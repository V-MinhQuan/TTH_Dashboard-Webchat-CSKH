import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download, Filter, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { useSettings } from "../context/SettingsContext";
import {
  defaultFilterValues,
  useOptionalGlobalFilters,
  type FilterValues,
} from "../context/GlobalFilterContext";
import { TOPIC_FILTER_OPTIONS } from "../constants/topicTaxonomy";
import { exportDashboardData, type ExportFormat } from "../services/exportService";
import { getDateParamsFromFilters } from "../utils/dateFilters";
import "../../styles/globals.css";

export { defaultFilterValues, type FilterValues } from "../context/GlobalFilterContext";

const NAVY = "#003865";
const CTA = "#ED5206";
const CTA_SOFT = "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const ALL = "Tất cả";
const FAILED_AI_STATUS = "AI trả lời thất bại";

export interface FilterCatalogOption {
  readonly value: string;
  readonly label: string;
  readonly available?: boolean;
  readonly unavailableReason?: string;
}

export interface FilterPanelProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  topicCatalog?: readonly FilterCatalogOption[];
  topicCatalogSource?: string;
}

const dateRanges = ["30 ngày qua", "7 ngày qua", "Hôm nay", "Tháng này", "Quý này", "Tùy chỉnh"];
const fallbackTopics: readonly FilterCatalogOption[] = Object.freeze(TOPIC_FILTER_OPTIONS.map((option) => Object.freeze(option)));
const conversationStatuses = [ALL, "Chờ xử lý", "Đang tư vấn / Chờ phản hồi", "Hoàn thành"];
const aiStatuses = [ALL, "AI trả lời thành công", FAILED_AI_STATUS];

// Req #16 – export format types
const EXPORT_FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "pdf",  label: "Xuất PDF (toàn trang)" },
  { id: "png",  label: "Xuất hình ảnh PNG" },
  { id: "csv",  label: "Xuất dữ liệu CSV" },
  { id: "xlsx", label: "Xuất Excel (XLSX)" },
];

const selectStyle: CSSProperties = {
  width: "100%",
  padding: "8px 28px 8px 12px",
  borderRadius: "8px",
  border: "1.5px solid rgba(0,56,101,0.12)",
  fontSize: "13px",
  color: NAVY,
  backgroundColor: "#fff",
  cursor: "pointer",
  outline: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23003865' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
};

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly FilterCatalogOption[];
  onChange: (value: string) => void;
  helper?: ReactNode;
}

