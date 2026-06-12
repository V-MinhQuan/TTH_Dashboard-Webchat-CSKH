import re

with open('sentiment_branch_ui_utf8.tsx', 'r', encoding='utf-8') as f:
    orig = f.read()

# We need to extract the exact JSX part from orig
jsx_start = orig.find('return (')
jsx_end = orig.rfind(');') + 2
jsx_content = orig[jsx_start:jsx_end]

# Modify the JSX part slightly to insert loading overlay and dynamic KPI values
jsx_content = jsx_content.replace('<div style={{ padding: "24px" }}>', '<div style={{ padding: "24px", position: "relative" }}>\n      {loading && (\n        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.7)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>\n          <div style={{ padding: "10px 20px", background: "#fff", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", fontSize: "14px", fontWeight: 600, color: NAVY }}>Đang tải dữ liệu...</div>\n        </div>\n      )}')
jsx_content = jsx_content.replace('value: "64%"', 'value: posPctStr')
jsx_content = jsx_content.replace('value: "22%"', 'value: neuPctStr')
jsx_content = jsx_content.replace('value: "14%"', 'value: negPctStr')
jsx_content = jsx_content.replace('value: "4.1/5"', 'value: satisfactionStr')

new_file_content = f'''import {{ useState, useEffect }} from "react";
import {{ Heart, Meh, Frown, TrendingUp, AlertTriangle, Lightbulb, Star }} from "lucide-react";
import {{
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
}} from "recharts";
import {{ ChartCard }} from "../ChartCard";
import {{ FilterPanel, FilterValues }} from "../FilterPanel";
import {{ toast }} from "sonner";
import {{ fetchApiJson, buildApiUrl }} from "../../services/sheetChatbotApi";

const NAVY = "#003865";
const ORANGE = "#D73C01";

type NegLevel = "Rất tiêu cực" | "Tiêu cực" | "Hơi tiêu cực";

const negLevelConfig: Record<NegLevel, {{ bg: string; color: string; stars: number }}> = {{
  "Rất tiêu cực": {{ bg: "#FFF1F1", color: "#B42318", stars: 3 }},
  "Tiêu cực":     {{ bg: "#FFF4EE", color: ORANGE,   stars: 2 }},
  "Hơi tiêu cực": {{ bg: "#FFF7E6", color: "#B7791F", stars: 1 }},
}};

const statusConfig: Record<string, {{ bg: string; color: string }}> = {{
  "Chờ quản lý xác nhận": {{ bg: "#FFF4EE", color: ORANGE }},
  "Chờ xử lý":          {{ bg: "#FFF7E6", color: "#B7791F" }},
  "Đang xử lý":          {{ bg: "#dbeafe", color: "#3b82f6" }},
  "Hoàn thành":           {{ bg: "#EAF8F1", color: "#228A61" }},
}};

function getDatesFromRange(range: string, customFrom?: string, customTo?: string): {{ startDate?: string; endDate?: string }} {{
  const today = new Date();
  const formatDateStr = (d: Date) => {{
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${{year}}-${{month}}-${{day}}`;
  }};

  if (range === "Hôm nay") {{
    return {{ startDate: formatDateStr(today), endDate: formatDateStr(today) }};
  }}
  if (range === "7 ngày qua") {{
    const start = new Date();
    start.setDate(today.getDate() - 7);
    return {{ startDate: formatDateStr(start), endDate: formatDateStr(today) }};
  }}
  if (range === "30 ngày qua") {{
    const start = new Date();
    start.setDate(today.getDate() - 30);
    return {{ startDate: formatDateStr(start), endDate: formatDateStr(today) }};
  }}
  if (range === "Tháng này") {{
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {{ startDate: formatDateStr(start), endDate: formatDateStr(today) }};
  }}
  if (range === "Tháng trước") {{
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return {{ startDate: formatDateStr(start), endDate: formatDateStr(end) }};
  }}
  if (range === "Tùy chọn" && customFrom && customTo) {{
    return {{ startDate: customFrom, endDate: customTo }};
  }}
  return {{}};
}}

interface SentimentAnalysisProps {{
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}}

export function SentimentAnalysis({{ filters, onFiltersChange, onNavigate }}: SentimentAnalysisProps) {{
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  
  const [sentimentTrend, setSentimentTrend] = useState<any[]>([]);
  const [topicSentiment, setTopicSentiment] = useState<any[]>([]);
  const [donutData, setDonutData] = useState<any[]>([
    {{ name: "Tích cực", value: 64, color: "#3E9675" }},
    {{ name: "Trung lập", value: 22, color: "#E5A850" }},
    {{ name: "Tiêu cực", value: 14, color: "#D26767" }},
  ]);
  const [negKeywords, setNegKeywords] = useState<any[]>([]);
  const [negativeConversations, setNegativeConversations] = useState<any[]>([]);

  useEffect(() => {{
    async function loadData() {{
      setLoading(true);
      try {{
        const queryParams = new URLSearchParams();
        const dates = getDatesFromRange(filters.dateRange, filters.customDateFrom, filters.customDateTo);
        if (dates.startDate && dates.endDate) {{
          queryParams.set("startDate", dates.startDate);
          queryParams.set("endDate", dates.endDate);
        }}

        const [sumRes, trendRes, topicRes, kwRes, convRes] = await Promise.all([
          fetchApiJson<any>(buildApiUrl("/api/analytics/sentiment-summary", queryParams.toString())),
          fetchApiJson<any>(buildApiUrl("/api/analytics/sentiment-trend", queryParams.toString())),
          fetchApiJson<any>(buildApiUrl("/api/analytics/topics", queryParams.toString())),
          fetchApiJson<any>(buildApiUrl("/api/analytics/negative-keywords", queryParams.toString())),
          fetchApiJson<any>(buildApiUrl("/api/analytics/negative-conversations", queryParams.toString()))
        ]);

        if (sumRes.success) {{
          setSummaryData(sumRes.data);
          const total = sumRes.data.summary?.total || 1;
          const pos = sumRes.data.summary?.positive || 0;
          const neu = sumRes.data.summary?.neutral || 0;
          const neg = sumRes.data.summary?.negative || 0;
          
          setDonutData([
            {{ name: "Tích cực", value: Math.round((pos / total) * 100) || 0, color: "#3E9675" }},
            {{ name: "Trung lập", value: Math.round((neu / total) * 100) || 0, color: "#E5A850" }},
            {{ name: "Tiêu cực", value: Math.round((neg / total) * 100) || 0, color: "#D26767" }},
          ]);
        }}
        
        if (trendRes.success) {{
          const rawTrend = Array.isArray(trendRes.data) ? trendRes.data : [];
          setSentimentTrend(rawTrend.map(d => {{
            const total = (d.positive + d.neutral + d.negative) || 1;
            const dateObj = new Date(d.date);
            return {{
              date: !isNaN(dateObj.getTime()) ? `${{dateObj.getDate()}}/${{dateObj.getMonth() + 1}}` : d.date,
              positive: Math.round((d.positive / total) * 100) || 0,
              neutral: Math.round((d.neutral / total) * 100) || 0,
              negative: Math.round((d.negative / total) * 100) || 0
            }};
          }}));
        }}

        if (topicRes.success) {{
          const rawTopic = Array.isArray(topicRes.data) ? topicRes.data : [];
          setTopicSentiment(rawTopic.slice(0, 10).map(d => {{
            const total = d.count || 1;
            return {{
              topic: d.topicLabel || "Chung",
              positive: Math.round(((d.positive || 0) / total) * 100) || 33,
              neutral: Math.round(((d.neutral || 0) / total) * 100) || 33,
              negative: Math.round(((d.negative || 0) / total) * 100) || 34
            }};
          }}));
        }}

        if (kwRes.success) {{
          const rawKw = Array.isArray(kwRes.data) ? kwRes.data : [];
          setNegKeywords(rawKw.slice(0, 10).map(d => ({{
            word: d.keyword,
            count: d.count,
            topic: d.issueType || "Chung"
          }})));
        }}

        if (convRes.success) {{
          const rawConv = Array.isArray(convRes.data?.records) ? convRes.data.records : [];
          setNegativeConversations(rawConv.map(conv => {{
            const waitTimeRaw = Date.now() - new Date(conv.messageAt).getTime();
            const waitHours = Math.floor(waitTimeRaw / (1000 * 60 * 60));
            const waitMins = Math.floor((waitTimeRaw / (1000 * 60)) % 60);
            const waitTimeStr = !isNaN(waitHours) && waitHours > 0 ? `${{waitHours}}g ${{waitMins}}p` : !isNaN(waitMins) ? `${{waitMins}}p` : "0p";
            const levelStr = conv.sentimentScore < 0.3 ? "Rất tiêu cực" : conv.sentimentScore < 0.6 ? "Tiêu cực" : "Hơi tiêu cực";
            return {{
              id: `#${{conv.messageId || conv.id_webchat_messagelogs || "N/A"}}`,
              customer: conv.customerId || "Khách hàng",
              complaint: conv.textContent || "",
              topic: Array.isArray(conv.detectedTopics) && conv.detectedTopics.length > 0 ? conv.detectedTopics.join(", ") : (conv.detectedTopics || "Chung"),
              channel: conv.source || "Unknown",
              level: levelStr as NegLevel,
              waitTime: waitTimeStr,
              status: conv.needStaffReview ? "Cần xử lý" : "Chờ xử lý"
            }};
          }}));
        }}
      }} catch (err) {{
        console.error("Lỗi khi tải dữ liệu cảm xúc:", err);
      }} finally {{
        setLoading(false);
      }}
    }}
    loadData();
  }}, [filters]);

  const posPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.positive / summaryData.summary.total) * 100) + "%" : "0%";
  const neuPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.neutral / summaryData.summary.total) * 100) + "%" : "0%";
  const negPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.negative / summaryData.summary.total) * 100) + "%" : "0%";
  const satisfactionStr = summaryData?.avgSatisfaction ? summaryData.avgSatisfaction.toFixed(1) + "/5" : "0/5";

  {jsx_content}
}}
'''

with open('src/app/components/screens/SentimentAnalysis.tsx', 'w', encoding='utf-8') as f:
    f.write(new_file_content)
print('File written successfully')
