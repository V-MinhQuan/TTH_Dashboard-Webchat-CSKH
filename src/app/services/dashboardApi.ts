import { DashboardKpiData, ChannelAnalyticsData, APIResponse } from "../types/dashboard";

// Lấy Base URL từ biến môi trường (Vite sử dụng import.meta.env)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const API_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 15000;
const configuredCacheTtl = Number(import.meta.env.VITE_API_CACHE_TTL_MS);
const API_CACHE_TTL_MS = Number.isFinite(configuredCacheTtl) && configuredCacheTtl > 0 ? configuredCacheTtl : 120000;
const API_CACHE_PREFIX = "flic_api_cache:v4:";

type CacheEntry<T> = {
  savedAt: number;
  value: T;
};

type DashboardKpiPayload = Partial<DashboardKpiData> & Record<string, any>;

const inFlightGetRequests = new Map<string, Promise<any>>();
const AUTH_STORAGE_KEY = "flic_dashboard_auth";

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const DEFAULT_STATUS_SUMMARY = {
  new: 0,
  open: 0,
  pending: 0,
  closed: 0,
  unknown: 0,
};

const DEFAULT_CHANNEL_SUMMARY = {
  ZaloOA: 0,
  ZaloBusiness: 0,
  Facebook: 0,
  ChatWidget: 0,
  other: 0,
};

const DEFAULT_TRENDS = {
  totalConversations: 0,
  totalMessages: 0,
  activeConversations: 0,
  closedConversations: 0,
  aiFailures: 0,
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeSourceKey(key: string): keyof typeof DEFAULT_CHANNEL_SUMMARY {
  const normalized = key.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "zalooa" || normalized === "zalo") return "ZaloOA";
  if (normalized === "zalobusiness" || normalized === "zalobiz") return "ZaloBusiness";
  if (normalized === "facebook" || normalized === "fb" || normalized === "messenger") return "Facebook";
  if (normalized === "chatwidget" || normalized === "website" || normalized === "web") return "ChatWidget";
  return "other";
}

export function formatChannelParam(channel: string): string {
  if (channel === "Zalo Business") return "ZaloBusiness";
  if (channel === "Zalo OA") return "ZaloOA";
  if (channel === "Chat Widget") return "ChatWidget";
  if (channel === "Facebook") return "Facebook";
  return channel;
}

function normalizeChannelSummary(value: unknown) {
  const summary = { ...DEFAULT_CHANNEL_SUMMARY };
  if (!value || typeof value !== "object") return summary;

  Object.entries(value as Record<string, unknown>).forEach(([key, rawValue]) => {
    const sourceKey = normalizeSourceKey(key);
    summary[sourceKey] += toNumber(rawValue);
  });

  return summary;
}

function normalizeStatusSummary(value: unknown) {
  const summary = { ...DEFAULT_STATUS_SUMMARY };
  if (!value || typeof value !== "object") return summary;

  Object.entries(value as Record<string, unknown>).forEach(([key, rawValue]) => {
    const statusKey = key.toLowerCase().trim();
    if (statusKey in summary) {
      summary[statusKey as keyof typeof summary] = toNumber(rawValue);
    }
  });

  return summary;
}

