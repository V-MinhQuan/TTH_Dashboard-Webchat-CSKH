import { Heart, Meh, Frown, TrendingUp, AlertTriangle, Lightbulb, Star } from "lucide-react";
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";

const NAVY = "#003865";
const ORANGE = "#D73C01";

const sentimentTrend = [
  { date: "1/4", positive: 60, neutral: 25, negative: 15 },
  { date: "5/4", positive: 65, neutral: 22, negative: 13 },
  { date: "10/4", positive: 58, neutral: 28, negative: 14 },
  { date: "15/4", positive: 70, neutral: 18, negative: 12 },
  { date: "20/4", positive: 63, neutral: 23, negative: 14 },
  { date: "25/4", positive: 67, neutral: 20, negative: 13 },
  { date: "27/4", positive: 64, neutral: 22, negative: 14 },
];

const topicSentiment = [
  { topic: "TOEIC", positive: 72, neutral: 20, negative: 8 },
  { topic: "VSTEP", positive: 68, neutral: 22, negative: 10 },
  { topic: "Chuẩn đầu ra", positive: 75, neutral: 16, negative: 9 },
  { topic: "Tin học", positive: 80, neutral: 15, negative: 5 },
  { topic: "Lệ phí", positive: 42, neutral: 28, negative: 30 },
  { topic: "Lịch thi", positive: 58, neutral: 27, negative: 15 },
  { topic: "Tra cứu điểm", positive: 51, neutral: 25, negative: 24 },
];

const donutData = [
  { name: "Tích cực", value: 64, color: "#3E9675" },
  { name: "Trung lập", value: 22, color: "#E5A850" },
  { name: "Tiêu cực", value: 14, color: "#D26767" },
];

const negKeywords = [
  { word: "chờ quá lâu", count: 89, topic: "Lệ phí" },
  { word: "không tìm thấy", count: 76, topic: "Tra cứu điểm" },
  { word: "sai thông tin", count: 54, topic: "Lịch thi" },
  { word: "không hiểu câu hỏi", count: 48, topic: "VSTEP" },
  { word: "cần gặp nhân viên", count: 43, topic: "Chuẩn đầu ra" },
];

type NegLevel = "Rất tiêu cực" | "Tiêu cực" | "Hơi tiêu cực";

const negativeConversations: {
  id: string;
  customer: string;
  complaint: string;
  topic: string;
  channel: string;
  level: NegLevel;
  waitTime: string;
  status: string;
}[] = [
  {
    id: "HT-2451",
    customer: "Nguyễn Văn A",
    complaint: "Em hỏi lịch thi VSTEP mà chatbot trả lời không rõ, hỏi đi hỏi lại vẫn không có câu trả lời cụ thể.",
    topic: "VSTEP",
    channel: "Facebook",
    level: "Rất tiêu cực",
    waitTime: "2g 15p",
    status: "Chờ quản lý xác nhận",
  },
  {
    id: "HT-2440",
    customer: "Phạm Thị D",
    complaint: "Thông tin lệ phí TOEIC bị khác nhau giữa các lần hỏi, không biết đâu là đúng.",
    topic: "TOEIC",
    channel: "Zalo Business",
    level: "Rất tiêu cực",
    waitTime: "6g 40p",
    status: "Chờ xử lý",
  },
  {
    id: "HT-2432",
    customer: "Trần Minh H",
    complaint: "Không tìm thấy hướng dẫn đăng ký thi MOS ở đâu cả, chatbot không giúp được.",
    topic: "MOS/IC3",
    channel: "Chat Widget",
    level: "Tiêu cực",
    waitTime: "1g 30p",
    status: "Đang xử lý",
  },
  {
    id: "HT-2427",
    customer: "Lê Thị K",
    complaint: "Chờ phản hồi quá lâu, đã gửi câu hỏi từ sáng đến chiều chưa có ai trả lời.",
    topic: "Chuẩn đầu ra",
    channel: "Zalo OA",
    level: "Tiêu cực",
    waitTime: "8g 05p",
    status: "Chờ xử lý",
  },
  {
    id: "HT-2420",
    customer: "Nguyễn Thị M",
    complaint: "Tra cứu điểm thi nhưng hệ thống báo lỗi, chatbot không hỗ trợ được gì.",
    topic: "Tra cứu điểm",
    channel: "Facebook",
    level: "Hơi tiêu cực",
    waitTime: "55p",
    status: "Đang xử lý",
  },
  {
    id: "HT-2415",
    customer: "Phan Văn N",
    complaint: "Thắc mắc về điều kiện miễn thi Tin học nhưng bot không có thông tin, phải chờ quản lý.",
    topic: "Tin học",
    channel: "Zalo Business",
    level: "Hơi tiêu cực",
    waitTime: "2g 10p",
    status: "Chờ quản lý xác nhận",
  },
];

