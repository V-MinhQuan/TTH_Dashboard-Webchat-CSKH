import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { injectAuth } from "./fixtures/auth";

const ARTIFACT_DIR = path.join("test-results", "flic-acceptance");
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const failedConversation = {
  id: 101,
  messageId: 501,
  conversationId: 301,
  customerId: "C301",
  customerName: "Khách hàng kiểm thử",
  customerDisplayName: "Khách hàng kiểm thử",
  phoneNumber: null,
  source: "Facebook",
  textContent: "Lịch thi TOEIC tháng này khi nào?",
  aiAnswer: "Câu trả lời AI sai từ database",
  issueFlag: true,
  issueType: "Không tìm thấy dữ liệu",
  issueReason: "Nguồn tri thức chưa có dữ liệu",
  issueConfidence: 0.9,
  detectedTopics: ["TOEIC"],
  messageAt: "2026-06-22T08:00:00Z",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

async function mockDashboardApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname;

    if (endpoint === "/api/dashboard/kpi") {
      return json(route, {
        success: true,
        data: {
          totalConversations: 1,
          totalMessages: 2,
          newCustomers: 1,
          aiFailures: 1,
          statusSummary: { new: 0, open: 1, pending: 0, closed: 0, unknown: 0 },
          sourceSummary: { Facebook: 1 },
          messageSummary: { Facebook: 2 },
          dateRange: { startDate: "01/06/2026", endDate: "22/06/2026" },
          trends: { totalConversations: 0, totalMessages: 0, activeConversations: 0, closedConversations: 0, aiFailures: 0 },
          averageResponseTimeMinutes: 5,
          urgentAlerts: [],
          priorityConversations: [],
          dailyTrends: [],
          topQuestions: [{ question: failedConversation.textContent, topic: "TOEIC", count: 3, channel: "Facebook", trend: null }],
        },
      });
    }
    if (endpoint === "/api/analytics/ai/failure-by-topic") {
      return json(route, { success: true, data: [{ topic: "TOEIC", thieuDL: 1, saiCauTra: 0, khongChinhXac: 0, khongHieu: 0, thieuThongTin: 0, loiTriThuc: 0, loiHeThong: 0, khac: 0, khongChac: 0, ngoaiPhamVi: 0, hallucination: 0 }] });
    }
    if (endpoint === "/api/analytics/ai/failed-conversations" || endpoint === "/api/analytics/ai/staff-reported-errors") {
      return json(route, { success: true, data: { records: endpoint.includes("staff-reported") ? [] : [failedConversation], pagination: { page: 1, pageSize: 100, total: endpoint.includes("staff-reported") ? 0 : 1 } } });
    }
    if (endpoint === "/api/analytics/ai/quality-metrics") return json(route, { success: true, data: { total_messages: 2, success_rate: 50, failure_count: 1, hallucination_count: 0, avg_confidence: 90 } });
    if (endpoint === "/api/analytics/ai/staff-activity") return json(route, { success: true, data: { reported_errors: 0, pending_review: 1 } });
    if (endpoint === "/api/analytics/ai/failure-trend") return json(route, { success: true, data: [] });
    if (endpoint === "/api/analytics/ai/suggested-faqs") return json(route, { success: true, data: [{ question: failedConversation.textContent, suggestedAnswer: "", topic: "TOEIC", freq: 3, priority: "Ưu tiên thấp" }] });
    if (endpoint === "/api/analytics/negative-conversations") return json(route, { success: true, data: { records: [], pagination: { page: 1, pageSize: 10, total: 0 } } });
    if (endpoint === "/api/analytics/positive-conversations") {
      const pageNumber = Number(url.searchParams.get("page") || 1);
      if (pageNumber === 2) await new Promise((resolve) => setTimeout(resolve, 400));
      return json(route, {
        success: true,
        data: {
          records: [{
            ...failedConversation,
            id: pageNumber === 1 ? 101 : 102,
            customerName: pageNumber === 1 ? "Khách hàng kiểm thử" : "Khách hàng trang hai",
            customerDisplayName: pageNumber === 1 ? "Khách hàng kiểm thử" : "Khách hàng trang hai",
            sentimentLabel: "positive",
            sentimentScore: 0.9,
          }],
          pagination: { page: pageNumber, pageSize: 10, total: 12 },
        },
      });
    }
    if (endpoint === "/api/admin/crm-keywords/groups") return json(route, { success: true, data: [{ id: "toeic", name: "TOEIC", totalQuestions: 3, changeRate: 0, aiFailed: 1, faqNeeded: 1, keywords: [{ word: "lịch thi", count: 3 }] }] });
    if (endpoint === "/api/admin/crm-keywords/heatmap") return json(route, { success: true, data: [], columns: [] });
    if (endpoint === "/api/admin/crm-keywords/trends") return json(route, { success: true, data: [] });
    if (endpoint === "/api/admin/sheet-chatbot/duplicates") return json(route, { success: true, data: [] });
    if (endpoint === "/api/admin/sheet-chatbot") {
      if (route.request().method() === "POST") {
        const payload = JSON.parse(route.request().postData() || "{}");
        return json(route, { success: true, data: { id: "CS-999", addedAt: new Date().toISOString(), addedBy: "qa", ...payload } }, 201);
      }
      return json(route, { success: true, data: [], total: 0, page: 1, pageSize: 500, stats: { total: 0, pending: 0, approved: 0, needsEdit: 0, rejected: 0 } });
    }
    if (endpoint === "/api/settings/profile") return json(route, { success: true, data: { username: "thuynt", name: "Thu Thuy", email: "qa@example.test", phone: "", role: "manager" } });
    return json(route, { success: true, data: [] });
  });
}

test.beforeEach(async ({ page }) => {
  await mockDashboardApi(page);
});

