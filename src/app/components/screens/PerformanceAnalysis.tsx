import { useEffect, useMemo, useState } from "react";
import { Zap, TrendingDown, Star, TimerReset, Target } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { buildApiUrl, fetchApiJson, formatChannelParam, getDashboardKpi } from "../../services/dashboardApi";
import type { DashboardKpiData } from "../../types/dashboard";
import { getDateParamsFromFilters } from "../../utils/dateFilters";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const GREEN_SOFT = "#EAF8F1";
const RED_SOFT = "#FFF1F1";
const RED_TEXT = "#B42318";

interface PerformanceAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

export function PerformanceAnalysis({ filters, onFiltersChange, onNavigate }: PerformanceAnalysisProps) {
  const [kpi, setKpi] = useState<DashboardKpiData | null>(null);
  const [quality, setQuality] = useState<any>({ success_rate: 0, failure_count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const dateParams = getDateParamsFromFilters(filters);
        const queryParams = new URLSearchParams();
        if (dateParams.startDate) queryParams.set("startDate", dateParams.startDate);
        if (dateParams.endDate) queryParams.set("endDate", dateParams.endDate);
        if (filters.channel && filters.channel !== "Tất cả") queryParams.set("channel", formatChannelParam(filters.channel));
        if (filters.topic && filters.topic !== "Tất cả") queryParams.set("topic", filters.topic);
        if (filters.conversationStatus && filters.conversationStatus !== "Tất cả") queryParams.set("conversationStatus", filters.conversationStatus);
        if (filters.aiStatus && filters.aiStatus !== "Tất cả") queryParams.set("aiStatus", filters.aiStatus);

        const [kpiData, qualityData] = await Promise.all([
          getDashboardKpi({
            ...dateParams,
            channel: filters.channel,
            topic: filters.topic,
            conversationStatus: filters.conversationStatus,
            aiStatus: filters.aiStatus,
          }),
          fetchApiJson<{ success: boolean; data: any }>(buildApiUrl("/api/analytics/ai/quality-metrics", queryParams), { cache: false }).catch(() => null),
        ]);
        if (cancelled) return;
        setKpi(kpiData);
        if (qualityData?.success) setQuality(qualityData.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const closed = kpi?.statusSummary.closed ?? 0;
  const total = kpi?.totalConversations ?? 0;
  const resolveRate = total > 0 ? (closed / total) * 100 : 0;
  const escalationRate = total > 0 ? ((kpi?.aiFailures ?? 0) / total) * 100 : 0;
  const trendData = useMemo(() => (kpi?.dailyTrends ?? []).map((row) => ({
    date: row.date,
    total: Number(row.total || 0),
    processed: Number(row.processed || 0),
    unprocessed: Number(row.unprocessed || 0),
  })), [kpi]);

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Hiệu suất cá nhân</h2>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "14px", marginTop: "4px" }}>Các chỉ số lấy từ database dashboard và analytics AI</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { icon: TimerReset, label: "Thời gian phản hồi TB", value: `${kpi?.averageResponseTimeMinutes ?? 0} phút`, change: "DB" },
          { icon: Target, label: "Tỷ lệ giải quyết", value: percent(resolveRate), change: "DB" },
          { icon: Zap, label: "AI xử lý thành công", value: percent(Number(quality.success_rate || 0)), change: "DB" },
          { icon: TrendingDown, label: "Hội thoại lỗi AI", value: percent(escalationRate), change: "DB" },
          { icon: Star, label: "Điểm hài lòng", value: "Không có cột DB", change: "Thiếu dữ liệu" },
        ].map(({ icon: Icon, label, value, change }) => {
          const isMissing = value === "Không có cột DB";
          return (
            <div
              key={label}
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "1px solid rgba(0,56,101,0.08)",
                boxShadow: "0 2px 8px rgba(0,56,101,0.05)",
                padding: "20px 22px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "stretch",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "72px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#EBF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} style={{ color: NAVY }} />
                </div>
                <div style={{ marginTop: "14px", fontSize: "12px", fontWeight: 500, color: "rgba(0,56,101,0.5)", lineHeight: 1.3 }}>{label}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", minHeight: "72px" }}>
                <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", backgroundColor: isMissing ? RED_SOFT : GREEN_SOFT, color: isMissing ? RED_TEXT : "#228A61", fontWeight: 600 }}>{change}</span>
                <div style={{ fontSize: isMissing ? "13px" : "24px", fontWeight: 700, color: NAVY, lineHeight: 1, textAlign: "right" }}>{loading ? "..." : value}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <ChartCard title="Hiệu suất xử lý theo thời gian" onOpenBuilder={() => onNavigate("chartbuilder")} defaultChartType="line" supportedChartTypes={["line"]}>
          {trendData.length === 0 ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,56,101,0.45)", fontSize: "13px" }}>Chưa có dữ liệu daily trend trong database.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                <Tooltip />
                <Legend iconSize={10} />
                <Line type="monotone" dataKey="processed" name="Đã xử lý" stroke="#1565C0" strokeWidth={2} />
                <Line type="monotone" dataKey="unprocessed" name="Chưa xử lý" stroke={ORANGE} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Số lượng hội thoại theo ngày" onOpenBuilder={() => onNavigate("chartbuilder")} defaultChartType="bar" supportedChartTypes={["bar"]}>
          {trendData.length === 0 ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,56,101,0.45)", fontSize: "13px" }}>Chưa có dữ liệu daily trend trong database.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
                <Tooltip />
                <Bar dataKey="total" name="Hội thoại" fill={NAVY} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
