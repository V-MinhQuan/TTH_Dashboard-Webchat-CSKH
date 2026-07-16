import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  defaultFilterValues,
  GlobalFilterProvider,
  useGlobalFilters,
} from "../../src/app/context/GlobalFilterContext";

describe("GlobalFilterContext", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps draft and applied filters separate and persists them for a reload", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    );
    const { result, unmount } = renderHook(() => useGlobalFilters(), { wrapper });

    act(() => result.current.updateDraft({ channel: "Facebook" }));
    expect(result.current.draftFilters.channel).toBe("Facebook");
    expect(result.current.appliedFilters.channel).toBe("Tất cả");

    act(() => result.current.applyDraft());
    expect(result.current.appliedFilters.channel).toBe("Facebook");
    unmount();

    const restored = renderHook(() => useGlobalFilters(), { wrapper });
    expect(restored.result.current.draftFilters.channel).toBe("Facebook");
    expect(restored.result.current.appliedFilters.channel).toBe("Facebook");
  });

  it("resets only when explicitly requested", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    );
    const { result } = renderHook(() => useGlobalFilters(), { wrapper });

    act(() => result.current.applyFilters({ ...result.current.appliedFilters, topic: "TOEIC" }));
    expect(result.current.appliedFilters.topic).toBe("TOEIC");

    act(() => result.current.resetFilters());
    expect(result.current.appliedFilters.topic).toBe("Tất cả");
    expect(result.current.draftFilters.topic).toBe("Tất cả");
    expect(result.current.appliedFilters.dateRange).toBe("30 ngày qua");
    expect(result.current.draftFilters.dateRange).toBe("30 ngày qua");
  });

  it("defaults new sessions to the last 30 days", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    );

    const { result } = renderHook(() => useGlobalFilters(), { wrapper });

    expect(defaultFilterValues.dateRange).toBe("30 ngày qua");
    expect(result.current.draftFilters.dateRange).toBe("30 ngày qua");
    expect(result.current.appliedFilters.dateRange).toBe("30 ngày qua");
  });

  it("normalizes removed status and date-range filters restored from storage", () => {
    sessionStorage.setItem("flic_dashboard_filters:v1", JSON.stringify({
      draftFilters: { ...defaultFilterValues, dateRange: "Tháng này", channel: "Facebook", topic: "TOEIC", conversationStatus: "Chờ xử lý", aiStatus: "AI không chắc chắn" },
      appliedFilters: { ...defaultFilterValues, dateRange: "Quý này", channel: "Zalo OA", topic: "MOS", conversationStatus: "Hoàn thành", aiStatus: "uncertain" },
    }));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    );

    const { result } = renderHook(() => useGlobalFilters(), { wrapper });

    expect(result.current.draftFilters.aiStatus).toBe(defaultFilterValues.aiStatus);
    expect(result.current.appliedFilters.aiStatus).toBe(defaultFilterValues.aiStatus);
    expect(result.current.draftFilters.conversationStatus).toBe(defaultFilterValues.conversationStatus);
    expect(result.current.appliedFilters.conversationStatus).toBe(defaultFilterValues.conversationStatus);
    expect(result.current.draftFilters.dateRange).toBe("30 ngày qua");
    expect(result.current.appliedFilters.dateRange).toBe("30 ngày qua");
    expect(result.current.draftFilters.channel).toBe("Facebook");
    expect(result.current.appliedFilters.channel).toBe("Zalo OA");
    expect(result.current.draftFilters.topic).toBe("TOEIC");
    expect(result.current.appliedFilters.topic).toBe("MOS");
    expect(sessionStorage.getItem("flic_dashboard_filters:v2")).not.toBeNull();
    expect(sessionStorage.getItem("flic_dashboard_filters:v1")).toBeNull();
  });

  it("normalizes a persisted v2 all-time value without losing channel and topic", () => {
    sessionStorage.setItem("flic_dashboard_filters:v2", JSON.stringify({
      draftFilters: {
        dateRange: "Toàn bộ dữ liệu",
        customDateFrom: "2024-01-01",
        customDateTo: "2026-07-15",
        channel: "Facebook",
        topic: "TOEIC",
        conversationStatus: "Chờ xử lý",
        aiStatus: "AI không chắc chắn",
      },
      appliedFilters: {
        dateRange: "all_time",
        channel: "Zalo OA",
        topic: "VSTEP",
        conversationStatus: "Hoàn thành",
        aiStatus: "AI trả lời thất bại",
      },
    }));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    );

    const { result } = renderHook(() => useGlobalFilters(), { wrapper });

    expect(result.current.draftFilters).toEqual(expect.objectContaining({
      dateRange: "30 ngày qua",
      channel: "Facebook",
      topic: "TOEIC",
      conversationStatus: "Tất cả",
      aiStatus: "Tất cả",
    }));
    expect(result.current.appliedFilters).toEqual(expect.objectContaining({
      dateRange: "30 ngày qua",
      channel: "Zalo OA",
      topic: "VSTEP",
      conversationStatus: "Tất cả",
      aiStatus: "Tất cả",
    }));
    expect(result.current.draftFilters).not.toHaveProperty("customDateFrom");
    expect(result.current.draftFilters).not.toHaveProperty("customDateTo");
    const persisted = JSON.parse(sessionStorage.getItem("flic_dashboard_filters:v2") || "{}");
    expect(persisted.draftFilters.dateRange).toBe("30 ngày qua");
    expect(persisted.appliedFilters.dateRange).toBe("30 ngày qua");
    expect(persisted.draftFilters).not.toHaveProperty("customDateFrom");
    expect(persisted.draftFilters).not.toHaveProperty("customDateTo");
  });

  it("normalizes removed AI fields out of global filters", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    );
    const { result } = renderHook(() => useGlobalFilters(), { wrapper });

    act(() => result.current.applyFilters({
      ...defaultFilterValues,
      aiStatus: "AI trả lời thất bại",
      aiFailureType: "AI không chắc chắn",
    }));
    expect(result.current.appliedFilters.aiStatus).toBe(defaultFilterValues.aiStatus);
    expect(result.current.appliedFilters.aiFailureType).toBe(defaultFilterValues.aiFailureType);

    act(() => result.current.updateDraft({ aiStatus: "AI trả lời thành công" }));
    expect(result.current.draftFilters.aiStatus).toBe(defaultFilterValues.aiStatus);
    expect(result.current.draftFilters.aiFailureType).toBe(defaultFilterValues.aiFailureType);
  });
});
