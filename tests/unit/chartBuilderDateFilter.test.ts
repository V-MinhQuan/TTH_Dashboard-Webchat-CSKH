import { describe, expect, it } from "vitest";

import { applyGlobalDateFilter } from "../../src/app/components/screens/ChartBuilder";
import type { CatalogDatasetMeta } from "../../src/app/types/chartBuilder";

const dataset = {
  id: "conversations",
  defaultDateField: "activity_at",
  fields: [
    {
      id: "activity_at",
      label: "Hoạt động hội thoại (chuẩn KPI Kênh)",
      dataType: "date",
      roles: ["filter"],
      filterOperators: ["between"],
      available: true,
    },
    {
      id: "last_message_at",
      label: "Thời gian tin nhắn cuối",
      dataType: "date",
      roles: ["dimension", "filter"],
      filterOperators: ["between"],
      available: true,
    },
    {
      id: "last_customer_message_at",
      label: "Thời gian khách gửi cuối",
      dataType: "date",
      roles: ["dimension", "filter"],
      filterOperators: ["between"],
      available: true,
    },
  ],
} as CatalogDatasetMeta;

describe("Chart Builder date filter field", () => {
  it("applies the visible date range to the explicitly selected time field", () => {
    const filters = applyGlobalDateFilter(
      [{ fieldId: "last_message_at", operator: "between", value: null, valueTo: null }],
      dataset,
      { startDate: "2026-06-01", endDate: "2026-06-30" },
    );

    expect(filters).toEqual([expect.objectContaining({
      fieldId: "last_message_at",
      operator: "between",
      value: "2026-06-01",
      valueTo: "2026-06-30",
    })]);
  });

  it("uses the KPI-compatible default field when no time field is selected", () => {
    const filters = applyGlobalDateFilter(
      [],
      dataset,
      { startDate: "2026-06-01", endDate: "2026-06-30" },
    );

    expect(filters[0].fieldId).toBe("activity_at");
  });

  it("removes generated time filters for the all-time scope", () => {
    expect(applyGlobalDateFilter(
      [{ fieldId: "last_message_at", operator: "between", value: null, valueTo: null }],
      dataset,
      {},
    )).toEqual([]);
  });
});
