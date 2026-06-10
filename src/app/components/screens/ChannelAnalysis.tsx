import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, CheckCircle, AlertTriangle, Zap, Bot, Lightbulb, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { getChannelAnalytics } from "../../services/dashboardApi";
import { ChannelAnalyticsData, ChannelSummary } from "../../types/dashboard";
import { EmptyState } from "../common/EmptyState";

const NAVY = "#003BB9";
const ORANGE = "#D73C01";
const GREEN = "#228A61";

const CHANNEL_COLORS: Record<string, string> = {
  "Zalo Business": "#0068FF",
  "Facebook": "#1877F2",
  "Zalo OA": "#00AEEF",
  "Chat Widget": "#003865",
};

const getInsightData = (ch: any) => {
  const observations: string[] = [];
  const recommendations: string[] = [];

  const aiRate = ch.ai_ok + ch.ai_fail > 0 ? Math.round((ch.ai_ok / (ch.ai_ok + ch.ai_fail)) * 100) : 0;

  if (ch.unresolved > 0) {
    observations.push(`Kênh đang có ${ch.unresolved.toLocaleString()} hội thoại chờ xử lý.`);
  }
  if (ch.ai_fail > 10) {
    observations.push(`Tỷ lệ AI trả lời thất bại khá cao (${ch.ai_fail.toLocaleString()} ca, thành công ${aiRate}%).`);
  }
  if (ch.negative > 5) {
    observations.push(`Phát hiện ${ch.negative.toLocaleString()} đánh giá/cảm xúc tiêu cực từ khách hàng.`);
  }
  if (ch.avg_time > 10) {
    observations.push(`Thời gian phản hồi trung bình khá chậm (${ch.avg_time} phút).`);
  }

  if (observations.length === 0) {
    observations.push(`Kênh hoạt động rất ổn định, các chỉ số đều ở mức an toàn.`);
    recommendations.push(`Tiếp tục duy trì chất lượng hiện tại.`);
    return { observations, recommendations };
  }

  if (ch.unresolved > 0) {
    recommendations.push(`Phân bổ thêm nhân sự trực kênh này để giải quyết tồn đọng.`);
  }
  if (ch.ai_fail > 10) {
    recommendations.push(`Kiểm tra và huấn luyện thêm kịch bản cho Chatbot dựa trên các câu hỏi thất bại gần đây.`);
  }
  if (ch.negative > 5) {
    recommendations.push(`Trưởng nhóm cần trực tiếp xem xét các đoạn hội thoại tiêu cực để xoa dịu khách hàng.`);
  }
  if (ch.avg_time > 10) {
    recommendations.push(`Thiết lập thông báo tự động (Auto-reply) xin lỗi khách hàng khi thời gian chờ quá lâu.`);
  }
  if (recommendations.length === 0) {
    recommendations.push(`Nên theo dõi thêm biến động trong vài ngày tới.`);
  }

  return { observations, recommendations };
};
const STATUS_COLORS: Record<string, string> = {
  "Chờ xử lý": ORANGE,
  "Đang xử lý": "#42A5F5",
  "Hoàn thành": GREEN,
  "AI thành công": NAVY,
  "AI thất bại": ORANGE,
};
const PIE_COLORS = ["#003865", "#1565C0", "#42A5F5", "#7BB6FF", ORANGE, GREEN];

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDatesFromRange(range: string, customFrom?: string, customTo?: string): { startDate?: string; endDate?: string } {
  const today = new Date();

  if (range === "Hôm nay") {
    const dateStr = formatLocalDate(today);
    return { startDate: dateStr, endDate: dateStr };
  }

  if (range === "7 ngày qua") {
    const start = new Date(today);
    start.setDate(today.getDate() - 7);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(today) };
  }

  if (range === "30 ngày qua") {
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(today) };
  }

  if (range === "Tháng này") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(today) };
  }

  if (range === "Quý này") {
    const currentMonth = today.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    const start = new Date(today.getFullYear(), quarterStartMonth, 1);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(today) };
  }

  if (range === "Tùy chỉnh" && customFrom) {
    const fromDate = new Date(customFrom);
    const toDate = customTo ? new Date(customTo) : today;
    if (!isNaN(fromDate.getTime())) {
      return {
        startDate: formatLocalDate(fromDate),
        endDate: formatLocalDate(toDate),
      };
    }
  }

  return {};
}

