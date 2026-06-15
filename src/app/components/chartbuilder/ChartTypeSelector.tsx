import {
  AreaChart,
  BarChart3,
  ChartNoAxesCombined,
  ChartScatter,
  LineChart,
  PieChart,
  Radar,
  Rows3,
} from "lucide-react";

import { ChartType } from "../../types/chartBuilder";
import { CHART_TYPE_LABELS } from "./chartBuilderLabels";

const options: Array<{
  id: ChartType;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: "bar", label: CHART_TYPE_LABELS.bar, icon: BarChart3 },
  { id: "line", label: CHART_TYPE_LABELS.line, icon: LineChart },
  { id: "area", label: CHART_TYPE_LABELS.area, icon: AreaChart },
  { id: "donut", label: CHART_TYPE_LABELS.donut, icon: PieChart },
  { id: "pie", label: CHART_TYPE_LABELS.pie, icon: PieChart },
  { id: "horizontal_bar", label: CHART_TYPE_LABELS.horizontal_bar, icon: Rows3 },
  { id: "stacked_bar", label: CHART_TYPE_LABELS.stacked_bar, icon: BarChart3 },
  { id: "scatter", label: CHART_TYPE_LABELS.scatter, icon: ChartScatter },
  { id: "combo", label: CHART_TYPE_LABELS.combo, icon: ChartNoAxesCombined },
  { id: "radar", label: CHART_TYPE_LABELS.radar, icon: Radar },
];

export function ChartTypeSelector({
  value,
  onChange,
}: {
  value: ChartType;
  onChange: (value: ChartType) => void;
}) {
  return (
    <div className="chart-builder-chart-types">
      <div className="chart-builder-chart-type-grid">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              type="button"
              key={option.id}
              title={option.label}
              className={option.id === value ? "is-selected" : ""}
              onClick={() => onChange(option.id)}
            >
              <Icon size={18} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
