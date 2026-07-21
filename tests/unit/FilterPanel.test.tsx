import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultFilterValues,
  FilterPanel,
  type FilterValues,
} from "../../src/app/components/FilterPanel";

const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const { exportDashboardData } = vi.hoisted(() => ({
  exportDashboardData: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));
vi.mock("../../src/app/services/exportService", () => ({ exportDashboardData }));
vi.mock("../../src/app/context/SettingsContext", () => ({
  useSettings: () => ({
    settings: {
      dataSourceZalo: true,
      dataSourceZaloBiz: true,
      dataSourceWidget: true,
      dataSourceFb: true,
    },
  }),
}));

function renderPanel(
  filters: FilterValues = defaultFilterValues,
  onFiltersChange = vi.fn(),
  extraProps: Partial<React.ComponentProps<typeof FilterPanel>> = {},
) {
  render(
    <FilterPanel
      filters={filters}
      onFiltersChange={onFiltersChange}
      {...extraProps}
    />,
  );
  return onFiltersChange;
}

/**
 * Helper: open the export dropdown menu.
 * The new design uses a "Xuất dữ liệu" toggle button that reveals a menu.
 */
async function openExportMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Xuất dữ liệu/i }));
}

describe("FilterPanel", () => {
  beforeEach(() => {
    Object.values(toast).forEach((mock) => mock.mockReset());
    exportDashboardData.mockReset();
    exportDashboardData.mockResolvedValue({ rowCount: 1, hasTable: true });
  });

  it("does not expose conversation status or AI status filters", () => {
    renderPanel();

    expect(screen.queryByRole("combobox", { name: "Trạng thái hội thoại" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Trạng thái AI" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Loại lỗi AI (8 nhóm)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "AI không chắc chắn" })).not.toBeInTheDocument();
  });

  it("does not expose sentiment in the global filter and keeps active filters removable", async () => {
    const user = userEvent.setup();
    const onFiltersChange = renderPanel({
      ...defaultFilterValues,
      channel: "Facebook",
    });

    expect(screen.getByRole("button", { name: "Xóa bộ lọc Kênh: Facebook" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Cảm xúc" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Tích cực" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa bộ lọc Kênh: Facebook" }));
    await user.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ channel: "Tất cả" }),
    );
  });

  it("rejects an inverted custom date range before applying", async () => {
    const user = userEvent.setup();
    const onFiltersChange = renderPanel();

    await user.selectOptions(screen.getByRole("combobox", { name: "Khoảng thời gian" }), "Tùy chỉnh");
    await user.type(screen.getByLabelText("Từ ngày"), "2026-06-21");
    await user.type(screen.getByLabelText("Đến ngày"), "2026-06-20");
    await user.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));

    expect(onFiltersChange).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Thời gian bắt đầu phải trước thời gian kết thúc.");
  });

  it("requires both ends of a custom date range and clears custom values when returning to a preset", async () => {
    const user = userEvent.setup();
    const onFiltersChange = renderPanel();

    await user.selectOptions(screen.getByRole("combobox", { name: "Khoảng thời gian" }), "Tùy chỉnh");
    await user.type(screen.getByLabelText("Từ ngày"), "2026-06-20");
    await user.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.");

    await user.selectOptions(screen.getByRole("combobox", { name: "Khoảng thời gian" }), "Hôm nay");
    await user.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith(expect.not.objectContaining({ customDateFrom: expect.anything() }));
  });

  it("resets all filters and can collapse the field region", async () => {
    const user = userEvent.setup();
    const onFiltersChange = renderPanel({ ...defaultFilterValues, channel: "Facebook" });

    await user.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith(defaultFilterValues);
    expect(toast.info).toHaveBeenCalledWith("Đã đặt lại bộ lọc");

    await user.click(screen.getByRole("button", { name: "Bộ lọc dữ liệu" }));
    expect(screen.queryByRole("combobox", { name: "Khoảng thời gian" })).not.toBeInTheDocument();
  });

  it("toggles from the empty header area with keyboard support and export does not toggle it", async () => {
    const user = userEvent.setup();
    renderPanel();

    const header = screen.getByRole("button", { name: "Bộ lọc dữ liệu" });
    header.focus();
    await user.keyboard(" ");
    expect(header).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{Enter}");
    expect(header).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: /Xuất dữ liệu/i }));
    expect(header).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the export menu in a portal so it remains usable when the filter is collapsed", async () => {
    const user = userEvent.setup();
    renderPanel();

    const container = screen.getByTestId("global-filter-collapse-container");
    await openExportMenu(user);

    const menu = screen.getByTestId("global-filter-export-menu");
    expect(menu).toBeVisible();
    expect(menu.parentElement).toBe(document.body);
    expect(container).not.toContainElement(menu);
  });

  it("exposes only the supported recent and custom date ranges", () => {
    renderPanel();

    const dateRangeSelect = screen.getByRole("combobox", { name: "Khoảng thời gian" });
    expect(within(dateRangeSelect).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "30 ngày qua",
      "7 ngày qua",
      "Hôm nay",
      "Tùy chỉnh",
    ]);
  });

  it("reports when the export target is unavailable after opening the dropdown", async () => {
    const user = userEvent.setup();
    renderPanel();

    // Step 1: Open the export dropdown
    await openExportMenu(user);

    // Step 2: Click the PDF export menu item
    await user.click(screen.getByRole("menuitem", { name: "Xuất PDF (toàn trang)" }));

    // Should show error because no [data-export-target] or [data-pdf-report] element exists
    expect(toast.error).toHaveBeenCalledWith(
      "Không tìm thấy nội dung để xuất. Vui lòng kiểm tra lại màn hình hiện tại.",
    );
  });

  it("exports a multi-page PDF from the overview report via the dropdown", async () => {
    const user = userEvent.setup();
    const report = document.createElement("div");
    report.dataset.pdfReport = "overview";
    Object.defineProperties(report, {
      scrollWidth: { value: 1000 },
      scrollHeight: { value: 1800 },
    });
    document.body.appendChild(report);
    renderPanel();

    await openExportMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Xuất PDF (toàn trang)" }));

    await waitFor(() => expect(exportDashboardData).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Đã xuất PDF", { description: "File đã được tải xuống." });
    report.remove();
  });

  it("surfaces export failures with a user-friendly message via the dropdown", async () => {
    const user = userEvent.setup();
    const report = document.createElement("div");
    report.dataset.pdfReport = "overview";
    document.body.appendChild(report);
    exportDashboardData.mockRejectedValue(new Error("Không thể dựng ảnh báo cáo"));
    renderPanel();

    await openExportMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Xuất PDF (toàn trang)" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Lỗi xuất dữ liệu: Không thể dựng ảnh báo cáo"),
    );
    report.remove();
  });
});
