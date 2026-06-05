import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, MessageCircle, Clock, CheckCircle, XCircle, AlertTriangle,
  Users, TrendingUp, TrendingDown, Eye, Flag, Plus, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";

// Import các types, services và components mới
import { getDashboardKpi, closeConversation } from "../../services/dashboardApi";
import { DashboardKpiData } from "../../types/dashboard";
import { LoadingState } from "../common/LoadingState";
import { ErrorState } from "../common/ErrorState";
import { EmptyState } from "../common/EmptyState";
import { KpiCard } from "../dashboard/KpiCard";
import { SourceChart } from "../dashboard/SourceChart";

const NAVY = "#003BB9";
const ORANGE = "#D73C01";

function viNum(n: number) {
  return n.toLocaleString("vi-VN");
}



const alertTypeIcon: Record<string, typeof AlertTriangle> = {
  overtime: Clock,
  ai_uncertain: AlertTriangle,
  ai_no_data: XCircle,
};

const statusColors: Record<string, { bg: string; color: string }> = {
  "Chờ quản lý xác nhận": { bg: "#FFF4EE", color: "#D73C01" },
  "Chờ xử lý": { bg: "#FFF7E6", color: "#B7791F" },
  "Đang xử lý": { bg: "#dbeafe", color: "#3b82f6" },
  "Hoàn thành": { bg: "#EAF8F1", color: "#228A61" },
};

const priorityColors: Record<string, { bg: string; color: string; border: string }> = {
  "Ưu tiên cao": { bg: "#FFF4EE", color: "#D73C01", border: "#FBCBB8" },
  "Ưu tiên trung bình": { bg: "#FFF7E6", color: "#B7791F", border: "#FADFA8" },
  "Ưu tiên thấp": { bg: "#EAF8F1", color: "#228A61", border: "#BFEAD3" },
};

interface OverviewProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (screen: string) => void;
  isRefreshing?: boolean;
  lastUpdated?: string;
  onManualRefresh?: () => void;
}

/**
 * Ánh xạ khoảng thời gian trong FilterPanel thành tham số API
 */
function getDatesFromRange(range: string, customFrom?: string, customTo?: string): { startDate?: string; endDate?: string } {
  const today = new Date();
  const formatDateStr = (d: Date) => d.toISOString().split("T")[0];

  if (range === "Hôm nay") {
    const dateStr = formatDateStr(today);
    return { startDate: dateStr, endDate: dateStr };
  }
  if (range === "7 ngày qua") {
    const start = new Date();
    start.setDate(today.getDate() - 7);
    return { startDate: formatDateStr(start), endDate: formatDateStr(today) };
  }
  if (range === "30 ngày qua") {
    const start = new Date();
    start.setDate(today.getDate() - 30);
    return { startDate: formatDateStr(start), endDate: formatDateStr(today) };
  }
  if (range === "Tháng này") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: formatDateStr(start), endDate: formatDateStr(today) };
  }
  if (range === "Quý này") {
    const currentMonth = today.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    const start = new Date(today.getFullYear(), quarterStartMonth, 1);
    return { startDate: formatDateStr(start), endDate: formatDateStr(today) };
  }
  if (range === "Tùy chỉnh" && customFrom) {
    const fromDate = new Date(customFrom);
    const toDate = customTo ? new Date(customTo) : today;
    if (!isNaN(fromDate.getTime())) {
      return {
        startDate: formatDateStr(fromDate),
        endDate: formatDateStr(toDate),
      };
    }
  }
  return {};
}

interface AlertCardProps {
  alert: any;
  alertTypeIcon: Record<string, typeof AlertTriangle>;
  onClose: (customerId: string, source: string) => Promise<void>;
  isFlagged: boolean;
  onFlag: (alertId: string) => void;
}

