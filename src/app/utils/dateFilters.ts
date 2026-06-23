import type { FilterValues } from "../context/GlobalFilterContext";
import { formatChannelParam } from "../services/dashboardApi";

export interface DateFilterInput {
  dateRange: string;
  customDateFrom?: string | Date | null;
  customDateTo?: string | Date | null;
}

export type AnalyticsAiStatus = "success" | "failed";

export interface AnalyticsApiFilters {
  startDate?: string;
  endDate?: string;
  channel?: string;
  topic?: string;
  conversationStatus?: string;
  aiStatus?: AnalyticsAiStatus;
}

function normalizedText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesAny(value: unknown, candidates: readonly string[]) {
  const normalized = normalizedText(value);
  return candidates.some((candidate) => normalized === normalizedText(candidate));
}

export function parseVietnameseDateString(input: string): Date {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    throw new Error("Ngay khong duoc de trong.");
  }

  const isoDate = normalizedInput.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoDate) {
    return buildLocalDate(
      Number(isoDate[1]),
      Number(isoDate[2]),
      Number(isoDate[3]),
      Number(isoDate[4] ?? 0),
      Number(isoDate[5] ?? 0),
      Number(isoDate[6] ?? 0),
    );
  }

  const viDate = normalizedInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(SA|CH|AM|PM))?)?$/i);
  if (!viDate) {
    throw new Error("Ngay khong dung dinh dang DD/MM/YYYY.");
  }

  const [, day, month, year, rawHour = "0", rawMinute = "0", rawSecond = "0", meridiem = ""] = viDate;
  let hour = Number(rawHour);
  const marker = meridiem.toUpperCase();
  if ((marker === "CH" || marker === "PM") && hour < 12) {
    hour += 12;
  }
  if ((marker === "SA" || marker === "AM") && hour === 12) {
    hour = 0;
  }

  return buildLocalDate(Number(year), Number(month), Number(day), hour, Number(rawMinute), Number(rawSecond));
}

function buildLocalDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    throw new Error("Ngay khong hop le.");
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second;

  if (!isValid) {
    throw new Error("Ngay khong ton tai.");
  }

  return date;
}

function parseDateInput(value: Date | string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : parseVietnameseDateString(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Ngay khong hop le.");
  }
  return date;
}

export function formatLocalDateForApi(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new Error("Ngay khong hop le.");
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeDateForApi(value: Date | string): string {
  return formatLocalDateForApi(parseDateInput(value));
}

function isAllValue(value: unknown) {
  return matchesAny(value, ["Tat ca", "Tất cả", "Táº¥t cáº£", "all", ""]);
}

function mapAiStatusForAnalytics(value: unknown): AnalyticsAiStatus | undefined {
  const normalized = normalizedText(value);
  if (!normalized || isAllValue(value)) return undefined;
  if (
    normalized === "success" ||
    normalized.includes("thanh cong") ||
    normalized.includes("thanh c")
  ) {
    return "success";
  }
  if (
    normalized === "failed" ||
    normalized === "failure" ||
    normalized.includes("that bai") ||
    normalized.includes("thất bại") ||
    normalized.includes("tháº¥t b")
  ) {
    return "failed";
  }
  return undefined;
}

export function getDateParamsFromFilters(filters: DateFilterInput): { startDate?: string; endDate?: string } {
  const today = new Date();

  if (matchesAny(filters.dateRange, ["Hom nay", "Hôm nay", "HÃ´m nay"])) {
    const dateStr = formatLocalDateForApi(today);
    return { startDate: dateStr, endDate: dateStr };
  }

  if (matchesAny(filters.dateRange, ["7 ngay qua", "7 ngày qua", "7 ngÃ y qua"])) {
    const start = new Date(today);
    start.setDate(today.getDate() - 7);
    return { startDate: formatLocalDateForApi(start), endDate: formatLocalDateForApi(today) };
  }

  if (matchesAny(filters.dateRange, ["30 ngay qua", "30 ngày qua", "30 ngÃ y qua"])) {
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { startDate: formatLocalDateForApi(start), endDate: formatLocalDateForApi(today) };
  }

  if (matchesAny(filters.dateRange, ["Thang nay", "Tháng này", "ThÃ¡ng nÃ y"])) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: formatLocalDateForApi(start), endDate: formatLocalDateForApi(today) };
  }

  if (matchesAny(filters.dateRange, ["Quy nay", "Quý này", "QuÃ½ nÃ y"])) {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const start = new Date(today.getFullYear(), quarterStartMonth, 1);
    return { startDate: formatLocalDateForApi(start), endDate: formatLocalDateForApi(today) };
  }

  if (matchesAny(filters.dateRange, ["Tuy chinh", "Tùy chỉnh", "TÃ¹y chá»‰nh"])) {
    if (!filters.customDateFrom || !filters.customDateTo) return {};
    const start = parseDateInput(filters.customDateFrom);
    const end = parseDateInput(filters.customDateTo);
    if (start.getTime() > end.getTime()) {
      throw new Error("Ngay bat dau phai truoc hoac bang ngay ket thuc.");
    }
    return { startDate: formatLocalDateForApi(start), endDate: formatLocalDateForApi(end) };
  }

  return {};
}

export function mapGlobalFiltersToAnalyticsRequest(filters: FilterValues): AnalyticsApiFilters {
  const dateParams = getDateParamsFromFilters(filters);
  const request: AnalyticsApiFilters = { ...dateParams };

  if (filters.channel && !isAllValue(filters.channel)) {
    request.channel = formatChannelParam(filters.channel);
  }
  if (filters.topic && !isAllValue(filters.topic)) {
    request.topic = filters.topic;
  }
  if (filters.conversationStatus && !isAllValue(filters.conversationStatus)) {
    request.conversationStatus = filters.conversationStatus;
  }

  const aiStatus = mapAiStatusForAnalytics(filters.aiStatus);
  if (aiStatus) {
    request.aiStatus = aiStatus;
  }

  return request;
}

export function analyticsFiltersToSearchParams(filters: FilterValues): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(mapGlobalFiltersToAnalyticsRequest(filters)).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return params;
}
