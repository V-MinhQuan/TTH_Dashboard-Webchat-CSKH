// @ts-nocheck
import React from 'react';
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

const NAVY = "#003865";
const ORANGE = "#D73C01";   // used only for active border/icon accents
const CTA = "#ED5206";
const CTA_SOFT = "#F36C2E";
const ORANGE_50 = "#FFF4EE";  // soft active toolbar bg
const ORANGE_200 = "#FBCBB8";  // soft border
const AMBER_50 = "#FFF7E6";
const AMBER_TEXT = "#B7791F";
const RED_50 = "#FFF1F1";
const RED_TEXT = "#B42318";

const chartTypes = [
  { id: "bar", label: "Cột đứng", icon: BarChart },
  { id: "line", label: "Đường", icon: LineChart },
  { id: "area", label: "Vùng", icon: AreaChart },
  { id: "donut", label: "Hình khuyên (Donut)", icon: PieChart },
  { id: "pie", label: "Hình tròn", icon: PieChart },
  { id: "hbar", label: "Cột ngang", icon: BarChart },
];

const COLORS = [NAVY, CTA, "#1565C0", ORANGE, "#42A5F5", CTA_SOFT, "#0F6C8D", "#F59E0B"];

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
  return [];
}

function formatColumnHeader(key: string) {
  const labels: Record<string, string> = {
    "ai_ok": "AI phản hồi thành công",
    "ai_fail": "AI phản hồi thất bại",
    "hoidthoai": "Số hội thoại",
    "name": "Loại cảm xúc",
    "channel": "Kênh",
    "topic": "Chủ đề",
    "date": "Ngày",
    "failure": "AI phản hồi thất bại",
    "success": "AI phản hồi thành công",
    "uncertain": "AI không chắc chắn",
    "total": "Tổng số",
    "unresolved": "Chưa xử lý",
    "negative": "Tiêu cực",
    "processing": "Đang xử lý",
    "completed": "Hoàn thành",
    "positive": "Tích cực",
    "neutral": "Trung lập",
    "thieuDL": "Không tìm thấy dữ liệu",
    "khongChac": "AI không chắc chắn",
    "value": "Giá trị",
    "Số lượng": "Số lượng",
    "Tỷ lệ": "Tỷ lệ",
    "Điểm số": "Điểm số",
    "avg_time": "Thời gian phản hồi TB",
    "hallucination": "Không tìm thấy dữ liệu",
    "processed": "Đã xử lý",
    "unprocessed": "Chưa xử lý",
    "Chờ xử lý": "Chờ xử lý",
    "Đang tư vấn": "Đang tư vấn",
    "AI thành công": "AI thành công",
    "AI phản hồi thất bại": "AI phản hồi thất bại",
    "saiCauTra": "Sai câu trả lời",
    "khongChinhXac": "Không chính xác",
    "khongHieu": "Không hiểu câu hỏi",
    "thieuThongTin": "Thiếu thông tin",
    "loiTriThuc": "Lỗi tri thức",
    "loiHeThong": "Lỗi hệ thống",
    "ngoaiPhamVi": "Ngoài phạm vi",
    "colorKey": "Kênh",
    "satisfaction": "Mức độ hài lòng",
    "color": "Màu sắc",
    "khac": "Khác"
  };
  return labels[key] || key;
}

function formatCellValue(value: any) {
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (value === null || value === undefined) return "";

  // Format YYYY-MM-DD date to DD/MM/YYYY (vi-VN style)
  const strVal = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
    const [year, month, day] = strVal.split("-");
    return `${day}/${month}/${year}`;
  }
  return strVal;
}

