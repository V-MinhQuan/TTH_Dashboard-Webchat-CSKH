import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Download, Filter, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { AI_FAILURE_TAXONOMY } from "../constants/aiFailureTaxonomy";
import { useSettings } from "../context/SettingsContext";
import "../../styles/globals.css";

const NAVY = "#003865";
const CTA = "#ED5206";
const CTA_SOFT = "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const ALL = "Tất cả";
const FAILED_AI_STATUS = "AI trả lời thất bại";

export interface FilterValues {
  dateRange: string;
  customDateFrom?: string;
  customDateTo?: string;
  channel: string;
  topic: string;
  conversationStatus: string;
  aiStatus: string;
  aiFailureType: string;
  sentiment: string;
}

export interface FilterCatalogOption {
  readonly value: string;
  readonly label: string;
  readonly available?: boolean;
  readonly unavailableReason?: string;
}

export const defaultFilterValues: Readonly<FilterValues> = Object.freeze({
  dateRange: "30 ngày qua",
  channel: ALL,
  topic: ALL,
  conversationStatus: ALL,
  aiStatus: ALL,
  aiFailureType: ALL,
  sentiment: ALL,
});

export interface FilterPanelProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  topicCatalog?: readonly FilterCatalogOption[];
  topicCatalogSource?: string;
}

const dateRanges = ["30 ngày qua", "7 ngày qua", "Hôm nay", "Tháng này", "Quý này", "Tùy chỉnh"];
const fallbackTopics: readonly FilterCatalogOption[] = Object.freeze([
  "TOEIC", "VSTEP", "Chuẩn đầu ra ngoại ngữ", "Tin học / MOS / IC3", "Thủ tục nhập học", "Đăng ký học phần", "Lịch thi", "Khác",
].map((label) => Object.freeze({ value: label, label, available: true })));
const conversationStatuses = [ALL, "Chờ xử lý", "Đang tư vấn / Chờ phản hồi", "Hoàn thành"];
const aiStatuses = [ALL, "AI trả lời thành công", FAILED_AI_STATUS];
const sentiments = [ALL, "Tích cực", "Trung lập", "Tiêu cực"];

// Req #16 – export format types
type ExportFormat = "pdf" | "png" | "csv" | "xlsx";

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
  return merged.aiStatus === FAILED_AI_STATUS
    ? merged
    : { ...merged, aiFailureType: ALL };
}

type ActiveFilterKey = "dateRange" | "channel" | "topic" | "conversationStatus" | "aiStatus" | "aiFailureType" | "sentiment";

const ACTIVE_FILTER_LABELS: Readonly<Record<ActiveFilterKey, string>> = Object.freeze({
  dateRange: "Thời gian",
  channel: "Kênh",
  topic: "Chủ đề",
  conversationStatus: "Hội thoại",
  aiStatus: "AI",
  aiFailureType: "Loại lỗi AI",
  sentiment: "Cảm xúc",
});

// ── Req #16: Export helpers ─────────────────────────────────────────────────
async function exportPdf(target: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(target, {
    backgroundColor: "#ffffff",
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    useCORS: true,
    logging: false,
    width: target.scrollWidth,
    height: target.scrollHeight,
    windowWidth: Math.max(document.documentElement.clientWidth, target.scrollWidth),
    windowHeight: Math.max(document.documentElement.clientHeight, target.scrollHeight),
  });
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let remaining = imgHeight;
  let yOffset = 0;
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, yOffset, pageWidth, imgHeight, undefined, "FAST");
  remaining -= pageHeight;
  while (remaining > 0) {
    yOffset = -(imgHeight - remaining);
    pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, yOffset, pageWidth, imgHeight, undefined, "FAST");
    remaining -= pageHeight;
  }
  pdf.save(filename);
}

async function exportPng(target: HTMLElement, filename: string) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(target, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

function collectTableData(target: HTMLElement): { headers: string[]; rows: string[][] } {
  const tables = Array.from(target.querySelectorAll("table"));
  if (!tables.length) return { headers: [], rows: [] };
  const table = tables[0];
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
  const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) => td.textContent?.trim() ?? ""),
  );
  return { headers, rows };
}

