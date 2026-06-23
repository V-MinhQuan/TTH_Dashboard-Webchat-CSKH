import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportFailedConversationsCsv } from "../../src/app/services/round3Api";

describe("round3Api export", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads CSV from the backend export endpoint with the current filters", async () => {
    const csv = "\ufeffSTT,Message ID\r\n1,\t000000000001\r\n";
    fetchMock.mockResolvedValue(new Response(csv, {
      status: 200,
      headers: {
        "Content-Disposition": "attachment; filename*=UTF-8''cau-hoi-ai-chua-xu-ly-test.csv",
        "X-Total-Records": "1",
        "Content-Type": "text/csv; charset=utf-8",
      },
    }));

    const result = await exportFailedConversationsCsv(new URLSearchParams({
      startDate: "2024-01-23",
      endDate: "2026-06-23",
      aiStatus: "failed",
    }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:5000/api/analytics/ai/failed-conversations/export?startDate=2024-01-23&endDate=2026-06-23&aiStatus=failed",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.filename).toBe("cau-hoi-ai-chua-xu-ly-test.csv");
    expect(result.totalRecords).toBe(1);
    expect(await result.blob.text()).toContain("Message ID");
  });

  it("surfaces HTTP status instead of downloading an error body", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: "Export vượt quá giới hạn an toàn.",
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(exportFailedConversationsCsv(new URLSearchParams())).rejects.toMatchObject({
      status: 400,
      message: "Export vượt quá giới hạn an toàn.",
    });
  });
});