function ChartRenderer({ type, data }: { type: string; data: any[] }) {
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
          <CartesianGrid stroke="rgba(0,59,185,0.06)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <YAxis tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="hoidthoai" name="Hội thoại" stroke="#00A3E0" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="ai_ok" name="AI phản hồi thành công" stroke="#00D2FF" strokeWidth={1.5} dot={false} />
        </ReLineChart>
      </ResponsiveContainer>
    );
  }
  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <ReAreaChart id="area-chart" data={data}>
          <CartesianGrid stroke="rgba(0,59,185,0.06)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <YAxis tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="hoidthoai" name="Hội thoại" stroke={NAVY} fill={`${NAVY}20`} strokeWidth={2} />
          <Area type="monotone" dataKey="ai_ok" name="AI phản hồi thành công" stroke={ORANGE} fill={`${ORANGE}20`} strokeWidth={2} />
        </ReAreaChart>
      </ResponsiveContainer>
    );
  }
  if (type === "hbar") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <ReBarChart id="hbar-chart" data={data} layout="vertical">
          <CartesianGrid stroke="rgba(0,59,185,0.06)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} width={80} />
          <Tooltip />
          <Legend />
          <Bar maxBarSize={40} dataKey="hoidthoai" name="Hội thoại" fill={NAVY} radius={[0, 4, 4, 0]} label={editValues?.dataLabels !== false ? { position: 'right', fontSize: 10, fill: "rgba(0,59,185,0.6)" } : undefined} />
          <Bar maxBarSize={40} dataKey="ai_ok" name="AI phản hồi thành công" fill={ORANGE} radius={[0, 4, 4, 0]} label={editValues?.dataLabels !== false ? { position: 'right', fontSize: 10, fill: "rgba(0,59,185,0.6)" } : undefined} />
        </ReBarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ReBarChart id="bar-chart" data={data}>
        <CartesianGrid stroke="rgba(0,59,185,0.06)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
        <YAxis tick={{ fontSize: 11, fill: "rgba(0,59,185,0.5)" }} />
        <Tooltip />
        <Legend />
        <Bar maxBarSize={40} dataKey="hoidthoai" name="Hội thoại" fill={NAVY} radius={[4, 4, 0, 0]} label={editValues?.dataLabels !== false ? { position: 'top', fontSize: 10, fill: "rgba(0,59,185,0.6)" } : undefined} />
        <Bar maxBarSize={40} dataKey="ai_ok" name="AI phản hồi thành công" fill={ORANGE} radius={[4, 4, 0, 0]} label={editValues?.dataLabels !== false ? { position: 'top', fontSize: 10, fill: "rgba(0,59,185,0.6)" } : undefined} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

interface ChartCardProps {
  title: string;
  children?: React.ReactNode | ((props: any) => React.ReactNode);
  useDefaultChart?: boolean;
  defaultChartType?: string;
  defaultAxisX?: string;
  supportedChartTypes?: string[];
  onOpenBuilder?: () => void;
  data?: any;
  showToolbarActions?: boolean;
  headerExtra?: React.ReactNode;
  baseFilters?: {
    dateRange?: string;
    channel?: string;
    topic?: string;
  };
  axisOptions?: string[];
  valueOptions?: string[];
}

