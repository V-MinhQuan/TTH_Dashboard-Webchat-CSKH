import { ColumnMeta, YAxisConfig } from "../../types/chartBuilder";

interface Props {
  metrics: ColumnMeta[];
  yAxes: YAxisConfig[];
  onChange: (value: YAxisConfig[]) => void;
}

const FALLBACKS = ["#003865", "#ED5206", "#1565C0", "#D73C01", "#42A5F5", "#F36C2E"];

export function ColorPicker({ metrics, yAxes, onChange }: Props) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#003865", marginBottom: 8 }}>4. Màu chuỗi dữ liệu</div>
      <div style={{ display: "grid", gap: 7 }}>
        {yAxes.map((axis, index) => (
          <label key={axis.column} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
            <span>{metrics.find((metric) => metric.id === axis.column)?.label || axis.column}</span>
            <input
              type="color"
              value={axis.color || FALLBACKS[index % FALLBACKS.length]}
              onChange={(event) => onChange(yAxes.map((item) => item.column === axis.column ? { ...item, color: event.target.value } : item))}
              style={{ width: 36, height: 28, border: 0, background: "transparent", cursor: "pointer" }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
