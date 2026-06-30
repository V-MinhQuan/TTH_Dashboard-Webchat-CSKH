import { expect, Page, test } from "@playwright/test";
import { injectAuth } from "./fixtures/auth";

test.describe("AI insights và thư viện phản hồi", () => {
  test("AI Insights hiển thị hội thoại lỗi và chuyển ngữ cảnh vào form phản hồi", async ({ page }) => {
    const createdRows: unknown[] = [];
    await injectAuth(page, "aiinsights");
    await mockAiInsightsApi(page, createdRows);

    await page.goto("/");

    const failedRow = page.getByRole("row", { name: /Lịch thi gần nhất là ngày nào\?.*AI có nguy cơ tự tạo thông tin/ });
    await expect(failedRow.getByText("Nguyễn Minh Anh", { exact: true })).toBeVisible();
    await expect(failedRow.getByText("customer-00001234", { exact: true })).toBeVisible();
    await expect(failedRow.getByText("AI có nguy cơ tự tạo thông tin", { exact: true })).toBeVisible();

    await failedRow.getByRole("button", { name: "Thêm FAQ" }).click();
    const modal = page.getByRole("dialog", { name: "Thêm phản hồi" });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Nguồn")).toHaveValue("Khác");
    await expect(modal.getByLabel("Câu hỏi khách hàng")).toHaveValue("Lịch thi gần nhất là ngày nào?");
    await expect(modal.getByLabel("Câu trả lời đúng")).toHaveValue("");
    await expect(modal.getByLabel("Ghi chú nội bộ")).toHaveValue(/AI khẳng định lịch thi diễn ra ngày 30\/06\./);

    await modal.getByLabel("Câu trả lời đúng").fill("Vui lòng xem lịch thi đã được FLIC công bố chính thức.");
    await modal.getByRole("button", { name: "Lưu phản hồi" }).click();

    await expect.poll(() => createdRows.length).toBe(1);
    expect(createdRows[0]).toMatchObject({
      source: "Khác",
      notes: expect.stringContaining("AI khẳng định lịch thi diễn ra ngày 30/06."),
    });
  });

  test("Thư viện phản hồi dùng taxonomy chuẩn và cập nhật ngay sau khi tạo", async ({ page }) => {
    const rows = [responseLibraryRow()];
    await injectAuth(page, "chatbot_sheet");
    await mockResponseLibraryApi(page, rows);

    await page.goto("/");

    const responseRows = page.locator("tbody");
    await expect(responseRows.getByText("AI có nguy cơ tự tạo thông tin", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Thêm phản hồi" }).click();

    const modal = page.getByRole("dialog", { name: "Thêm phản hồi" });
    const source = modal.getByLabel("Nguồn");
    await expect(source.locator("option")).toHaveText([
      "Không tìm thấy dữ liệu",
      "AI trả lời không chắc chắn",
      "Lỗi hệ thống",
      "Khác",
    ]);
    await expect(source.locator("option", { hasText: "Nhân viên đề xuất" })).toHaveCount(0);

    await modal.getByLabel("Câu hỏi khách hàng").fill("Lịch thi VSTEP tháng 7 khi nào?");
    await modal.getByLabel("Câu trả lời đúng").fill("Lịch thi được cập nhật trên cổng thông tin FLIC.");
    await source.selectOption("Không tìm thấy dữ liệu");
    await modal.getByRole("button", { name: "Lưu phản hồi" }).click();

    await expect(responseRows.getByText("Lịch thi VSTEP tháng 7 khi nào?", { exact: true })).toBeVisible();
    await expect(responseRows.getByText("Không tìm thấy dữ liệu", { exact: true })).toBeVisible();
  });

});

async function mockAiInsightsApi(page: Page, createdRows: unknown[]) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/analytics/ai/quality-metrics") {
      return route.fulfill(json({ success: true, data: { total_messages: 10, success_rate: 80, failure_count: 1, hallucination_count: 1, avg_confidence: 35 } }));
    }
    if (pathname === "/api/analytics/ai/failed-conversations") {
      return route.fulfill(json({
        success: true,
        data: {
          records: [{
            id: "ai-1",
            messageId: 101,
            conversationId: 202,
            customerId: "customer-00001234",
            customerName: "Nguyễn Minh Anh",
            source: "ZaloBusiness",
            textContent: "Lịch thi gần nhất là ngày nào?",
            aiAnswer: "AI khẳng định lịch thi diễn ra ngày 30/06.",
            detectedTopics: ["Lịch thi"],
            issueType: "AI có nguy cơ tự tạo thông tin",
            issueReason: "Thông tin lịch thi không có trong cơ sở tri thức.",
            issueConfidence: 0.35,
            messageAt: "2026-06-20T08:00:00Z",
          }],
        },
      }));
    }
    if (pathname === "/api/admin/sheet-chatbot/duplicates") {
      return route.fulfill(json({ success: true, data: [] }));
    }
    if (pathname === "/api/admin/sheet-chatbot" && request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "{}");
      createdRows.push(payload);
      return route.fulfill(json({ success: true, data: { ...responseLibraryRow(), ...payload, id: "CS-AI-1" } }));
    }
    return route.fulfill(json({ success: true, data: [] }));
  });
}

async function mockResponseLibraryApi(page: Page, rows: Array<Record<string, unknown>>) {
  await page.route("**/api/admin/sheet-chatbot**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.endsWith("/duplicates")) {
      return route.fulfill(json({ success: true, data: [] }));
    }
    if (request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "{}");
      const created = { ...responseLibraryRow(), ...payload, id: "CS-NEW" };
      rows.unshift(created);
      return route.fulfill(json({ success: true, data: created }));
    }
    return route.fulfill(json({
      success: true,
      data: rows,
      total: rows.length,
      page: 1,
      pageSize: 500,
      stats: { total: rows.length, pending: rows.length, approved: 0, needsEdit: 0, rejected: 0 },
    }));
  });
}

function responseLibraryRow() {
  return {
    id: "CS-001",
    addedAt: "2026-06-20T08:00:00Z",
    addedBy: "Admin FLIC",
    question: "Lịch thi được công bố ở đâu?",
    correctAnswer: "Xem lịch thi trên cổng thông tin FLIC.",
    topic: "Lịch thi",
    source: "AI có nguy cơ tự tạo thông tin",
    risk: "Trung bình",
    status: "Chờ xử lý",
    notes: "Thông tin lịch thi không có trong cơ sở tri thức.",
  };
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  };
}