function normalizeDashboardKpiData(value: DashboardKpiPayload | null | undefined): DashboardKpiData {
  const raw: DashboardKpiPayload = value && typeof value === "object" ? value : {};
  const rawDateRange: Record<string, any> = raw.dateRange && typeof raw.dateRange === "object" ? raw.dateRange : {};
  const rawTrends: Record<string, any> = raw.trends && typeof raw.trends === "object" ? raw.trends : {};

  return {
    ...raw,
    totalConversations: toNumber(raw.totalConversations),
    totalMessages: toNumber(raw.totalMessages),
    newCustomers: toNumber(raw.newCustomers),
    aiFailures: toNumber(raw.aiFailures ?? raw.aiFailedCount),
    statusSummary: normalizeStatusSummary(raw.statusSummary),
    sourceSummary: normalizeChannelSummary(raw.sourceSummary),
    messageSummary: normalizeChannelSummary(raw.messageSummary),
    dateRange: {
      startDate: String(rawDateRange.startDate || ""),
      endDate: String(rawDateRange.endDate || ""),
    },
    trends: {
      ...DEFAULT_TRENDS,
      totalConversations: toNumber(rawTrends.totalConversations),
      totalMessages: toNumber(rawTrends.totalMessages),
      activeConversations: toNumber(rawTrends.activeConversations ?? rawTrends.pendingConversations),
      closedConversations: toNumber(rawTrends.closedConversations ?? rawTrends.completedConversations),
      aiFailures: toNumber(rawTrends.aiFailures ?? rawTrends.aiFailedCount),
    },
    averageResponseTimeMinutes: toNumber(raw.averageResponseTimeMinutes),
    urgentAlerts: Array.isArray(raw.urgentAlerts) ? raw.urgentAlerts : [],
    topQuestions: Array.isArray(raw.topQuestions) ? raw.topQuestions : [],
    priorityConversations: Array.isArray(raw.priorityConversations) ? raw.priorityConversations : [],
    dailyTrends: Array.isArray(raw.dailyTrends)
      ? raw.dailyTrends
      : Array.isArray(raw.trendData)
        ? raw.trendData
        : [],
  };
}

function getCacheStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(AUTH_STORAGE_KEY);
      if (!raw) continue;
      const token = JSON.parse(raw)?.user?.accessToken;
      if (typeof token === "string" && token.trim()) return token;
    } catch {
      // Ignore malformed or unavailable browser storage.
    }
  }
  return null;
}

function readCache<T>(key: string, allowExpired = false): T | null {
  const storage = getCacheStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(`${API_CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.savedAt !== "number") return null;
    if (!allowExpired && Date.now() - entry.savedAt > API_CACHE_TTL_MS) return null;
    return entry.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  const storage = getCacheStorage();
  if (!storage) return;

  try {
    storage.setItem(`${API_CACHE_PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Browser storage can be full or disabled; the network response is still usable.
  }
}

function clearApiCache() {
  const storage = getCacheStorage();
  if (!storage) return;

  try {
    Object.keys(storage)
      .filter((key) => key.startsWith(API_CACHE_PREFIX))
      .forEach((key) => storage.removeItem(key));
  } catch {
    // Best-effort cache cleanup.
  }
}

export function buildApiUrl(path: string, params?: URLSearchParams | Record<string, string | number | undefined | null>) {
  const url = new URL(path, API_BASE_URL);
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => url.searchParams.set(key, value));
  } else if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url;
}

export async function fetchApiJson<T>(
  urlInput: string | URL,
  options: Omit<RequestInit, "cache"> & { timeoutMs?: number; cache?: boolean } = {},
): Promise<T> {
  const url = urlInput.toString();
  const { timeoutMs, cache: cacheOption, ...fetchOptions } = options;
  const method = (fetchOptions.method || "GET").toUpperCase();
  const useCache = cacheOption !== false && method === "GET";
  const cacheKey = `${method}:${url}`;

  if (useCache) {
    const cached = readCache<T>(cacheKey);
    if (cached) return cached;

    const pending = inFlightGetRequests.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const controller = new AbortController();
  const timeoutValue = timeoutMs || API_TIMEOUT_MS;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutValue);

  const authToken = getAuthToken();
  const request = fetch(url, {
    ...fetchOptions,
    method,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(fetchOptions.headers || {}),
    },
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        const error = new ApiRequestError(
          payload?.message || payload?.detail || `API trả về lỗi ${response.status}.`,
          response.status,
        );
        if (response.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("flic:auth-expired", { detail: error.message }));
        }
        throw error;
      }
      if (useCache) writeCache(cacheKey, payload);
      return payload;
    })
    .catch((err: any) => {
      if (useCache && !(err instanceof ApiRequestError)) {
        const stale = readCache<T>(cacheKey, true);
        if (stale) return stale;
      }

      if (err?.name === "AbortError") {
        throw new Error(`Quá thời gian tải dữ liệu ${Math.round(timeoutValue / 1000)} giây. Vui lòng thử lại hoặc kiểm tra kết nối backend.`);
      }

      throw err;
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
      if (useCache) inFlightGetRequests.delete(cacheKey);
    });

  if (useCache) inFlightGetRequests.set(cacheKey, request);
  return request;
}


