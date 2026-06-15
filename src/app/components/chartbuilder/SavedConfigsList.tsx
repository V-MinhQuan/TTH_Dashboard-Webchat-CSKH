import { Check, Trash2 } from "lucide-react";

import { SavedChartConfig } from "../../types/chartBuilder";

interface Props {
  configs: SavedChartConfig[];
  loading: boolean;
  onApply: (config: SavedChartConfig) => void;
  onDelete: (config: SavedChartConfig) => void;
  embedded?: boolean;
}

export function SavedConfigsList({
  configs,
  loading,
  onApply,
  onDelete,
  embedded = false,
}: Props) {
  return (
    <section className={`chart-builder-saved-configs${embedded ? " is-embedded" : ""}`}>
      <div className="chart-builder-saved-configs-title">CẤU HÌNH ĐÃ LƯU</div>
      {loading && <div className="chart-builder-saved-state">Đang tải...</div>}
      {!loading && !configs.length && <div className="chart-builder-saved-state">Chưa có cấu hình nào.</div>}
      <div className="chart-builder-saved-list">
        {configs.map((config) => (
          <div key={config.id} className="chart-builder-saved-item">
            <div className="chart-builder-saved-item-name">{config.name}</div>
            {config.description && <div className="chart-builder-saved-item-description">{config.description}</div>}
            <div className="chart-builder-saved-actions">
              <button type="button" onClick={() => onApply(config)}><Check size={12} /> Áp dụng</button>
              <button type="button" className="is-danger" onClick={() => onDelete(config)}><Trash2 size={12} /> Xóa</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