function AlertCard({ alert, alertTypeIcon, onClose, isFlagged, onFlag }: AlertCardProps) {
  const isHigh = alert.priority === "Ưu tiên cao";
  const Icon = alertTypeIcon[alert.type] || AlertTriangle;
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClose = async () => {
    try {
      setIsProcessing(true);
      if (alert.customer && alert.raw_source) {
        await onClose(alert.customer, alert.raw_source);
      } else {
        toast.error("Không tìm thấy thông tin hội thoại để xử lý.");
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi xử lý hội thoại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlag = () => {
    onFlag(String(alert.id));
    if (!isFlagged) {
      toast.success("Đã đánh dấu cần xử lý gấp.");
    }
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "10px",
        backgroundColor: isFlagged ? "rgba(217,119,6,0.05)" : "#fff",
        border: isFlagged ? "1px solid rgba(217,119,6,0.30)" : "1px solid rgba(0,59,185,0.08)",
        borderLeft: isFlagged ? `3px solid #D97706` : isHigh ? `3px solid ${ORANGE}` : `3px solid #f59e0b`,
        transition: "box-shadow 0.15s, background-color 0.2s, border 0.2s",
        boxShadow: isFlagged ? "0 2px 10px rgba(217,119,6,0.12)" : undefined,
      }}
      onMouseEnter={(e) => { if (!isFlagged) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 3px 12px rgba(0,59,185,0.07)"; }}
      onMouseLeave={(e) => { if (!isFlagged) (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <Icon size={13} style={{ color: isFlagged ? "#D97706" : isHigh ? ORANGE : "#d97706", flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: "12px", color: "#003BB9" }}>{alert.title}</span>
          <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "20px", backgroundColor: isHigh ? "#FFF4EE" : "#FFF7E6", color: isHigh ? ORANGE : "#B7791F", fontWeight: 700 }}>{alert.priority}</span>
          {isFlagged && (
            <span style={{
              fontSize: "9px", padding: "1px 6px", borderRadius: "20px",
              backgroundColor: "#D97706", color: "#fff",
              fontWeight: 700, display: "flex", alignItems: "center", gap: "3px",
              letterSpacing: "0.02em"
            }}>
              <Flag size={8} /> Đã đánh dấu
            </span>
          )}
        </div>
        {alert.waitTime !== "—" && (
          <span style={{ fontSize: "10px", fontWeight: 600, color: isFlagged ? "#D97706" : isHigh ? ORANGE : "#B7791F", flexShrink: 0, marginLeft: "8px" }}>{alert.waitTime}</span>
        )}
      </div>
      <div style={{ display: "flex", gap: "5px", marginBottom: "6px", flexWrap: "wrap" }}>
        {alert.customer !== "" && <span style={{ fontSize: "10px", color: "#003BB9", fontWeight: 600 }}>ID: {alert.customer}</span>}
        <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{alert.channel}</span>
        <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "rgba(0,59,185,0.6)" }}>{alert.topic}</span>
      </div>
      <div style={{ fontSize: "11px", color: "rgba(0,59,185,0.7)", marginBottom: "8px", lineHeight: 1.35, wordBreak: "break-word" }}>{alert.desc}</div>
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={handleFlag}
          style={{
            padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: isFlagged ? 600 : 500,
            display: "flex", alignItems: "center", gap: "2px", cursor: "pointer", transition: "all 0.15s",
            border: isFlagged ? `1px solid #D97706` : "1px solid rgba(0,59,185,0.15)",
            background: isFlagged ? "rgba(217,119,6,0.08)" : "#fff",
            color: isFlagged ? "#D97706" : "rgba(0,59,185,0.65)",
          }}
        >
          <Flag size={9} /> {isFlagged ? "Bỏ đánh dấu" : "Đánh dấu"}
        </button>
        <button 
          onClick={handleClose} 
          disabled={isProcessing}
          style={{ padding: "3px 8px", borderRadius: "6px", border: "none", background: "#003BB9", color: "#fff", cursor: isProcessing ? "not-allowed" : "pointer", fontSize: "10px", fontWeight: 600, display: "flex", alignItems: "center", gap: "2px", opacity: isProcessing ? 0.6 : 1 }}
        >
          <CheckCircle size={9} /> {isProcessing ? "..." : "Xử lý"}
        </button>
      </div>
    </div>
  );
}


export function Overview({ filters, onFiltersChange, onNavigate, isRefreshing: parentRefreshing, lastUpdated: parentLastUpdated, onManualRefresh }: OverviewProps) {
  const [kpiData, setKpiData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [localRefreshing, setLocalRefreshing] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(parentLastUpdated || "08:00");
  const [flaggedAlertIds, setFlaggedAlertIds] = useState<Set<string>>(new Set());

  const handleFlagAlert = (alertId: string) => {
    setFlaggedAlertIds(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  const urgentAlerts = kpiData?.urgentAlerts || [];
  const topQuestions = kpiData?.topQuestions || [];
  const priorityConversations = kpiData?.priorityConversations || [];

  const overtimeAlerts = urgentAlerts.filter(a => a.type === "overtime");
  const aiAlerts = urgentAlerts.filter(a => a.type === "ai_uncertain" || a.type === "ai_no_data");

  const loadDashboardData = useCallback(async (isRefreshCall = false) => {
    try {
      if (isRefreshCall) {
        setLocalRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // 1. Chuyển đổi bộ lọc ngày sang query params
      const dateParams = getDatesFromRange(
        filters.dateRange,
        filters.customDateFrom,
        filters.customDateTo
      );

      // Validate khoảng ngày tùy chỉnh
      if (filters.dateRange === "Tùy chỉnh" && filters.customDateFrom && filters.customDateTo) {
        if (new Date(filters.customDateFrom) > new Date(filters.customDateTo)) {
          toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
          setLoading(false);
          setLocalRefreshing(false);
          return;
        }
      }

      // 2. Gọi API thực tế
      const data = await getDashboardKpi({
        ...dateParams,
        channel: filters.channel,
        topic: filters.topic,
        conversationStatus: filters.conversationStatus,
        aiStatus: filters.aiStatus,
      });
      setKpiData(data);

      const now = new Date();
      setLastUpdatedTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Không thể tải dữ liệu Dashboard. Vui lòng thử lại.");
    } finally {
      setLoading(false);
      setLocalRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleManualRefresh = () => {
    if (onManualRefresh) {
      onManualRefresh();
    }
    loadDashboardData(true);
    toast.success("Đang làm mới dữ liệu...");
  };

  const handleCloseConversation = useCallback(async (customerId: string, source: string) => {
    await closeConversation(customerId, source);
    loadDashboardData(true);
  }, [loadDashboardData]);

  const isScreenRefreshing = parentRefreshing || localRefreshing;

  const dailyTrends = kpiData?.dailyTrends || [];

  // Render các trạng thái đặc biệt
  if (loading && !kpiData) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => loadDashboardData()} />;
  }

  if (kpiData && kpiData.totalConversations === 0) {
    return (
      <div style={{ padding: "24px" }}>
        <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />
        <EmptyState />
      </div>
    );
  }

  // 3. Tính toán các chỉ số phái sinh
  const closedConversations = kpiData?.statusSummary.closed || 0;
  const activeConversations = kpiData?.statusSummary.pending || 0;

  const kpiList = [
    {
      title: "Tổng hội thoại",
      value: viNum(kpiData?.totalConversations || 0),
      icon: MessageSquare,
      change: kpiData?.trends.totalConversations,
      isWarning: false
    },
    {
      title: "Tổng tin nhắn",
      value: viNum(kpiData?.totalMessages || 0),
      icon: MessageCircle,
      change: kpiData?.trends.totalMessages,
      isWarning: false
    },
    {
      title: "Chờ xử lý",
      value: viNum(activeConversations),
      icon: AlertTriangle,
      change: kpiData?.trends.activeConversations,
      isWarning: true
    },
    {
      title: "Đã xử lý",
      value: viNum(closedConversations),
      icon: CheckCircle,
      change: kpiData?.trends.closedConversations,
      isWarning: false
    },
    {
      title: "AI trả lời thất bại",
      value: viNum(kpiData?.aiFailures || 0),
      icon: XCircle,
      change: kpiData?.trends.aiFailures,
      isWarning: true
    },
  ];

  // Thống kê theo kênh trên bảng phụ dưới biểu đồ
  const sourceStats = [
    { name: "Zalo Business", hoiday: kpiData?.sourceSummary.ZaloBusiness || 0, tinnan: kpiData?.messageSummary.ZaloBusiness || 0 },
    { name: "Facebook", hoiday: kpiData?.sourceSummary.Facebook || 0, tinnan: kpiData?.messageSummary.Facebook || 0 },
    { name: "Zalo OA", hoiday: kpiData?.sourceSummary.ZaloOA || 0, tinnan: kpiData?.messageSummary.ZaloOA || 0 },
    { name: "Chat Widget", hoiday: kpiData?.sourceSummary.ChatWidget || 0, tinnan: kpiData?.messageSummary.ChatWidget || 0 }
  ];
  const reportGeneratedAt = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const reportDateRange = kpiData?.dateRange?.startDate && kpiData?.dateRange?.endDate
    ? `${kpiData.dateRange.startDate} - ${kpiData.dateRange.endDate}`
    : filters.dateRange;
  const reportStatusRows = [
    { label: "Chờ xử lý", value: kpiData?.statusSummary.pending || 0, color: "#D73C01" },
    { label: "Đang xử lý", value: kpiData?.statusSummary.open || 0, color: "#003BB9" },
    { label: "Hoàn thành", value: kpiData?.statusSummary.closed || 0, color: "#228A61" },
  ];
  const maxStatusValue = Math.max(...reportStatusRows.map((row) => row.value), 1);
  const maxSourceValue = Math.max(...sourceStats.map((row) => row.hoiday), 1);
  const reportTrends = dailyTrends.slice(-8);
  const maxTrendValue = Math.max(...reportTrends.map((row: any) => row.total || 0), 1);
  const reportAlerts = urgentAlerts.slice(0, 6);
  const reportTopQuestions = topQuestions.slice(0, 5);
  const reportPriorityConversations = priorityConversations.slice(0, 6);

  return (
    <div style={{ padding: "24px" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Bộ lọc Panel */}
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      <div aria-hidden="true" style={{ position: "absolute", left: "-12000px", top: 0, width: "1120px", pointerEvents: "none" }}>
        <section
          data-pdf-report="overview"
          style={{
            width: "1120px",
            background: "#ffffff",
            color: "#003865",
            fontFamily: "Arial, sans-serif",
            padding: "28px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", borderBottom: "3px solid #ED5206", paddingBottom: "18px", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", color: "#ED5206", marginBottom: "7px" }}>FLIC WEBCHAT CSKH</div>
              <h1 style={{ margin: 0, fontSize: "27px", lineHeight: 1.2, color: "#003865", fontWeight: 800 }}>Báo cáo tổng quan hệ thống</h1>
              <p style={{ margin: "7px 0 0", fontSize: "13px", color: "rgba(0,56,101,0.62)" }}>Dashboard vận hành WebChat CSKH và chất lượng chatbot AI</p>
            </div>
            <div style={{ minWidth: "260px", background: "#F8FAFC", border: "1px solid rgba(0,56,101,0.1)", borderRadius: "10px", padding: "13px 15px" }}>
              <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.5)", fontWeight: 700, textTransform: "uppercase", marginBottom: "7px" }}>Thông tin báo cáo</div>
              <div style={{ fontSize: "12px", lineHeight: 1.8, color: "#003865" }}>
                <div><strong>Ngày xuất:</strong> {reportGeneratedAt}</div>
                <div><strong>Khoảng dữ liệu:</strong> {reportDateRange}</div>
                <div><strong>Kênh:</strong> {filters.channel}</div>
                <div><strong>Chủ đề:</strong> {filters.topic}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "18px" }}>
            {[
              { label: "Tổng hội thoại", value: viNum(kpiData?.totalConversations || 0), color: "#003BB9" },
              { label: "Tổng tin nhắn", value: viNum(kpiData?.totalMessages || 0), color: "#003865" },
              { label: "Chờ xử lý", value: viNum(activeConversations), color: "#D73C01" },
              { label: "Hoàn thành", value: viNum(closedConversations), color: "#228A61" },
              { label: "AI thất bại", value: viNum(kpiData?.aiFailures || 0), color: "#B42318" },
            ].map((item) => (
              <div key={item.label} style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "10px", padding: "14px", background: "#FDFEFE" }}>
                <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.55)", fontWeight: 700, textTransform: "uppercase", marginBottom: "7px" }}>{item.label}</div>
                <div style={{ fontSize: "25px", color: item.color, fontWeight: 800, lineHeight: 1 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Xu hướng hội thoại gần đây</h2>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "9px", height: "135px", borderBottom: "1px solid rgba(0,56,101,0.12)", padding: "0 4px 8px" }}>
                {reportTrends.map((row: any, index: number) => {
                  const value = row.total || 0;
                  const height = Math.max(8, Math.round((value / maxTrendValue) * 112));
                  return (
                    <div key={`${row.date || index}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: "5px" }}>
                      <div style={{ fontSize: "10px", color: "#003865", fontWeight: 700 }}>{viNum(value)}</div>
                      <div style={{ width: "100%", maxWidth: "28px", height, borderRadius: "6px 6px 0 0", background: "linear-gradient(180deg, #ED5206, #D73C01)" }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "9px", marginTop: "7px" }}>
                {reportTrends.map((row: any, index: number) => (
                  <div key={`${row.date || index}-label`} style={{ flex: 1, textAlign: "center", fontSize: "9px", color: "rgba(0,56,101,0.55)" }}>{row.date || ""}</div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Trạng thái hội thoại</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {reportStatusRows.map((row) => (
                  <div key={row.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "11px", color: "#003865", fontWeight: 700 }}>
                      <span>{row.label}</span>
                      <span>{viNum(row.value)}</span>
                    </div>
                    <div style={{ height: "9px", background: "#EEF3F8", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(4, (row.value / maxStatusValue) * 100)}%`, height: "100%", background: row.color, borderRadius: "999px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Cảnh báo cần xử lý</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div style={{ background: "#FFF4EE", border: "1px solid #FBCBB8", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "22px", color: "#D73C01", fontWeight: 800 }}>{overtimeAlerts.length}</div>
                  <div style={{ fontSize: "10px", color: "#D73C01", fontWeight: 700 }}>Chờ quá 10 giờ</div>
                </div>
                <div style={{ background: "#FFF7E6", border: "1px solid #FADFA8", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "22px", color: "#B7791F", fontWeight: 800 }}>{aiAlerts.length}</div>
                  <div style={{ fontSize: "10px", color: "#B7791F", fontWeight: 700 }}>Cảnh báo AI</div>
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.62)", lineHeight: 1.45 }}>
                Tổng cộng <strong>{urgentAlerts.length}</strong> cảnh báo đang cần theo dõi trong phạm vi bộ lọc hiện tại.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Phân bổ theo kênh</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sourceStats.map((row) => (
                  <div key={row.name} style={{ display: "grid", gridTemplateColumns: "110px 1fr 72px", gap: "10px", alignItems: "center" }}>
                    <div style={{ fontSize: "11px", color: "#003865", fontWeight: 700 }}>{row.name}</div>
                    <div style={{ height: "10px", background: "#EEF3F8", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(3, (row.hoiday / maxSourceValue) * 100)}%`, height: "100%", background: "#003BB9", borderRadius: "999px" }} />
                    </div>
                    <div style={{ fontSize: "11px", textAlign: "right", color: "rgba(0,56,101,0.7)" }}>{viNum(row.hoiday)} HT</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Cảnh báo nổi bật</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {reportAlerts.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.55)" }}>Không có cảnh báo trong phạm vi dữ liệu này.</div>
                ) : reportAlerts.map((alert) => (
                  <div key={alert.id} style={{ borderLeft: "3px solid #D73C01", padding: "7px 9px", background: "#FFFDFB", borderRadius: "7px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "11px", color: "#003BB9", fontWeight: 800 }}>{alert.title}</span>
                      <span style={{ fontSize: "10px", color: "#D73C01", fontWeight: 700, whiteSpace: "nowrap" }}>{alert.waitTime}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.62)" }}>{alert.channel} · {alert.topic} · ID {alert.customer}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,56,101,0.08)", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Top câu hỏi khách hàng</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["#", "Câu hỏi", "Chủ đề", "Lần"].map((h) => (
                      <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: "rgba(0,56,101,0.55)", fontWeight: 800 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportTopQuestions.map((question, index) => (
                    <tr key={`${question.question}-${index}`} style={{ borderTop: "1px solid rgba(0,56,101,0.06)" }}>
                      <td style={{ padding: "9px 10px", color: "rgba(0,56,101,0.45)", fontWeight: 800 }}>#{index + 1}</td>
                      <td style={{ padding: "9px 10px", color: "#003865" }}>{question.question}</td>
                      <td style={{ padding: "9px 10px", color: "#003BB9", whiteSpace: "nowrap" }}>{question.topic}</td>
                      <td style={{ padding: "9px 10px", color: "#003BB9", fontWeight: 800 }}>{question.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,56,101,0.08)", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Hội thoại ưu tiên</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["ID", "Kênh", "Chủ đề", "Chờ", "Ưu tiên"].map((h) => (
                      <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: "rgba(0,56,101,0.55)", fontWeight: 800 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportPriorityConversations.map((conversation) => (
                    <tr key={conversation.id} style={{ borderTop: "1px solid rgba(0,56,101,0.06)" }}>
                      <td style={{ padding: "9px 10px", color: "rgba(0,56,101,0.65)", fontFamily: "monospace" }}>{conversation.id}</td>
                      <td style={{ padding: "9px 10px", color: "#003BB9", whiteSpace: "nowrap" }}>{conversation.channel}</td>
                      <td style={{ padding: "9px 10px", color: "#003865" }}>{conversation.topic}</td>
                      <td style={{ padding: "9px 10px", color: conversation.isOvertime ? "#D73C01" : "rgba(0,56,101,0.65)", whiteSpace: "nowrap", fontWeight: conversation.isOvertime ? 800 : 600 }}>{conversation.wait}</td>
                      <td style={{ padding: "9px 10px", color: "#D73C01", whiteSpace: "nowrap", fontWeight: 800 }}>{conversation.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: "18px", paddingTop: "12px", borderTop: "1px solid rgba(0,56,101,0.1)", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "rgba(0,56,101,0.45)" }}>
            <span>Báo cáo tự động từ Dashboard WebChat CSKH FLIC</span>
            <span>Trang dữ liệu tổng quan</span>
          </div>
        </section>
      </div>

      <div style={{ backgroundColor: "#f4f6fa" }}>
      {/* Label đầu trang */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#003BB9", margin: 0 }}>Tổng quan hệ thống</h2>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(0,59,185,0.5)", marginLeft: "14px", marginTop: "4px" }}>Theo dõi hoạt động WebChat CSKH và chất lượng chatbot AI</p>
      </div>

      {/* Live Indicator & Làm mới thủ công */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#228A61", animation: "glowPulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "12px", color: "#228A61", fontWeight: 600 }}>Trực tiếp</span>
          </div>
          <span style={{ fontSize: "12px", color: "rgba(0,59,185,0.5)" }}>Cập nhật gần nhất: {lastUpdatedTime} hôm nay</span>
          <span style={{ fontSize: "11px", color: "rgba(0,59,185,0.35)" }}>· Tự động cập nhật mỗi 30 phút</span>
          <span style={{ fontSize: "11px", color: "rgba(0,59,185,0.35)" }}>
          </span>
          {isScreenRefreshing && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <RefreshCw size={12} style={{ color: ORANGE, animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "11px", color: ORANGE, fontWeight: 600 }}>Đang cập nhật...</span>
            </div>
          )}
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isScreenRefreshing}
          style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,59,185,0.12)", background: "#fff", color: "#003BB9", cursor: isScreenRefreshing ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", opacity: isScreenRefreshing ? 0.6 : 1, flexShrink: 0 }}
        >
          <RefreshCw size={12} style={{ animation: isScreenRefreshing ? "spin 1s linear infinite" : "none" }} /> Làm mới
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {kpiList.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            change={kpi.change}
            isWarning={kpi.isWarning}
          />
        ))}
      </div>

      {/* Cần xử lý ngay (Hội thoại khẩn cấp) */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div style={{ width: "4px", height: "18px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ color: "#003BB9", fontSize: "15px", fontWeight: 700, margin: 0 }}>Cảnh báo khẩn cấp cần xử lý ngay</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Cột 1: Hội thoại chờ phản hồi quá 10 giờ */}
          <div style={{ backgroundColor: "#FDFEFE", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.03)", padding: "16px" }}>
            <h3 style={{ color: "#D73C01", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", marginTop: 0, marginBottom: "12px", borderBottom: "1px solid rgba(215,60,1,0.1)", paddingBottom: "8px" }}>
              <Clock size={14} />
              Hội thoại chờ quá 10 giờ
              <span style={{ fontSize: "10px", backgroundColor: "#FFF4EE", color: "#D73C01", border: "1px solid #FBCBB8", borderRadius: "20px", padding: "1px 6px", fontWeight: 700, marginLeft: "auto" }}>
                {overtimeAlerts.length}
              </span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "360px", overflowY: "auto", paddingRight: "4px" }}>
              {overtimeAlerts.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "rgba(0,59,185,0.4)", fontSize: "11px", border: "1px dashed rgba(0,59,185,0.15)", borderRadius: "10px", background: "#fcfcfc" }}>
                  Không có cuộc hội thoại nào chờ phản hồi quá 10 giờ
                </div>
              ) : (
                overtimeAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} alertTypeIcon={alertTypeIcon} onClose={handleCloseConversation} isFlagged={flaggedAlertIds.has(String(alert.id))} onFlag={handleFlagAlert} />
                ))
              )}
            </div>
          </div>

          {/* Cột 2: AI trả lời không chắc chắn */}
          <div style={{ backgroundColor: "#FDFEFE", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.03)", padding: "16px" }}>
            <h3 style={{ color: "#B7791F", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", marginTop: 0, marginBottom: "12px", borderBottom: "1px solid rgba(183,121,31,0.1)", paddingBottom: "8px" }}>
              <AlertTriangle size={14} />
              AI trả lời không chắc chắn
              <span style={{ fontSize: "10px", backgroundColor: "#FFF7E6", color: "#B7791F", border: "1px solid #FADFA8", borderRadius: "20px", padding: "1px 6px", fontWeight: 700, marginLeft: "auto" }}>
                {aiAlerts.length}
              </span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "360px", overflowY: "auto", paddingRight: "4px" }}>
              {aiAlerts.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "rgba(0,59,185,0.4)", fontSize: "11px", border: "1px dashed rgba(0,59,185,0.15)", borderRadius: "10px", background: "#fcfcfc" }}>
                  Không có cảnh báo AI trả lời không chắc chắn
                </div>
              ) : (
                aiAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} alertTypeIcon={alertTypeIcon} onClose={handleCloseConversation} isFlagged={flaggedAlertIds.has(String(alert.id))} onFlag={handleFlagAlert} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row biểu đồ 1: Đường xu hướng và Phân bổ kênh nguồn */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "24px" }}>
        <ChartCard
          title="Lượng hội thoại theo thời gian"
          onOpenBuilder={() => onNavigate("chartbuilder")}
          data={dailyTrends}
          defaultChartType="line"
        >
          {({ chartType, chartData, editValues }: any) => {
            const valueKey =
              editValues.values === "AI trả lời thành công"
                ? "ai_ok"
                : editValues.values === "AI trả lời thất bại"
                  ? "ai_fail"
                  : "total";

            const nameKey = "date";

            let sortedData = [...chartData];
            if (editValues.sort === "Tăng dần") {
              sortedData.sort((a, b) => (a[valueKey] || 0) - (b[valueKey] || 0));
            } else if (editValues.sort === "Giảm dần") {
              sortedData.sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
            } else if (editValues.sort === "A-Z") {
              sortedData.sort((a, b) => String(a[nameKey] || "").localeCompare(String(b[nameKey] || "")));
            }

            const renderChart = () => {
              if (chartType === "donut" || chartType === "pie") {
                const pieData = sortedData
                  .filter((d) => d[valueKey] !== null)
                  .map((d) => ({ name: d[nameKey], value: d[valueKey] }));
                const COLORS = ["#003BB9", "#D73C01", "rgba(0,59,185,0.6)", "#ED5206", "rgba(0,59,185,0.3)"];
                return (
                  <PieChart id="pie-chart-trend">
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={chartType === "donut" ? 50 : 0}
                      outerRadius={80}
                      dataKey="value"
                      label={editValues.dataLabels}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={`pie-cell-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                  </PieChart>
                );
              }

              if (chartType === "bar") {
                return (
                  <BarChart id="bar-chart-trend" data={sortedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
                    <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                    <Bar
                      dataKey={valueKey}
                      name={
                        valueKey === "total"
                          ? "Thực tế"
                          : valueKey === "ai_ok"
                            ? "AI trả lời thành công"
                            : "AI trả lời thất bại"
                      }
                      fill="#003BB9"
                      radius={[4, 4, 0, 0]}
                      label={editValues.dataLabels ? { position: "top", fontSize: 10 } : undefined}
                    />

                  </BarChart>
                );
              }

              if (chartType === "hbar") {
                return (
                  <BarChart id="hbar-chart-trend" data={sortedData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <YAxis dataKey={nameKey} type="category" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} width={40} />
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                    <Bar
                      dataKey={valueKey}
                      name={
                        valueKey === "total"
                          ? "Thực tế"
                          : valueKey === "ai_ok"
                            ? "AI trả lời thành công"
                            : "AI trả lời thất bại"
                      }
                      fill="#003BB9"
                      radius={[0, 4, 4, 0]}
                      label={editValues.dataLabels ? { position: "right", fontSize: 10 } : undefined}
                    />

                  </BarChart>
                );
              }

              if (chartType === "area") {
                return (
                  <AreaChart id="area-chart-trend" data={sortedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
                    <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                    <Area
                      type="monotone"
                      dataKey={valueKey}
                      name={
                        valueKey === "total"
                          ? "Thực tế"
                          : valueKey === "ai_ok"
                            ? "AI trả lời thành công"
                            : "AI trả lời thất bại"
                      }
                      stroke="#003BB9"
                      fill="rgba(0,59,185,0.2)"
                      strokeWidth={2}
                      label={editValues.dataLabels}
                    />

                  </AreaChart>
                );
              }

              // Default: line chart
              return (
                <LineChart data={sortedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
                  <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                  <ChartTooltip />
                  {editValues.legend && <Legend iconSize={10} />}
                  <Line
                    type="monotone"
                    dataKey={valueKey}
                    name={
                      valueKey === "total"
                        ? "Thực tế"
                        : valueKey === "ai_ok"
                          ? "AI trả lời thành công"
                          : "AI trả lời thất bại"
                    }
                    stroke="#003BB9"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls={false}
                    label={editValues.dataLabels}
                  />

                </LineChart>
              );
            };

            return (
              <ResponsiveContainer width="100%" height={220}>
                {renderChart()}
              </ResponsiveContainer>
            );
          }}
        </ChartCard>

        <ChartCard
          title="Phân bổ theo kênh nguồn"
          onOpenBuilder={() => onNavigate("chartbuilder")}
          data={kpiData?.sourceSummary || {}}
          defaultChartType="donut"
        >
          {({ chartType, chartData, editValues }: any) => {
            const normalizedData: Record<string, number> = {
              ZaloOA: 0,
              ZaloBusiness: 0,
              Facebook: 0,
              ChatWidget: 0,
            };

            Object.entries(chartData || {}).forEach(([key, value]) => {
              const k = key.toLowerCase().trim();
              const val = typeof value === "number" ? value : 0;
              if (k === "zalooa" || k === "zalo") {
                normalizedData.ZaloOA += val;
              } else if (k === "zalobusiness" || k === "zalobiz") {
                normalizedData.ZaloBusiness += val;
              } else if (k === "facebook" || k === "fb" || k === "messenger") {
                normalizedData.Facebook += val;
              } else if (k === "chatwidget" || k === "website" || k === "web") {
                normalizedData.ChatWidget += val;
              }
            });

            let listData = Object.entries(normalizedData)
              .map(([name, value]) => ({
                name,
                value,
                colorKey: name,
              }))
              .filter((item) => item.value > 0);

            const total = listData.reduce((acc, curr) => acc + curr.value, 0);

            if (total === 0) {
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "220px",
                    color: "rgba(0,59,185,0.4)",
                    fontSize: "13px",
                  }}
                >
                  Không có dữ liệu kênh nguồn
                </div>
              );
            }

            if (editValues.sort === "Tăng dần") {
              listData.sort((a, b) => a.value - b.value);
            } else if (editValues.sort === "Giảm dần") {
              listData.sort((a, b) => b.value - a.value);
            } else if (editValues.sort === "A-Z") {
              listData.sort((a, b) => a.name.localeCompare(b.name));
            }

            const SOURCE_COLORS: Record<string, string> = {
              ZaloOA: "#00B2FE",
              ZaloBusiness: "#085fb6ff",
              Facebook: "#1877F2",
              ChatWidget: ORANGE,
            };

            const renderSourceChart = () => {
              if (chartType === "donut" || chartType === "pie") {
                return (
                  <PieChart>
                    <Pie
                      data={listData}
                      cx="50%"
                      cy="50%"
                      innerRadius={chartType === "donut" ? 50 : 0}
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={editValues.dataLabels}
                    >
                      {listData.map((entry) => (
                        <Cell
                          key={`cell-source-${entry.colorKey}`}
                          fill={SOURCE_COLORS[entry.colorKey] || "#003BB9"}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip
                      formatter={(value: number) => [
                        `${value.toLocaleString("vi-VN")} hội thoại (${((value / total) * 100).toFixed(1)}%)`,
                        "Số lượng",
                      ]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid rgba(0,59,185,0.08)",
                        fontFamily: "sans-serif",
                        fontSize: "12px",
                      }}
                    />
                    {editValues.legend && (
                      <Legend
                        iconSize={8}
                        iconType="circle"
                        layout="horizontal"
                        verticalAlign="bottom"
                        formatter={(value) => (
                          <span style={{ fontSize: "11px", color: "#003BB9", fontWeight: 500 }}>{value}</span>
                        )}
                      />
                    )}
                  </PieChart>
                );
              }

              if (chartType === "bar") {
                return (
                  <BarChart data={listData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                    <Bar
                      dataKey="value"
                      name="Số hội thoại"
                      fill="#003BB9"
                      radius={[4, 4, 0, 0]}
                      label={editValues.dataLabels ? { position: "top", fontSize: 10 } : undefined}
                    >
                      {listData.map((entry) => (
                        <Cell
                          key={`cell-source-bar-${entry.colorKey}`}
                          fill={SOURCE_COLORS[entry.colorKey] || "#003BB9"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                );
              }

              if (chartType === "hbar") {
                return (
                  <BarChart data={listData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} width={80} />
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                    <Bar
                      dataKey="value"
                      name="Số hội thoại"
                      fill="#003BB9"
                      radius={[0, 4, 4, 0]}
                      label={editValues.dataLabels ? { position: "right", fontSize: 10 } : undefined}
                    >
                      {listData.map((entry) => (
                        <Cell
                          key={`cell-source-hbar-${entry.colorKey}`}
                          fill={SOURCE_COLORS[entry.colorKey] || "#003BB9"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                );
              }

              if (chartType === "area") {
                return (
                  <AreaChart data={listData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Số hội thoại"
                      stroke="#003BB9"
                      fill="rgba(0,59,185,0.2)"
                      strokeWidth={2}
                      label={editValues.dataLabels}
                    />
                  </AreaChart>
                );
              }

              return (
                <LineChart data={listData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,59,185,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                  <ChartTooltip />
                  {editValues.legend && <Legend iconSize={10} />}
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Số hội thoại"
                    stroke="#003BB9"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    label={editValues.dataLabels}
                  />
                </LineChart>
              );
            };

            return (
              <ResponsiveContainer width="100%" height={220}>
                {renderSourceChart()}
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
      </div>



      {/* Bảng thống kê theo kênh nguồn bên dưới */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.05)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>
          <h3 style={{ color: "#003BB9", fontSize: "14px", fontWeight: 700, margin: 0 }}>
            Thống kê theo kênh
          </h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {sourceStats.map((ch, i) => (
            <div key={ch.name} style={{ padding: "18px 22px", borderRight: i < 3 ? "1px solid rgba(0,59,185,0.06)" : "none" }}>
              {/* Tên Kênh */}
              <div style={{ fontSize: "11px", color: "rgba(0,59,185,0.5)", fontWeight: 500, marginBottom: "6px" }}>{ch.name}</div>

              {/* Khối Hội thoại */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#003BB9", lineHeight: 1.1 }}>{viNum(ch.hoiday)}</div>
                <div style={{ fontSize: "11px", color: "rgba(0,59,185,0.4)", marginTop: "2px" }}>hội thoại</div>
              </div>

              {/* Khối Tin nhắn */}
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#334155", lineHeight: 1.1 }}>{viNum(ch.tinnan)}</div>
                <div style={{ fontSize: "11px", color: "rgba(0,59,185,0.4)", marginTop: "2px" }}>tin nhắn</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Câu hỏi nổi bật (Top Questions) */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.05)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,59,185,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "#003BB9", fontSize: "14px", fontWeight: 700, margin: 0 }}>Câu hỏi nổi bật từ khách hàng</h3>
          <button onClick={() => onNavigate("question")} style={{ fontSize: "12px", color: "#003BB9", border: "1px solid rgba(0,59,185,0.2)", background: "#f8fafc", padding: "5px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 500 }}>
            Xem toàn bộ
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["#", "Câu hỏi", "Chủ đề", "Số lần", "Kênh phổ biến", "Xu hướng", "Hành động"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,59,185,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topQuestions.map((q, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(0,59,185,0.04)" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                >
                  <td style={{ padding: "12px 16px", color: "rgba(0,59,185,0.3)", fontWeight: 700, fontSize: "12px" }}>#{i + 1}</td>
                  <td style={{ padding: "12px 16px", color: "#003BB9", maxWidth: "280px" }}>{q.question}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{q.topic}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#003BB9" }}>{q.count}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(0,59,185,0.6)", fontSize: "12px" }}>{q.channel}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {q.trend >= 0 ? (
                        <>
                          <TrendingUp size={12} style={{ color: "#228A61" }} />
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#228A61" }}>+{q.trend}%</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown size={12} style={{ color: ORANGE }} />
                          <span style={{ fontSize: "12px", fontWeight: 600, color: ORANGE }}>{q.trend}%</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => onNavigate("question")} style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid rgba(0,59,185,0.2)", background: "#f8fafc", color: "#003BB9", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                        <Eye size={10} /> Chi tiết
                      </button>
                      <button onClick={() => toast.success("Đã thêm vào FAQ đề xuất")} style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid rgba(0,59,185,0.15)", background: "#fff", color: "rgba(0,59,185,0.65)", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                        <Plus size={10} /> Thêm FAQ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hội thoại ưu tiên xử lý (Hiển thị tĩnh để giữ giao diện đẹp) */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,59,185,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "#003BB9", fontSize: "14px", fontWeight: 700, margin: 0 }}>Hội thoại ưu tiên xử lý</h3>
          {/* Nút Quản lý hội thoại đã ẩn */}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["ID", "Khách hàng", "Kênh", "Chủ đề", "Thời gian chờ", "Trạng thái", "Ưu tiên", "Hành động"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,59,185,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {priorityConversations.map((conv) => {
                const ss = statusColors[conv.status] || { bg: "#f1f5f9", color: "#64748b" };
                const pc = priorityColors[conv.priority];
                return (
                  <tr key={conv.id} style={{ borderBottom: "1px solid rgba(0,59,185,0.04)" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "12px 16px", color: "rgba(0,59,185,0.4)", fontFamily: "monospace", fontSize: "12px" }}>{conv.id}</td>
                    <td style={{ padding: "12px 16px", color: "#003BB9", fontWeight: 500 }}>{conv.customer}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{conv.channel}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#003BB9" }}>{conv.topic}</td>
                    <td style={{ padding: "12px 16px", color: conv.isOvertime ? ORANGE : "rgba(0,59,185,0.7)", fontWeight: conv.isOvertime ? 700 : 400, whiteSpace: "nowrap" }}>
                      {conv.isOvertime && <span style={{ marginRight: "4px" }}>⚠</span>}{conv.wait}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: ss.bg, color: ss.color, fontWeight: 500, whiteSpace: "nowrap" }}>{conv.status}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>{conv.priority}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button 
                          onClick={async () => {
                            try {
                              if (conv.customerId && conv.source) {
                                await handleCloseConversation(conv.customerId, conv.source);
                                toast.success("Đã đánh dấu xử lý thành công.");
                              } else {
                                toast.error("Không tìm thấy thông tin hội thoại để xử lý.");
                              }
                            } catch (err: any) {
                              toast.error(err.message || "Lỗi khi xử lý hội thoại.");
                            }
                          }} 
                          style={{ padding: "4px 9px", borderRadius: "7px", border: "none", background: "#003BB9", color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}
                        >
                          <CheckCircle size={10} /> Xử lý
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
