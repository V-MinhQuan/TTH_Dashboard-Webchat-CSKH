import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartCard } from "../../src/app/components/ChartCard";

const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast }));
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

describe("ChartCard filter panel", () => {
  it("does not expose the deprecated uncertain AI status", async () => {
    const user = userEvent.setup();

    render(
      <ChartCard title="Biểu đồ kiểm thử" data={[]}>
        <div>chart body</div>
      </ChartCard>,
    );

    await user.click(screen.getByTitle("Lọc dữ liệu"));

    expect(screen.queryByText("TRẠNG THÁI AI")).toBeNull();
    expect(screen.queryByRole("option", { name: "AI không chắc chắn" })).toBeNull();
  });
});
