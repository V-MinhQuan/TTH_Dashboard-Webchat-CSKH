import { expect, Page, test } from "@playwright/test";
import { injectAuth } from "./fixtures/auth";

test.describe("Customer interview round 3", () => {
  test("Sentiment supports page selection, exact bulk confirmation, submit guard, and refresh", async ({ page }) => {
    const bulkRequests: unknown[] = [];
    let negativeConversationLoads = 0;

    await injectAuth(page, "sentiment");
    await mockSentimentRound3Api(page, bulkRequests, () => {
      negativeConversationLoads += 1;
    });
    await page.goto("/");

    await expect(page.getByText("Nguyễn Minh Anh", { exact: true })).toBeVisible();
    await expect(page.getByText("KH ••••7890", { exact: true })).toBeVisible();
    await expect(page.getByText("Dự báo xu hướng cảm xúc", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Khuyến nghị cải thiện", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Từ khóa gây cảm xúc tiêu cực", { exact: true })).toBeVisible();

    await page.getByLabel("Chọn tất cả hội thoại trên trang").check();
    const bulkBar = page.getByRole("toolbar", { name: "Thao tác hàng loạt" });
    await expect(bulkBar).toContainText("Đã chọn 2 hội thoại");
    await bulkBar.getByRole("button", { name: "Đánh dấu đã xử lý 2 hội thoại" }).click();

    const dialog = page.getByRole("dialog", { name: "Xác nhận đánh dấu đã xử lý" });
    await expect(dialog).toContainText("chính xác 2 hội thoại");
    const confirm = dialog.getByRole("button", { name: "Xác nhận xử lý 2 hội thoại" });
    await confirm.dblclick();

    await expect.poll(() => bulkRequests.length).toBe(1);
    expect(bulkRequests[0]).toEqual({ conversationIds: [101, 102] });

    const beforeRefresh = negativeConversationLoads;
    await page.getByRole("button", { name: "Làm mới danh sách hội thoại tiêu cực" }).click();
    await expect.poll(() => negativeConversationLoads).toBeGreaterThan(beforeRefresh);
  });

  test("AI Insights provides Top N topic drilldown, classification, related conversations, and export menu", async ({ page }) => {
    const requestedPaths: string[] = [];
    await injectAuth(page, "aiinsights");
    await mockAiInsightsRound3Api(page, requestedPaths);
    await page.goto("/");

    await expect(page.getByRole("combobox", { name: "Số chủ đề hiển thị" })).toHaveValue("5");
    await expect(page.getByRole("button", { name: "Xem chi tiết chủ đề TOEIC" })).toBeVisible();
    await page.getByRole("button", { name: "Xem chi tiết chủ đề TOEIC" }).click();

    await expect(page.getByRole("heading", { name: "Chi tiết chủ đề: TOEIC" })).toBeVisible();
    const classification = page.getByRole("table", { name: "Phân loại lỗi của chủ đề TOEIC" });
    await expect(classification).toContainText("Không tìm thấy dữ liệu");
    await expect(classification).toContainText("4");
    await expect(classification).toContainText("AI không chắc chắn");
    await expect(classification).not.toContainText("AI có nguy cơ tự tạo thông tin");
    await expect(classification).not.toContainText("Câu hỏi ngoài phạm vi");

    const related = page.getByRole("region", { name: "Hội thoại liên quan đến chủ đề TOEIC" });
    await expect(related).toContainText("Trần Hải Yến");
    await expect(related).toContainText("KH ••••4321");

    await page.getByRole("button", { name: "Mở menu xuất dữ liệu" }).click();
    const exportMenu = page.getByRole("menu", { name: "Định dạng xuất dữ liệu" });
    await expect(exportMenu.getByRole("menuitem", { name: "Xuất CSV" })).toBeVisible();
    await expect(exportMenu.getByRole("menuitem", { name: "Xuất JSON" })).toBeVisible();

    expect(requestedPaths).toEqual(expect.arrayContaining([
      "/api/analytics/ai/failure-by-topic",
      "/api/analytics/ai/failed-conversations",
    ]));
  });
});