function getHeatColor(value: number): string {
  if (value === 0) return "#EBF2FF";
  if (value <= 3) return "#B8D8FF";
  if (value <= 7) return "#7BB6FF";
  if (value <= 11) return "#1565C0";
  return "#003865";
}

function getHeatTextColor(value: number): string {
  return value >= 4 ? "#fff" : "#003865";
}

function getAiSuccessRate(channel: ChannelSummary) {
  const total = channel.ai_ok + channel.ai_fail;
  if (!total) return 0;
  return Math.round((channel.ai_ok / total) * 100);
}

function getPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function getUnresolvedRate(channel: ChannelSummary) {
  return getPercent(channel.unresolved, channel.total);
}

function getAiFailRate(channel: ChannelSummary) {
  return getPercent(channel.ai_fail, channel.ai_ok + channel.ai_fail);
}

function sortChartRows<T extends Record<string, any>>(rows: T[], sort: string, valueKey: string, nameKey = "channel") {
  const nextRows = [...rows];
  if (sort === "Tăng dần") return nextRows.sort((a, b) => Number(a[valueKey] || 0) - Number(b[valueKey] || 0));
  if (sort === "Giảm dần") return nextRows.sort((a, b) => Number(b[valueKey] || 0) - Number(a[valueKey] || 0));
  if (sort === "A-Z") return nextRows.sort((a, b) => String(a[nameKey] || "").localeCompare(String(b[nameKey] || ""), "vi"));
  return nextRows;
}

function renderEmptyChart(message = "Không có dữ liệu biểu đồ") {
  return (
    <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,56,101,0.45)", fontSize: "13px" }}>
      {message}
    </div>
  );
}

