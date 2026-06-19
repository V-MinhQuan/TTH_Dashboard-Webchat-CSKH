export interface DateFilterInput {
  dateRange: string;
  customDateFrom?: string;
  customDateTo?: string;
}

export function formatApiDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDateParamsFromFilters(filters: DateFilterInput): { startDate?: string; endDate?: string } {
  const today = new Date();

  if (filters.dateRange === "Hôm nay") {
    const dateStr = formatApiDate(today);
    return { startDate: dateStr, endDate: dateStr };
  }

  if (filters.dateRange === "7 ngày qua") {
    const start = new Date(today);
    start.setDate(today.getDate() - 7);
    return { startDate: formatApiDate(start), endDate: formatApiDate(today) };
  }

  if (filters.dateRange === "30 ngày qua") {
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { startDate: formatApiDate(start), endDate: formatApiDate(today) };
  }

  if (filters.dateRange === "Tháng này") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: formatApiDate(start), endDate: formatApiDate(today) };
  }

  if (filters.dateRange === "Quý này") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const start = new Date(today.getFullYear(), quarterStartMonth, 1);
    return { startDate: formatApiDate(start), endDate: formatApiDate(today) };
  }

  if (filters.dateRange === "Tùy chỉnh" && filters.customDateFrom && filters.customDateTo) {
    return {
      startDate: formatApiDate(new Date(filters.customDateFrom)),
      endDate: formatApiDate(new Date(filters.customDateTo)),
    };
  }

  return {};
}