const negLevelConfig: Record<NegLevel, { bg: string; color: string; stars: number }> = {
  "Rất tiêu cực": { bg: "#FFF1F1", color: "#B42318", stars: 3 },
  "Tiêu cực":     { bg: "#FFF4EE", color: ORANGE,   stars: 2 },
  "Hơi tiêu cực": { bg: "#FFF7E6", color: "#B7791F", stars: 1 },
};

const statusConfig: Record<string, { bg: string; color: string }> = {
  "Chờ quản lý xác nhận": { bg: "#FFF4EE", color: ORANGE },
  "Chờ xử lý":          { bg: "#FFF7E6", color: "#B7791F" },
  "Đang xử lý":          { bg: "#dbeafe", color: "#3b82f6" },
  "Hoàn thành":           { bg: "#EAF8F1", color: "#228A61" },
};

interface SentimentAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

export function SentimentAnalysis({ filters, onFiltersChange, onNavigate }: SentimentAnalysisProps) {
  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {/* Section Label */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Phân tích cảm xúc</h2>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "14px", marginTop: "4px" }}>Theo dõi và phân tích thái độ, mức độ hài lòng của khách hàng</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { icon: Heart, label: "Tỷ lệ tích cực", value: "64%", change: "+3%", color: "#228A61", bg: "#f0fdf4", trend: "+2.1% so với tuần trước" },
          { icon: Meh, label: "Tỷ lệ trung lập", value: "22%", change: "0%", color: "#f59e0b", bg: "#fffbeb", trend: "Ổn định" },
          { icon: Frown, label: "Tỷ lệ tiêu cực", value: "14%", change: "-2%", color: ORANGE, bg: "#fff5f5", trend: "-1.8% so với tuần trước" },
          { icon: Star, label: "Mức độ hài lòng", value: "4.1/5", change: "+0.2", color: "#a855f7", bg: "#faf5ff", trend: "Tăng so với tháng trước" },
        ].map(({ icon: Icon, label, value, change, color, bg, trend }) => (
          <div key={label} style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={22} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>{value}</div>
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.45)" }}>{trend}</div>
            <div style={{ marginTop: "10px", fontSize: "11px", padding: "3px 8px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "rgba(0,56,101,0.5)", display: "inline-block", fontWeight: 500 }}>{change}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
        <ChartCard title="Xu hướng cảm xúc theo thời gian" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={sentimentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend iconSize={10} />
              <Line type="monotone" dataKey="positive" name="Tích cực" stroke="#3E9675" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="neutral" name="Trung lập" stroke="#E5A850" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="negative" name="Tiêu cực" stroke="#D26767" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Phân bổ cảm xúc tổng quan" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px", height: "220px" }}>
            <PieChart width={200} height={200}>
              <Pie data={donutData} cx={100} cy={100} innerRadius={55} outerRadius={85} dataKey="value">
                {donutData.map((d) => <Cell key={`sentiment-donut-${d.name}`} fill={d.color} />)}
              </Pie>
            </PieChart>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {donutData.map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: d.color }} />
                  <span style={{ fontSize: "13px", color: NAVY }}>{d.name}</span>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: d.color, marginLeft: "auto" }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Stacked by Topic */}
      <div style={{ marginBottom: "24px" }}>
        <ChartCard title="Cảm xúc theo chủ đề" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topicSentiment}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="topic" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend iconSize={10} />
              <Bar dataKey="positive" name="Tích cực" stackId="a" fill="#3E9675" />
              <Bar dataKey="neutral" name="Trung lập" stackId="a" fill="#E5A850" />
              <Bar dataKey="negative" name="Tiêu cực" stackId="a" fill="#D26767" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Negative Conversations Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Frown size={16} style={{ color: ORANGE }} />
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Hội thoại có cảm xúc tiêu cực cần xử lý</h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#FFF4EE", border: "1px solid #FBCBB8", color: ORANGE, fontWeight: 600 }}>{negativeConversations.length} hội thoại</span>
          </div>
          <button
            onClick={() => toast.success("Đã đánh dấu xử lý toàn bộ danh sách")}
            style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, #ED5206 0%, #F36C2E 100%)`, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}
          >
            Đánh dấu xử lý (tất cả)
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Khách hàng", "Nội dung phàn nàn", "Chủ đề", "Kênh", "Mức độ tiêu cực", "Thời gian chờ", "Trạng thái", "Hành động"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {negativeConversations.map((conv) => {
                const lc = negLevelConfig[conv.level];
                const sc = statusConfig[conv.status] || { bg: "#f1f5f9", color: "#64748b" };
                return (
                  <tr key={conv.id}
                    style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: NAVY, fontSize: "12px" }}>{conv.customer}</div>
                      <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)", fontFamily: "monospace", marginTop: "2px" }}>{conv.id}</div>
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: "240px" }}>
                      <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.7)", lineHeight: 1.5, fontStyle: "italic" }}>"{conv.complaint}"</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6", whiteSpace: "nowrap" }}>{conv.topic}</span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.65)", whiteSpace: "nowrap" }}>{conv.channel}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: lc.bg, color: lc.color, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" }}>{conv.level}</span>
                        <div style={{ display: "flex", gap: "2px" }}>
                          {Array.from({ length: lc.stars }).map((_, i) => (
                            <span key={i} style={{ color: lc.color, fontSize: "11px" }}>●</span>
                          ))}
                          {Array.from({ length: 3 - lc.stars }).map((_, i) => (
                            <span key={i} style={{ color: "#e2e8f0", fontSize: "11px" }}>●</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", color: conv.waitTime.includes("g") && parseInt(conv.waitTime) >= 4 ? ORANGE : "rgba(0,56,101,0.65)", fontWeight: conv.waitTime.includes("g") && parseInt(conv.waitTime) >= 4 ? 600 : 400, whiteSpace: "nowrap" }}>{conv.waitTime}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: sc.bg, color: sc.color, fontWeight: 600, whiteSpace: "nowrap" }}>{conv.status}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        <button
                          onClick={() => toast.success(`Đang xem hội thoại ${conv.id}`)}
                          style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.15)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}
                        >
                          Xem hội thoại
                        </button>
                        <button
                          onClick={() => toast.success(`Đã đánh dấu xử lý ${conv.id}`)}
                          style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${ORANGE}30`, background: "#fff3ef", color: ORANGE, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}
                        >
                          Đánh dấu xử lý
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

      {/* Keywords & AI */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "20px" }}>
          <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, marginBottom: "16px", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={15} style={{ color: ORANGE }} /> Từ khóa gây cảm xúc tiêu cực
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {negKeywords.map((kw, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#FFF4EE" }}>
                <span style={{ fontSize: "11px", color: ORANGE, fontWeight: 700 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: "13px", color: NAVY }}>"{kw.word}"</span>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{kw.topic}</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: ORANGE }}>{kw.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            {
              icon: TrendingUp,
              title: "Dự báo xu hướng cảm xúc",
              color: NAVY,
              content: "Sentiment tiêu cực có thể tăng 3-5% trong tuần tới do gần deadline đăng ký thi. Đặc biệt topic 'Lệ phí' và 'Tra cứu điểm' cần quan tâm.",
            },
            {
              icon: Lightbulb,
              title: "Khuyến nghị cải thiện",
              color: "#228A61",
              items: ["Cải thiện tốc độ tra cứu điểm thi", "Thêm FAQ cho topic Lệ phí", "Tăng độ chính xác trả lời về Lịch thi", "Bổ sung chính sách giảm giá học sinh vào cơ sở tri thức"],
            },
          ].map(({ icon: Icon, title, color, content, items }) => (
            <div key={title} style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)", padding: "20px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Icon size={16} style={{ color }} />
                <span style={{ fontWeight: 700, fontSize: "14px", color: NAVY }}>{title}</span>
              </div>
              {content && <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.7)", lineHeight: 1.6, margin: 0 }}>{content}</p>}
              {items && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", fontSize: "13px", color: "rgba(0,56,101,0.75)" }}>
                      <span style={{ color, fontWeight: 700 }}>•</span> {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