export function ChartCard({
  title,
  children,
  useDefaultChart,
  defaultChartType = "bar",
  defaultAxisX = "Chủ đề",
  supportedChartTypes,
  onOpenBuilder,
  data,
  showToolbarActions = true,
  headerExtra,
  baseFilters,
  axisOptions = ["Chủ đề", "Kênh", "Ngày", "Tuần", "Tháng"],
  valueOptions = ["Số hội thoại", "AI phản hồi thành công", "AI phản hồi thất bại", "Điểm cảm xúc"],
}: ChartCardProps) {
  const [chartType, setChartType] = useState(() => {
    if (supportedChartTypes && !supportedChartTypes.includes(defaultChartType)) {
      return supportedChartTypes[0] || defaultChartType;
    }
    return defaultChartType;
  });
  const [chartTitle, setChartTitle] = useState(title);
  const [isEdited, setIsEdited] = useState(false);
  const [filterActive, setFilterActive] = useState(false);

  useEffect(() => {
    if (supportedChartTypes && !supportedChartTypes.includes(chartType)) {
      setChartType(supportedChartTypes[0]);
    }
  }, [supportedChartTypes, chartType]);
  const [chartData, setChartData] = useState(data ?? []);
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

  const baseFilterValues = {
    dateRange: baseFilters?.dateRange || "30 ngày qua",
    channel: baseFilters?.channel || "Tất cả",
    topic: baseFilters?.topic || "Tất cả",
  };
  const hasBaseFilter =
    baseFilterValues.channel !== "Tất cả" ||
    baseFilterValues.topic !== "Tất cả" ||
    !["", "30 ngày qua"].includes(baseFilterValues.dateRange);

  const [filterValues, setFilterValues] = useState(baseFilterValues);
  const [editValues, setEditValues] = useState({ title: chartTitle, axisX: defaultAxisX, values: "Số hội thoại", legend: true, sort: "Mặc định", dataLabels: false });

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChartData(data ?? []);
    setFilterValues(baseFilterValues);
    setFilterActive(hasBaseFilter);
  }, [data, baseFilterValues.dateRange, baseFilterValues.channel, baseFilterValues.topic, hasBaseFilter]);

  useEffect(() => {
    setEditValues((current) => ({ ...current, axisX: defaultAxisX }));
  }, [defaultAxisX]);

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

    return processed;
  };

  const applyLocalFiltersToObject = (rawObj: Record<string, number>, filters: typeof filterValues) => {
    if (!rawObj || typeof rawObj !== "object" || Array.isArray(rawObj)) return rawObj;
    const processed = { ...rawObj };

    if (filters.channel !== "Tất cả") {
      const matchKey = Object.keys(processed).find(k => k.toLowerCase().includes(filters.channel.toLowerCase().replace(" ", "")));
      Object.keys(processed).forEach(key => {
        if (key !== matchKey) {
          processed[key] = 0;
        }
      });
    }

    return processed;
  };

  const handleFilterApply = () => {
    setFilterPanelOpen(false);
    setFilterActive(true);
    const sourceData = data ?? [];
    if (Array.isArray(sourceData)) {
      setChartData(applyLocalFilters(sourceData, filterValues));
    } else {
      setChartData(applyLocalFiltersToObject(sourceData, filterValues));
    }
    toast.success("Đã áp dụng bộ lọc", { description: "Biểu đồ đã cập nhật dữ liệu" });
  };

  const handleFilterReset = () => {
    setFilterActive(hasBaseFilter);
    setChartData(data ?? []);
    setFilterValues(baseFilterValues);
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
  const topics = Array.from(new Set(
    tableRows
      .map((row: any) => typeof row?.topic === "string" ? row.topic.trim() : "")
      .filter(Boolean),
  ));
  const supportsChannelFilter = tableRows.some((row: any) => {
    if (!row || typeof row !== "object") return false;
    if ("channel" in row) return true;
    return Object.keys(row).some(isChannelKey);
  });
  const topicOptions = Array.from(new Set(["Tất cả", baseFilterValues.topic, ...topics].filter(Boolean)));
  const channelOptions = supportsChannelFilter
    ? channels
    : Array.from(new Set(["Tất cả", baseFilterValues.channel].filter(Boolean)));
  const dateOptions = Array.from(new Set(["30 ngày qua", "7 ngày qua", "Hôm nay", baseFilterValues.dateRange].filter(Boolean)));
  const technicalColumns = ["id", "key", "rawKey", "_id", "colorKey", "source"];
  const tableColumns = Array.from(
    new Set(tableRows.flatMap((row: any) => row && typeof row === "object" ? Object.keys(row) : []))
  ).filter(col => !technicalColumns.includes(col));

  const isNumericColumn = (col: string) => {
    return tableRows.some((row: any) => typeof row[col] === "number");
  };

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
              <span style={{ fontSize: "10px", backgroundColor: "#f0fdf4", color: "#228A61", padding: "2px 8px", borderRadius: "20px", fontWeight: 600, border: "1px solid #bbf7d0", whiteSpace: "nowrap" }}>
                Đã chỉnh sửa
              </span>
            )}
            {filterActive && (
              <span style={{ fontSize: "10px", backgroundColor: ORANGE_50, color: ORANGE, padding: "2px 8px", borderRadius: "20px", fontWeight: 600, border: `1px solid ${ORANGE_200}`, whiteSpace: "nowrap" }}>
                Đã lọc
              </span>
            )}
          </div>
          {(headerExtra || showToolbarActions) && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }} ref={popoverRef}>
              {headerExtra}
              {showToolbarActions && (
                <div style={{ display: "flex", gap: "4px" }}>
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
                </div>
              )}

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
                              toast.error(`Dữ liệu không phù hợp`);
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
                            cursor: (supportedChartTypes && !supportedChartTypes.includes(ct.id)) ? "not-allowed" : "pointer",
                            opacity: (supportedChartTypes && !supportedChartTypes.includes(ct.id)) ? 0.4 : 1,
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
            children({ chartType, chartData, editValues, filterValues })
          ) : useDefaultChart ? (
            <ChartRenderer type={chartType} data={chartData} />
          ) : (
            children
          )}
        </div>
      </div>


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
                      <th key={h} style={{ padding: "12px 16px", textAlign: isNumericColumn(h) ? "right" : "left", fontWeight: 600, color: "rgba(0,59,185,0.6)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,59,185,0.08)" }}>
                        {formatColumnHeader(h)}
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
                        <td key={col} style={{ padding: "12px 16px", textAlign: isNumericColumn(col) ? "right" : "left", color: typeof row[col] === "number" ? NAVY : "rgba(0,59,185,0.68)", fontWeight: typeof row[col] === "number" ? 600 : 400 }}>
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
                { label: "Trục X", key: "axisX", type: "select", options: axisOptions },
                { label: "Giá trị", key: "values", type: "select", options: valueOptions },
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