/**
 * Gọi API lấy dữ liệu KPI của Dashboard
 * @param params Bộ lọc thời gian startDate và endDate (định dạng YYYY-MM-DD)
 * @returns Trả về đối tượng dữ liệu KPI Dashboard
 */
export async function getDashboardKpi(params?: {
  startDate?: string;
  endDate?: string;
  channel?: string;
  topic?: string;
  conversationStatus?: string;
  aiStatus?: string;
}): Promise<DashboardKpiData> {
  const url = buildApiUrl("/api/dashboard/kpi");

  if (params?.startDate) {
    url.searchParams.append("startDate", params.startDate);
  }
  if (params?.endDate) {
    url.searchParams.append("endDate", params.endDate);
  }
  if (params?.channel && params.channel !== "Tất cả") {
    url.searchParams.append("channel", formatChannelParam(params.channel));
  }
  if (params?.topic && params.topic !== "Tất cả") {
    url.searchParams.append("topic", params.topic);
  }
  if (params?.conversationStatus && params.conversationStatus !== "Tất cả") {
    url.searchParams.append("conversationStatus", params.conversationStatus);
  }
  if (params?.aiStatus && params.aiStatus !== "Tất cả") {
    url.searchParams.append("aiStatus", params.aiStatus);
  }

  const resJson = await fetchApiJson<APIResponse<DashboardKpiPayload>>(url);

  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể tải dữ liệu Dashboard. Vui lòng kiểm tra lại cấu hình hoặc kết nối.");
  }

  return normalizeDashboardKpiData(resJson.data);
}

export async function getChannelAnalytics(params?: {
  startDate?: string;
  endDate?: string;
  channel?: string;
  topic?: string;
  conversationStatus?: string;
  aiStatus?: string;
}): Promise<ChannelAnalyticsData> {
  const url = buildApiUrl("/api/dashboard/channels");

  if (params?.startDate) {
    url.searchParams.append("startDate", params.startDate);
  }
  if (params?.endDate) {
    url.searchParams.append("endDate", params.endDate);
  }
  if (params?.channel && params.channel !== "Tất cả") {
    url.searchParams.append("channel", formatChannelParam(params.channel));
  }
  if (params?.topic && params.topic !== "Tất cả") {
    url.searchParams.append("topic", params.topic);
  }
  if (params?.conversationStatus && params.conversationStatus !== "Tất cả") {
    url.searchParams.append("conversationStatus", params.conversationStatus);
  }
  if (params?.aiStatus && params.aiStatus !== "Tất cả") {
    url.searchParams.append("aiStatus", params.aiStatus);
  }

  const resJson = await fetchApiJson<APIResponse<ChannelAnalyticsData>>(url);

  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể tải dữ liệu phân tích kênh.");
  }

  return resJson.data;
}

/**
 * Gọi API đóng cuộc hội thoại (đánh dấu là đã xử lý)
 * @param customerId ID của khách hàng
 * @param source Nguồn kênh của cuộc hội thoại
 */
export async function closeConversation(customerId: string, source: string): Promise<boolean> {
  const resJson = await fetchApiJson<{ success: boolean; message?: string }>(
    buildApiUrl("/api/conversations/close"),
    {
      method: "POST",
      cache: false,
      body: JSON.stringify({ customerId, source }),
    },
  );
  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể cập nhật trạng thái cuộc hội thoại.");
  }

  clearApiCache();
  return true;
}

