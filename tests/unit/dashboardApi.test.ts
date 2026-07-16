import { afterEach, describe, expect, it, vi } from "vitest";

import { getDashboardKpi } from "../../src/app/services/dashboardApi";


describe("dashboard KPI integrity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("rejects a nominally successful KPI payload when the required summary branch failed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          totalConversations: 0,
          totalMessages: 0,
          partialErrors: [
            { branch: "summary", message: "database unavailable" },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDashboardKpi({ forceRefresh: true })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not silently turn an omitted date range into an all-time request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { totalConversations: 2905, totalMessages: 44543, partialErrors: [] },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getDashboardKpi({ forceRefresh: true });

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).not.toContain("dateRange=all_time");
  });
});
