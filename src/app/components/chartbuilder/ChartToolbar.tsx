import {
  ArrowLeft,
  PanelLeft,
  RefreshCw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { CHART_BUILDER_LABELS } from "./chartBuilderLabels";

interface Props {
  title: string;
  saveDisabled: boolean;
  onTitleChange: (title: string) => void;
  onBack: () => void;
  onReset: () => void;
  onSave: () => void;
  onToggleDataPanel: () => void;
  onToggleSettings: () => void;
}

export function ChartToolbar({
  title,
  saveDisabled,
  onTitleChange,
  onBack,
  onReset,
  onSave,
  onToggleDataPanel,
  onToggleSettings,
}: Props) {
  return (
    <header className="chart-builder-toolbar">
      <div className="chart-builder-toolbar-leading">
        <button type="button" className="chart-builder-icon-button chart-builder-panel-toggle" onClick={onToggleDataPanel} aria-label="Mở trường dữ liệu">
          <PanelLeft size={17} />
        </button>
        <button type="button" className="chart-builder-back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </button>
        <div className="chart-builder-title-block">
          <span>CHART BUILDER</span>
          <input
            value={title}
            maxLength={200}
            aria-label="Tiêu đề biểu đồ"
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={CHART_BUILDER_LABELS.title}
          />
        </div>
      </div>

      <div className="chart-builder-toolbar-actions">
        <button type="button" className="chart-builder-secondary-button" onClick={onReset}>
          <RefreshCw size={15} />
          <span>{CHART_BUILDER_LABELS.reset}</span>
        </button>
        <button type="button" className="chart-builder-icon-button chart-builder-panel-toggle" onClick={onToggleSettings} aria-label="Mở cài đặt biểu đồ">
          <SlidersHorizontal size={17} />
        </button>
        <button type="button" className="chart-builder-primary-button" disabled={saveDisabled} onClick={onSave}>
          <Save size={15} />
          <span>{CHART_BUILDER_LABELS.save}</span>
        </button>
      </div>
    </header>
  );
}
