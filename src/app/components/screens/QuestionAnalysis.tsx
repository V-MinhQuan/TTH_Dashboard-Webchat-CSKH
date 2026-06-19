import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { getDashboardKpi } from "../../services/dashboardApi";
import { createSheetChatbotRow } from "../../services/sheetChatbotApi";
import type { DashboardKpiData, TopQuestion } from "../../types/dashboard";

const NAVY = "#003865";
const ORANGE = "#D73C01";

interface QuestionAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

function formatDateStr(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDatesFromRange(range: string, customFrom?: string, customTo?: string): { startDate?: string; endDate?: string } {
  const today = new Date();

  if (range === "Hôm nay") {
    return { startDate: formatDateStr(today), endDate: formatDateStr(today) };
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
  if (range === "Tháng trước") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: formatDateStr(start), endDate: formatDateStr(end) };
  }
  if (range === "Tùy chỉnh" && customFrom && customTo) {
    return { startDate: customFrom, endDate: customTo };
  }
  return {};
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,56,101,0.45)", fontSize: "13px", fontStyle: "italic" }}>
      {text}
    </div>
  );
}

export function QuestionAnalysis({ filters, onFiltersChange, onNavigate }: QuestionAnalysisProps) {
  const [data, setData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError(null);
      try {
        const dates = getDatesFromRange(filters.dateRange, filters.customDateFrom, filters.customDateTo);
        const result = await getDashboardKpi({
          ...dates,
          channel: filters.channel,
          topic: filters.topic,
          conversationStatus: filters.conversationStatus,
          aiStatus: filters.aiStatus,
        });
        if (!cancelled) setData(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể tải dữ liệu câu hỏi từ database.";
        if (!cancelled) {
          setLoadError(message);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const topQuestions = data?.topQuestions ?? [];
  const questionTrend = useMemo(() => {
    return (data?.dailyTrends ?? []).map((row) => ({
      date: row.date,
      total: Number(row.total || row.totalMessages || row.messages || 0),
      processed: Number(row.processed || 0),
      unprocessed: Number(row.unprocessed || 0),
    }));
  }, [data]);

  const handleCreateFaq = async (question: TopQuestion) => {
    try {
      await createSheetChatbotRow({
        question: question.question,
        correctAnswer: "Cần bổ sung câu trả lời chính thức từ quản lý.",
        topic: question.topic || "Không phân loại trong database",
        source: "Câu hỏi lặp lại nhiều lần",
        risk: "Trung bình",
        status: "Chờ xử lý",
        notes: `Tạo từ Phân tích câu hỏi. Số lần hỏi trong database: ${question.count}.`,
        addedBy: "Dashboard",
      });
      toast.success("Đã tạo phản hồi chờ xử lý trong thư viện");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tạo FAQ từ câu hỏi này");
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {loadError && (
        <div style={{ marginBottom: "16px", padding: "12px 14px", borderRadius: "10px", background: "#FFF1F1", color: "#B42318", fontSize: "13px", border: "1px solid #F8CACA" }}>
          {loadError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
        <ChartCard title="Câu hỏi nhiều nhất theo chủ đề" onOpenBuilder={() => onNavigate("chartbuilder")} defaultChartType="hbar" supportedChartTypes={["hbar"]}>
          {loading ? (
            <EmptyChart text="Đang tải dữ liệu từ database..." />
          ) : topQuestions.length === 0 ? (
            <EmptyChart text="Database chưa có dữ liệu top câu hỏi cho bộ lọc này." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topQuestions.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                <YAxis dataKey="topic" type="category" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} width={110} />
                <Tooltip />
                <Bar dataKey="count" name="Số lần hỏi" fill={ORANGE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Xu hướng câu hỏi theo thời gian" onOpenBuilder={() => onNavigate("chartbuilder")} defaultChartType="line" supportedChartTypes={["line"]}>
          {loading ? (
            <EmptyChart text="Đang tải dữ liệu từ database..." />
          ) : questionTrend.length === 0 ? (
            <EmptyChart text="Database chưa có dữ liệu xu hướng câu hỏi cho bộ lọc này." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={questionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                <Tooltip />
                <Legend iconSize={10} />
                <Line type="monotone" dataKey="total" name="Tổng câu hỏi" stroke={NAVY} strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="unprocessed" name="Chưa xử lý" stroke={ORANGE} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: NAVY, fontSize: "15px", fontWeight: 700 }}>Top câu hỏi thường gặp</h3>
          <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.45)" }}>Sắp xếp theo số lần hỏi từ database</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              {["#", "Câu hỏi", "Chủ đề", "Kênh", "Số lần", "Xu hướng", "Hành động"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.55)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ padding: "36px", textAlign: "center", color: "rgba(0,56,101,0.45)" }}>Đang tải dữ liệu từ database...</td>
              </tr>
            )}
            {!loading && topQuestions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "36px", textAlign: "center", color: "rgba(0,56,101,0.45)" }}>Database chưa có câu hỏi phù hợp với bộ lọc hiện tại.</td>
              </tr>
            )}
            {!loading && topQuestions.map((q, i) => (
              <tr
                key={`${q.question}-${q.topic}-${i}`}
                style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
              >
                <td style={{ padding: "14px 16px", color: "rgba(0,56,101,0.35)", fontWeight: 700 }}>#{i + 1}</td>
                <td style={{ padding: "14px 16px", color: NAVY, maxWidth: "320px" }}>{q.question}</td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{q.topic || "Không phân loại trong database"}</span>
                </td>
                <td style={{ padding: "14px 16px", color: "rgba(0,56,101,0.65)" }}>{q.channel || "Không có kênh trong database"}</td>
                <td style={{ padding: "14px 16px", fontWeight: 600, color: NAVY }}>{q.count}</td>
                <td style={{ padding: "14px 16px" }}>
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
                <td style={{ padding: "14px 16px" }}>
                  <button
                    onClick={() => void handleCreateFaq(q)}
                    style={{ padding: "5px 12px", borderRadius: "7px", border: `1px solid ${ORANGE}30`, background: "#fff3ef", color: ORANGE, cursor: "pointer", fontSize: "11px", fontWeight: 600 }}
                  >
                    Tạo FAQ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