function exportCsv(data: { headers: string[]; rows: string[][] }, filename: string) {
  const escape = (v: string) => {
    const safe = /^[=+@-]/.test(v.trimStart()) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = [data.headers.map(escape).join(","), ...data.rows.map((row) => row.map(escape).join(","))];
  const blob = new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** XLSX export via SheetJS (cdn-free, inline approach) */
async function exportXlsx(data: { headers: string[]; rows: string[][] }, filename: string) {
  // Dynamic import of xlsx (already in deps via sheetjs or we use a simple approach)
  try {
    // Use the xlsx library if available
    const XLSX = await import("xlsx").catch(() => null);
    if (XLSX) {
      const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dữ liệu");
      XLSX.writeFile(wb, filename);
      return;
    }
  } catch {
    // fall through
  }
  // Fallback: export as CSV with .xlsx extension (opens in Excel)
  exportCsv(data, filename.replace(".xlsx", ".csv"));
  toast.info("Thư viện XLSX chưa được cài đặt – đã xuất CSV thay thế.", { duration: 4000 });
}

// ────────────────────────────────────────────────────────────────────────────

export function FilterPanel({
  filters,
  onFiltersChange,
  topicCatalog,
  topicCatalogSource = "Care Hub",
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [localFilters, setLocalFilters] = useState<FilterValues>(() => normalizeFilters(filters));
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();

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
    setLocalFilters(normalizeFilters(filters));
  }, [filters]);

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocalChange = (key: keyof FilterValues, value: string) => {
    setLocalFilters((previous) => {
      if (key === "dateRange" && value !== "Tùy chỉnh") {
        const { customDateFrom: _from, customDateTo: _to, ...remaining } = previous;
        return { ...remaining, dateRange: value };
      }
      if (key === "aiStatus" && value !== FAILED_AI_STATUS) {
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
      if (new Date(localFilters.customDateFrom).getTime() > new Date(localFilters.customDateTo).getTime()) {
        toast.error("Thời gian bắt đầu phải trước thời gian kết thúc.");
        return;
      }
    }
    onFiltersChange({ ...localFilters });
    toast.success("Đã áp dụng bộ lọc");
  };

  const handleReset = () => {
    const nextFilters = { ...defaultFilterValues };
    setLocalFilters(nextFilters);
    onFiltersChange(nextFilters);
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

      if (format === "pdf") {
        toast.info("Đang tạo PDF...");
        await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
        await exportPdf(target, `${base}.pdf`);
        toast.success("Đã xuất PDF", { description: "File đã được tải xuống." });
      } else if (format === "png") {
        toast.info("Đang chụp màn hình...");
        await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
        await exportPng(target, `${base}.png`);
        toast.success("Đã xuất PNG");
      } else if (format === "csv") {
        const data = collectTableData(target);
        if (!data.headers.length) {
          toast.warning("Không tìm thấy bảng dữ liệu để xuất CSV.");
          return;
        }
        exportCsv(data, `${base}.csv`);
        toast.success(`Đã xuất CSV – ${data.rows.length} dòng`);
      } else if (format === "xlsx") {
        const data = collectTableData(target);
        if (!data.headers.length) {
          toast.warning("Không tìm thấy bảng dữ liệu để xuất Excel.");
          return;
        }
        await exportXlsx(data, `${base}.xlsx`);
        toast.success(`Đã xuất Excel – ${data.rows.length} dòng`);
      }
    } catch {
      toast.error("Không thể xuất dữ liệu. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  const activeFilters = (Object.keys(ACTIVE_FILTER_LABELS) as ActiveFilterKey[])
    .filter((key) => localFilters[key] !== defaultFilterValues[key])
    .filter((key) => key !== "aiFailureType" || localFilters.aiStatus === FAILED_AI_STATUS)
    .map((key) => ({ key, label: ACTIVE_FILTER_LABELS[key], value: localFilters[key] }));

  return (
    <section className="filter-panel" aria-label="Bộ lọc dữ liệu">
      <div className="filter-panel__header">
        <button
          type="button"
          className="filter-panel__toggle"
          aria-expanded={isExpanded}
          aria-controls="dashboard-filter-fields"
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          <Filter size={15} aria-hidden="true" />
          <span>Bộ lọc dữ liệu</span>
          {activeFilters.length > 0 && <span className="filter-panel__count">{activeFilters.length} bộ lọc</span>}
        </button>

        {/* Req #16: Multi-format export dropdown */}
        <div style={{ position: "relative" }} ref={exportMenuRef}>
          <button
            type="button"
            disabled={exporting}
            data-print-hidden="true"
            className="filter-panel__export"
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            onClick={() => setExportMenuOpen((prev) => !prev)}
          >
            <Download size={12} aria-hidden="true" />
            {exporting ? "Đang xuất..." : "Xuất dữ liệu"}
            <ChevronDown size={11} aria-hidden="true" style={{ marginLeft: "2px" }} />
          </button>
          {exportMenuOpen && !exporting && (
            <div
              role="menu"
              aria-label="Chọn định dạng xuất"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 50,
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
            </div>
          )}
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
            {localFilters.aiStatus === FAILED_AI_STATUS && (
              <SelectField
                label="Loại lỗi AI (8 nhóm)"
                value={localFilters.aiFailureType}
                options={withAll(AI_FAILURE_TAXONOMY.map((item) => ({ value: item.apiValue, label: item.label, available: true })))}
                onChange={(value) => handleLocalChange("aiFailureType", value)}
              />
            )}
            <SelectField label="Cảm xúc" value={localFilters.sentiment} options={textOptions(sentiments)} onChange={(value) => handleLocalChange("sentiment", value)} />
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