async function mockSentimentRound3Api(
  page: Page,
  bulkRequests: unknown[],
  onNegativeConversationLoad: () => void,
) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/conversations/bulk-close") {
      bulkRequests.push(JSON.parse(request.postData() || "{}"));
      await new Promise((resolve) => setTimeout(resolve, 120));
      return route.fulfill(json({ success: true, data: { requested: 2, affected: 2, alreadyClosed: 0 } }));
    }
    if (pathname === "/api/analytics/sentiment-summary") {
      return route.fulfill(json({ success: true, data: { summary: { positive: 3, neutral: 6, negative: 1, total: 10 }, avgSatisfaction: 4.2 } }));
    }
    if (pathname === "/api/analytics/sentiment-trend") {
      return route.fulfill(json({ success: true, data: [{ date: "2026-06-19", positive: 3, neutral: 6, negative: 1 }] }));
    }
    if (pathname === "/api/analytics/topics") {
      return route.fulfill(json({ success: true, data: [{ topicLabel: "Lệ phí", positive: 3, neutral: 6, negative: 1, count: 10 }] }));
    }
    if (pathname === "/api/analytics/negative-keywords") {
      return route.fulfill(json({ success: true, data: [{ keyword: "chậm", count: 3, topicLabel: "Hỗ trợ" }] }));
    }
    if (pathname === "/api/analytics/negative-conversations") {
      onNegativeConversationLoad();
      return route.fulfill(json({
        success: true,
        data: {
          records: [
            negativeConversation(101, "m-1", "customer-00001234", "ZaloBusiness", "Nguyễn Minh Anh"),
            negativeConversation(102, "m-2", "customer-00007890", "ChatWidget", null),
          ],
          pagination: { page: 1, pageSize: 20, total: 2 },
        },
      }));
    }
    return route.fulfill(json({ success: true, data: [] }));
  });
}

async function mockAiInsightsRound3Api(page: Page, requestedPaths: string[]) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    requestedPaths.push(pathname);

    const payloads: Record<string, unknown> = {
      "/api/analytics/ai/quality-metrics": { total_messages: 20, success_rate: 75, failure_count: 5, hallucination_count: 1, avg_confidence: 62 },
      "/api/analytics/ai/staff-activity": { reported_errors: 2, pending_review: 1 },
      "/api/analytics/ai/failure-trend": [{ date: "2026-06-19", failure: 5, hallucination: 1, uncertain: 2 }],
      "/api/analytics/ai/failure-by-topic": [
        { topic: "TOEIC", thieuDL: 4, khongHieu: 0, khongChac: 2, ngoaiPhamVi: 1, hallucination: 1 },
        { topic: "Lệ phí", thieuDL: 99, khongHieu: 0, khongChac: 99, ngoaiPhamVi: 0, hallucination: 0 },
        { topic: "Lịch thi", thieuDL: 3, khongHieu: 0, khongChac: 1, ngoaiPhamVi: 0, hallucination: 0 },
        { topic: "MOS", thieuDL: 2, khongHieu: 0, khongChac: 1, ngoaiPhamVi: 0, hallucination: 0 },
        { topic: "Học Tiếng Anh", thieuDL: 2, khongHieu: 0, khongChac: 0, ngoaiPhamVi: 0, hallucination: 0 },
        { topic: "Sát hạch CNTT (Sát hạch Công nghệ thông tin)", thieuDL: 1, khongHieu: 0, khongChac: 0, ngoaiPhamVi: 0, hallucination: 0 },
      ],
      "/api/analytics/ai/failed-conversations": {
        records: [
          failedConversation("ai-1", "TOEIC", "customer-00009999", "Trần Hải Yến"),
          failedConversation("ai-2", "TOEIC", "customer-00004321", null),
          failedConversation("ai-3", "Lịch thi", "customer-00005555", null),
        ],
        pagination: { page: 1, pageSize: 100, total: 3 },
      },
      "/api/analytics/ai/staff-reported-errors": { records: [], pagination: { page: 1, pageSize: 20, total: 0 } },
      "/api/analytics/ai/suggested-faqs": [],
    };

    if (pathname === "/api/admin/sheet-chatbot") {
      return route.fulfill(json({ success: true, data: [], total: 0, page: 1, pageSize: 5, stats: { total: 0, pending: 0, approved: 0 } }));
    }
    return route.fulfill(json({ success: true, data: payloads[pathname] ?? [] }));
  });
}

function negativeConversation(conversationId: number, messageId: string, customerId: string, source: string, customerName: string | null) {
  return {
    conversationId,
    messageId,
    customerId,
    customerName,
    source,
    textContent: "Tôi đã chờ quá lâu nhưng chưa được hỗ trợ.",
    detectedTopics: ["Hỗ trợ"],
    sentimentLabel: "negative",
    sentimentScore: 0.15,
    needStaffReview: true,
    messageAt: "2026-06-19T08:00:00Z",
  };
}

function failedConversation(id: string, topic: string, customerId: string, customerName: string | null) {
  return {
    id,
    customerId,
    customerName,
    source: "ZaloBusiness",
    textContent: `Câu hỏi liên quan đến ${topic}`,
    aiAnswer: "AI chưa có câu trả lời phù hợp.",
    detectedTopics: [topic],
    issueType: "Không tìm thấy dữ liệu",
    issueReason: "Thiếu nội dung tri thức.",
    issueConfidence: 0.35,
    needStaffReview: true,
    messageAt: "2026-06-19T08:00:00Z",
  };
}

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  };
}