export async function getProfile(username: string) {
  const response = await fetchApiJson<{ success: boolean; data: Record<string, any>; message?: string }>(
    buildApiUrl("/api/settings/profile", { username }),
    { cache: false },
  );
  return response.data;
}

export async function updateProfile(payload: { username: string; name: string; email: string; phone: string }) {
  const response = await fetchApiJson<{ success: boolean; data: Record<string, any>; message?: string }>(
    buildApiUrl("/api/settings/profile"),
    { method: "PUT", cache: false, body: JSON.stringify(payload) },
  );
  return response.data;
}

export async function requestPasswordChange(payload: { username: string; currentPassword: string }) {
  return fetchApiJson<{ success: boolean; message?: string }>(
    buildApiUrl("/api/settings/profile/change-password/request"),
    { method: "POST", cache: false, body: JSON.stringify(payload) },
  );
}

export async function confirmPasswordChange(payload: { username: string; otp: string; newPassword: string }) {
  return fetchApiJson<{ success: boolean; message?: string }>(
    buildApiUrl("/api/settings/profile/change-password/confirm"),
    { method: "POST", cache: false, body: JSON.stringify(payload) },
  );
}

/**
 * Lấy danh sách tất cả người dùng từ database
 */
export async function getAllUsers(): Promise<any[]> {
  const url = buildApiUrl("/api/settings/users");
  const resJson = await fetchApiJson<{ success: boolean; data: any[]; message?: string }>(url, { cache: false });
  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể tải danh sách người dùng.");
  }
  return resJson.data;
}

export async function getSettings(): Promise<Record<string, any>> {
  const resJson = await fetchApiJson<{ success: boolean; data: Record<string, any>; message?: string }>(
    buildApiUrl("/api/settings"),
    { cache: false },
  );
  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể tải cấu hình hệ thống.");
  }
  return resJson.data;
}

export async function updateSettings(payload: Record<string, any>): Promise<Record<string, any>> {
  const resJson = await fetchApiJson<{ success: boolean; data: Record<string, any>; message?: string }>(
    buildApiUrl("/api/settings"),
    {
      method: "PUT",
      cache: false,
      body: JSON.stringify(payload),
    },
  );
  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể lưu cấu hình hệ thống.");
  }
  clearApiCache();
  return resJson.data;
}

export async function createSettingsUser(payload: {
  username: string;
  password: string;
  name: string;
  email?: string;
  phone?: string;
  active?: boolean;
}) {
  const resJson = await fetchApiJson<{ success: boolean; data: any; message?: string }>(
    buildApiUrl("/api/settings/users"),
    {
      method: "POST",
      cache: false,
      body: JSON.stringify(payload),
    },
  );
  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể tạo người dùng.");
  }
  clearApiCache();
  return resJson.data;
}

export async function updateSettingsUserStatus(username: string, active: boolean) {
  const resJson = await fetchApiJson<{ success: boolean; data: any; message?: string }>(
    buildApiUrl(`/api/settings/users/${encodeURIComponent(username)}/status`),
    {
      method: "PATCH",
      cache: false,
      body: JSON.stringify({ active }),
    },
  );
  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể cập nhật trạng thái người dùng.");
  }
  clearApiCache();
  return resJson.data;
}

export async function resetSettingsUserPassword(username: string, newPassword?: string) {
  const resJson = await fetchApiJson<{ success: boolean; data: { temporaryPassword: string }; message?: string }>(
    buildApiUrl(`/api/settings/users/${encodeURIComponent(username)}/reset-password`),
    {
      method: "POST",
      cache: false,
      body: JSON.stringify({ newPassword }),
    },
  );
  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể reset mật khẩu người dùng.");
  }
  clearApiCache();
  return resJson.data;
}
