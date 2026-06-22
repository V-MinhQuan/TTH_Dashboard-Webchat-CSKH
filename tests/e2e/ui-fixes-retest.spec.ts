import { expect, Page, test, TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { injectAuth } from "./fixtures/auth";

const ARTIFACT_ROOT = path.join("test-results", "ui-fixes-retest");
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, "screenshots");
const CONSOLE_DIR = path.join(ARTIFACT_ROOT, "console");
const NETWORK_DIR = path.join(ARTIFACT_ROOT, "network");

for (const directory of [ARTIFACT_ROOT, SCREENSHOT_DIR, CONSOLE_DIR, NETWORK_DIR]) {
  fs.mkdirSync(directory, { recursive: true });
}

interface CaptureState {
  console: Array<{ type: string; text: string }>;
  network: Array<{
    method: string;
    url: string;
    status: number;
    contentType: string | null;
  }>;
}

const captures = new Map<string, CaptureState>();

test.beforeEach(async ({ page }, testInfo) => {
  const state: CaptureState = { console: [], network: [] };
  captures.set(testKey(testInfo), state);

  page.on("console", (message) => {
    state.console.push({ type: message.type(), text: message.text() });
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    state.network.push({
      method: response.request().method(),
      url,
      status: response.status(),
      contentType: response.headers()["content-type"] || null,
    });
  });
});

test.afterEach(async (_, testInfo) => {
  const state = captures.get(testKey(testInfo));
  if (!state) return;
  const slug = slugify(testInfo.title);
  fs.writeFileSync(
    path.join(CONSOLE_DIR, `${slug}.json`),
    JSON.stringify(state.console, null, 2),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(NETWORK_DIR, `${slug}.json`),
    JSON.stringify(state.network, null, 2),
    "utf-8",
  );
});

