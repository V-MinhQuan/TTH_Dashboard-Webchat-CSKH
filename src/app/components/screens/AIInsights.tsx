import React, { useState } from "react";
import { Brain, AlertTriangle, CheckCircle, XCircle, HelpCircle, ShieldAlert, TrendingUp, ChevronDown, ChevronUp, FilePlus2, Clock, Table2, Activity } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";

const NAVY    = "#003865";
const ORANGE  = "#D73C01";   // kept for brand; use for borders/icons only
const CTA     = "#ED5206";
const CTA_SOFT= "#F36C2E";
// Soft surface tokens
const ORANGE_50 = "#FFF4EE";
const ORANGE_200= "#FBCBB8";
const AMBER_50  = "#FFF7E6";
const AMBER_100 = "#FADFA8";
const AMBER_TEXT= "#B7791F";
const RED_50    = "#FFF1F1";
const RED_100   = "#F8CACA";
const RED_TEXT  = "#B42318";

const failureTrend = [
  { date: "21/4", failure: 58, hallucination: 12, uncertain: 34 },
  { date: "22/4", failure: 72, hallucination: 18, uncertain: 41 },
  { date: "23/4", failure: 65, hallucination: 15, uncertain: 38 },
  { date: "24/4", failure: 89, hallucination: 24, uncertain: 52 },
  { date: "25/4", failure: 78, hallucination: 20, uncertain: 45 },
  { date: "26/4", failure: 94, hallucination: 28, uncertain: 58 },
  { date: "27/4", failure: 82, hallucination: 22, uncertain: 49 },
  { date: "28/4", failure: 71, hallucination: 19, uncertain: 42, forecast: true },
  { date: "29/4", failure: 68, hallucination: 17, uncertain: 39, forecast: true },
  { date: "30/4", failure: 95, hallucination: 30, uncertain: 61, forecast: true },
];

const failureByTopic = [
  { topic: "VSTEP", thieuDL: 18, khongHieu: 12, khongChac: 9, ngoaiPhamVi: 5, hallucination: 4 },
  { topic: "TOEIC", thieuDL: 14, khongHieu: 8, khongChac: 7, ngoaiPhamVi: 3, hallucination: 6 },
  { topic: "Lệ phí", thieuDL: 10, khongHieu: 6, khongChac: 11, ngoaiPhamVi: 2, hallucination: 8 },
  { topic: "Lịch thi", thieuDL: 9, khongHieu: 7, khongChac: 5, ngoaiPhamVi: 4, hallucination: 3 },
  { topic: "MOS/IC3", thieuDL: 7, khongHieu: 4, khongChac: 4, ngoaiPhamVi: 6, hallucination: 2 },
  { topic: "Chuẩn đầu ra", thieuDL: 5, khongHieu: 9, khongChac: 6, ngoaiPhamVi: 1, hallucination: 5 },
];

type FailReason = "Không tìm thấy dữ liệu" | "Không hiểu intent" | "AI không chắc chắn" | "Câu hỏi ngoài phạm vi" | "AI có nguy cơ tự tạo thông tin" | "AI trả lời sai";