function renderMetricChart({
  chartType,
  data,
  editValues,
  nameKey,
  valueKey,
  valueName,
  color,
  tooltipSuffix = "",
}: {
  chartType: string;
  data: any[];
  editValues: any;
  nameKey: string;
  valueKey: string;
  valueName: string;
  color: string;
  tooltipSuffix?: string;
}) {
  const rows = sortChartRows(data || [], editValues.sort, valueKey, nameKey);
  if (!rows.length) return renderEmptyChart();

  if (chartType === "pie" || chartType === "donut") {
    const pieRows = rows.map((row) => ({ name: row[nameKey], value: Number(row[valueKey] || 0) })).filter((row) => row.value > 0);
    if (!pieRows.length) return renderEmptyChart();
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={pieRows} cx="50%" cy="50%" innerRadius={chartType === "donut" ? 48 : 0} outerRadius={78} dataKey="value" label={editValues.dataLabels}>
            {pieRows.map((entry, index) => <Cell key={`metric-pie-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value: number) => [`${value}${tooltipSuffix}`, valueName]} />
          {editValues.legend && <Legend iconSize={10} formatter={(value) => <span style={{ fontSize: "11px" }}>{value}</span>} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
          <YAxis tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
          <Tooltip formatter={(value: number) => [`${value}${tooltipSuffix}`, valueName]} />
          {editValues.legend && <Legend iconSize={10} />}
          <Line type="monotone" dataKey={valueKey} name={valueName} stroke={color} strokeWidth={2} dot={{ r: 3 }} label={editValues.dataLabels ? { fontSize: 10 } : undefined} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
          <YAxis tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
          <Tooltip formatter={(value: number) => [`${value}${tooltipSuffix}`, valueName]} />
          {editValues.legend && <Legend iconSize={10} />}
          <Area type="monotone" dataKey={valueKey} name={valueName} stroke={color} fill={`${color}22`} strokeWidth={2} label={editValues.dataLabels ? { fontSize: 10 } : undefined} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "hbar") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 18, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
          <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
          <YAxis dataKey={nameKey} type="category" width={96} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.65)" }} />
          <Tooltip formatter={(value: number) => [`${value}${tooltipSuffix}`, valueName]} />
          {editValues.legend && <Legend iconSize={10} />}
          <Bar dataKey={valueKey} name={valueName} fill={color} radius={[0, 5, 5, 0]} label={editValues.dataLabels ? { position: "right", fontSize: 10 } : undefined} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
        <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
        <YAxis tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
        <Tooltip formatter={(value: number) => [`${value}${tooltipSuffix}`, valueName]} />
        {editValues.legend && <Legend iconSize={10} />}
        <Bar dataKey={valueKey} name={valueName} fill={color} radius={[5, 5, 0, 0]} label={editValues.dataLabels ? { position: "top", fontSize: 10 } : undefined} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderTrendChart(chartType: string, chartRows: any[], channels: string[], editValues: any) {
  const rows = chartRows || [];
  const activeChannels = channels.filter((channel) => rows.some((row) => row[channel] !== undefined));
  if (!rows.length || !activeChannels.length) return renderEmptyChart();

  const totals = activeChannels.map((channel) => ({
    channel,
    total: rows.reduce((sum, row) => sum + Number(row[channel] || 0), 0),
  }));

  if (chartType === "pie" || chartType === "donut" || chartType === "hbar") {
    return renderMetricChart({
      chartType,
      data: totals,
      editValues,
      nameKey: "channel",
      valueKey: "total",
      valueName: "Hội thoại",
      color: NAVY,
    });
  }

  const ChartComponent = chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ChartComponent data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
        <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
        <Tooltip />
        {editValues.legend && <Legend iconSize={10} />}
        {activeChannels.map((channel) => {
          if (chartType === "area") {
            return <Area key={channel} type="monotone" dataKey={channel} stroke={CHANNEL_COLORS[channel] || NAVY} fill={`${CHANNEL_COLORS[channel] || NAVY}22`} strokeWidth={2} />;
          }
          if (chartType === "bar") {
            return <Bar key={channel} dataKey={channel} fill={CHANNEL_COLORS[channel] || NAVY} radius={[4, 4, 0, 0]} label={editValues.dataLabels ? { position: "top", fontSize: 10 } : undefined} />;
          }
          return <Line key={channel} type="monotone" dataKey={channel} stroke={CHANNEL_COLORS[channel] || NAVY} strokeWidth={2} dot={{ r: 2 }} label={editValues.dataLabels ? { fontSize: 10 } : undefined} />;
        })}
      </ChartComponent>
    </ResponsiveContainer>
  );
}

function renderStackedChart(chartType: string, rows: any[], keys: string[], editValues: any) {
  if (!rows.length) return renderEmptyChart();

  const sortedRows = [...rows].sort((a, b) => {
    const totalA = keys.reduce((sum, key) => sum + Number(a[key] || 0), 0);
    const totalB = keys.reduce((sum, key) => sum + Number(b[key] || 0), 0);
    if (editValues.sort === "Tăng dần") return totalA - totalB;
    if (editValues.sort === "Giảm dần") return totalB - totalA;
    if (editValues.sort === "A-Z") return String(a.channel || "").localeCompare(String(b.channel || ""), "vi");
    return 0;
  });

  const totals = keys.map((key) => ({
    channel: key,
    total: sortedRows.reduce((sum, row) => sum + Number(row[key] || 0), 0),
  }));

  if (chartType === "pie" || chartType === "donut") {
    return renderMetricChart({ chartType, data: totals, editValues, nameKey: "channel", valueKey: "total", valueName: "Hội thoại", color: NAVY });
  }

  if (chartType === "line" || chartType === "area") {
    const ChartComponent = chartType === "area" ? AreaChart : LineChart;
    return (
      <ResponsiveContainer width="100%" height={220}>
        <ChartComponent data={sortedRows}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
          <XAxis dataKey="channel" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
          <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
          <Tooltip />
          {editValues.legend && <Legend iconSize={10} />}
          {keys.map((key) => chartType === "area"
            ? <Area key={key} type="monotone" dataKey={key} stroke={STATUS_COLORS[key] || NAVY} fill={`${STATUS_COLORS[key] || NAVY}22`} strokeWidth={2} />
            : <Line key={key} type="monotone" dataKey={key} stroke={STATUS_COLORS[key] || NAVY} strokeWidth={2} dot={{ r: 2 }} />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={sortedRows} layout={chartType === "hbar" ? "vertical" : "horizontal"}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
        {chartType === "hbar" ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
            <YAxis dataKey="channel" type="category" width={90} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
          </>
        ) : (
          <>
            <XAxis dataKey="channel" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
          </>
        )}
        <Tooltip />
        {editValues.legend && <Legend iconSize={10} />}
        {keys.map((key, index) => <Bar key={key} dataKey={key} stackId="a" fill={STATUS_COLORS[key] || PIE_COLORS[index % PIE_COLORS.length]} radius={index === keys.length - 1 ? [4, 4, 0, 0] : undefined} label={editValues.dataLabels ? { fontSize: 10 } : undefined} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChannelLoadingState() {
  const block = (style: React.CSSProperties = {}) => (
    <div
      style={{
        borderRadius: "10px",
        background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
        backgroundSize: "200% 100%",
        animation: "channelShimmer 1.4s infinite",
        ...style,
      }}
    />
  );

  return (
    <div>
      <style>{`
        @keyframes channelShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ marginBottom: "18px" }}>
        {block({ width: "220px", height: "22px", marginBottom: "8px" })}
        {block({ width: "330px", height: "14px" })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "20px", marginBottom: "24px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ background: "#fff", borderRadius: "20px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", minHeight: "138px" }}>
            {block({ width: "48%", height: "16px", marginBottom: "18px" })}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[0, 1, 2, 3].map((item) => (
                <div key={item}>{block({ height: "48px" })}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {block({ height: "282px", backgroundColor: "#fff" })}
        {block({ height: "282px", backgroundColor: "#fff" })}
      </div>
    </div>
  );
}

function ChannelErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,56,101,0.08)", borderRadius: "16px", padding: "44px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "15px", fontWeight: 700, color: NAVY, marginBottom: "8px" }}>Không thể tải dữ liệu Kênh</div>
      <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", marginBottom: "18px" }}>{message}</div>
      <button onClick={onRetry} style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>
        Tải lại
      </button>
    </div>
  );
}

