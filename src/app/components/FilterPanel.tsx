import { useState, useEffect } from "react";
import { Filter, Download } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../context/SettingsContext";

const NAVY   = "#003865";
const ORANGE  = "#D73C01";
const CTA     = "#ED5206";
const CTA_SOFT= "#F36C2E";
const ORANGE_50 = "#FFF4EE";

export interface FilterValues {
  dateRange: string;
  customDateFrom?: string;
  customDateTo?: string;
  channel: string;
  topic: string;
  conversationStatus: string;
  aiStatus: string;
}

export const defaultFilterValues: FilterValues = {
  dateRange: "30 ngày qua",
  channel: "Tất cả",
  topic: "Tất cả",
  conversationStatus: "Tất cả",
  aiStatus: "Tất cả",
};

interface FilterPanelProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
}

const dateRanges = ["30 ngày qua", "7 ngày qua", "Hôm nay", "Tháng này", "Quý này", "Tùy chỉnh"];
const topics = ["Tất cả", "TOEIC", "VSTEP", "Chuẩn đầu ra", "Tin học", "Tra cứu điểm", "Lịch thi", "Khác"];
const conversationStatuses = ["Tất cả", "Chờ xử lý", "Đang xử lý", "Hoàn thành"];
const aiStatuses = ["Tất cả", "AI trả lời thành công", "AI trả lời thất bại", "Không tìm thấy dữ liệu"];

export function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [localFilters, setLocalFilters] = useState<FilterValues>(filters);
  const [exporting, setExporting] = useState(false);
  const { settings } = useSettings();

  const channels = ["Tất cả"];
  if (settings.dataSourceZalo) channels.push("Zalo OA");
  if (settings.dataSourceZaloBiz) channels.push("Zalo Business");
  if (settings.dataSourceWidget) channels.push("Chat Widget");
  if (settings.dataSourceFb) channels.push("Facebook");

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleLocalChange = (key: keyof FilterValues, value: string) => {
    setLocalFilters((prev) => {
      if (key === "dateRange" && value !== "Tùy chỉnh") {
        const nextFilters = { ...prev, dateRange: value };
        delete nextFilters.customDateFrom;
        delete nextFilters.customDateTo;
        return nextFilters;
      }

      return { ...prev, [key]: value };
    });
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    toast.success("Đã áp dụng bộ lọc");
  };

  const handleReset = () => {
    const nextFilters = { ...defaultFilterValues };
    setLocalFilters(nextFilters);
    onFiltersChange(nextFilters);
    toast.info("Đã đặt lại bộ lọc");
  };

  const handleExport = async () => {
    const target = document.querySelector<HTMLElement>('[data-pdf-report="overview"]');
    if (!target) {
      toast.error("Không tìm thấy mẫu báo cáo tổng quan để xuất PDF.");
      return;
    }

    try {
      setExporting(true);
      toast.info("Đang tạo báo cáo PDF...");

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

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

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 0;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      const imageHeight = (canvas.height * printableWidth) / canvas.width;
      const imageData = canvas.toDataURL("image/png");

      let remainingHeight = imageHeight;
      let y = margin;
      pdf.addImage(imageData, "PNG", margin, y, printableWidth, imageHeight, undefined, "FAST");
      remainingHeight -= printableHeight;

      while (remainingHeight > 0) {
        y = margin - (imageHeight - remainingHeight);
        pdf.addPage();
        pdf.addImage(imageData, "PNG", margin, y, printableWidth, imageHeight, undefined, "FAST");
        remainingHeight -= printableHeight;
      }

      pdf.save(`tong-quan-he-thong-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Đã xuất PDF", { description: "File PDF đã được tải xuống." });
    } catch (err: any) {
      toast.error(err.message || "Không thể xuất PDF.");
    } finally {
      setExporting(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px",
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
    paddingRight: "28px",
    width: "100%",
  };

  const SelectField = ({ label, value, options, onChange, style }: { label: string; value: string; options: string[]; onChange: (v: string) => void; style?: React.CSSProperties }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", ...style }}>
      <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.05em" }}>
        {label.toUpperCase()}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const hasActiveFilters = localFilters.channel !== defaultFilterValues.channel ||
    localFilters.topic !== defaultFilterValues.topic ||
    localFilters.conversationStatus !== defaultFilterValues.conversationStatus ||
    localFilters.aiStatus !== defaultFilterValues.aiStatus ||
    localFilters.dateRange !== defaultFilterValues.dateRange;

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        border: "1px solid rgba(0,56,101,0.08)",
        boxShadow: "0 2px 8px rgba(0,56,101,0.05)",
        overflow: "hidden",
        marginBottom: "20px",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Header */}
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", cursor: "pointer", borderBottom: isExpanded ? "1px solid rgba(0,56,101,0.06)" : "none" }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Filter size={15} style={{ color: ORANGE }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>Bộ lọc dữ liệu</span>
          {hasActiveFilters && (
            <span style={{ fontSize: "10px", backgroundColor: ORANGE_50, color: CTA, border: "1px solid #FBCBB8", borderRadius: "20px", padding: "2px 7px", fontWeight: 700 }}>Đang lọc</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleExport(); }}
          disabled={exporting}
          data-print-hidden="true"
          style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", cursor: exporting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: NAVY, opacity: exporting ? 0.65 : 1 }}
        >
          <Download size={12} /> {exporting ? "Đang xuất..." : "Xuất PDF"}
        </button>
      </div>

      {isExpanded && (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "end", marginBottom: "16px" }}>
            <SelectField
              label="Khoảng thời gian"
              value={localFilters.dateRange}
              options={dateRanges}
              onChange={(v) => handleLocalChange("dateRange", v)}
            />
            {localFilters.dateRange === "Tùy chỉnh" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.05em" }}>TỪ NGÀY & GIỜ</label>
                  <input type="datetime-local" value={localFilters.customDateFrom || ""} onChange={(e) => handleLocalChange("customDateFrom", e.target.value)} style={{ padding: "7px 10px", borderRadius: "8px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "12px", color: NAVY, outline: "none", width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.05em" }}>ĐẾN NGÀY & GIỜ</label>
                  <input type="datetime-local" value={localFilters.customDateTo || ""} onChange={(e) => handleLocalChange("customDateTo", e.target.value)} style={{ padding: "7px 10px", borderRadius: "8px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "12px", color: NAVY, outline: "none", width: "100%", boxSizing: "border-box" }} />
                </div>
              </>
            )}
            <SelectField label="Kênh" value={localFilters.channel} options={channels} onChange={(v) => handleLocalChange("channel", v)} />
            <SelectField label="Chủ đề" value={localFilters.topic} options={topics} onChange={(v) => handleLocalChange("topic", v)} />
            <SelectField label="Trạng thái hội thoại" value={localFilters.conversationStatus} options={conversationStatuses} onChange={(v) => handleLocalChange("conversationStatus", v)} />
            <SelectField label="Trạng thái AI" value={localFilters.aiStatus} options={aiStatuses} onChange={(v) => handleLocalChange("aiStatus", v)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={handleReset}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
            >
              Đặt lại
            </button>
            <button
              onClick={handleApply}
              style={{ padding: "8px 22px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "13px", boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