test.describe("UI fixes retest", () => {
  test("Chart Builder palette changes immediately, sort labels are localized, and saved configs persist palette", async ({ page }) => {
    const previewRequests: any[] = [];
    const savedConfigs: any[] = [];
    const savedPayloads: any[] = [];
    await injectAuth(page, "chartbuilder");
    await mockChartBuilderApi(page, { previewRequests, savedConfigs, savedPayloads });

    await page.goto("/");
    await expect(page.locator(".chart-builder-shell")).toBeVisible();
    await expect(page.locator('[data-preview-state="has-data"]')).toBeVisible();
    await screenshot(page, "01-chartbuilder-palette-before.png");

    await openChartSettings(page);
    const sortSelect = page
      .locator(".chart-builder-control")
      .filter({ hasText: "Sắp xếp theo" })
      .locator("select")
      .first();
    const sortOptions = await sortSelect.locator("option").evaluateAll((options) =>
      options.map((option) => ({
        value: (option as HTMLOptionElement).value,
        label: option.textContent?.trim() || "",
      })),
    );
    expect(sortOptions).toEqual(expect.arrayContaining([
      { value: "channel", label: "Kênh" },
      { value: "metric_conversation_id_1", label: "Số lượng hội thoại" },
    ]));
    expect(sortOptions.map((option) => option.label).join(" ")).not.toMatch(/metric_|response_minutes|last_message_at|snake_case/);
    await sortSelect.screenshot({ path: path.join(SCREENSHOT_DIR, "03-chartbuilder-sort-labels.png") });

    const paletteSelect = page
      .locator(".chart-builder-control")
      .filter({ hasText: "Bảng màu" })
      .locator("select")
      .first();
    await expect(paletteSelect.locator("option", { hasText: "Đơn sắc" })).toHaveCount(1);
    await paletteSelect.selectOption("warm");

    await expect.poll(() => latestPreviewChartType(previewRequests)).toBe("bar");
    await expect(page.locator('#chart-builder-export-area svg [fill="#D73C01"]').first()).toBeVisible();
    await expect(page.locator("#chart-builder-export-area")).toContainText("Số lượng hội thoại");
    await expect(page.locator("#chart-builder-export-area")).not.toContainText("metric_conversation_id_1");
    await screenshot(page, "02-chartbuilder-palette-after.png");

    await page.getByTitle("Hình tròn").click();
    await expect.poll(() => latestPreviewChartType(previewRequests)).toBe("pie");
    await expect(page.locator('#chart-builder-export-area svg [fill="#D73C01"]').first()).toBeVisible();
    await expect(page.locator('#chart-builder-export-area svg [fill="#ED5206"]').first()).toBeVisible();

    await page.getByRole("button", { name: "Lưu biểu đồ" }).click();
    const saveDialog = page.getByRole("dialog", { name: "Lưu biểu đồ" });
    await expect(saveDialog).toBeVisible();
    await saveDialog.getByLabel("Tên cấu hình").fill("Kiểm thử bảng màu");
    await saveDialog.getByRole("button", { name: "Lưu biểu đồ" }).click();
    await expect.poll(() => savedPayloads.length).toBe(1);
    expect(savedPayloads[0].config.chartSettings.theme).toBe("warm");

    const savedItem = page.locator(".chart-builder-saved-item").filter({ hasText: "Kiểm thử bảng màu" });
    await savedItem.scrollIntoViewIfNeeded();
    await savedItem.getByRole("button", { name: "Áp dụng" }).click();
    await expect(paletteSelect).toHaveValue("warm");
  });

  test.skip("Sentiment forecast no-data state, KPI labels, and bulk confirmation work without pre-confirm API calls", async ({ page }) => {
    const closeRequests: any[] = [];
    await injectAuth(page, "sentiment");
    await mockSentimentApi(page, closeRequests);

    await page.goto("/");
    await expect(page.getByText("Chưa đủ dữ liệu để dự báo")).toBeVisible();
    await screenshot(page, "04-sentiment-forecast-empty-state.png");

    await expect(page.getByText("5%", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("94%", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1%", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("2.6/5", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/điểm %/).first()).toBeVisible();
    await expect(page.getByText("165 ngày").first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Zalo Business" }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\d+g\s+\d+p/);
    await screenshot(page, "05-sentiment-kpi-cards.png");

    await page.getByRole("button", { name: "Đánh dấu xử lý (tất cả)" }).click();
    await expect.poll(() => closeRequests.length).toBe(0);
    const dialog = page.getByRole("dialog", { name: "Xác nhận đánh dấu đã xử lý" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("2 hội thoại tiêu cực");
    await dialog.screenshot({ path: path.join(SCREENSHOT_DIR, "06-bulk-resolve-confirmation-dialog.png") });

    await dialog.getByRole("button", { name: "Hủy" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => closeRequests.length).toBe(0);
    await screenshot(page, "07-bulk-resolve-cancelled.png");

    await page.getByRole("button", { name: "Đánh dấu xử lý (tất cả)" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Xác nhận đánh dấu đã xử lý" });
    await confirmDialog.getByRole("button", { name: "Xác nhận xử lý" }).click();
    await confirmDialog.getByRole("button", { name: /Đang xử lý|Xác nhận xử lý/ }).click({ timeout: 500 }).catch(() => undefined);
    await expect.poll(() => closeRequests.length).toBe(2);
  });

  test("Response Library wording is active on desktop and mobile", async ({ page }) => {
    await injectAuth(page, "chatbot_sheet");
    await mockResponseLibraryApi(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Quản lý thư viện phản hồi" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm phản hồi/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Sheet Chatbot");
    await expect(page.locator("body")).not.toContainText("Chatbot Sheet");
    await screenshot(page, "08-response-library-page.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Quản lý thư viện phản hồi" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Sheet Chatbot");
    await screenshot(page, "09-response-library-mobile.png");
  });

  test("Chart Builder responsive layout remains usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await injectAuth(page, "chartbuilder");
    await mockChartBuilderApi(page, { previewRequests: [], savedConfigs: [], savedPayloads: [] });

    await page.goto("/");
    await expect(page.locator(".chart-builder-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mở cài đặt biểu đồ" })).toBeVisible();
    await page.getByRole("button", { name: "Mở cài đặt biểu đồ" }).click();
    await expect(page.getByRole("complementary", { name: "Cài đặt biểu đồ" })).toBeVisible();
    await screenshot(page, "10-chartbuilder-mobile.png");
  });
});

function testKey(testInfo: TestInfo) {
  return `${testInfo.project.name} > ${testInfo.title}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true,
  });
}

async function openChartSettings(page: Page) {
  const settings = page.getByRole("complementary", { name: "Cài đặt biểu đồ" });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Mở cài đặt biểu đồ" }).click();
  }
  await expect(settings).toBeVisible();
}

function latestPreviewChartType(requests: any[]) {
  return requests[requests.length - 1]?.chartType || "";
}

async function mockChartBuilderApi(
  page: Page,
  state: { previewRequests: any[]; savedConfigs: any[]; savedPayloads: any[] },
) {
  await page.route("**/api/chart-builder/catalog", (route) =>
    route.fulfill(jsonResponse(chartCatalog())),
  );

  await page.route("**/api/chart-builder/configs", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      state.savedPayloads.push(body);
      const saved = {
        id: `saved-${state.savedConfigs.length + 1}`,
        name: body.name,
        description: body.description,
        config: body.config,
      };
      state.savedConfigs.unshift(saved);
      return route.fulfill(jsonResponse({ success: true, data: saved }));
    }
    return route.fulfill(jsonResponse({ success: true, data: state.savedConfigs }));
  });

  await page.route("**/api/chart-builder/preview", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    state.previewRequests.push(body);
    return route.fulfill(jsonResponse(chartPreview(body.chartType || "bar")));
  });

  await page.route("**/api/chart-builder/data", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    return route.fulfill(jsonResponse(chartPreview(body.chartType || "bar")));
  });
}

function chartCatalog() {
  return {
    success: true,
    data: {
      version: 2,
      cachedAt: new Date().toISOString(),
      defaultLimit: 500,
      maxLimit: 5000,
      aggregations: ["count", "count_distinct", "sum", "avg", "min", "max"],
      dateGrains: ["day", "week", "month", "quarter", "year"],
      filterOperators: ["eq", "neq", "contains", "between", "is_null", "is_not_null"],
      datasets: [
        {
          id: "conversations",
          label: "Hội thoại",
          description: "Dữ liệu hội thoại từ SQL Server.",
          available: true,
          unavailableReason: null,
          defaultDateField: "last_message_at",
          defaultDimension: "channel",
          defaultMetric: "conversation_id",
          defaultLimit: 500,
          maxLimit: 5000,
          fields: [
            field("channel", "Kênh", "string", "channel", ["dimension", "series", "filter"], [], ["eq", "neq", "in", "contains"]),
            field("conversation_id", "Số lượng hội thoại", "number", "id", ["metric"], ["count", "count_distinct"], [], "count_distinct"),
            field("response_minutes", "Thời gian phản hồi trung bình", "number", "duration_minutes", ["metric", "filter"], ["avg", "min", "max"], ["gt", "gte", "lt", "lte"]),
            field("last_message_at", "Thời gian tin nhắn gần nhất", "date", "datetime", ["dimension", "filter"], [], ["before", "after", "between"], null, ["day", "week", "month"]),
          ],
          relations: [],
        },
      ],
    },
  };
}

function field(
  id: string,
  label: string,
  dataType: string,
  semanticType: string,
  roles: string[],
  aggregations: string[],
  filterOperators: string[],
  defaultAggregation: string | null = null,
  dateGrains: string[] = [],
) {
  return {
    id,
    label,
    dataType,
    semanticType,
    roles,
    aggregations,
    filterOperators,
    dateGrains,
    defaultAggregation,
    nullable: true,
    available: true,
  };
}

function chartPreview(chartType: string) {
  const series = [
    {
      key: "metric_conversation_id_1",
      label: "metric_conversation_id_1",
      color: "#999999",
      axisGroup: "left",
      seriesType: chartType === "combo" ? "bar" : null,
      numberFormat: "number",
    },
  ];
  return {
    success: true,
    data: {
      mode: "custom",
      datasetId: "conversations",
      rows: [
        { channel: "Facebook", metric_conversation_id_1: 142 },
        { channel: "ZaloBusiness", metric_conversation_id_1: 87 },
        { channel: "ChatWidget", metric_conversation_id_1: 54 },
      ],
      series,
      dimensionKeys: ["channel"],
      generatedAt: new Date().toISOString(),
      execution: {
        rowCount: 3,
        executionTimeMs: 40,
        limit: 500,
        truncated: false,
      },
    },
  };
}

async function mockSentimentApi(page: Page, closeRequests: any[]) {
  await page.route("**/api/analytics/sentiment-summary**", (route) =>
    route.fulfill(jsonResponse({
      success: true,
      data: {
        summary: { positive: 5, neutral: 94, negative: 1, total: 100 },
        avgSatisfaction: 2.6,
      },
    })),
  );
  await page.route("**/api/analytics/sentiment-trend**", (route) =>
    route.fulfill(jsonResponse({
      success: true,
      data: [
        { date: "2026-05-01", positive: 2, neutral: 40, negative: 2 },
        { date: "2026-05-02", positive: 3, neutral: 44, negative: 1 },
        { date: "2026-05-03", positive: 5, neutral: 94, negative: 1 },
      ],
    })),
  );
  await page.route("**/api/analytics/topics**", (route) =>
    route.fulfill(jsonResponse({
      success: true,
      data: [
        { topicLabel: "Lệ phí", positive: 1, neutral: 20, negative: 1, count: 22 },
      ],
    })),
  );
  await page.route("**/api/analytics/negative-keywords**", (route) =>
    route.fulfill(jsonResponse({
      success: true,
      data: [
        { keyword: "lệ phí", count: 7, issueType: "Thanh toán" },
        { keyword: "không", count: 1, issueType: "Nhiễu" },
      ],
    })),
  );
  await page.route("**/api/analytics/negative-conversations**", (route) =>
    route.fulfill(jsonResponse({
      success: true,
      data: {
        records: [
          negativeRecord("m-001", "C001", "ZaloBusiness"),
          negativeRecord("m-002", "C002", "ChatWidget"),
        ],
      },
    })),
  );
  await page.route("**/api/conversations/close", async (route) => {
    closeRequests.push(JSON.parse(route.request().postData() || "{}"));
    await new Promise((resolve) => setTimeout(resolve, 120));
    return route.fulfill(jsonResponse({ success: true, message: "Đã xử lý" }));
  });
}

function negativeRecord(messageId: string, customerId: string, source: string) {
  const minutesAgo = 165 * 1440 + 20;
  return {
    messageId,
    id_webchat_messagelogs: messageId,
    customerId,
    source,
    textContent: "Tôi đã chờ quá lâu nhưng vẫn chưa được hỗ trợ.",
    detectedTopics: ["Hỗ trợ"],
    sentimentScore: 0.2,
    needStaffReview: true,
    messageAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

async function mockResponseLibraryApi(page: Page) {
  await page.route("**/api/admin/sheet-chatbot**", async (route) => {
    const request = route.request();
    const pathName = new URL(request.url()).pathname;
    if (pathName.endsWith("/duplicates")) {
      return route.fulfill(jsonResponse({ success: true, data: [] }));
    }
    if (request.method() !== "GET") {
      return route.fulfill(jsonResponse({
        success: true,
        data: responseLibraryRows()[0],
      }));
    }
    return route.fulfill(jsonResponse({
      success: true,
      data: responseLibraryRows(),
      total: 1,
      page: 1,
      pageSize: 500,
      stats: { total: 1, pending: 1, approved: 0, needsEdit: 0, rejected: 0 },
    }));
  });
}

function responseLibraryRows() {
  return [
    {
      id: "CS-001",
      addedAt: new Date().toISOString(),
      addedBy: "Admin FLIC",
      question: "Học viên cần tra cứu lịch thi ở đâu?",
      correctAnswer: "Vào cổng thông tin FLIC để xem lịch thi mới nhất.",
      topic: "Lịch thi",
      source: "Nhân viên đề xuất",
      risk: "Thấp",
      status: "Chờ xử lý",
      notes: "Dữ liệu kiểm thử UI",
    },
  ];
}

function jsonResponse(body: unknown) {
  return {
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  };
}
