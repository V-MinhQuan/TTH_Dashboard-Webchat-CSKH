import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Frown,
  Heart,
  Lightbulb,
  Meh,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { FilterPanel, FilterValues } from "../FilterPanel";
import {
  buildApiUrl,
  closeConversation,
  fetchApiJson,
  formatChannelParam,
} from "../../services/dashboardApi";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const BUTTON_ORANGE = "#ED5206";
const GREEN = "#228A61";
const AMBER = "#E5A850";
const RED = "#D26767";

type NegLevel = "Rất tiêu cực" | "Tiêu cực" | "Hơi tiêu cực";

interface SentimentAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onNavigate: (screen: string) => void;
}

interface TrendRow {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface TopicRow {
  topic: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface NegativeConversation {
  id: string;
  customer: string;
  customerLabel: string;
  complaint: string;
  topic: string;
  channel: string;
  level: NegLevel;
  waitTime: string;
  waitMinutes: number;
  status: string;
  customerId?: string;
  source?: string;
}

interface KeywordRow {
  word: string;
  count: number;
  topic: string;
}

const negLevelConfig: Record<NegLevel, { bg: string; color: string; stars: number }> = {
  "Rất tiêu cực": { bg: "#FFF1F1", color: "#B42318", stars: 3 },
  "Tiêu cực": { bg: "#FFF4EE", color: ORANGE, stars: 2 },
  "Hơi tiêu cực": { bg: "#FFF7E6", color: "#B7791F", stars: 1 },
};

const statusConfig: Record<string, { bg: string; color: string }> = {
  "Cần xử lý": { bg: "#FFF4EE", color: ORANGE },
  "Chờ xử lý": { bg: "#FFF7E6", color: "#B7791F" },
  "Đã xử lý": { bg: "#EAF8F1", color: GREEN },
};

export function SentimentAnalysis({ filters, onFiltersChange }: SentimentAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [sentimentTrend, setSentimentTrend] = useState<TrendRow[]>([]);
  const [topicSentiment, setTopicSentiment] = useState<TopicRow[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<KeywordRow[]>([]);
  const [negativeConversations, setNegativeConversations] = useState<NegativeConversation[]>([]);
  const [sentimentKpiTrend, setSentimentKpiTrend] = useState({ pos: "", neu: "", neg: "" });
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const bulkTriggerRef = useRef<HTMLButtonElement | null>(null);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError("");

    try {
      const queryParams = buildQueryParams(filters);
      const [summaryRes, trendRes, topicRes, keywordRes, conversationRes] = await Promise.all([
        fetchApiJson<any>(buildApiUrl("/api/analytics/sentiment-summary", queryParams), { cache: false }),
        fetchApiJson<any>(buildApiUrl("/api/analytics/sentiment-trend", queryParams), { cache: false }),
        fetchApiJson<any>(buildApiUrl("/api/analytics/topics", queryParams), { cache: false }),
        fetchApiJson<any>(buildApiUrl("/api/analytics/negative-keywords", queryParams), { cache: false }),
        fetchApiJson<any>(buildApiUrl("/api/analytics/negative-conversations", queryParams), { cache: false }),
      ]);

      if (summaryRes.success) {
        setSummaryData(summaryRes.data);
      }

      const rawTrend = trendRes.success && Array.isArray(trendRes.data) ? trendRes.data : [];
      setSentimentTrend(rawTrend.map(toTrendRow));
      setSentimentKpiTrend({
        pos: calculatePointChange(rawTrend, "positive"),
        neu: calculatePointChange(rawTrend, "neutral"),
        neg: calculatePointChange(rawTrend, "negative"),
      });

      const rawTopics = topicRes.success && Array.isArray(topicRes.data) ? topicRes.data : [];
      setTopicSentiment(rawTopics.slice(0, 10).map(toTopicRow));

      const rawKeywords = keywordRes.success && Array.isArray(keywordRes.data) ? keywordRes.data : [];
      setNegativeKeywords(
        rawKeywords
          .map((item: any) => ({
            word: cleanKeyword(item.keyword),
            count: Number(item.count || 0),
            topic: item.issueType || "Không phân loại",
          }))
          .filter((item: KeywordRow) => item.word && item.count > 0)
          .slice(0, 10),
      );

      const rawConversations = Array.isArray(conversationRes.data?.records)
        ? conversationRes.data.records
        : [];
      setNegativeConversations(rawConversations.map(toNegativeConversation));
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Không thể tải dữ liệu phân tích cảm xúc.";
      setLoadError(message);
      toast.error(message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const [posPct, neuPct, negPct] = useMemo(
    () => sentimentShares(summaryData?.summary),
    [summaryData],
  );
  const sentimentTotal = Number(summaryData?.summary?.total || 0);
  const satisfactionValue = normalizeSatisfaction(summaryData?.avgSatisfaction);
  const donutData = useMemo(
    () => [
      { name: "Tích cực", value: posPct, color: GREEN },
      { name: "Trung lập", value: neuPct, color: AMBER },
      { name: "Tiêu cực", value: negPct, color: RED },
    ],
    [posPct, neuPct, negPct],
  );
  const pendingNegativeConversations = useMemo(
    () => negativeConversations.filter((conversation) => conversation.status !== "Đã xử lý"),
    [negativeConversations],
  );
  const closableNegativeConversations = useMemo(
    () => pendingNegativeConversations.filter((conversation) => conversation.customerId && conversation.source),
    [pendingNegativeConversations],
  );

  const handleCloseNegativeConversation = async (conversation: NegativeConversation) => {
    if (!conversation.customerId || !conversation.source) {
      toast.error("Bản ghi thiếu customerId/source trong database nên không thể đóng hội thoại.");
      return;
    }

    try {
      await closeConversation(conversation.customerId, conversation.source);
      setNegativeConversations((current) => current.map((item) => (
        item.id === conversation.id ? { ...item, status: "Đã xử lý" } : item
      )));
      await loadData(false);
      toast.success(`Đã đóng hội thoại ${conversation.id} trong database`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đóng hội thoại");
    }
  };

  const handleRequestCloseAllNegativeConversations = () => {
    if (!closableNegativeConversations.length) {
      toast.error("Không có hội thoại đủ customerId/source trong database để đóng.");
      return;
    }
    setBulkConfirmOpen(true);
  };

  const handleConfirmCloseAllNegativeConversations = async () => {
    if (bulkSubmitting || !closableNegativeConversations.length) return;

    try {
      setBulkSubmitting(true);
      await Promise.all(
        closableNegativeConversations.map((conversation) => (
          closeConversation(conversation.customerId!, conversation.source!)
        )),
      );
      const closedIds = new Set(closableNegativeConversations.map((conversation) => conversation.id));
      setNegativeConversations((current) => current.map((conversation) => (
        closedIds.has(conversation.id) ? { ...conversation, status: "Đã xử lý" } : conversation
      )));
      setBulkConfirmOpen(false);
      await loadData(false);
      toast.success(`Đã đóng ${closableNegativeConversations.length} hội thoại trong database`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đóng toàn bộ hội thoại");
    } finally {
      setBulkSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />
        <SentimentLoadingState />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg, ${ORANGE}, ${BUTTON_ORANGE})` }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, margin: 0 }}>Phân tích cảm xúc</h2>
        </div>
        <p style={{ fontSize: 12, color: "rgba(0,56,101,0.58)", margin: "4px 0 0 14px" }}>
          Theo dõi tỷ lệ cảm xúc, mức độ hài lòng và các hội thoại tiêu cực cần xử lý.
        </p>
      </section>

      {loadError && (
        <div style={errorBannerStyle}>
          <AlertTriangle size={16} />
          <span>{loadError}</span>
        </div>
      )}

      <section style={kpiGridStyle} aria-label="Chỉ số cảm xúc">
        {[
          {
            icon: Heart,
            label: "Tỷ lệ tích cực",
            value: `${posPct}%`,
            change: sentimentKpiTrend.pos,
            color: GREEN,
            bg: "#f0fdf4",
            note: `Tỷ lệ hiện tại trên ${sentimentTotal.toLocaleString("vi-VN")} bản ghi phân tích`,
          },
          {
            icon: Meh,
            label: "Tỷ lệ trung lập",
            value: `${neuPct}%`,
            change: sentimentKpiTrend.neu,
            color: "#f59e0b",
            bg: "#fffbeb",
            note: `Tỷ lệ hiện tại trên ${sentimentTotal.toLocaleString("vi-VN")} bản ghi phân tích`,
          },
          {
            icon: Frown,
            label: "Tỷ lệ tiêu cực",
            value: `${negPct}%`,
            change: sentimentKpiTrend.neg,
            color: ORANGE,
            bg: "#fff5f5",
            note: `Tỷ lệ hiện tại trên ${sentimentTotal.toLocaleString("vi-VN")} bản ghi phân tích`,
          },
          {
            icon: Star,
            label: "Mức độ hài lòng",
            value: satisfactionValue > 0 ? `${satisfactionValue.toFixed(1)}/5` : "0/5",
            change: "",
            color: "#7c3aed",
            bg: "#faf5ff",
            note: "Điểm trung bình từ cột satisfactionScore trong MessageAnalytics",
          },
        ].map(({ icon: Icon, label, value, change, color, bg, note }) => (
          <article key={label} style={kpiCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: bg, display: "grid", placeItems: "center" }}>
                <Icon size={22} color={color} />
              </div>
              <div>
                <div style={mutedLabelStyle}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 750, color: NAVY, lineHeight: 1.15 }}>{value}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "rgba(0,56,101,0.56)", lineHeight: 1.45 }}>{note}</div>
            <div style={changeBadgeStyle}>
              {change ? `${change} so với nửa đầu kỳ` : "Chưa đủ dữ liệu so sánh"}
            </div>
          </article>
        ))}
      </section>

      <section style={twoColumnGridStyle}>
        <Panel title="Phân bổ cảm xúc" icon={<Heart size={16} color={GREEN} />}>
          {sentimentTotal ? (
            <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 20, alignItems: "center" }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88}>
                    {donutData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gap: 12 }}>
                {donutData.map((item) => (
                  <div key={item.name} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(0,56,101,0.72)", fontSize: 13 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <strong style={{ color: NAVY }}>{item.value}%</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState text="Chưa có bản ghi phân tích cảm xúc phù hợp với bộ lọc hiện tại." />
          )}
        </Panel>

        <Panel title="Xu hướng cảm xúc theo thời gian" icon={<TrendingUp size={16} color={NAVY} />} id="sentiment-trend-chart">
          {sentimentTrend.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={sentimentTrend} margin={{ top: 20, right: 20, bottom: 12, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.08)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.55)" }} />
                <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.55)" }} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend iconSize={8} />
                <Line type="monotone" dataKey="positive" name="Tích cực" stroke={GREEN} strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="neutral" name="Trung lập" stroke={AMBER} strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="negative" name="Tiêu cực" stroke={RED} strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="Chưa có dữ liệu xu hướng cảm xúc theo thời gian." />
          )}
        </Panel>
      </section>

      <Panel
        title="Cảm xúc theo chủ đề"
        icon={<AlertTriangle size={16} color={ORANGE} />}
      >
        {topicSentiment.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topicSentiment} margin={{ top: 20, right: 20, bottom: 18, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.08)" vertical={false} />
              <XAxis dataKey="topic" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.55)" }} interval={0} />
              <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.55)" }} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend iconSize={8} />
              <Bar dataKey="positive" name="Tích cực" stackId="sentiment" fill={GREEN} />
              <Bar dataKey="neutral" name="Trung lập" stackId="sentiment" fill={AMBER} />
              <Bar dataKey="negative" name="Tiêu cực" stackId="sentiment" fill={RED} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Chưa có dữ liệu phân tích chủ đề. Dữ liệu sẽ hiển thị khi ML service phân tích xong tin nhắn." />
        )}
      </Panel>

      <section style={tablePanelStyle}>
        <div style={tableHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Frown size={16} color={ORANGE} />
            <h3 style={sectionTitleStyle}>Hội thoại có cảm xúc tiêu cực cần xử lý</h3>
            <span style={countBadgeStyle}>{pendingNegativeConversations.length} hội thoại đang hiển thị</span>
          </div>
          <button
            ref={bulkTriggerRef}
            type="button"
            onClick={handleRequestCloseAllNegativeConversations}
            disabled={bulkSubmitting || !closableNegativeConversations.length}
            style={{
              ...primaryButtonStyle,
              opacity: bulkSubmitting || !closableNegativeConversations.length ? 0.55 : 1,
              cursor: bulkSubmitting || !closableNegativeConversations.length ? "not-allowed" : "pointer",
            }}
          >
            <ClipboardCheck size={14} />
            Đánh dấu xử lý (tất cả)
          </button>
        </div>
        <NegativeConversationTable
          conversations={negativeConversations}
          onCloseConversation={handleCloseNegativeConversation}
        />
      </section>

      <section style={twoColumnGridStyle}>
        <Panel title="Từ khóa gây cảm xúc tiêu cực" icon={<AlertTriangle size={16} color={ORANGE} />}>
          {negativeKeywords.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {negativeKeywords.map((keyword, index) => (
                <div key={`${keyword.word}-${index}`} style={keywordRowStyle}>
                  <strong style={{ color: ORANGE, fontSize: 11 }}>#{index + 1}</strong>
                  <span style={{ flex: 1, color: NAVY }}>&quot;{keyword.word}&quot;</span>
                  <span style={topicPillStyle}>{keyword.topic}</span>
                  <strong style={{ color: ORANGE }}>{keyword.count.toLocaleString("vi-VN")}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Chưa có đủ dữ liệu từ khóa tiêu cực để hiển thị." />
          )}
        </Panel>

        <div style={{ display: "grid", gap: 16 }}>
          <ForecastNoDataCard />
          <RecommendationCard keywords={negativeKeywords} />
        </div>
      </section>

      <BulkConfirmDialog
        open={bulkConfirmOpen}
        count={closableNegativeConversations.length}
        submitting={bulkSubmitting}
        triggerRef={bulkTriggerRef}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={handleConfirmCloseAllNegativeConversations}
      />
    </div>
  );
}

function NegativeConversationTable({
  conversations,
  onCloseConversation,
}: {
  conversations: NegativeConversation[];
  onCloseConversation: (conversation: NegativeConversation) => void;
}) {
  if (!conversations.length) {
    return <EmptyState text="Không có hội thoại tiêu cực phù hợp với bộ lọc hiện tại." />;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ backgroundColor: "#f8fafc" }}>
            {[
              "Khách hàng",
              "Nội dung phàn nàn",
              "Chủ đề",
              "Kênh",
              "Mức độ tiêu cực",
              "Thời gian chờ",
              "Trạng thái",
              "Hành động",
            ].map((heading) => (
              <th key={heading} style={tableHeadCellStyle}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conversations.map((conversation) => {
            const level = negLevelConfig[conversation.level];
            const status = statusConfig[conversation.status] || { bg: "#f1f5f9", color: "#64748b" };
            return (
              <tr key={conversation.id} style={{ borderBottom: "1px solid rgba(0,56,101,0.05)" }}>
                <td style={tableCellStyle}>
                  <div style={{ fontWeight: 700, color: NAVY }}>{conversation.customer}</div>
                  <div style={subTextStyle}>{conversation.customerLabel}</div>
                  <div style={{ ...subTextStyle, fontFamily: "monospace" }}>{conversation.id}</div>
                </td>
                <td style={{ ...tableCellStyle, minWidth: 260, maxWidth: 420 }}>
                  <div style={{ color: "rgba(0,56,101,0.74)", lineHeight: 1.5 }}>
                    &quot;{conversation.complaint}&quot;
                  </div>
                </td>
                <td style={tableCellStyle}>
                  <span style={topicPillStyle}>{conversation.topic}</span>
                </td>
                <td style={{ ...tableCellStyle, whiteSpace: "nowrap", color: "rgba(0,56,101,0.72)" }}>
                  {conversation.channel}
                </td>
                <td style={tableCellStyle}>
                  <span style={{ ...pillStyle, backgroundColor: level.bg, color: level.color }}>{conversation.level}</span>
                  <div style={{ marginTop: 4 }}>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <span key={index} style={{ color: index < level.stars ? level.color : "#e2e8f0", fontSize: 11 }}>●</span>
                    ))}
                  </div>
                </td>
                <td style={{ ...tableCellStyle, color: conversation.waitMinutes >= 240 ? ORANGE : "rgba(0,56,101,0.72)", fontWeight: conversation.waitMinutes >= 240 ? 700 : 500, whiteSpace: "nowrap" }}>
                  {conversation.waitTime}
                </td>
                <td style={tableCellStyle}>
                  <span style={{ ...pillStyle, backgroundColor: status.bg, color: status.color }}>{conversation.status}</span>
                </td>
                <td style={tableCellStyle}>
                  {conversation.status !== "Đã xử lý" ? (
                    <button type="button" onClick={() => onCloseConversation(conversation)} style={secondaryActionButtonStyle}>
                      Đánh dấu xử lý
                    </button>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: GREEN, fontWeight: 700 }}>
                      <CheckCircle2 size={12} />
                      Hoàn tất
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ForecastNoDataCard() {
  return (
    <article style={compactCardStyle}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={noDataIconStyle}>
          <TrendingUp size={20} color={NAVY} />
        </div>
        <div>
          <h3 style={sectionTitleStyle}>Chưa đủ dữ liệu để dự báo</h3>
          <p style={paragraphStyle}>
            Hệ thống cần thêm dữ liệu cảm xúc theo thời gian trước khi có thể tạo dự báo đáng tin cậy.
            Bạn vẫn có thể theo dõi xu hướng thực tế trong biểu đồ “Xu hướng cảm xúc theo thời gian”.
          </p>
          <div style={{ fontSize: 12, color: "rgba(0,56,101,0.68)", lineHeight: 1.6 }}>
            <strong>Điều kiện đề xuất:</strong>
            <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
              <li>Có dữ liệu liên tục trong ít nhất 30 ngày.</li>
              <li>Có đủ số lượng hội thoại đã được phân tích cảm xúc.</li>
              <li>Dịch vụ ML đang hoạt động.</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("sentiment-trend-chart")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            style={linkButtonStyle}
          >
            Xem xu hướng thực tế
          </button>
        </div>
      </div>
    </article>
  );
}

function RecommendationCard({ keywords }: { keywords: KeywordRow[] }) {
  return (
    <article style={compactCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Lightbulb size={16} color={GREEN} />
        <h3 style={sectionTitleStyle}>Khuyến nghị cải thiện</h3>
      </div>
      {keywords.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ ...paragraphStyle, marginBottom: 2 }}>
            Dựa trên các từ khóa tiêu cực xuất hiện nhiều nhất trong dữ liệu API:
          </p>
          {keywords.slice(0, 4).map((keyword) => (
            <div key={keyword.word} style={{ display: "flex", gap: 8, fontSize: 13, color: "rgba(0,56,101,0.76)", lineHeight: 1.45 }}>
              <span style={{ color: GREEN, fontWeight: 800 }}>•</span>
              <span>
                Xem xét cải thiện phản hồi liên quan đến “{keyword.word}”
                {" "}
                <strong>({keyword.count.toLocaleString("vi-VN")} lần xuất hiện)</strong>.
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="Chưa có đủ dữ liệu từ khóa tiêu cực để đưa ra khuyến nghị." compact />
      )}
    </article>
  );
}

function BulkConfirmDialog({
  open,
  count,
  submitting,
  triggerRef,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  submitting: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    window.setTimeout(() => cancelRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      (triggerRef.current || previous)?.focus?.();
    };
  }, [open, onCancel, triggerRef]);

  if (!open) return null;

  return (
    <div style={dialogBackdropStyle}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-resolve-title"
        aria-describedby="bulk-resolve-description"
        style={dialogStyle}
      >
        <button type="button" aria-label="Đóng hộp thoại xác nhận" onClick={onCancel} style={dialogCloseButtonStyle}>
          <X size={16} />
        </button>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ ...noDataIconStyle, backgroundColor: "#FFF4EE" }}>
            <ClipboardCheck size={20} color={ORANGE} />
          </div>
          <div>
            <h2 id="bulk-resolve-title" style={{ margin: "0 0 8px", color: NAVY, fontSize: 18 }}>
              Xác nhận đánh dấu đã xử lý
            </h2>
            <p id="bulk-resolve-description" style={paragraphStyle}>
              Bạn sắp đánh dấu <strong>{count.toLocaleString("vi-VN")} hội thoại tiêu cực</strong> là đã xử lý.
              Thao tác này sẽ cập nhật trạng thái của toàn bộ hội thoại đang hiển thị trong danh sách hiện tại.
            </p>
            <p style={paragraphStyle}>Bạn có chắc chắn muốn tiếp tục?</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={submitting} style={dialogSecondaryButtonStyle}>
            Hủy
          </button>
          <button type="button" onClick={onConfirm} disabled={submitting} style={dialogPrimaryButtonStyle}>
            {submitting ? "Đang xử lý..." : "Xác nhận xử lý"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
  id,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {icon}
        <h3 style={sectionTitleStyle}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div style={{
      minHeight: compact ? 70 : 180,
      display: "grid",
      placeItems: "center",
      textAlign: "center",
      color: "rgba(0,56,101,0.52)",
      fontSize: 13,
      lineHeight: 1.55,
      padding: compact ? 12 : 24,
    }}>
      {text}
    </div>
  );
}

function SentimentLoadingState() {
  return (
    <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
      <div style={skeletonBlockStyle} />
      <div style={{ ...skeletonBlockStyle, height: 260 }} />
      <div style={{ ...skeletonBlockStyle, height: 320 }} />
    </div>
  );
}

function buildQueryParams(filters: FilterValues) {
  const queryParams = new URLSearchParams();
  const dates = getDatesFromRange(filters.dateRange, filters.customDateFrom, filters.customDateTo);
  if (dates.startDate && dates.endDate) {
    queryParams.set("startDate", dates.startDate);
    queryParams.set("endDate", dates.endDate);
  }
  if (filters.channel && filters.channel !== "Tất cả") {
    queryParams.set("channel", formatChannelParam(filters.channel));
  }
  if (filters.topic && filters.topic !== "Tất cả") {
    queryParams.set("topic", filters.topic);
  }
  if (filters.conversationStatus && filters.conversationStatus !== "Tất cả") {
    queryParams.set("conversationStatus", filters.conversationStatus);
  }
  if (filters.aiStatus && filters.aiStatus !== "Tất cả") {
    queryParams.set("aiStatus", filters.aiStatus);
  }
  return queryParams;
}

function getDatesFromRange(range: string, customFrom?: string, customTo?: string) {
  const today = new Date();
  const format = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (range === "Hôm nay") return { startDate: format(today), endDate: format(today) };
  if (range === "7 ngày qua") {
    const start = new Date(today);
    start.setDate(today.getDate() - 7);
    return { startDate: format(start), endDate: format(today) };
  }
  if (range === "30 ngày qua") {
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return { startDate: format(start), endDate: format(today) };
  }
  if (range === "Tháng này") {
    return { startDate: format(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: format(today) };
  }
  if (range === "Tháng trước") {
    return {
      startDate: format(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      endDate: format(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  if (range === "Tùy chỉnh" && customFrom && customTo) {
    return { startDate: customFrom, endDate: customTo };
  }
  return {};
}

function toTrendRow(row: any): TrendRow {
  const [positive, neutral, negative] = sentimentShares({
    positive: Number(row.positive || 0),
    neutral: Number(row.neutral || 0),
    negative: Number(row.negative || 0),
    total: Number(row.positive || 0) + Number(row.neutral || 0) + Number(row.negative || 0),
  });
  const date = new Date(row.date);
  return {
    date: Number.isNaN(date.getTime()) ? String(row.date || "") : `${date.getDate()}/${date.getMonth() + 1}`,
    positive,
    neutral,
    negative,
  };
}

function toTopicRow(row: any): TopicRow {
  const [positive, neutral, negative] = sentimentShares({
    positive: Number(row.positive || 0),
    neutral: Number(row.neutral || 0),
    negative: Number(row.negative || 0),
    total: Number(row.count || 0),
  });
  return {
    topic: row.topicLabel || "Không phân loại",
    positive,
    neutral,
    negative,
  };
}

function toNegativeConversation(row: any): NegativeConversation {
  const wait = formatWaitDuration(row.messageAt);
  return {
    id: `#${row.messageId || row.id_webchat_messagelogs || "N/A"}`,
    customer: "Khách hàng",
    customerLabel: row.customerId ? `Mã khách: ${row.customerId}` : "Chưa có mã khách hàng",
    complaint: row.textContent || "Tin nhắn khách hàng đang trống trong database",
    topic: Array.isArray(row.detectedTopics) && row.detectedTopics.length
      ? row.detectedTopics.join(", ")
      : row.detectedTopics || "Không phân loại",
    channel: displayChannel(row.source),
    level: row.sentimentScore < 0.3 ? "Rất tiêu cực" : row.sentimentScore < 0.6 ? "Tiêu cực" : "Hơi tiêu cực",
    waitTime: wait.label,
    waitMinutes: wait.minutes,
    status: row.needStaffReview ? "Cần xử lý" : "Chờ xử lý",
    customerId: row.customerId,
    source: row.source,
  };
}

function sentimentShares(summary?: { positive?: number; neutral?: number; negative?: number; total?: number }) {
  const total = Number(summary?.total || 0);
  const counts = [
    Number(summary?.positive || 0),
    Number(summary?.neutral || 0),
    Number(summary?.negative || 0),
  ];
  if (!total) return [0, 0, 0];

  const raw = counts.map((count) => (count / total) * 100);
  const rounded = raw.map(Math.floor);
  let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    rounded[order[index].index] += 1;
    remainder -= 1;
  }
  return rounded;
}

function calculatePointChange(rows: any[], key: "positive" | "neutral" | "negative") {
  if (!rows.length || rows.length < 2) return "";
  const half = Math.floor(rows.length / 2);
  const firstHalf = rows.slice(0, half);
  const secondHalf = rows.slice(half);
  const share = (items: any[]) => {
    const totals = items.reduce(
      (sum, item) => ({
        positive: sum.positive + Number(item.positive || 0),
        neutral: sum.neutral + Number(item.neutral || 0),
        negative: sum.negative + Number(item.negative || 0),
      }),
      { positive: 0, neutral: 0, negative: 0 },
    );
    const total = totals.positive + totals.neutral + totals.negative;
    return total ? (totals[key] / total) * 100 : 0;
  };
  const delta = share(secondHalf) - share(firstHalf);
  if (Math.abs(delta) < 0.05) return "Ổn định";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)} điểm %`;
}

function normalizeSatisfaction(value: unknown) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 5 ? numeric / 20 : numeric;
}

function formatWaitDuration(messageAt: unknown) {
  const timestamp = new Date(String(messageAt || "")).getTime();
  if (Number.isNaN(timestamp)) return { label: "Không xác định", minutes: 0 };
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) return { label: `${days} ngày ${hours ? `${hours} giờ ` : ""}${rest} phút`.trim(), minutes };
  if (hours > 0) return { label: `${hours} giờ ${rest} phút`, minutes };
  return { label: `${rest} phút`, minutes };
}

function displayChannel(channel: string) {
  if (channel === "ZaloBusiness") return "Zalo Business";
  if (channel === "ZaloOA") return "Zalo OA";
  if (channel === "ChatWidget") return "Chat Widget";
  return channel || "Không có kênh";
}

function cleanKeyword(value: unknown) {
  const text = String(value || "").trim();
  if (!text || /^(none|null|undefined|khong|không)$/i.test(text)) return "";
  return text;
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  position: "relative",
};

const panelStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: 16,
  border: "1px solid rgba(0,56,101,0.08)",
  boxShadow: "0 2px 12px rgba(0,56,101,0.06)",
  padding: 20,
  marginBottom: 20,
};

const compactCardStyle: React.CSSProperties = {
  ...panelStyle,
  marginBottom: 0,
  padding: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  color: NAVY,
  fontSize: 14,
  fontWeight: 750,
  margin: 0,
};

const paragraphStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 13,
  color: "rgba(0,56,101,0.64)",
  lineHeight: 1.6,
};

const mutedLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(0,56,101,0.58)",
  fontWeight: 600,
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: 18,
  border: "1px solid rgba(0,56,101,0.08)",
  boxShadow: "0 2px 12px rgba(0,56,101,0.06)",
  padding: 22,
};

const changeBadgeStyle: React.CSSProperties = {
  marginTop: 10,
  display: "inline-flex",
  padding: "4px 9px",
  borderRadius: 999,
  backgroundColor: "#f1f5f9",
  color: "rgba(0,56,101,0.68)",
  fontSize: 11,
  fontWeight: 700,
};

const twoColumnGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 20,
  marginBottom: 20,
};

const tablePanelStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: 16,
  border: "1px solid rgba(0,56,101,0.08)",
  boxShadow: "0 2px 12px rgba(0,56,101,0.06)",
  overflow: "hidden",
  marginBottom: 20,
};

const tableHeaderStyle: React.CSSProperties = {
  padding: "18px 22px",
  borderBottom: "1px solid rgba(0,56,101,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const tableHeadCellStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 700,
  color: "rgba(0,56,101,0.56)",
  fontSize: 10,
  letterSpacing: "0.04em",
  borderBottom: "1px solid rgba(0,56,101,0.06)",
  whiteSpace: "nowrap",
};

const tableCellStyle: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "top",
};

const subTextStyle: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(0,56,101,0.45)",
  marginTop: 3,
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const topicPillStyle: React.CSSProperties = {
  ...pillStyle,
  backgroundColor: "#eff6ff",
  color: "#2563eb",
};

const countBadgeStyle: React.CSSProperties = {
  ...pillStyle,
  backgroundColor: "#FFF4EE",
  border: "1px solid #FBCBB8",
  color: ORANGE,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 9,
  background: `linear-gradient(135deg, ${BUTTON_ORANGE} 0%, #F36C2E 100%)`,
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 750,
  boxShadow: "0 4px 12px rgba(237,82,6,0.18)",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 7,
  border: `1px solid ${ORANGE}30`,
  background: "#fff3ef",
  color: ORANGE,
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const keywordRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  backgroundColor: "#FFF4EE",
  fontSize: 13,
};

const noDataIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  backgroundColor: "#f1f5f9",
  display: "grid",
  placeItems: "center",
  flex: "0 0 auto",
};

const linkButtonStyle: React.CSSProperties = {
  marginTop: 10,
  border: "none",
  background: "transparent",
  color: BUTTON_ORANGE,
  fontSize: 13,
  fontWeight: 750,
  padding: 0,
  cursor: "pointer",
};

const errorBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  marginBottom: 16,
  borderRadius: 10,
  backgroundColor: "#FFF4EE",
  color: ORANGE,
  border: "1px solid #FBCBB8",
  fontSize: 13,
};

const skeletonBlockStyle: React.CSSProperties = {
  height: 120,
  borderRadius: 16,
  background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
  backgroundSize: "200% 100%",
};

const dialogBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 300,
  backgroundColor: "rgba(15,23,42,0.48)",
  display: "grid",
  placeItems: "center",
  padding: 20,
};

const dialogStyle: React.CSSProperties = {
  position: "relative",
  width: "min(520px, 100%)",
  borderRadius: 16,
  backgroundColor: "#fff",
  padding: 24,
  boxShadow: "0 20px 60px rgba(15,23,42,0.24)",
};

const dialogCloseButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  border: "none",
  width: 30,
  height: 30,
  borderRadius: 8,
  backgroundColor: "#f1f5f9",
  color: "rgba(0,56,101,0.66)",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const dialogSecondaryButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 9,
  border: "1px solid rgba(0,56,101,0.14)",
  backgroundColor: "#fff",
  color: NAVY,
  fontWeight: 700,
  cursor: "pointer",
};

const dialogPrimaryButtonStyle: React.CSSProperties = {
  ...dialogSecondaryButtonStyle,
  borderColor: BUTTON_ORANGE,
  backgroundColor: BUTTON_ORANGE,
  color: "#fff",
};