test("global filters reset when changing pages and export remains independent from collapse", async ({ page }) => {
  await injectAuth(page, "overview");
  await page.goto("/");

  const channel = page.getByRole("combobox", { name: "Kênh" }).first();
  await channel.selectOption("Facebook");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).first().click();

  await page.getByRole("button", { name: "Hiệu suất AI" }).click();
  await expect(page.getByRole("combobox", { name: "Kênh" }).first()).toHaveValue("Tất cả");
  await page.getByRole("button", { name: "Từ khóa nổi bật" }).click();
  await expect(page.getByRole("combobox", { name: "Kênh" }).first()).toHaveValue("Tất cả");
  await page.getByRole("button", { name: "Tổng quan" }).click();
  await expect(page.getByRole("combobox", { name: "Kênh" }).first()).toHaveValue("Tất cả");

  await page.getByRole("combobox", { name: "Kênh" }).first().selectOption("Facebook");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).first().click();

  const header = page.locator(".filter-panel__header").first();
  await header.click({ position: { x: 350, y: 18 } });
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: /Xuất dữ liệu/ }).first().click();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Xuất dữ liệu CSV" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csv = fs.readFileSync(downloadPath!, "utf8");
  expect(csv).toContain("Bộ lọc đã áp dụng");
  expect(csv).toContain("Facebook");

  await header.click({ position: { x: 350, y: 18 } });
  await page.getByRole("button", { name: "Đặt lại" }).first().click();
  await expect(page.getByRole("combobox", { name: "Kênh" }).first()).toHaveValue("Tất cả");
});

test("all requested entry points use the same create feedback form with the source question", async ({ page }) => {
  await injectAuth(page, "overview");
  await page.goto("/");

  await page.getByRole("button", { name: "Thêm FAQ" }).first().click();
  await expect(page.getByRole("heading", { name: "Thêm phản hồi" })).toBeVisible();
  await expect(page.getByLabel("Câu hỏi khách hàng")).toHaveValue(failedConversation.textContent);
  await page.getByRole("button", { name: "Đóng form phản hồi" }).click();

  await page.getByRole("button", { name: "Hiệu suất AI" }).click();
  await page.getByRole("button", { name: "Thêm FAQ" }).first().click();
  await expect(page.getByRole("heading", { name: "Thêm phản hồi" })).toBeVisible();
  await expect(page.getByLabel("Câu hỏi khách hàng")).toHaveValue(failedConversation.textContent);
  await page.getByRole("button", { name: "Đóng form phản hồi" }).click();

  await page.getByRole("button", { name: "Từ khóa nổi bật" }).click();
  await page.getByRole("button", { name: /FAQ cần thêm/ }).click();
  await page.getByRole("button", { name: "Soạn câu trả lời" }).click();
  await expect(page.getByRole("heading", { name: "Thêm phản hồi" })).toBeVisible();
  await expect(page.getByLabel("Câu hỏi khách hàng")).toHaveValue(failedConversation.textContent);
  await page.getByRole("button", { name: "Đóng form phản hồi" }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();

  await page.getByRole("button", { name: "Thư viện phản hồi" }).click();
  await page.getByRole("button", { name: "Thêm phản hồi" }).click();
  await expect(page.getByRole("heading", { name: "Thêm phản hồi" })).toBeVisible();
});

test("settings opens user information and removed settings are absent", async ({ page }) => {
  await injectAuth(page, "settings");
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Thông tin người dùng" })).toBeVisible();
  await expect(page.getByText("Cấu hình kênh", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Báo cáo tuần tự động", { exact: true })).toHaveCount(0);
});

test("positive sentiment conversations render from the API response", async ({ page }) => {
  await injectAuth(page, "sentiment");
  await page.goto("/");

  await expect(page.getByText("Hội thoại có cảm xúc tích cực", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Khách hàng kiểm thử/ })).toBeVisible();
  await expect(page.getByText("Cannot read properties of null", { exact: false })).toHaveCount(0);

  const nextPage = page.getByRole("button", { name: "Trang sau" });
  await expect(nextPage.locator("svg")).toHaveCount(1);
  await expect(nextPage).toHaveText("");
  await nextPage.click();
  await expect(page.getByRole("heading", { name: "Phân tích cảm xúc" })).toBeVisible();
  await expect(page.getByText("Trang 2/2", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Khách hàng trang hai/ })).toBeVisible();
});

test("AI performance CSV export falls back when the backend export route is missing", async ({ page }) => {
  await page.route("**/api/analytics/ai/failed-conversations/export**", (route) =>
    json(route, { success: false, message: "Route không tồn tại." }, 404),
  );
  await injectAuth(page, "aiinsights");
  await page.goto("/");

  await expect(page.locator(".ai-insights-chart-grid")).toBeVisible();
  await page.locator('button[aria-haspopup="menu"]').last().click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem").first().click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csv = fs.readFileSync(downloadPath!, "utf8");
  expect(csv).toContain("Message ID");
  expect(csv).toContain(String(failedConversation.messageId));
});

test("AI performance layout is viewport-safe at the four acceptance sizes", async ({ page }) => {
  await injectAuth(page, "aiinsights");
  const sizes = [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ];

  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator(".ai-insights-chart-grid")).toBeVisible();
    const bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(bodyOverflow).toBeLessThanOrEqual(1);
    const cards = page.locator(".ai-insights-chart-grid > div");
    if (size.width >= 1366) {
      const first = await cards.nth(0).boundingBox();
      const second = await cards.nth(1).boundingBox();
      expect(first).toBeTruthy();
      expect(second).toBeTruthy();
      expect(Math.abs(first!.y - second!.y)).toBeLessThanOrEqual(2);
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `ai-performance-${size.width}x${size.height}.png`), fullPage: true });
  }
});
