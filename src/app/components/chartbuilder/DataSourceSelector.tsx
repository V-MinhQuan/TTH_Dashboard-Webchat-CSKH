import { DataSourceInfo } from "../../types/chartBuilder";

interface Props {
  sources: DataSourceInfo[];
  value: string;
  onChange: (sourceId: string) => void;
}

export function DataSourceSelector({ sources, value, onChange }: Props) {
  const selected = sources.find((source) => source.id === value);
  return (
    <div className="chart-builder-source-selector">
      <label>
        <span>BỘ DỮ LIỆU PHÂN TÍCH</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {!value && <option value="">Chọn nguồn dữ liệu</option>}
          {sources.map((source) => (
            <option key={source.id} value={source.id} disabled={!source.available}>
              {source.name}{source.available ? "" : " - Chưa khả dụng"}
            </option>
          ))}
        </select>
      </label>
      {selected && <p>{selected.description}</p>}
      {sources.filter((source) => !source.available).map((source) => (
        <div key={source.id} className="chart-builder-source-warning" title={source.unavailableReason || undefined}>
          <strong>{source.name}</strong>
          <span>{source.unavailableReason || "Dữ liệu chưa khả dụng."}</span>
        </div>
      ))}
    </div>
  );
}