const failedConversations: {
  id: string;
  question: string;
  aiAnswer: string;
  topic: string;
  channel: string;
  failReason: FailReason;
  confidence: number;
  impact: string;
  kbSuggestion: string;
}[] = [
  {
    id: "HT-2451",
    question: "Học sinh có được giảm giá thi TOEIC không?",
    aiAnswer: "Tôi không có thông tin chắc chắn về chính sách giảm giá cho học sinh...",
    topic: "TOEIC",
    channel: "Facebook",
    failReason: "Không tìm thấy dữ liệu",
    confidence: 0.34,
    impact: "Ưu tiên cao",
    kbSuggestion: "Bổ sung chính sách giảm giá học sinh/sinh viên vào FAQ TOEIC",
  },
  {
    id: "HT-2449",
    question: "Lịch thi VSTEP tháng này khi nào?",
    aiAnswer: "Tôi chưa có thông tin cập nhật về lịch thi VSTEP tháng này...",
    topic: "VSTEP",
    channel: "Zalo OA",
    failReason: "AI không chắc chắn",
    confidence: 0.42,
    impact: "Ưu tiên cao",
    kbSuggestion: "Cập nhật lịch thi VSTEP định kỳ theo tháng vào knowledge base",
  },
  {
    id: "HT-2445",
    question: "Phân biệt chuẩn đầu ra và chứng chỉ TOEIC như thế nào?",
    aiAnswer: "Chuẩn đầu ra và TOEIC là hai khái niệm liên quan...",
    topic: "Chuẩn đầu ra",
    channel: "Chat Widget",
    failReason: "Không hiểu intent",
    confidence: 0.28,
    impact: "Ưu tiên trung bình",
    kbSuggestion: "Thêm bài giải thích so sánh chuẩn đầu ra vs chứng chỉ quốc tế",
  },
  {
    id: "HT-2440",
    question: "Có thể dùng chứng chỉ TOEIC để miễn thi tin học không?",
    aiAnswer: "Tôi không tìm thấy thông tin về việc dùng TOEIC miễn thi tin học.",
    topic: "Tin học",
    channel: "Zalo Business",
    failReason: "Câu hỏi ngoài phạm vi",
    confidence: 0.38,
    impact: "Ưu tiên thấp",
    kbSuggestion: "Bổ sung thông tin về điều kiện miễn thi các môn học",
  },
  {
    id: "HT-2438",
    question: "Điểm TOEIC 600 có đủ chuẩn đầu ra của trường ĐH Bách Khoa không?",
    aiAnswer: "Điểm TOEIC 600 thường đáp ứng yêu cầu của nhiều trường... Tuy nhiên tôi không chắc về ĐH Bách Khoa.",
    topic: "TOEIC",
    channel: "Facebook",
    failReason: "AI có nguy cơ tự tạo thông tin",
    confidence: 0.31,
    impact: "Ưu tiên cao",
    kbSuggestion: "Thêm bảng tra cứu yêu cầu điểm của từng trường đại học",
  },
  {
    id: "HT-2435",
    question: "Lệ phí thi MOS Excel thi lại sau khi trượt?",
    aiAnswer: "Lệ phí thi lại MOS thường được giảm so với lần đầu...",
    topic: "MOS/IC3",
    channel: "Chat Widget",
    failReason: "AI không chắc chắn",
    confidence: 0.39,
    impact: "Ưu tiên trung bình",
    kbSuggestion: "Cập nhật chính sách thi lại và lệ phí MOS/IC3 vào FAQ",
  },
];

const failReasonColor: Record<FailReason, string> = {
  "Không tìm thấy dữ liệu": ORANGE,
  "Không hiểu intent": "#8b5cf6",
  "AI không chắc chắn": AMBER_TEXT,
  "Câu hỏi ngoài phạm vi": "#64748b",
  "AI có nguy cơ tự tạo thông tin": RED_TEXT,
  "AI trả lời sai": RED_TEXT,
};

const suggestedFAQs = [
  { question: "Học sinh có được giảm giá thi TOEIC không?", freq: 47, topic: "TOEIC", priority: "Ưu tiên cao" },
  { question: "Khi nào có lịch thi VSTEP tháng 5/2026?", freq: 38, topic: "VSTEP", priority: "Ưu tiên cao" },
  { question: "MOS và IC3 khác nhau như thế nào?", freq: 29, topic: "MOS/IC3", priority: "Ưu tiên trung bình" },
  { question: "Cách kiểm tra chuẩn đầu ra đã đạt chưa?", freq: 24, topic: "Chuẩn đầu ra", priority: "Ưu tiên trung bình" },
  { question: "Có thể miễn thi tin học không?", freq: 19, topic: "Tin học", priority: "Ưu tiên thấp" },
];

const priorityColor: Record<string, { bg: string; color: string }> = {
  "Ưu tiên cao":         { bg: ORANGE_50,  color: ORANGE },
  "Ưu tiên trung bình": { bg: AMBER_50,  color: AMBER_TEXT },
  "Ưu tiên thấp":        { bg: "#EAF8F1",  color: "#228A61" },
};

const impactColor: Record<string, { bg: string; color: string }> = {
  "Ưu tiên cao":         { bg: RED_50,    color: RED_TEXT },
  "Ưu tiên trung bình": { bg: AMBER_50, color: AMBER_TEXT },
  "Ưu tiên thấp":        { bg: "#f1f5f9", color: "#64748b" },
};

