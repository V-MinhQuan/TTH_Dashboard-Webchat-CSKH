import { expect, Page, test } from "@playwright/test";
import { injectAuth } from "./fixtures/auth";

test.describe("AI monitoring, thư viện phản hồi và từ khóa lỗi AI", () => {
  test("AI Monitoring hiển thị danh tính an toàn và chuyển đầy đủ ngữ cảnh lỗi vào ghi chú nội bộ", async ({ page }) => {
    const createdRows: unknown[] = [];
    await injectAuth(page, "ai_intervention");
    await mockAiMonitoringApi(page, createdRows);

    await page.goto("/");

    await expect(page.getByText("Nguyễn Minh Anh", { exact: true })).toBeVisible();
    await expect(page.getByText("KH ••••1234", { exact: true })).toBeVisible();
    await expect(page.getByText("AI có nguy cơ tự tạo thông tin", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Thêm phản hồi" }).click();
    const modal = page.getByRole("dialog", { name: "Thêm phản hồi" });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Nguồn gốc lỗi sai")).toHaveValue("AI có nguy cơ tự tạo thông tin");
    await expect(modal.getByLabel("Câu trả lời đúng")).toHaveValue("");
    await expect(modal.getByLabel("Ghi chú nội bộ")).toHaveValue(/AI khẳng định lịch thi diễn ra ngày 30\/06\./);
    await expect(modal.getByLabel("Ghi chú nội bộ")).toHaveValue(/Thông tin lịch thi không có trong cơ sở tri thức\./);

    await modal.getByLabel("Câu trả lời đúng").fill("Vui lòng xem lịch thi đã được FLIC công bố chính thức.");
    await modal.getByRole("button", { name: "Lưu phản hồi" }).click();

    await expect.poll(() => createdRows.length).toBe(1);
    expect(createdRows[0]).toMatchObject({
      source: "AI có nguy cơ tự tạo thông tin",
      notes: expect.stringContaining("AI khẳng định lịch thi diễn ra ngày 30/06."),
    });
  });

  test("Thư viện phản hồi dùng taxonomy chuẩn và cập nhật ngay sau khi tạo", async ({ page }) => {
    const rows = [responseLibraryRow()];
    await injectAuth(page, "chatbot_sheet");
    await mockResponseLibraryApi(page, rows);

    await page.goto("/");

    await expect(page.getByText("AI có nguy cơ tự tạo thông tin", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Thêm phản hồi" }).click();

    const modal = page.getByRole("dialog", { name: "Thêm phản hồi" });
    const source = modal.getByLabel("Nguồn gốc lỗi sai");
    await expect(source.locator("option")).toHaveText([
      "Không tìm thấy dữ liệu",
      "AI không chắc chắn",
      "Câu hỏi ngoài phạm vi",
      "AI có nguy cơ tự tạo thông tin",
    ]);
    await expect(source.locator("option", { hasText: "Nhân viên đề xuất" })).toHaveCount(0);

    await modal.getByLabel("Câu hỏi khách hàng").fill("Lịch thi VSTEP tháng 7 khi nào?");
    await modal.getByLabel("Câu trả lời đúng").fill("Lịch thi được cập nhật trên cổng thông tin FLIC.");
    await source.selectOption("Không tìm thấy dữ liệu");
    await modal.getByRole("button", { name: "Lưu phản hồi" }).click();

    await expect(page.getByText("Lịch thi VSTEP tháng 7 khi nào?", { exact: true })).toBeVisible();
    await expect(page.getByText("Không tìm thấy dữ liệu", { exact: true }).last()).toBeVisible();
  });

  test("Phân tích từ khóa tạo và lưu từ khóa lỗi AI bằng API round 3", async ({ page }) => {
    const createdKeywords: unknown[] = [];
    await injectAuth(page, "keyword");
    await mockKeywordApi(page, createdKeywords);

    await page.goto("/");
    await page.getByRole("button", { name: "Thêm từ khóa lỗi AI" }).click();

    const dialog = page.getByRole("dialog", { name: "Thêm từ khóa lỗi AI" });
    await dialog.getByLabel("Từ khóa lỗi AI").fill("không tìm thấy lịch thi");
    await dialog.getByLabel("Nhóm lỗi AI").selectOption("Không tìm thấy dữ liệu");
    await dialog.getByLabel("Chủ đề").fill("Lịch thi");
    await dialog.getByLabel("Mô tả").fill("AI chưa có dữ liệu lịch thi mới nhất.");
    await dialog.getByRole("button", { name: "Lưu từ khóa" }).click();

    await expect.poll(() => createdKeywords.length).toBe(1);
    expect(createdKeywords[0]).toEqual({
      keyword: "không tìm thấy lịch thi",
      error_group: "Không tìm thấy dữ liệu",
      topic: "Lịch thi",
      care_hub: null,
      description: "AI chưa có dữ liệu lịch thi mới nhất.",
      status: "active",
    });
    await expect(page.getByText("Đã thêm từ khóa lỗi AI", { exact: true })).toBeVisible();
  });
});

async function mockAiMonitoringApi(page: Page, createdRows: unknown[]) {
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

async function mockKeywordApi(page: Page, createdKeywords: unknown[]) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/ai-error-keywords" && request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "{}");
      createdKeywords.push(payload);
      return route.fulfill(json({ success: true, data: { id: "keyword-1", ...payload } }, 201));
    }
    if (pathname === "/api/admin/crm-keywords/groups") {
      return route.fulfill(json({ success: true, data: [] }));
    }
    if (pathname === "/api/admin/crm-keywords/heatmap") {
      return route.fulfill(json({ success: true, data: [], columns: [] }));
    }
    if (pathname === "/api/admin/crm-keywords/trends") {
      return route.fulfill(json({ success: true, data: [] }));
    }
    if (pathname === "/api/analytics/ai/suggested-faqs") {
      return route.fulfill(json({ success: true, data: [] }));
    }
    return route.fulfill(json({ success: true, data: [] }));
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