function SelectField({ label, value, options, onChange, helper }: SelectFieldProps) {
  const id = useId();
  const hasCurrentValue = options.some((option) => option.value === value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <label htmlFor={id} style={{ fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.05em" }}>
          {label.toUpperCase()}
        </label>
        {helper}
      </div>
      <select id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle}>
        {!hasCurrentValue && <option value={value}>{value}</option>}
        {options.map((option) => {
          const available = option.available !== false;
          return (
            <option key={option.value} value={option.value} disabled={!available} title={option.unavailableReason}>
              {available ? option.label : `${option.label} — Đang chờ dữ liệu`}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function withAll(options: readonly FilterCatalogOption[]): readonly FilterCatalogOption[] {
  return [{ value: ALL, label: ALL, available: true }, ...options];
}

function textOptions(options: readonly string[]): readonly FilterCatalogOption[] {
  return options.map((label) => ({ value: label, label, available: true }));
}

function normalizeFilters(filters: FilterValues): FilterValues {
  const merged = { ...defaultFilterValues, ...filters };
  return {
    ...merged,
    aiFailureType: ALL,
  };
}

type ActiveFilterKey = "dateRange" | "channel" | "topic" | "conversationStatus" | "aiStatus";

const ACTIVE_FILTER_LABELS: Readonly<Record<ActiveFilterKey, string>> = Object.freeze({
  dateRange: "Thời gian",
  channel: "Kênh",
  topic: "Chủ đề",
  conversationStatus: "Hội thoại",
  aiStatus: "AI",
});

export function FilterPanel({
  filters,
  onFiltersChange,
  topicCatalog,
  topicCatalogSource = "Care Hub",
}: FilterPanelProps) {
  const globalFilters = useOptionalGlobalFilters();
  const [isExpanded, setIsExpanded] = useState(true);
  const [fallbackDraft, setFallbackDraft] = useState<FilterValues>(() => normalizeFilters(filters));
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMenuPosition, setExportMenuPosition] = useState({ top: 0, right: 0 });
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const localFilters = globalFilters?.draftFilters ?? fallbackDraft;

  const setLocalFilters = (updater: FilterValues | ((current: FilterValues) => FilterValues)) => {
    const next = typeof updater === "function" ? updater(localFilters) : updater;
    if (globalFilters) globalFilters.setDraftFilters(next);
    else setFallbackDraft(next);
  };

  const channels = useMemo(() => {
    const enabled = [
      settings.dataSourceZalo && "Zalo OA",
      settings.dataSourceZaloBiz && "Zalo Business",
      settings.dataSourceWidget && "Chat Widget",
      settings.dataSourceFb && "Facebook",
    ].filter((value): value is string => Boolean(value));
    return textOptions([ALL, ...enabled]);
  }, [settings.dataSourceFb, settings.dataSourceWidget, settings.dataSourceZalo, settings.dataSourceZaloBiz]);

  const resolvedTopics = useMemo(
    () => withAll(topicCatalog ?? fallbackTopics),
    [topicCatalog],
  );
  const catalogPending = !topicCatalog || topicCatalog.some((option) => option.available === false);

  useEffect(() => {
    if (!globalFilters) setFallbackDraft(normalizeFilters(filters));
  }, [filters, globalFilters]);

  useEffect(() => {
    if (!exportMenuOpen) return;

    const updatePosition = () => {
      const rect = exportButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setExportMenuPosition({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!exportMenuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        exportMenuRef.current?.contains(target) ||
        exportButtonRef.current?.contains(target)
      ) {
        return;
      }
      setExportMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExportMenuOpen(false);
        exportButtonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [exportMenuOpen]);

  const handleLocalChange = (key: keyof FilterValues, value: string) => {
    setLocalFilters((previous) => {
      if (key === "dateRange" && value !== "Tùy chỉnh") {
        const { customDateFrom: _from, customDateTo: _to, ...remaining } = previous;
        return { ...remaining, dateRange: value };
      }
      if (key === "aiStatus") {
        return { ...previous, aiStatus: value, aiFailureType: ALL };
      }
      return { ...previous, [key]: value };
    });
  };

  const handleApply = () => {
    if (localFilters.dateRange === "Tùy chỉnh") {
      if (!localFilters.customDateFrom || !localFilters.customDateTo) {
        toast.error("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.");
        return;
      }
      try {
        getDateParamsFromFilters(localFilters);
      } catch {
        toast.error("Thời gian bắt đầu phải trước thời gian kết thúc.");
        return;
      }
    }
    if (globalFilters) globalFilters.applyDraft();
    else onFiltersChange({ ...localFilters });
    toast.success("Đã áp dụng bộ lọc");
  };

  const handleReset = () => {
    const nextFilters = { ...defaultFilterValues };
    setLocalFilters(nextFilters);
    if (globalFilters) globalFilters.resetFilters();
    else onFiltersChange(nextFilters);
    toast.info("Đã đặt lại bộ lọc");
  };

  // Req #16: Multi-format export
  const handleExport = async (format: ExportFormat) => {
    setExportMenuOpen(false);
    const target = document.querySelector<HTMLElement>('[data-export-target="true"]') || document.querySelector<HTMLElement>('[data-pdf-report="overview"]');
    if (!target) {
      toast.error("Không tìm thấy nội dung để xuất. Vui lòng kiểm tra lại màn hình hiện tại.");
      return;
    }
    try {
      setExporting(true);
      const date = new Date().toISOString().slice(0, 10);
      const viewName = document.title.split('-')[0].trim().toLowerCase().replace(/ /g, '-') || "bao-cao";
      const base = `${viewName}-${date}`;
      if (format === "pdf") toast.info("Đang tạo PDF...");
      if (format === "png") toast.info("Đang chụp màn hình...");
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const result = await exportDashboardData({
        format,
        target,
        filenameBase: base,
        filters: globalFilters?.appliedFilters ?? filters,
      });
      if (!result.hasTable) {
        toast.warning(`Không tìm thấy bảng dữ liệu để xuất ${format.toUpperCase()}.`);
        return;
      }
      if (format === "pdf") toast.success("Đã xuất PDF", { description: "File đã được tải xuống." });
      else if (format === "png") toast.success("Đã xuất PNG");
      else toast.success(`Đã xuất ${format.toUpperCase()} – ${result.rowCount} dòng`);
    } catch {
      toast.error("Không thể xuất dữ liệu. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  const activeFilters = (Object.keys(ACTIVE_FILTER_LABELS) as ActiveFilterKey[])
    .filter((key) => localFilters[key] !== defaultFilterValues[key])
    .map((key) => ({ key, label: ACTIVE_FILTER_LABELS[key], value: localFilters[key] }));

  const exportMenu = exportMenuOpen && !exporting
    ? createPortal(
      <div
        ref={exportMenuRef}
        role="menu"
        aria-label="Chọn định dạng xuất"
        data-testid="global-filter-export-menu"
        style={{
          position: "fixed",
          top: exportMenuPosition.top,
          right: exportMenuPosition.right,
          zIndex: 1000,
          minWidth: "200px",
          background: "#fff",
          borderRadius: "10px",
          border: "1px solid rgba(0,56,101,0.1)",
          boxShadow: "0 8px 28px rgba(0,56,101,0.14)",
          padding: "6px",
        }}
      >
        {EXPORT_FORMATS.map((fmt) => (
          <button
            key={fmt.id}
            role="menuitem"
            type="button"
            onClick={() => void handleExport(fmt.id)}
            style={{
              width: "100%",
              padding: "9px 12px",
              border: 0,
              borderRadius: "7px",
              background: "transparent",
              color: NAVY,
              textAlign: "left",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            {fmt.label}
          </button>
        ))}
      </div>,
      document.body,
    )
    : null;

  return (
    <section className="filter-panel" aria-label="Bộ lọc dữ liệu" data-testid="global-filter-collapse-container">
      <div
        role="button"
        tabIndex={0}
        aria-label="Bộ lọc dữ liệu"
        className="filter-panel__header"
        aria-expanded={isExpanded}
        aria-controls="dashboard-filter-fields"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded((expanded) => !expanded);
          }
        }}
      >
        <div className="filter-panel__toggle">
            <Filter size={15} aria-hidden="true" />
            <span>Bộ lọc dữ liệu</span>
            {activeFilters.length > 0 && <span className="filter-panel__count">{activeFilters.length} bộ lọc</span>}
            <ChevronDown className="filter-panel__chevron" data-expanded={isExpanded} size={15} aria-hidden="true" />
        </div>

        {/* Req #16: Multi-format export dropdown */}
        <div
          style={{ position: "relative" }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              setExportMenuOpen(false);
              exportButtonRef.current?.focus();
            }
          }}
        >
          <button
            ref={exportButtonRef}
            type="button"
            disabled={exporting}
            data-print-hidden="true"
            className="filter-panel__export"
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setExportMenuOpen((prev) => !prev);
            }}
          >
            <Download size={12} aria-hidden="true" />
            {exporting ? "Đang xuất..." : "Xuất dữ liệu"}
            <ChevronDown size={11} aria-hidden="true" style={{ marginLeft: "2px" }} />
          </button>
          {exportMenu}
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="filter-panel__badges" aria-label="Bộ lọc đang áp dụng">
          {activeFilters.map(({ key, label, value }) => (
            <button
              key={key}
              type="button"
              aria-label={`Xóa bộ lọc ${label}: ${value}`}
              className="filter-panel__badge"
              onClick={() => handleLocalChange(key, defaultFilterValues[key])}
            >
              <span>{label}: {value}</span><X size={11} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {isExpanded && (
        <div id="dashboard-filter-fields" className="filter-panel__body">
          <div className="filter-panel__grid">
            <SelectField label="Khoảng thời gian" value={localFilters.dateRange} options={textOptions(dateRanges)} onChange={(value) => handleLocalChange("dateRange", value)} />
            {localFilters.dateRange === "Tùy chỉnh" && (
              <>
                <label className="filter-panel__date-field">
                  <span>TỪ NGÀY VÀ GIỜ</span>
                  <input aria-label="Từ ngày và giờ" type="datetime-local" value={localFilters.customDateFrom ?? ""} onChange={(event) => handleLocalChange("customDateFrom", event.target.value)} />
                </label>
                <label className="filter-panel__date-field">
                  <span>ĐẾN NGÀY VÀ GIỜ</span>
                  <input aria-label="Đến ngày và giờ" type="datetime-local" value={localFilters.customDateTo ?? ""} onChange={(event) => handleLocalChange("customDateTo", event.target.value)} />
                </label>
              </>
            )}
            <SelectField label="Kênh" value={localFilters.channel} options={channels} onChange={(value) => handleLocalChange("channel", value)} />
            <SelectField
              label="Chủ đề"
              value={localFilters.topic}
              options={resolvedTopics}
              onChange={(value) => handleLocalChange("topic", value)}
              helper={(
                <span className="filter-panel__catalog" title={catalogPending ? "Chưa có catalog động đầy đủ" : "Catalog đã sẵn sàng"}>
                  <span>Danh mục {topicCatalogSource}</span>
                  <strong data-state={catalogPending ? "pending" : "ready"}>{catalogPending ? "Đang chờ dữ liệu" : "Đã kết nối"}</strong>
                </span>
              )}
            />
            <SelectField label="Trạng thái hội thoại" value={localFilters.conversationStatus} options={textOptions(conversationStatuses)} onChange={(value) => handleLocalChange("conversationStatus", value)} />
            <SelectField label="Trạng thái AI" value={localFilters.aiStatus} options={textOptions(aiStatuses)} onChange={(value) => handleLocalChange("aiStatus", value)} />
          </div>
          <div className="filter-panel__actions">
            <button type="button" onClick={handleReset} className="filter-panel__reset">Đặt lại</button>
            <button type="button" onClick={handleApply} aria-label="Áp dụng bộ lọc" className="filter-panel__apply">Áp dụng</button>
          </div>
        </div>
      )}
    </section>
  );
}