const staffReportedErrors = [
  { id: "ERR-1", time: "10:15 hôm nay", staff: "Thu Trang", channel: "Zalo Business", topic: "TOEIC", question: "Lệ phí thi TOEIC hiện tại là bao nhiêu?", aiAnswer: "Tôi không có thông tin cập nhật về lệ phí...", reason: "Không tìm thấy dữ liệu", impact: "Ưu tiên cao", status: "Chờ quản lý xác nhận" },
  { id: "ERR-2", time: "09:30 hôm nay", staff: "Thùy NT", channel: "Facebook", topic: "VSTEP", question: "Thi xong VSTEP bao lâu có bằng?", aiAnswer: "Chứng chỉ VSTEP sẽ được cấp sau 2 tháng...", reason: "AI trả lời sai", impact: "Ưu tiên trung bình", status: "Đã bổ sung FAQ" },
  { id: "ERR-3", time: "Hôm qua", staff: "Thu Trang", channel: "Chat Widget", topic: "Chuẩn đầu ra", question: "Điểm TOEIC 600 có đủ chuẩn đầu ra không?", aiAnswer: "Điểm TOEIC 600 thường đáp ứng...", reason: "AI có nguy cơ tự tạo thông tin", impact: "Ưu tiên cao", status: "Chờ quản lý xác nhận" },
];

interface AIInsightsProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

