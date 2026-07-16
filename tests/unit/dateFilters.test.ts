import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFilterValues } from "../../src/app/context/GlobalFilterContext";
import {
  analyticsFiltersToSearchParams,
  getDateParamsFromFilters,
  mapGlobalFiltersToAnalyticsRequest,
  normalizeDateForApi,
} from "../../src/app/utils/dateFilters";

describe("date filter mapping", () => {
  afterEach(() => vi.useRealTimers());

  it("maps the default 30-day range to explicit dates and enables period comparison", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 16, 12, 0, 0));

    expect(defaultFilterValues.dateRange).toBe("30 ngày qua");
    expect(getDateParamsFromFilters(defaultFilterValues)).toEqual({
      startDate: "2026-06-16",
      endDate: "2026-07-16",
    });
    expect(analyticsFiltersToSearchParams(defaultFilterValues).toString()).toBe(
      "startDate=2026-06-16&endDate=2026-07-16",
    );
  });

  it("normalizes Vietnamese custom date strings without timezone drift", () => {
    expect(normalizeDateForApi("23/01/2024 07:07 CH")).toBe("2024-01-23");
    expect(normalizeDateForApi("23/01/2024 07:07 SA")).toBe("2024-01-23");
  });

  it("rejects invalid or inverted custom ranges before API calls", () => {
    expect(() => normalizeDateForApi("31/02/2024 07:07 CH")).toThrow("Ngay khong ton tai");
    expect(() => getDateParamsFromFilters({
      ...defaultFilterValues,
      dateRange: "Tùy chỉnh",
      customDateFrom: "24/01/2024 07:07 CH",
      customDateTo: "23/01/2024 07:07 CH",
    })).toThrow("Ngay bat dau phai truoc hoac bang ngay ket thuc");
  });

  it("maps global filters to the analytics API contract", () => {
    expect(mapGlobalFiltersToAnalyticsRequest({
      ...defaultFilterValues,
      dateRange: "Tùy chỉnh",
      customDateFrom: "23/01/2024 07:07 CH",
      customDateTo: "24/01/2024 08:00 SA",
      channel: "Facebook",
      topic: "TOEIC",
      conversationStatus: "Chờ xử lý",
      aiStatus: "AI trả lời thất bại",
      aiFailureType: "AI không chắc chắn",
    })).toEqual({
      startDate: "2024-01-23",
      endDate: "2024-01-24",
      channel: "Facebook",
      topic: "TOEIC",
    });

    expect(mapGlobalFiltersToAnalyticsRequest({
      ...defaultFilterValues,
      aiStatus: "AI trả lời thành công",
    })).not.toHaveProperty("aiStatus");
  });
});
