import { describe, expect, it } from "vitest";

import {
  CHART_BUILDER_PALETTES,
  semanticChartColor,
} from "../../src/app/components/chartbuilder/chartBuilderPalettes";

describe("Chart Builder semantic colors", () => {
  it("uses the fixed system colors for channels", () => {
    expect(semanticChartColor("Zalo Business")).toBe("#003865");
    expect(semanticChartColor("Facebook")).toBe("#008C95");
    expect(semanticChartColor("Zalo OA")).toBe("#42A5F5");
    expect(semanticChartColor("Chat Widget")).toBe("#D73C01");
  });

  it("uses fixed topic and response-status colors", () => {
    expect(semanticChartColor("TOEIC")).toBe("#308D16");
    expect(semanticChartColor("Cần phản hồi")).toBe("#F97316");
    expect(semanticChartColor("Không cần phản hồi")).toBe("#16A34A");
  });

  it("keeps the default palette visually distinct", () => {
    expect(new Set(CHART_BUILDER_PALETTES.flic).size).toBe(
      CHART_BUILDER_PALETTES.flic.length,
    );
  });
});
