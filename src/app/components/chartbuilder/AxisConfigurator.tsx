import { ColumnMeta, YAxisConfig } from "../../types/chartBuilder";

interface Props {
  dimensions: ColumnMeta[];
  metrics: ColumnMeta[];
  groupBy: string;
  yAxes: YAxisConfig[];
  onGroupByChange: (value: string) => void;
  onYAxesChange: (value: YAxisConfig[]) => void;
}

export function AxisConfigurator({
  dimensions,
  metrics,
  groupBy,
  yAxes,
  onGroupByChange,
  onYAxesChange,
}: Props) {
  const selected = new Set(yAxes.map((item) => item.column));
  const toggleMetric = (column: string) => {
    if (selected.has(column)) {
      if (yAxes.length === 1) return;
      onYAxesChange(yAxes.filter((item) => item.column !== column));
      return;
    }
    onYAxesChange([...yAxes, { column }]);
  };

  return (
    <div>
      <div style={sectionLabel}>3. Trục và chỉ số</div>
      <label style={fieldStyle}>
        <span>Trục X</span>
        <select value={groupBy} onChange={(event) => onGroupByChange(event.target.value)} style={inputStyle}>
          {dimensions.map((dimension) => <option key={dimension.id} value={dimension.id}>{dimension.label}</option>)}
        </select>
      </label>
      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>Trục Y</span>
        {metrics.map((metric) => (
          <label key={metric.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#003865" }}>
            <input
              type="checkbox"
              checked={selected.has(metric.id)}
              onChange={() => toggleMetric(metric.id)}
            />
            {metric.label}
          </label>
        ))}
      </div>
    </div>
  );
}

const sectionLabel = { fontSize: 12, fontWeight: 700, color: "#003865", marginBottom: 8 } as const;
const fieldStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 11, color: "#64748b", marginBottom: 9 } as const;
const inputStyle = { width: "100%", padding: "9px", borderRadius: 8, border: "1px solid #dbe3ea", color: "#003865", background: "#fff" } as const;
