import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";


describe("Overview finite date-range behavior", () => {
  it("does not retain an all-time-only branch that suppresses KPI comparison", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/components/screens/Overview.tsx"),
      "utf8",
    );

    expect(source).not.toContain("shouldLoadTrendComparison");
    expect(source).not.toContain("isAllTimeRange");
    expect(source).toContain("getDashboardKpiComparison");
  });
});
