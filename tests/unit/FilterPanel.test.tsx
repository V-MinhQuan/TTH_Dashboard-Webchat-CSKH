import { render, screen, waitFor } from "@testing-library/react";
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

const { html2canvas, pdf } = vi.hoisted(() => ({
  html2canvas: vi.fn(),
  pdf: {
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 297),
        getHeight: vi.fn(() => 210),
      },
    },
    addImage: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast }));
vi.mock("html2canvas", () => ({ default: html2canvas }));
vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function MockJsPdf() {
    return pdf;
  }),
}));
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
    html2canvas.mockReset();
    Object.values(pdf).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) value.mockClear();
    });
  });

  it("shows a canonical dependent failure filter labeled '8 nhóm' and clears it immutably when the parent changes", async () => {
    const user = userEvent.setup();
    const onFiltersChange = renderPanel();

    // The AI status combobox label is "Trạng thái AI"
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Trạng thái AI" }),
      "AI trả lời thất bại",
    );

    // After selecting "AI trả lời thất bại", the subfilter appears with label "Loại lỗi AI (8 nhóm)"
    expect(screen.getByRole("combobox", { name: "Loại lỗi AI (8 nhóm)" })).toBeInTheDocument();

    // Select one of the 8 canonical failure types
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Loại lỗi AI (8 nhóm)" }),
      "AI không chắc chắn",
    );

    // Switching to success hides the subfilter
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Trạng thái AI" }),
      "AI trả lời thành công",
    );

    expect(screen.queryByRole("combobox", { name: "Loại lỗi AI (8 nhóm)" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        aiStatus: "AI trả lời thành công",
        aiFailureType: "Tất cả",
      }),
    );
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

  it("uses a supplied topic catalog and marks unavailable Care Hub entries as pending", () => {
    renderPanel(defaultFilterValues, vi.fn(), {
      topicCatalog: [
        { value: "TOEIC", label: "TOEIC", available: true },
        {
          value: "care-hub",
          label: "Care Hub",
          available: false,
          unavailableReason: "Chưa có API danh mục",
        },
      ],
      topicCatalogSource: "Care Hub",
    });

    expect(screen.getByText("Danh mục Care Hub")).toBeVisible();
    expect(screen.getByText("Đang chờ dữ liệu")).toBeVisible();
    expect(screen.getByRole("option", { name: "Care Hub — Đang chờ dữ liệu" })).toBeDisabled();
    expect(screen.queryByRole("option", { name: "VSTEP" })).not.toBeInTheDocument();
  });

  it("shows that the default Care Hub catalog is pending instead of pretending fallback topics are dynamic", () => {
    renderPanel();

    expect(screen.getByText("Danh mục Care Hub")).toBeVisible();
    expect(screen.getByText("Đang chờ dữ liệu")).toBeVisible();
  });

  it("marks a fully available topic catalog as connected", () => {
    renderPanel(defaultFilterValues, vi.fn(), {
      topicCatalog: [{ value: "TOEIC", label: "TOEIC", available: true }],
    });

    expect(screen.getByText("Đã kết nối")).toHaveAttribute("data-state", "ready");
  });

  it("rejects an inverted custom date range before applying", async () => {
    const user = userEvent.setup();
    const onFiltersChange = renderPanel();

    await user.selectOptions(screen.getByRole("combobox", { name: "Khoảng thời gian" }), "Tùy chỉnh");
    await user.type(screen.getByLabelText("Từ ngày và giờ"), "2026-06-20T12:00");
    await user.type(screen.getByLabelText("Đến ngày và giờ"), "2026-06-20T10:00");
    await user.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));

    expect(onFiltersChange).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Thời gian bắt đầu phải trước thời gian kết thúc.");
  });

  it("requires both ends of a custom date range and clears custom values when returning to a preset", async () => {
    const user = userEvent.setup();
    const onFiltersChange = renderPanel();

    await user.selectOptions(screen.getByRole("combobox", { name: "Khoảng thời gian" }), "Tùy chỉnh");
    await user.type(screen.getByLabelText("Từ ngày và giờ"), "2026-06-20T10:00");
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
    html2canvas.mockResolvedValue({
      width: 1000,
      height: 1800,
      toDataURL: vi.fn(() => "data:image/png;base64,test"),
    });
    renderPanel();

    await openExportMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Xuất PDF (toàn trang)" }));

    await waitFor(() => expect(pdf.save).toHaveBeenCalledTimes(1));
    expect(pdf.addPage).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Đã xuất PDF", { description: "File đã được tải xuống." });
    report.remove();
  });

  it("surfaces export failures with a user-friendly message via the dropdown", async () => {
    const user = userEvent.setup();
    const report = document.createElement("div");
    report.dataset.pdfReport = "overview";
    document.body.appendChild(report);
    html2canvas.mockRejectedValue(new Error("Không thể dựng ảnh báo cáo"));
    renderPanel();

    await openExportMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Xuất PDF (toàn trang)" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Không thể xuất dữ liệu. Vui lòng thử lại."),
    );
    report.remove();
  });
});
