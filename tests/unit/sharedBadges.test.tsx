import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorSourceBadge } from "../../src/app/components/common/ErrorSourceBadge";
import { StatusBadge } from "../../src/app/components/common/StatusBadge";

/**
 * ErrorSourceBadge renders the `source` prop as the visible text label.
 * Pass the Vietnamese label (e.g. the canonical AI failure taxonomy label)
 * directly as source. The component does NOT map raw keys like "staff".
 * Use the actual taxonomy labels for production code.
 */
describe("shared semantic badges", () => {
  it("uses the shared Vietnamese status label and semantic tone", () => {
    render(<StatusBadge status="waiting_approval" />);

    expect(screen.getByText("Chờ duyệt")).toHaveAttribute("data-tone", "warning");
  });

  it("supports existing display labels without losing their canonical color", () => {
    render(<StatusBadge status="Hoàn thành" />);

    expect(screen.getByText("Hoàn thành")).toHaveAttribute("data-tone", "success");
  });

  it("renders a known AI taxonomy error source with the correct modifier and icon", () => {
    render(<ErrorSourceBadge source="Câu trả lời sai" />);

    const badge = screen.getByText("Câu trả lời sai");
    expect(badge).toHaveClass("error-source-badge--wrong");
    expect(badge).toHaveAttribute("title", "Câu trả lời sai");
  });

  it("renders an unknown source value visibly using the fallback 'other' modifier", () => {
    render(<ErrorSourceBadge source="Nguồn không xác định" />);

    const badge = screen.getByText("Nguồn không xác định");
    expect(badge).toHaveClass("error-source-badge--other");
  });

  it("keeps unknown StatusBadge status visible with neutral fallback tone", () => {
    render(<StatusBadge status="Trạng thái mới" />);

    expect(screen.getByText("Trạng thái mới")).toHaveAttribute("data-tone", "neutral");
  });

  it("shows all 8 canonical AI failure types with correct modifiers", () => {
    const cases: [string, string][] = [
      ["Không tìm thấy dữ liệu",    "error-source-badge--no-data"],
      ["Câu trả lời sai",            "error-source-badge--wrong"],
      ["Thông tin không chính xác",  "error-source-badge--inaccurate"],
      ["Không hiểu câu hỏi",         "error-source-badge--not-understood"],
      ["Thiếu thông tin",            "error-source-badge--missing"],
      ["Lỗi nguồn tri thức",         "error-source-badge--kb"],
      ["Lỗi hệ thống",               "error-source-badge--system"],
      ["Khác",                       "error-source-badge--other"],
    ];

    for (const [source, expectedClass] of cases) {
      const { unmount } = render(<ErrorSourceBadge source={source} />);
      const badge = screen.getByText(source);
      expect(badge).toHaveClass(expectedClass);
      unmount();
    }
  });
});