interface ChannelAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

export function ChannelAnalysis({ filters, onFiltersChange, onNavigate }: ChannelAnalysisProps) {
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(filters);
  const [data, setData] = useState<ChannelAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [heatmapChannelFilter, setHeatmapChannelFilter] = useState("Tất cả");
  const [heatmapTopicFilter, setHeatmapTopicFilter] = useState("Tất cả");

  useEffect(() => {
    setAppliedFilters(filters);
  }, [filters]);

  const loadChannelData = useCallback(async () => {
    const dateParams = getDatesFromRange(
      appliedFilters.dateRange,
      appliedFilters.customDateFrom,
      appliedFilters.customDateTo,
    );

    if (appliedFilters.dateRange === "Tùy chỉnh" && appliedFilters.customDateFrom && appliedFilters.customDateTo) {
      if (new Date(appliedFilters.customDateFrom) > new Date(appliedFilters.customDateTo)) {
        toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      setLoadError(null);

      const result = await getChannelAnalytics({
        ...dateParams,
        channel: appliedFilters.channel,
        topic: appliedFilters.topic,
        conversationStatus: appliedFilters.conversationStatus,
        aiStatus: appliedFilters.aiStatus,
      });

      setData(result);
    } catch (err: any) {
      console.error("Lỗi khi tải dữ liệu Kênh:", err);
      setData(null);
      setLoadError(err.message || "Không thể kết nối API phân tích kênh.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const dateParams = getDatesFromRange(
        appliedFilters.dateRange,
        appliedFilters.customDateFrom,
        appliedFilters.customDateTo,
      );

      if (appliedFilters.dateRange === "Tùy chỉnh" && appliedFilters.customDateFrom && appliedFilters.customDateTo) {
        if (new Date(appliedFilters.customDateFrom) > new Date(appliedFilters.customDateTo)) {
          toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
          setLoading(false);
          return;
        }
      }

      try {
        setLoading(true);
        setLoadError(null);

        const result = await getChannelAnalytics({
          ...dateParams,
          channel: appliedFilters.channel,
          topic: appliedFilters.topic,
          conversationStatus: appliedFilters.conversationStatus,
          aiStatus: appliedFilters.aiStatus,
        });

        if (!cancelled) setData(result);
      } catch (err: any) {
        if (cancelled) return;
        console.error("Lỗi khi tải dữ liệu Kênh:", err);
        setData(null);
        setLoadError(err.message || "Không thể kết nối API phân tích kênh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [appliedFilters]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    onFiltersChange(newFilters);
    setAppliedFilters(newFilters);
  };

  const channelData = data?.channels || [];
  const channelTrend = data?.trend || [];
  const channelStatusData = data?.statusByChannel || [];
  const heatmapData = data?.heatmap || [];

  const availableChannels = useMemo(() => {
    const channels = data?.channelsList?.length ? data.channelsList : channelData.map((item) => item.channel);
    return channels.filter((item, index, arr) => arr.indexOf(item) === index);
  }, [data, channelData]);

  const availableTopics = useMemo(() => {
    const topics = data?.topics || [];
    return topics.filter((item, index, arr) => arr.indexOf(item) === index);
  }, [data]);

  useEffect(() => {
    if (heatmapChannelFilter !== "Tất cả" && !availableChannels.includes(heatmapChannelFilter)) {
      setHeatmapChannelFilter("Tất cả");
    }
    if (heatmapTopicFilter !== "Tất cả" && !availableTopics.includes(heatmapTopicFilter)) {
      setHeatmapTopicFilter("Tất cả");
    }
  }, [availableChannels, availableTopics, heatmapChannelFilter, heatmapTopicFilter]);

  const visibleChannels = heatmapChannelFilter === "Tất cả" ? availableChannels : [heatmapChannelFilter];
  const visibleTopics = heatmapTopicFilter === "Tất cả" ? availableTopics : [heatmapTopicFilter];
  const hasAnyConversation = channelData.some((ch) => ch.total > 0 || ch.ai_ok > 0 || ch.ai_fail > 0);

  const nonDataState = loading ? <ChannelLoadingState /> : loadError ? <ChannelErrorState message={loadError} onRetry={loadChannelData} /> : null;

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={handleApplyFilters} />

      {nonDataState ? (
        nonDataState
      ) : data && !hasAnyConversation ? (
        <EmptyState
          message="Chưa có dữ liệu kênh để hiển thị"
          subtitle="Khoảng thời gian hoặc bộ lọc hiện tại chưa có hội thoại phù hợp."
        />
      ) : (
        <>
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Phân tích theo kênh</h2>
            </div>
            <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "14px", marginTop: "4px" }}>Phân tích câu hỏi, chủ đề và lỗi AI theo từng kênh</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            {channelData.map((ch) => (
              <div
                key={ch.channel}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "20px",
                  border: "1px solid rgba(0,56,101,0.08)",
                  boxShadow: "0 2px 12px rgba(0,56,101,0.06)",
                  padding: "20px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,56,101,0.12)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,56,101,0.06)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: CHANNEL_COLORS[ch.channel] || "#94A3B8" }} />
                  <span style={{ fontWeight: 700, fontSize: "14px", color: NAVY }}>{ch.channel}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { icon: MessageSquare, label: "Tổng hội thoại", value: ch.total.toLocaleString("vi-VN"), color: NAVY },
                    { icon: AlertTriangle, label: "Chờ xử lý", value: `${ch.unresolved.toLocaleString("vi-VN")} (${getUnresolvedRate(ch)}%)`, color: ORANGE },
                    { icon: Zap, label: "Câu AI thất bại", value: `${ch.ai_fail.toLocaleString("vi-VN")} câu (${getAiFailRate(ch)}%)`, color: ORANGE },
                    { icon: CheckCircle, label: "Tỷ lệ AI tốt", value: `${getAiSuccessRate(ch)}%`, color: GREEN },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: "center", padding: "10px 8px", borderRadius: "10px", backgroundColor: "#f8fafc" }}>
                      <div style={{ fontSize: String(value).length > 9 ? "14px" : "16px", fontWeight: 700, color, whiteSpace: "nowrap" }}>{value}</div>
                      <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.45)", marginTop: "2px" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <ChartCard
              title={`Xu hướng hội thoại theo kênh (${data?.dateRange?.granularity === "week" ? "theo tuần" : data?.dateRange?.granularity === "month" ? "theo tháng" : "theo ngày"})`}
              onOpenBuilder={() => onNavigate("chartbuilder")}
              data={channelTrend}
              defaultChartType="line"
            >
              {({ chartType, chartData, editValues }: any) => renderTrendChart(chartType, chartData, availableChannels, editValues)}
            </ChartCard>

            <ChartCard
              title="Thời gian phản hồi trung bình theo kênh"
              onOpenBuilder={() => onNavigate("chartbuilder")}
              data={channelData}
              defaultChartType="hbar"
            >
              {({ chartType, chartData, editValues }: any) => renderMetricChart({
                chartType,
                data: chartData,
                editValues,
                nameKey: "channel",
                valueKey: "avg_time",
                valueName: "Phản hồi TB",
                color: ORANGE,
                tooltipSuffix: " phút",
              })}
            </ChartCard>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <ChartCard
              title="Trạng thái xử lý theo kênh"
              onOpenBuilder={() => onNavigate("chartbuilder")}
              data={channelStatusData}
              defaultChartType="bar"
            >
              {({ chartType, chartData, editValues }: any) => renderStackedChart(chartType, chartData, ["Chờ xử lý", "Đang xử lý", "Hoàn thành"], editValues)}
            </ChartCard>

            <ChartCard
              title="So sánh hiệu suất AI theo kênh"
              onOpenBuilder={() => onNavigate("chartbuilder")}
              data={channelData}
              defaultChartType="bar"
            >
              {({ chartType, chartData, editValues }: any) => renderStackedChart(chartType, chartData.map((row: any) => ({
                channel: row.channel,
                "AI thành công": row.ai_ok,
                "AI thất bại": row.ai_fail,
              })), ["AI thành công", "AI thất bại"], editValues)}
            </ChartCard>
          </div>

          <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "20px" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Heatmap: Số câu AI trả lời thất bại theo kênh × chủ đề</h3>
                <p style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", margin: "2px 0 0" }}>Số câu hỏi AI không xử lý được — màu đậm hơn = tần suất cao hơn</p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "10px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.04em" }}>KÊNH</label>
                  <select
                    value={heatmapChannelFilter}
                    onChange={(e) => setHeatmapChannelFilter(e.target.value)}
                    style={{ padding: "5px 24px 5px 8px", borderRadius: "7px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "12px", color: NAVY, backgroundColor: "#fff", cursor: "pointer", outline: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23003865' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                  >
                    <option value="Tất cả">Tất cả kênh</option>
                    {availableChannels.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "10px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.04em" }}>CHỦ ĐỀ</label>
                  <select
                    value={heatmapTopicFilter}
                    onChange={(e) => setHeatmapTopicFilter(e.target.value)}
                    style={{ padding: "5px 24px 5px 8px", borderRadius: "7px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "12px", color: NAVY, backgroundColor: "#fff", cursor: "pointer", outline: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23003865' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                  >
                    <option value="Tất cả">Tất cả chủ đề</option>
                    {availableTopics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => onNavigate("chartbuilder")}
                  style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "11px", alignSelf: "flex-end" }}
                >
                  Mở Trình tạo biểu đồ
                </button>
              </div>
            </div>
            <div style={{ padding: "20px", overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 16px", textAlign: "left", color: "rgba(0,56,101,0.5)", fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em", minWidth: "110px" }}>KÊNH / CHỦ ĐỀ</th>
                    {visibleTopics.map((t) => (
                      <th key={t} style={{ padding: "8px 12px", textAlign: "center", color: "rgba(0,56,101,0.6)", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleChannels.map((ch) => (
                    <tr key={ch}>
                      <td style={{ padding: "8px 16px", color: NAVY, fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: CHANNEL_COLORS[ch] || "#94A3B8" }} />
                          {ch}
                        </div>
                      </td>
                      {visibleTopics.map((topicName) => {
                        const cell = heatmapData.find((d) => d.channel === ch && d.topic === topicName);
                        const val = cell?.value ?? 0;
                        const bg = getHeatColor(val);
                        const textColor = getHeatTextColor(val);
                        return (
                          <td key={`${ch}-${topicName}`} style={{ padding: "4px 6px", textAlign: "center" }}>
                            <div
                              style={{
                                width: "48px",
                                height: "36px",
                                borderRadius: "8px",
                                backgroundColor: bg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "13px",
                                fontWeight: 700,
                                color: textColor,
                                margin: "0 auto",
                                cursor: "pointer",
                                transition: "opacity 0.15s",
                              }}
                              title={`${ch} × ${topicName}: ${val} lỗi`}
                              onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.opacity = "0.8"}
                              onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.opacity = "1"}
                            >
                              {val}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)" }}>Mức độ:</span>
                {[
                  { label: "0", color: "#EBF2FF" },
                  { label: "1-3", color: "#B8D8FF" },
                  { label: "4-7", color: "#7BB6FF" },
                  { label: "8-11", color: "#1565C0" },
                  { label: ">=12", color: "#003865" },
                ].map(({ label, color }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "14px", height: "14px", borderRadius: "3px", backgroundColor: color, border: "1px solid rgba(0,56,101,0.1)" }} />
                    <span style={{ fontSize: "10px", color: "rgba(0,56,101,0.6)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
              <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Chi tiết tồn đọng theo kênh</h3>
              <p style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", margin: "2px 0 0" }}>Các vấn đề cần chú ý và xử lý</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    {["Kênh", "Hội thoại chờ", "Câu AI thất bại", "Cảm xúc tiêu cực", "Hành động"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {channelData.map((ch) => (
                    <tr key={ch.channel}
                      style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: CHANNEL_COLORS[ch.channel] || "#94A3B8" }} />
                          <span style={{ fontWeight: 600, color: NAVY }}>{ch.channel}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ color: ORANGE, fontWeight: 700 }}>{ch.unresolved.toLocaleString("vi-VN")}</span>
                        <span style={{ color: "rgba(0,56,101,0.4)", fontSize: "10px", marginLeft: "4px" }}>({getUnresolvedRate(ch)}%)</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ color: ORANGE, fontWeight: 700 }}>{ch.ai_fail.toLocaleString("vi-VN")}</span>
                        <span style={{ color: "rgba(0,56,101,0.4)", fontSize: "10px", marginLeft: "4px" }}>({getAiFailRate(ch)}%)</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ color: ch.negative > 30 ? ORANGE : "#d97706", fontWeight: 600 }}>{ch.negative.toLocaleString("vi-VN")}</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                style={{
                                  padding: "6px",
                                  borderRadius: "8px",
                                  background: "#fff",
                                  border: "1px solid rgba(0,56,101,0.1)",
                                  color: "#d97706",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all 0.2s"
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#fff7ed")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                                title="Gợi ý AI"
                              >
                                <Lightbulb size={16} />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="left" style={{ width: "320px", padding: "16px", borderRadius: "12px", border: "1px solid rgba(0,56,101,0.1)", boxShadow: "0 4px 20px rgba(0,56,101,0.08)", zIndex: 50, backgroundColor: "#fff" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", borderBottom: "1px solid rgba(0,56,101,0.06)", paddingBottom: "8px" }}>
                                <Bot size={18} color="#d97706" />
                                <span style={{ fontWeight: 700, fontSize: "14px", color: NAVY }}>AI Phân tích: {ch.channel}</span>
                              </div>

                              {(() => {
                                const insights = getInsightData(ch);
                                return (
                                  <>
                                    <div style={{ marginBottom: "12px" }}>
                                      <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(0,56,101,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Nhận xét tình hình</div>
                                      <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: NAVY, display: "flex", flexDirection: "column", gap: "6px", lineHeight: 1.4 }}>
                                        {insights.observations.map((obs, i) => <li key={`obs-${i}`}>{obs}</li>)}
                                      </ul>
                                    </div>

                                    <div>
                                      <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(0,56,101,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Đề xuất hành động</div>
                                      <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#d97706", display: "flex", flexDirection: "column", gap: "6px", lineHeight: 1.4 }}>
                                        {insights.recommendations.map((rec, i) => <li key={`rec-${i}`}>{rec}</li>)}
                                      </ul>
                                    </div>
                                  </>
                                );
                              })()}
                            </PopoverContent>
                          </Popover>

                          <button
                            onClick={() => {
                              handleApplyFilters({ ...filters, channel: ch.channel });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                              toast.success(`Đang phân tích sâu kênh: ${ch.channel}`);
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              border: "1px solid rgba(0,56,101,0.1)",
                              background: (ch.unresolved > 0 || ch.negative > 20) ? "#fff7ed" : "#f8fafc",
                              color: (ch.unresolved > 0 || ch.negative > 20) ? ORANGE : NAVY,
                              cursor: "pointer",
                              fontSize: "11px",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = (ch.unresolved > 0 || ch.negative > 20) ? ORANGE : NAVY;
                              e.currentTarget.style.color = "#fff";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = (ch.unresolved > 0 || ch.negative > 20) ? "#fff7ed" : "#f8fafc";
                              e.currentTarget.style.color = (ch.unresolved > 0 || ch.negative > 20) ? ORANGE : NAVY;
                            }}
                          >
                            <Search size={14} />
                            Phân tích sâu
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
