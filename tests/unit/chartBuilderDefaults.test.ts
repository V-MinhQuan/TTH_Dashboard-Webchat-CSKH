import { describe, expect, it } from "vitest";

import {
  buildDimensionSelectionForField,
  normalizeChartBuilderState,
  recommendedChartTypeForDimension,
} from "../../src/app/components/chartbuilder/chartBuilderValidation";
import type { CatalogDatasetMeta, ChartBuilderState } from "../../src/app/types/chartBuilder";

describe("chart builder semantic defaults", () => {
  it("uses a line only for chronological dimensions", () => {
    expect(recommendedChartTypeForDimension({ dataType: "date" })).toBe("line");
    expect(recommendedChartTypeForDimension({ dataType: "boolean" })).toBe("bar");
    expect(recommendedChartTypeForDimension({ dataType: "string" })).toBe("bar");
  });

  it("excludes null date and boolean buckets by default", () => {
    expect(buildDimensionSelectionForField({
      id: "status_marked_at",
      dataType: "date",
      dateGrains: ["month"],
    }).nullHandling).toBe("exclude");
    expect(buildDimensionSelectionForField({
      id: "no_response_needed",
      dataType: "boolean",
      dateGrains: [],
    }).nullHandling).toBe("exclude");
  });

  it("removes legacy time fields from persisted builder selections", () => {
    const state = {
      version: 2,
      mode: "custom",
      datasetId: "conversations",
      chartType: "line",
      dimensions: [{ fieldId: "last_message_at", alias: "time" }],
      metrics: [],
      series: null,
      tooltipFields: [],
      filters: [{ fieldId: "last_message_at", operator: "between" }],
      sort: [],
      limit: 500,
      title: "Test",
      chartSettings: {
        showLegend: true,
        showDataLabels: false,
        showGrid: true,
        showTooltip: true,
        theme: "flic",
      },
    } as ChartBuilderState;
    const dataset = {
      id: "conversations",
      fields: [{
        id: "last_message_at",
        dataType: "date",
        dateGrains: ["month"],
      }],
    } as CatalogDatasetMeta;

    expect(normalizeChartBuilderState(state, dataset)).toEqual(expect.objectContaining({
      dimensions: [],
      filters: [],
      series: null,
    }));
  });
});
