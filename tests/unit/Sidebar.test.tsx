import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "../../src/app/components/Sidebar";

vi.mock("../../src/app/context/AuthContext", () => ({
  useAuth: () => ({ role: "manager" }),
}));

describe("Sidebar", () => {
  it("uses the circular logo asset and a circular logo frame when collapsed", () => {
    /**
     * When collapsed, Sidebar renders flicLogoCircle (flic-logo-circle.png).
     * This is intentional: the circle-cropped asset is used for the compact
     * collapsed state (CR-26: circular logo when sidebar is collapsed).
     */
    render(
      <Sidebar
        activeScreen="overview"
        onNavigate={vi.fn()}
        collapsed
        onToggleCollapse={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Logo FLIC" })).toHaveAttribute(
      "src",
      expect.stringContaining("flic-logo-circle.png"),
    );
    expect(screen.getByTestId("sidebar-logo-frame")).toHaveStyle({ borderRadius: "50%" });
  });

  it("uses the wide transparent logo when expanded", () => {
    /**
     * When expanded, Sidebar renders flicLogo (flic-logo-transparent.png)
     * to show the full-width brand logo without a white background.
     */
    render(
      <Sidebar
        activeScreen="overview"
        onNavigate={vi.fn()}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Logo FLIC" })).toHaveAttribute(
      "src",
      expect.stringContaining("flic-logo-transparent.png"),
    );
  });

  it("marks navigation and collapse controls for keyboard and responsive styling", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onToggleCollapse = vi.fn();

    render(
      <Sidebar
        activeScreen="overview"
        onNavigate={onNavigate}
        collapsed={false}
        onToggleCollapse={onToggleCollapse}
      />,
    );

    const sidebar = screen.getByRole("navigation", { name: "Điều hướng chính" }).closest("aside");
    expect(sidebar).toHaveClass("app-sidebar");
    expect(screen.getByRole("button", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");

    await user.tab();
    expect(screen.getByRole("button", { name: "Tổng quan" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Kênh" }));
    expect(onNavigate).toHaveBeenCalledWith("channel");
    await user.click(screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });
});
