import { useState, useRef, useEffect } from "react";
import {
  SlidersHorizontal, Table2, BarChart2, Settings2, ExternalLink,
  X, Check, ChevronDown, BarChart, LineChart, PieChart, AreaChart,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../context/SettingsContext";
import {
  BarChart as ReBarChart, Bar, LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell, AreaChart as ReAreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const NAVY      = "#003BB9";
const ORANGE    = "#D73C01";   // used only for active border/icon accents
const CTA       = "#ED5206";
const CTA_SOFT  = "#F36C2E";
const ORANGE_50 = "#FFF4EE";  // soft active toolbar bg
const ORANGE_200= "#FBCBB8";  // soft border
const AMBER_50  = "#FFF7E6";
const AMBER_TEXT= "#B7791F";
const RED_50    = "#FFF1F1";
const RED_TEXT  = "#B42318";

const chartTypes = [
  { id: "bar", label: "Cột đứng", icon: BarChart },
  { id: "line", label: "Đường", icon: LineChart },
  { id: "area", label: "Vùng", icon: AreaChart },
  { id: "donut", label: "Hình khuyên (Donut)", icon: PieChart },
  { id: "pie", label: "Hình tròn", icon: PieChart },
  { id: "hbar", label: "Cột ngang", icon: BarChart },
];

const topics = ["TOEIC", "VSTEP", "Chuẩn đầu ra", "MOS/IC3", "Tin học cơ sở"];

const baseData = [
  { name: "TOEIC", hoidthoai: 420, ai_ok: 360, ai_fail: 60, sentiment: 72 },
  { name: "VSTEP", hoidthoai: 280, ai_ok: 230, ai_fail: 50, sentiment: 68 },
  { name: "Chuẩn đầu ra", hoidthoai: 350, ai_ok: 295, ai_fail: 55, sentiment: 75 },
  { name: "MOS/IC3", hoidthoai: 190, ai_ok: 158, ai_fail: 32, sentiment: 80 },
  { name: "Tin học", hoidthoai: 240, ai_ok: 195, ai_fail: 45, sentiment: 65 },
  { name: "Lệ phí", hoidthoai: 310, ai_ok: 250, ai_fail: 60, sentiment: 60 },
  { name: "Lịch thi", hoidthoai: 380, ai_ok: 312, ai_fail: 68, sentiment: 78 },
];

const filteredData = [
  { name: "TOEIC", hoidthoai: 180, ai_ok: 155, ai_fail: 25, sentiment: 79 },
  { name: "VSTEP", hoidthoai: 120, ai_ok: 100, ai_fail: 20, sentiment: 71 },
  { name: "Chuẩn đầu ra", hoidthoai: 145, ai_ok: 128, ai_fail: 17, sentiment: 82 },
  { name: "MOS/IC3", hoidthoai: 80, ai_ok: 70, ai_fail: 10, sentiment: 85 },
  { name: "Tin học", hoidthoai: 95, ai_ok: 78, ai_fail: 17, sentiment: 68 },
  { name: "Lệ phí", hoidthoai: 130, ai_ok: 105, ai_fail: 25, sentiment: 62 },
  { name: "Lịch thi", hoidthoai: 160, ai_ok: 132, ai_fail: 28, sentiment: 80 },
];

const sourceTableData = [
  { date: "2025-01-15", channel: "Facebook", topic: "TOEIC", count: 48, ai_ok: 42, ai_fail: 6, sentiment: "Tích cực", status: "Đã xử lý" },
  { date: "2025-01-15", channel: "Zalo OA", topic: "VSTEP", count: 32, ai_ok: 28, ai_fail: 4, sentiment: "Trung lập", status: "Đang xử lý" },
  { date: "2025-01-14", channel: "Chat Widget", topic: "Chuẩn đầu ra", count: 41, ai_ok: 35, ai_fail: 6, sentiment: "Tích cực", status: "Đã xử lý" },
  { date: "2025-01-14", channel: "Facebook", topic: "MOS/IC3", count: 22, ai_ok: 20, ai_fail: 2, sentiment: "Tích cực", status: "Đã xử lý" },
  { date: "2025-01-13", channel: "Zalo Business", topic: "Tin học cơ sở", count: 28, ai_ok: 22, ai_fail: 6, sentiment: "Tiêu cực", status: "Chờ quản lý xác nhận" },
  { date: "2025-01-13", channel: "Zalo OA", topic: "Lệ phí thi", count: 35, ai_ok: 28, ai_fail: 7, sentiment: "Trung lập", status: "Đã xử lý" },
  { date: "2025-01-12", channel: "Chat Widget", topic: "Lịch thi", count: 44, ai_ok: 37, ai_fail: 7, sentiment: "Tích cực", status: "Đã xử lý" },
  { date: "2025-01-12", channel: "Facebook", topic: "Tra cứu điểm", count: 19, ai_ok: 14, ai_fail: 5, sentiment: "Tiêu cực", status: "Chờ quản lý xác nhận" },
];

const COLORS = [NAVY, CTA, "rgba(0,59,185,0.6)", CTA_SOFT, "rgba(0,59,185,0.3)", ORANGE_200];

function normalizeValue(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function isChannelKey(key: string) {
  const normalized = normalizeValue(key);
  return ["zalooa", "zalobusiness", "facebook", "chatwidget"].includes(normalized);
}

function toTableRows(data: any) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    return Object.entries(data).map(([key, value]) => ({ name: key, value }));
  }
  return sourceTableData;
}

function formatCellValue(value: any) {
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (value === null || value === undefined) return "";
  return String(value);
}

function ChartRenderer({ type, data }: { type: string; data: typeof baseData }) {
  if (type === "donut" || type === "pie") {
    const pieData = data.map((d) => ({ name: d.name, value: d.hoidthoai }));
    return (
      <ResponsiveContainer width="100%" height={200}>
        <RePieChart id="pie-chart">
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={type === "donut" ? 50 : 0} outerRadius={80} dataKey="value">
            {pieData.map((entry, i) => <Cell key={`chartcard-pie-${entry.name}`} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend iconSize={10} />
        </RePieChart>
      </ResponsiveContainer>
    );
  }
  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <ReLineChart id="line-chart" data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <YAxis tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="hoidthoai" name="Hội thoại" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="ai_ok" name="AI trả lời thành công" stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
        </ReLineChart>
      </ResponsiveContainer>
    );
  }
  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <ReAreaChart id="area-chart" data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <YAxis tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="hoidthoai" name="Hội thoại" stroke={NAVY} fill={`${NAVY}20`} strokeWidth={2} />
          <Area type="monotone" dataKey="ai_ok" name="AI trả lời thành công" stroke={ORANGE} fill={`${ORANGE}20`} strokeWidth={2} />
        </ReAreaChart>
      </ResponsiveContainer>
    );
  }
  if (type === "hbar") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <ReBarChart id="hbar-chart" data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} width={80} />
          <Tooltip />
          <Legend />
          <Bar dataKey="hoidthoai" name="Hội thoại" fill={NAVY} radius={[0, 4, 4, 0]} />
          <Bar dataKey="ai_ok" name="AI trả lời thành công" fill={ORANGE} radius={[0, 4, 4, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ReBarChart id="bar-chart" data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
        <YAxis tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="hoidthoai" name="Hội thoại" fill={NAVY} radius={[4, 4, 0, 0]} />
        <Bar dataKey="ai_ok" name="AI trả lời thành công" fill={ORANGE} radius={[4, 4, 0, 0]} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

interface ChartCardProps {
  title: string;
  children?: React.ReactNode | ((props: any) => React.ReactNode);
  useDefaultChart?: boolean;
  defaultChartType?: string;
  supportedChartTypes?: string[];
  onOpenBuilder?: () => void;
  data?: any;
  showToolbarActions?: boolean;
}

export function ChartCard({ title, children, useDefaultChart, defaultChartType = "bar", supportedChartTypes, onOpenBuilder, data, showToolbarActions = true }: ChartCardProps) {
  const [chartType, setChartType] = useState(defaultChartType);
  const [chartTitle, setChartTitle] = useState(title);
  const [isEdited, setIsEdited] = useState(false);
  const [filterActive, setFilterActive] = useState(false);
  const [chartData, setChartData] = useState(data || baseData);
  const { settings } = useSettings();

  const channels = ["Tất cả"];
  if (settings.dataSourceZalo) channels.push("Zalo OA");
  if (settings.dataSourceZaloBiz) channels.push("Zalo Business");
  if (settings.dataSourceWidget) channels.push("Chat Widget");
  if (settings.dataSourceFb) channels.push("Facebook");

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);

  const [filterValues, setFilterValues] = useState({ dateRange: "30 ngày qua", channel: "Tất cả", topic: "Tất cả", status: "Tất cả", aiStatus: "Tất cả" });
  const [editValues, setEditValues] = useState({ title: chartTitle, axisX: "Chủ đề", values: "Số hội thoại", legend: true, sort: "Mặc định", dataLabels: false });

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChartData(data || baseData);
    setFilterActive(false);
  }, [data]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setChartTypeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toolbarItems = [
    {
      icon: SlidersHorizontal,
      tooltip: "Lọc dữ liệu",
      active: filterActive,
      onClick: () => { setFilterPanelOpen(true); setDataModalOpen(false); setEditPanelOpen(false); },
    },
    {
      icon: Table2,
      tooltip: "Xem dữ liệu",
      active: dataModalOpen,
      onClick: () => setDataModalOpen(true),
    },
    {
      icon: BarChart2,
      tooltip: "Đổi loại biểu đồ",
      active: chartTypeOpen,
      onClick: () => setChartTypeOpen(!chartTypeOpen),
    },
    {
      icon: Settings2,
      tooltip: "Chỉnh sửa biểu đồ",
      active: editPanelOpen,
      onClick: () => { setEditPanelOpen(true); setFilterPanelOpen(false); },
    },
    {
      icon: ExternalLink,
      tooltip: "Mở trong Trình tạo biểu đồ",
      active: false,
      onClick: () => { onOpenBuilder?.(); toast.info("Mở trong Trình tạo biểu đồ..."); },
    },
  ];

  const applyLocalFilters = (rawValues: any[], filters: typeof filterValues) => {
    if (!rawValues || !Array.isArray(rawValues)) return rawValues;
    let processed = [...rawValues];

    const hasDateField = processed.some(item => item && typeof item === "object" && "date" in item);

    if (hasDateField && filters.dateRange === "7 ngày qua") {
      processed = processed.slice(-7);
    } else if (hasDateField && filters.dateRange === "Hôm nay") {
      processed = processed.slice(-2);
    }

    if (filters.channel !== "Tất cả") {
      const target = normalizeValue(filters.channel);
      const hasChannelField = processed.some(item => item && typeof item === "object" && "channel" in item);

      if (hasChannelField) {
        processed = processed.filter(item => normalizeValue(item.channel) === target);
      } else {
        processed = processed.map(item => {
          if (!item || typeof item !== "object") return item;
          const channelKeys = Object.keys(item).filter(isChannelKey);
          if (!channelKeys.length) return item;

          return Object.keys(item).reduce((acc: any, key) => {
            if (key === "date" || key === "name") {
              acc[key] = item[key];
            } else if (normalizeValue(key) === target) {
              acc[key] = item[key];
            } else if (isChannelKey(key)) {
              acc[key] = 0;
            } else {
              acc[key] = item[key];
            }
            return acc;
          }, {});
        });
      }
    }

    if (filters.topic !== "Tất cả") {
      const target = normalizeValue(filters.topic);
      const hasTopicField = processed.some(item => item && typeof item === "object" && "topic" in item);
      if (hasTopicField) {
        processed = processed.filter(item => normalizeValue(item.topic) === target);
      }
    }

    if (filters.status !== "Tất cả") {
      const target = filters.status;
      const hasStatusField = processed.some(item => item && typeof item === "object" && "status" in item);
      if (hasStatusField) {
        processed = processed.filter(item => item.status === target);
      } else {
        processed = processed.map(item => {
          if (!item || typeof item !== "object" || !(target in item)) return item;
          return Object.keys(item).reduce((acc: any, key) => {
            if (key === "channel" || key === "date" || key === "name") {
              acc[key] = item[key];
            } else if (["Chờ xử lý", "Đang tư vấn / Chờ phản hồi", "Đang xử lý", "Hoàn thành"].includes(key)) {
              acc[key] = key === target ? item[key] : 0;
            } else {
              acc[key] = item[key];
            }
            return acc;
          }, {});
        });
      }
    }

    if (filters.aiStatus !== "Tất cả") {
      processed = processed.map(item => {
        if (!item || typeof item !== "object") return item;
        const newItem = { ...item };
        if (filters.aiStatus === "AI trả lời thành công" && "ai_fail" in newItem) newItem.ai_fail = 0;
        if (filters.aiStatus === "AI trả lời thất bại" && "ai_ok" in newItem) newItem.ai_ok = 0;
        return newItem;
      });
    }
    return processed;
  };

  const applyLocalFiltersToObject = (rawObj: Record<string, number>, filters: typeof filterValues) => {
    if (!rawObj || typeof rawObj !== "object" || Array.isArray(rawObj)) return rawObj;
    let processed = { ...rawObj };

    if (filters.channel !== "Tất cả") {
      const matchKey = Object.keys(processed).find(k => k.toLowerCase().includes(filters.channel.toLowerCase().replace(" ", "")));
      Object.keys(processed).forEach(key => {
        if (key !== matchKey) {
          processed[key] = 0;
        }
      });
    }

    let scale = 1.0;
    if (filters.topic !== "Tất cả") {
      if (filters.topic.includes("TOEIC")) scale = 0.3;
      else if (filters.topic.includes("VSTEP")) scale = 0.2;
      else if (filters.topic.includes("Chuẩn đầu ra")) scale = 0.25;
      else if (filters.topic.includes("MOS/IC3")) scale = 0.15;
      else if (filters.topic.includes("Tin học")) scale = 0.1;
      else scale = 0.05;
    }

    if (scale !== 1.0) {
      Object.keys(processed).forEach(key => {
        processed[key] = Math.round(processed[key] * scale);
      });
    }

    return processed;
  };

  const handleFilterApply = () => {
    setFilterPanelOpen(false);
    setFilterActive(true);
    const sourceData = data || baseData;
    if (Array.isArray(sourceData)) {
      setChartData(applyLocalFilters(sourceData, filterValues));
    } else {
      setChartData(applyLocalFiltersToObject(sourceData, filterValues));
    }
    toast.success("Đã áp dụng bộ lọc", { description: "Biểu đồ đã cập nhật dữ liệu" });
  };

  const handleFilterReset = () => {
    setFilterActive(false);
    setChartData(data || baseData);
    setFilterValues({ dateRange: "30 ngày qua", channel: "Tất cả", topic: "Tất cả", status: "Tất cả", aiStatus: "Tất cả" });
    setFilterPanelOpen(false);
    toast.info("Đã đặt lại bộ lọc biểu đồ");
  };

  const handleSaveEdit = () => {
    setChartTitle(editValues.title);
    setIsEdited(true);
    setEditPanelOpen(false);
    toast.success("Đã lưu cấu hình biểu đồ");
  };

  const sentimentColors: Record<string, string> = { "Tích cực": "#228A61", "Trung lập": AMBER_TEXT, "Tiêu cực": RED_TEXT };
  const tableRows = toTableRows(chartData);
  const tableColumns = Array.from(
    new Set(tableRows.flatMap((row: any) => row && typeof row === "object" ? Object.keys(row) : []))
  );

  return (
    <div style={{ position: "relative" }}>
      {/* Chart Card */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "20px",
          border: "1px solid rgba(0,59,185,0.08)",
          boxShadow: "0 2px 12px rgba(0,59,185,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px", color: NAVY }}>{chartTitle}</span>
            {isEdited && (
              <span style={{ fontSize: "10px", backgroundColor: "#f0fdf4", color: "#228A61", padding: "2px 8px", borderRadius: "20px", fontWeight: 600, border: "1px solid #bbf7d0" }}>
                Đã chỉnh sửa
              </span>
            )}
            {filterActive && (
              <span style={{ fontSize: "10px", backgroundColor: ORANGE_50, color: ORANGE, padding: "2px 8px", borderRadius: "20px", fontWeight: 600, border: `1px solid ${ORANGE_200}` }}>
                Đã lọc
              </span>
            )}
          </div>
          {showToolbarActions && (
            <div style={{ display: "flex", gap: "4px", position: "relative" }} ref={popoverRef}>
              {toolbarItems.map(({ icon: Icon, tooltip, active, onClick }, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <button
                    onClick={onClick}
                    title={tooltip}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      border: active ? `1.5px solid ${ORANGE}` : "1.5px solid transparent",
                      backgroundColor: active ? ORANGE_50 : "#f8fafc",
                      color: active ? ORANGE : "rgba(0,59,185,0.5)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f0f4f8";
                        (e.currentTarget as HTMLButtonElement).style.color = NAVY;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f8fafc";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,59,185,0.5)";
                      }
                    }}
                  >
                    <Icon size={14} />
                  </button>
                </div>
              ))}

              {/* Chart Type Popover */}
              {chartTypeOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  backgroundColor: "#fff",
                  borderRadius: "14px",
                  boxShadow: "0 8px 32px rgba(0,59,185,0.18)",
                  border: "1px solid rgba(0,59,185,0.1)",
                  padding: "12px",
                  zIndex: 200,
                  width: "280px",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 600, color: "rgba(0,59,185,0.5)", marginBottom: "10px", letterSpacing: "0.05em" }}>CHỌN LOẠI BIỂU ĐỒ</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {chartTypes.map((ct) => {
                    const Ic = ct.icon;
                    const isSelected = chartType === ct.id;
                    return (
                      <button
                        key={ct.id}
                        onClick={() => {
                          if (supportedChartTypes && !supportedChartTypes.includes(ct.id)) {
                            toast.error(`Dữ liệu không phù hợp với biểu đồ ${ct.label.toLowerCase()}`);
                            return;
                          }
                          setChartType(ct.id);
                          setChartTypeOpen(false);
                          toast.success(`Đã đổi loại biểu đồ: ${ct.label}`);
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "6px",
                          padding: "10px 6px",
                          borderRadius: "10px",
                          border: isSelected ? `2px solid ${ORANGE}` : "2px solid transparent",
                          backgroundColor: isSelected ? ORANGE_50 : "#f8fafc",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <Ic size={16} style={{ color: isSelected ? ORANGE : "rgba(0,59,185,0.6)" }} />
                        <span style={{ fontSize: "11px", color: isSelected ? ORANGE : "rgba(0,59,185,0.7)", fontWeight: isSelected ? 600 : 400 }}>{ct.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          )}
        </div>

        {/* Chart Content */}
        <div style={{ padding: "16px 20px 20px" }}>
          {typeof children === "function" ? (
            (children as Function)({ chartType, chartData, editValues, filterValues })
          ) : useDefaultChart ? (
            <ChartRenderer type={chartType} data={chartData} />
          ) : (
            children
          )}
        </div>
      </div>

      {/* Filter Side Panel */}
      {filterPanelOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 300, backgroundColor: "rgba(0,0,0,0.2)" }}
            onClick={() => setFilterPanelOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "360px",
              backgroundColor: "#fff",
              boxShadow: "-8px 0 32px rgba(0,59,185,0.15)",
              zIndex: 400,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "24px", borderBottom: "1px solid rgba(0,59,185,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: NAVY, fontSize: "16px", fontWeight: 700 }}>Bộ lọc biểu đồ</h3>
              <button onClick={() => setFilterPanelOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgba(0,59,185,0.4)", padding: "4px" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { label: "Khoảng thời gian", key: "dateRange", options: ["30 ngày qua", "7 ngày qua", "Hôm nay", "Tháng này"] },
                { label: "Kênh", key: "channel", options: channels },
                { label: "Chủ đề", key: "topic", options: ["Tất cả", ...topics] },
                { label: "Trạng thái hội thoại", key: "status", options: ["Tất cả", "Chờ xử lý", "Đang tư vấn / Chờ phản hồi", "Hoàn thành"] },
                { label: "Trạng thái AI", key: "aiStatus", options: ["Tất cả", "AI trả lời thành công", "AI trả lời thất bại", "AI không chắc chắn"] },
              ].map(({ label, key, options }) => (
                <div key={key}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(0,59,185,0.5)", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                    {label.toUpperCase()}
                  </label>
                  <select
                    value={(filterValues as any)[key]}
                    onChange={(e) => setFilterValues({ ...filterValues, [key]: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid rgba(0,59,185,0.12)", fontSize: "13px", color: NAVY, outline: "none", cursor: "pointer" }}
                  >
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ padding: "20px 24px", borderTop: "1px solid rgba(0,59,185,0.08)", display: "flex", gap: "10px" }}>
              <button onClick={handleFilterReset} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid rgba(0,59,185,0.15)", background: "#fff", cursor: "pointer", fontSize: "13px", color: NAVY, fontWeight: 500 }}>
                Đặt lại
              </button>
              <button onClick={handleFilterApply} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, cursor: "pointer", fontSize: "13px", color: "#fff", fontWeight: 600, boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}>
                Áp dụng
              </button>
            </div>
          </div>
        </>
      )}

      {/* Data Table Modal */}
      {dataModalOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 300, backgroundColor: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setDataModalOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "900px",
              maxHeight: "80vh",
              backgroundColor: "#fff",
              borderRadius: "20px",
              boxShadow: "0 24px 80px rgba(0,59,185,0.2)",
              zIndex: 400,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(0,59,185,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ color: NAVY, fontSize: "16px", fontWeight: 700, marginBottom: "2px" }}>Dữ liệu nguồn của biểu đồ</h3>
                <p style={{ color: "rgba(0,59,185,0.5)", fontSize: "12px" }}>{tableRows.length} bản ghi</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => { setDataModalOpen(false); onOpenBuilder?.(); }} style={{ padding: "8px 16px", borderRadius: "10px", border: `1.5px solid ${ORANGE}`, background: "#fff", cursor: "pointer", fontSize: "13px", color: ORANGE, fontWeight: 600 }}>
                  Mở trong Trình tạo biểu đồ
                </button>
                <button onClick={() => setDataModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "10px", border: "1.5px solid rgba(0,59,185,0.15)", background: "#fff", cursor: "pointer", fontSize: "13px", color: NAVY }}>
                  Đóng
                </button>
              </div>
            </div>
            <div style={{ overflow: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    {tableColumns.map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,59,185,0.6)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,59,185,0.08)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(0,59,185,0.04)" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                    >
                      {tableColumns.map((col) => (
                        <td key={col} style={{ padding: "12px 16px", color: typeof row[col] === "number" ? NAVY : "rgba(0,59,185,0.68)", fontWeight: typeof row[col] === "number" ? 600 : 400 }}>
                          {formatCellValue(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(tableColumns.length, 1)} style={{ padding: "28px", textAlign: "center", color: "rgba(0,59,185,0.45)", fontSize: "13px" }}>
                        Không có dữ liệu phù hợp với bộ lọc biểu đồ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Edit Panel */}
      {editPanelOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 300, backgroundColor: "rgba(0,0,0,0.2)" }}
            onClick={() => setEditPanelOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "360px",
              backgroundColor: "#fff",
              boxShadow: "-8px 0 32px rgba(0,59,185,0.15)",
              zIndex: 400,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "24px", borderBottom: "1px solid rgba(0,59,185,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: NAVY, fontSize: "16px", fontWeight: 700 }}>Cài đặt biểu đồ</h3>
              <button onClick={() => setEditPanelOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgba(0,59,185,0.4)" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
              {[
                { label: "Tên biểu đồ", key: "title", type: "text" },
                { label: "Trục X", key: "axisX", type: "select", options: ["Chủ đề", "Kênh", "Ngày", "Tuần", "Tháng"] },
                { label: "Giá trị", key: "values", type: "select", options: ["Số hội thoại", "AI trả lời thành công", "AI trả lời thất bại", "Điểm cảm xúc"] },
                { label: "Sắp xếp", key: "sort", type: "select", options: ["Mặc định", "Tăng dần", "Giảm dần", "A-Z"] },
              ].map(({ label, key, type, options }) => (
                <div key={key}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(0,59,185,0.5)", display: "block", marginBottom: "6px", letterSpacing: "0.05em" }}>
                    {label.toUpperCase()}
                  </label>
                  {type === "text" ? (
                    <input
                      value={(editValues as any)[key]}
                      onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid rgba(0,59,185,0.12)", fontSize: "13px", color: NAVY, outline: "none", boxSizing: "border-box" }}
                    />
                  ) : (
                    <select
                      value={(editValues as any)[key]}
                      onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid rgba(0,59,185,0.12)", fontSize: "13px", color: NAVY, outline: "none", cursor: "pointer" }}
                    >
                      {options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: "16px" }}>
                {[
                  { label: "Hiển thị chú thích", key: "legend" },
                  { label: "Nhãn dữ liệu", key: "dataLabels" },
                ].map(({ label, key }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: NAVY }}>
                    <input
                      type="checkbox"
                      checked={(editValues as any)[key]}
                      onChange={(e) => setEditValues({ ...editValues, [key]: e.target.checked })}
                      style={{ accentColor: ORANGE, width: "16px", height: "16px" }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ padding: "20px 24px", borderTop: "1px solid rgba(0,59,185,0.08)" }}>
              <button onClick={handleSaveEdit} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, cursor: "pointer", fontSize: "14px", color: "#fff", fontWeight: 600, boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}>
                Lưu thay đổi
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