export function AIInsights({ filters, onFiltersChange, onNavigate }: AIInsightsProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {/* Section Label */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Phân tích AI</h2>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "14px", marginTop: "4px" }}>Phân tích câu hỏi, chủ đề và lỗi AI theo từng kênh</p>
      </div>

      {/* KPI Row - AI quality */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "16px" }}>
        {[
          { icon: CheckCircle, label: "Tỷ lệ AI trả lời thành công", value: "86,5%", change: "+2,1%", isWarning: false },
          { icon: XCircle, label: "AI trả lời thất bại", value: "215", change: "+24", isWarning: true },
          { icon: ShieldAlert, label: "Cảnh báo AI tự tạo thông tin", value: "19", change: "+5", isWarning: true },
          { icon: Activity, label: "Độ tin cậy trung bình", value: "84%", change: "+3%", isWarning: false },
        ].map(({ icon: Icon, label, value, change, isWarning }) => {
          const isNegative = change.startsWith("-");
          const badgeBg = isNegative ? "#FFF1F1" : "#EAF8F1";
          const badgeColor = isNegative ? "#B42318" : "#228A61";

          // Theme colors for icon circles
          let iconBg = "#EBF2FF";
          let iconColor = NAVY;
          if (Icon === CheckCircle) {
            iconBg = "#EAF8F1";
            iconColor = "#228A61";
          } else if (Icon === XCircle) {
            iconBg = "#FFF1F1";
            iconColor = "#B42318";
          } else if (Icon === ShieldAlert) {
            iconBg = "#FFF4EE";
            iconColor = ORANGE;
          } else if (Icon === Activity) {
            iconBg = "#EBF2FF";
            iconColor = NAVY;
          }

          return (
            <div
              key={label}
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "1px solid rgba(0,56,101,0.08)",
                boxShadow: "0 2px 10px rgba(0,62,154,0.06)",
                padding: "20px 22px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "stretch",
                transition: "box-shadow 0.2s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,62,154,0.11)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,62,154,0.06)";
              }}
            >
              {/* Left Column: Icon (top) and Label (bottom) */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "72px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} style={{ color: iconColor }} />
                </div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(0,56,101,0.55)", lineHeight: 1.3 }}>{label}</div>
              </div>

              {/* Right Column: Change badge (top) and Value (bottom, under Change badge) */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", height: "100%", minHeight: "72px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {change}
                </span>
                <div style={{ fontSize: "24px", fontWeight: 700, color: NAVY, lineHeight: 1 }}>{value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* KPI Row - Staff activity */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
        {[
          { icon: AlertTriangle, label: "Lỗi AI nhân viên ghi nhận", value: "47", isWarning: true },
          { icon: FilePlus2, label: "FAQ nhân viên đã thêm", value: "28", isWarning: false },
          { icon: Clock, label: "Dữ liệu chờ duyệt", value: "12", isWarning: true },
          { icon: Table2, label: "Đã cập nhật vào Sheet Chatbot", value: "16", isWarning: false },
        ].map(({ icon: Icon, label, value, isWarning }) => {
          let iconBg = "#EBF2FF";
          let iconColor = NAVY;
          if (Icon === AlertTriangle || Icon === Clock) {
            iconBg = "#FFF4EE";
            iconColor = ORANGE;
          } else if (Icon === FilePlus2) {
            iconBg = "#EAF8F1";
            iconColor = "#228A61";
          } else if (Icon === Table2) {
            iconBg = "#EBF2FF";
            iconColor = NAVY;
          }

          return (
            <div
              key={label}
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "1px solid rgba(0,56,101,0.08)",
                boxShadow: "0 2px 10px rgba(0,62,154,0.06)",
                padding: "20px 22px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "stretch",
                transition: "box-shadow 0.2s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,62,154,0.11)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,62,154,0.06)";
              }}
            >
              {/* Left Column: Icon (top) and Label (bottom) */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "72px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} style={{ color: iconColor }} />
                </div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(0,56,101,0.55)", lineHeight: 1.3 }}>{label}</div>
              </div>

              {/* Right Column: Value (bottom) */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-end", height: "100%", minHeight: "72px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, color: NAVY, lineHeight: 1 }}>{value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "20px", marginBottom: "24px" }}>
        <ChartCard title="Xu hướng AI thất bại theo ngày (+ dự báo 3 ngày)" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={failureTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <ReferenceLine x="28/4" stroke="rgba(0,56,101,0.2)" strokeDasharray="6 3" label={{ value: "Dự báo →", position: "insideTopRight", fontSize: 10, fill: "rgba(0,56,101,0.4)" }} />
              <Line type="monotone" dataKey="failure" name="AI trả lời thất bại" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="hallucination" name="AI có nguy cơ tự tạo thông tin" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="uncertain" name="AI không chắc chắn" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Lỗi AI theo chủ đề (Stacked)" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={failureByTopic} layout="vertical" barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis type="category" dataKey="topic" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.6)" }} width={70} />
              <Tooltip />
              <Bar dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={ORANGE} />
              <Bar dataKey="khongHieu" name="Không hiểu intent" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill="#f59e0b" />
              <Bar dataKey="ngoaiPhamVi" name="Ngoài phạm vi" stackId="a" fill="#64748b" />
              <Bar dataKey="hallucination" name="AI có nguy cơ tự tạo thông tin" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* AI Failed Conversations Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <XCircle size={16} style={{ color: ORANGE }} />
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Câu hỏi AI chưa xử lý được</h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: ORANGE_50, color: ORANGE, border: `1px solid ${ORANGE_200}`, fontWeight: 600 }}>{failedConversations.length} câu hỏi</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => toast.success("Đã xuất danh sách câu hỏi AI thất bại")}
              style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px" }}
            >
              Xuất danh sách
            </button>
            <button
              onClick={() => toast.success("Đã đánh dấu xử lý toàn bộ danh sách")}
              style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}
            >
              Đánh dấu xử lý (tất cả)
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Câu hỏi khách hàng", "Chủ đề", "Kênh", "Lý do lỗi AI", "Mức độ tin cậy", "Mức ảnh hưởng", "Gợi ý bổ sung Cơ sở tri thức", "Hành động"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failedConversations.map((conv) => {
                const isExpanded = expandedRow === conv.id;
                const fc = failReasonColor[conv.failReason];
                const ic = impactColor[conv.impact];
                return (
                  <React.Fragment key={conv.id}>
                    <tr
                      style={{ borderBottom: "1px solid rgba(0,56,101,0.04)", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                    >
                      <td style={{ padding: "12px 14px", maxWidth: "220px" }}>
                        <div style={{ color: NAVY, fontWeight: 500, fontSize: "12px", lineHeight: 1.4 }}>{conv.question}</div>
                        <div
                          onClick={() => setExpandedRow(isExpanded ? null : conv.id)}
                          style={{ fontSize: "11px", color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", marginTop: "4px" }}
                        >
                          Xem câu trả lời AI {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6", whiteSpace: "nowrap" }}>{conv.topic}</span>
                      </td>
                      <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.65)", whiteSpace: "nowrap" }}>{conv.channel}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: `${fc}18`, color: fc, fontWeight: 600, whiteSpace: "nowrap" }}>{conv.failReason}</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "40px", height: "5px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${conv.confidence * 100}%`, backgroundColor: conv.confidence < 0.4 ? RED_TEXT : AMBER_TEXT, borderRadius: "3px" }} />
                          </div>
                          <span style={{ fontSize: "11px", color: conv.confidence < 0.4 ? RED_TEXT : AMBER_TEXT, fontWeight: 600 }}>{(conv.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: ic.bg, color: ic.color, fontWeight: 600 }}>{conv.impact}</span>
                      </td>
                      <td style={{ padding: "12px 14px", maxWidth: "200px", fontSize: "11px", color: "rgba(0,56,101,0.65)", lineHeight: 1.4 }}>{conv.kbSuggestion}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          <button
                            onClick={() => toast.success(`Đã đánh dấu xử lý ${conv.id}`)}
                            style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${ORANGE}30`, background: "#fff3ef", color: ORANGE, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}
                          >
                            Đánh dấu xử lý
                          </button>
                          <button
                            onClick={() => toast.success(`Đã thêm vào FAQ đề xuất`)}
                            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.15)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}
                          >
                            Thêm FAQ
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${conv.id}-expanded`} style={{ backgroundColor: "#fff8f6" }}>
                        <td colSpan={8} style={{ padding: "12px 14px 14px 28px" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                            <span style={{ fontSize: "10px", color: ORANGE, fontWeight: 700, whiteSpace: "nowrap", paddingTop: "2px" }}>CÂU TRẢ LỜI AI:</span>
                            <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.7)", lineHeight: 1.5, fontStyle: "italic" }}>{conv.aiAnswer}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Errors Reported by Staff Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={16} style={{ color: ORANGE }} />
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Lỗi AI do nhân viên ghi nhận</h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: ORANGE_50, color: ORANGE, border: `1px solid ${ORANGE_200}`, fontWeight: 600 }}>{staffReportedErrors.length} lỗi</span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Thời gian", "Nhân viên", "Kênh", "Chủ đề", "Câu hỏi khách hàng", "Lý do đánh dấu", "Mức độ ảnh hưởng", "Trạng thái", "Hành động"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffReportedErrors.map((err) => (
                <tr key={err.id} style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                >
                  <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.65)", whiteSpace: "nowrap" }}>{err.time}</td>
                  <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 600 }}>{err.staff}</td>
                  <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.65)", whiteSpace: "nowrap" }}>{err.channel}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{err.topic}</span>
                  </td>
                  <td style={{ padding: "12px 14px", maxWidth: "200px" }}>
                    <div style={{ color: NAVY, fontWeight: 500, fontSize: "12px", lineHeight: 1.4 }}>{err.question}</div>
                    <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)", marginTop: "2px", fontStyle: "italic" }}>"{err.aiAnswer}"</div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: `${failReasonColor[err.reason as FailReason] || ORANGE}18`, color: failReasonColor[err.reason as FailReason] || ORANGE, fontWeight: 600, whiteSpace: "nowrap" }}>{err.reason}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: impactColor[err.impact]?.bg || "#f1f5f9", color: impactColor[err.impact]?.color || "#64748b", fontWeight: 600 }}>{err.impact}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: err.status.includes("Chờ") ? AMBER_50 : "#EAF8F1", color: err.status.includes("Chờ") ? AMBER_TEXT : "#228A61", fontWeight: 600, whiteSpace: "nowrap" }}>{err.status}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => toast.success("Đã xác nhận lỗi AI")} style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${NAVY}30`, background: "#fff", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}>Xác nhận</button>
                      <button onClick={() => toast.success("Đã duyệt FAQ")} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.15)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}>Duyệt FAQ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI sai đã bổ sung vào Sheet Chatbot */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle size={16} style={{ color: "#228A61" }} />
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>AI sai đã được bổ sung vào Sheet Chatbot</h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#16a34a", fontWeight: 600 }}>16 mục</span>
          </div>
          <button onClick={() => onNavigate("chatbot_sheet")} style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>
            Xem Sheet Chatbot
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Câu hỏi khách hàng", "Câu trả lời AI sai", "Câu trả lời đúng đã bổ sung", "Người bổ sung", "Chủ đề", "Trạng thái", "Ngày cập nhật"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { q: "Lệ phí thi TOEIC hiện tại là bao nhiêu?", wrong: "Tôi không có thông tin cập nhật...", correct: "Lệ phí thi TOEIC tại FLIC là 750.000 VNĐ/lần thi.", staff: "Thu Trang", topic: "TOEIC", status: "Có thể sử dụng", date: "Hôm nay" },
                { q: "Thi xong VSTEP bao lâu có kết quả?", wrong: "Chứng chỉ VSTEP sẽ được cấp sau 2 tháng...", correct: "Kết quả thi VSTEP trả trong 30 ngày làm việc.", staff: "Thùy NT", topic: "VSTEP", status: "Đã duyệt", date: "Hôm qua" },
                { q: "Đăng ký thi CNTT nhóm trên 3 bạn?", wrong: "Tôi không có dữ liệu về đăng ký nhóm...", correct: "Nhóm từ 3 người có thể đăng ký qua form online.", staff: "Thu Trang", topic: "CNTT Cơ bản", status: "Đã duyệt", date: "28/05/2026" },
              ].map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                >
                  <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 500, maxWidth: "180px" }}>{item.q}</td>
                  <td style={{ padding: "12px 14px", color: ORANGE, fontStyle: "italic", maxWidth: "160px", fontSize: "11px" }}>{item.wrong}</td>
                  <td style={{ padding: "12px 14px", color: "#16a34a", maxWidth: "180px", fontSize: "11px" }}>{item.correct}</td>
                  <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 600 }}>{item.staff}</td>
                  <td style={{ padding: "12px 14px" }}><span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{item.topic}</span></td>
                  <td style={{ padding: "12px 14px" }}><span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: item.status === "Đã duyệt" ? "#dbeafe" : "#dcfce7", color: item.status === "Đã duyệt" ? "#2563eb" : "#16a34a", fontWeight: 600 }}>{item.status}</span></td>
                  <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.55)", whiteSpace: "nowrap" }}>{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top chủ đề cần bổ sung */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px", padding: "20px 24px" }}>
        <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: "0 0 16px 0" }}>Top chủ đề cần bổ sung dữ liệu</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { topic: "VSTEP", count: 38, pct: 85 },
            { topic: "TOEIC", count: 29, pct: 65 },
            { topic: "Lệ phí", count: 22, pct: 50 },
            { topic: "Chuẩn đầu ra ngoại ngữ", count: 18, pct: 40 },
            { topic: "MOS/IC3", count: 12, pct: 27 },
          ].map(item => (
            <div key={item.topic} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "130px", fontSize: "12px", color: NAVY, fontWeight: 500, flexShrink: 0 }}>{item.topic}</div>
              <div style={{ flex: 1, height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${item.pct}%`, backgroundColor: CTA, borderRadius: "4px" }} />
              </div>
              <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.65)", fontWeight: 600, width: "50px", textAlign: "right" }}>{item.count} lần</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Suggestions */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TrendingUp size={16} style={{ color: "#228A61" }} />
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>FAQ cần bổ sung vào cơ sở tri thức</h3>
          </div>
          <button
            onClick={() => toast.success("Đã gửi toàn bộ FAQ cho admin duyệt")}
            style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}
          >
            Duyệt tất cả
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Câu hỏi đề xuất", "Chủ đề", "Xuất hiện", "Ưu tiên", "Hành động"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suggestedFAQs.map((faq, i) => {
                const pc = priorityColor[faq.priority];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 500, fontSize: "12px", lineHeight: 1.4 }}>{faq.question}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{faq.topic}</span>
                    </td>
                    <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 700 }}>{faq.freq} lần</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: pc.bg, color: pc.color, fontWeight: 600 }}>{faq.priority}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => toast.success("Đã duyệt FAQ")}
                          style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${ORANGE}30`, background: "#fff3ef", color: ORANGE, cursor: "pointer", fontSize: "10px", fontWeight: 600 }}
                        >
                          Duyệt FAQ
                        </button>
                        <button
                          onClick={() => toast.success("Đã bổ sung dữ liệu AI")}
                          style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.15)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600 }}
                        >
                          Bổ sung dữ liệu
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
  );
}
