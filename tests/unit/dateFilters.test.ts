import { describe, expect, it } from "vitest";

import { defaultFilterValues } from "../../src/app/context/GlobalFilterContext";
import {
  getDateParamsFromFilters,
  mapGlobalFiltersToAnalyticsRequest,
  normalizeDateForApi,
} from "../../src/app/utils/dateFilters";

describe("date filter mapping", () => {
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
      conversationStatus: "Chờ xử lý",
      aiStatus: "failed",
    });

    expect(mapGlobalFiltersToAnalyticsRequest({
      ...defaultFilterValues,
      aiStatus: "AI trả lời thành công",
    })).toMatchObject({ aiStatus: "success" });
  });
});
