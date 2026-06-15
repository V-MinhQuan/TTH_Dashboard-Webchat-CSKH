import { DashboardKpiData, ChannelAnalyticsData, APIResponse } from "../types/dashboard";

// Lấy Base URL từ biến môi trường (Vite sử dụng import.meta.env)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const API_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 5000;
const configuredCacheTtl = Number(import.meta.env.VITE_API_CACHE_TTL_MS);
const API_CACHE_TTL_MS = Number.isFinite(configuredCacheTtl) && configuredCacheTtl > 0 ? configuredCacheTtl : 120000;
const API_CACHE_PREFIX = "flic_api_cache:";

type CacheEntry<T> = {
  savedAt: number;
  value: T;
};

const inFlightGetRequests = new Map<string, Promise<any>>();

function getCacheStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
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
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs || API_TIMEOUT_MS);

  const request = fetch(url, {
    ...fetchOptions,
    method,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    },
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `API trả về lỗi ${response.status}.`);
      }

      if (useCache) writeCache(cacheKey, payload);
      return payload as T;
    })
    .catch((err: any) => {
      if (useCache) {
        const stale = readCache<T>(cacheKey, true);
        if (stale) return stale;
      }

      if (err?.name === "AbortError") {
        throw new Error("Quá thời gian tải dữ liệu 5 giây. Vui lòng thử lại hoặc kiểm tra kết nối backend.");
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
    url.searchParams.append("channel", params.channel);
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

  const resJson = await fetchApiJson<APIResponse<DashboardKpiData>>(url);

  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể tải dữ liệu Dashboard. Vui lòng kiểm tra lại cấu hình hoặc kết nối.");
  }

  return resJson.data;
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
    url.searchParams.append("channel", params.channel);
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
  const response = await fetch(`${API_BASE_URL}/api/conversations/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ customerId, source })
  });

  const resJson: { success: boolean; message?: string } = await response.json();

  if (!response.ok || !resJson.success) {
    throw new Error(resJson.message || "Không thể cập nhật trạng thái cuộc hội thoại.");
  }

  clearApiCache();
  return true;
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
