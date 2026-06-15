import { HelpCircle, TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";

const NAVY = "#003865";
const ORANGE = "#D73C01";

const topQuestions = [
  { question: "Lịch thi TOEIC 2025 khi nào?", count: 234, ai_ok: 210, ai_fail: 24, topic: "TOEIC", trend: 28 },
  { question: "Lệ phí thi TOEIC là bao nhiêu?", count: 198, ai_ok: 165, ai_fail: 33, topic: "TOEIC", trend: -12 },
  { question: "Đăng ký thi VSTEP như thế nào?", count: 178, ai_ok: 154, ai_fail: 24, topic: "VSTEP", trend: 19 },
  { question: "Chuẩn đầu ra ngoại ngữ gồm những gì?", count: 156, ai_ok: 128, ai_fail: 28, topic: "Chuẩn đầu ra", trend: -8 },
  { question: "Học bổng miễn chuẩn đầu ra áp dụng khi nào?", count: 142, ai_ok: 89, ai_fail: 53, topic: "Chuẩn đầu ra", trend: 55 },
  { question: "MOS khác IC3 như thế nào?", count: 134, ai_ok: 104, ai_fail: 30, topic: "MOS/IC3", trend: 31 },
  { question: "Thi tin học cơ sở ở đâu?", count: 121, ai_ok: 108, ai_fail: 13, topic: "Tin học", trend: -6 },
  { question: "Tra cứu điểm TOEIC online không?", count: 109, ai_ok: 78, ai_fail: 31, topic: "TOEIC", trend: 41 },
];

const questionTrend = [
  { date: "T2", TOEIC: 48, VSTEP: 32, ChuanDauRa: 28, TinHoc: 22 },
  { date: "T3", TOEIC: 55, VSTEP: 38, ChuanDauRa: 34, TinHoc: 25 },
  { date: "T4", TOEIC: 62, VSTEP: 44, ChuanDauRa: 31, TinHoc: 28 },
  { date: "T5", TOEIC: 58, VSTEP: 41, ChuanDauRa: 38, TinHoc: 24 },
  { date: "T6", TOEIC: 74, VSTEP: 52, ChuanDauRa: 42, TinHoc: 31 },
  { date: "T7", TOEIC: 69, VSTEP: 48, ChuanDauRa: 39, TinHoc: 28 },
  { date: "CN", TOEIC: 51, VSTEP: 35, ChuanDauRa: 29, TinHoc: 20 },
];

interface QuestionAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

export function QuestionAnalysis({ filters, onFiltersChange, onNavigate }: QuestionAnalysisProps) {
  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
        <ChartCard title="Câu hỏi nhiều nhất theo chủ đề" onOpenBuilder={() => onNavigate("chartbuilder")} defaultChartType="hbar" supportedChartTypes={["hbar"]}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topQuestions.slice(0, 6)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis dataKey="topic" type="category" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} width={80} />
              <Tooltip />
              <Bar dataKey="ai_ok" name="AI trả lời thành công" fill="#228A61" stackId="a" />
              <Bar dataKey="ai_fail" name="AI trả lời thất bại" fill={ORANGE} stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Xu hướng câu hỏi theo chủ đề" onOpenBuilder={() => onNavigate("chartbuilder")} defaultChartType="line" supportedChartTypes={["line"]}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={questionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <Line type="monotone" dataKey="TOEIC" stroke={NAVY} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="VSTEP" stroke={ORANGE} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="ChuanDauRa" name="Chuẩn đầu ra" stroke="#228A61" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="TinHoc" name="Tin học" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Questions Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: NAVY, fontSize: "15px", fontWeight: 700 }}>Top câu hỏi thường gặp</h3>
          <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.45)" }}>Sắp xếp theo số lần hỏi</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              {["#", "Câu hỏi", "Chủ đề", "Số lần", "AI trả lời thành công", "AI trả lời thất bại", "Xu hướng", "Hành động"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.55)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topQuestions.map((q, i) => (
              <tr
                key={i}
                style={{ borderBottom: "1px solid rgba(0,56,101,0.04)", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
              >
                <td style={{ padding: "14px 16px", color: "rgba(0,56,101,0.35)", fontWeight: 700 }}>#{i + 1}</td>
                <td style={{ padding: "14px 16px", color: NAVY, maxWidth: "280px" }}>{q.question}</td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{q.topic}</span>
                </td>
                <td style={{ padding: "14px 16px", fontWeight: 600, color: NAVY }}>{q.count}</td>
                <td style={{ padding: "14px 16px", color: "#228A61", fontWeight: 600 }}>{q.ai_ok}</td>
                <td style={{ padding: "14px 16px", color: q.ai_fail > 30 ? ORANGE : "rgba(0,56,101,0.6)", fontWeight: q.ai_fail > 30 ? 600 : 400 }}>{q.ai_fail}</td>
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
                    onClick={() => toast.success(`Đã tạo FAQ: "${q.question.slice(0, 30)}..."`)}
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
