import { useEffect, useMemo, useState } from "react";
import { Brain, Cpu, Zap, Activity, AlertOctagon, Shield, Terminal, FileText, Flag, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { AddSheetModal } from "./SheetChatbot";
import { createSheetChatbotRow } from "../../services/sheetChatbotApi";
import { buildApiUrl, fetchApiJson, formatChannelParam } from "../../services/dashboardApi";
import { FilterValues } from "../FilterPanel";
import { getDateParamsFromFilters } from "../../utils/dateFilters";

const DARK_BG = "#020617";
const PANEL_BG = "#0f172a";
const CYAN = "#38bdf8";
const ACCENT_ORANGE = "#f97316";

type AIStatus = "AI không chắc chắn" | "AI trả lời sai" | "Không tìm thấy dữ liệu" | "AI có nguy cơ tự tạo thông tin" | "Cần kiểm duyệt" | string;

interface AnomalyItem {
  id: string;
  messageId?: number;
  conversationId?: number;
  type: AIStatus;
  confidence: number;
  customer: string;
  question: string;
  aiAnswer: string;
  reason: string;
  channel: string;
  topic: string;
  waitTime: string;
}

interface QualityMetrics {
  total_messages: number;
  success_rate: number;
  failure_count: number;
  hallucination_count: number;
  avg_confidence: number;
}

interface AIMonitoringProps {
  filters: FilterValues;
}

const aiStatusColor: Record<string, { color: string; bg: string }> = {
  "AI không chắc chắn": { color: ACCENT_ORANGE, bg: "rgba(249, 115, 22, 0.15)" },
  "AI trả lời sai": { color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
  "Không tìm thấy dữ liệu": { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  "AI có nguy cơ tự tạo thông tin": { color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)" },
  "Cần kiểm duyệt": { color: CYAN, bg: "rgba(56, 189, 248, 0.15)" },
};

function colorForStatus(status: string) {
  return aiStatusColor[status] || { color: CYAN, bg: "rgba(56, 189, 248, 0.15)" };
}

function parseTopics(value: unknown) {
  if (Array.isArray(value) && value.length > 0) return value.join(", ");
  if (typeof value === "string" && value.trim()) return value;
  return "Không phân loại trong database";
}

function formatWaitTime(value?: string) {
  if (!value) return "Không có thời gian trong database";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diffMins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMins >= 60) return `${Math.floor(diffMins / 60)} giờ ${diffMins % 60} phút`;
  return `${diffMins} phút`;
}

function mapAnomaly(row: any): AnomalyItem {
  const confidenceRaw = Number(row.issueConfidence ?? 0);
  const confidence = confidenceRaw <= 1 ? Math.round(confidenceRaw * 100) : Math.round(confidenceRaw);
  return {
    id: String(row.id ?? row.messageId ?? crypto.randomUUID()),
    messageId: row.messageId,
    conversationId: row.conversationId,
    type: row.issueType || "Cần kiểm duyệt",
    confidence,
    customer: row.customerId || "Không có mã khách hàng trong database",
    question: row.textContent || "Tin nhắn khách hàng đang trống trong database",
    aiAnswer: row.aiAnswer || "Câu trả lời AI đang trống trong database",
    reason: row.issueReason || "Chưa có lý do lỗi AI trong database",
    channel: row.source || "Không có kênh trong database",
    topic: parseTopics(row.detectedTopics),
    waitTime: formatWaitTime(row.messageAt),
  };
}

export function AIMonitoring({ filters }: AIMonitoringProps) {
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics>({ total_messages: 0, success_rate: 0, failure_count: 0, hallucination_count: 0, avg_confidence: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editedAnswer, setEditedAnswer] = useState<Record<string, string>>({});
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [showErrorReasonModal, setShowErrorReasonModal] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        const dates = getDateParamsFromFilters(filters);
        if (dates.startDate) queryParams.set("startDate", dates.startDate);
        if (dates.endDate) queryParams.set("endDate", dates.endDate);
        if (filters.channel && filters.channel !== "Tất cả") queryParams.set("channel", formatChannelParam(filters.channel));
        if (filters.topic && filters.topic !== "Tất cả") queryParams.set("topic", filters.topic);
        if (filters.conversationStatus && filters.conversationStatus !== "Tất cả") queryParams.set("conversationStatus", filters.conversationStatus);
        if (filters.aiStatus && filters.aiStatus !== "Tất cả") queryParams.set("aiStatus", filters.aiStatus);

        const failedParams = new URLSearchParams(queryParams);
        failedParams.set("page", "1");
        failedParams.set("pageSize", "50");

        const [qualityResponse, failedResponse] = await Promise.all([
          fetchApiJson<{ success: boolean; data: QualityMetrics }>(buildApiUrl("/api/analytics/ai/quality-metrics", queryParams), { cache: false }),
          fetchApiJson<{ success: boolean; data: { records: any[] } }>(buildApiUrl("/api/analytics/ai/failed-conversations", failedParams), { cache: false }),
        ]);

        if (cancelled) return;
        if (qualityResponse.success) setQualityMetrics(qualityResponse.data);
        const rows = failedResponse.success ? (failedResponse.data.records || []).map(mapAnomaly) : [];
        setAnomalies(rows);
        setActiveId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Không thể tải dữ liệu AI Monitoring");
          setAnomalies([]);
          setActiveId(null);
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

  const activeAnomaly = useMemo(() => anomalies.find((item) => item.id === activeId) || anomalies[0] || null, [anomalies, activeId]);
  const currentAnswer = activeAnomaly ? (editedAnswer[activeAnomaly.id] ?? activeAnomaly.aiAnswer) : "";
  const isResolved = activeAnomaly ? resolvedIds.has(activeAnomaly.id) : false;

  const markResolved = () => {
    if (!activeAnomaly) return;
    setResolvedIds((prev) => new Set([...prev, activeAnomaly.id]));
    toast.info("Backend hiện chưa có API lưu trạng thái xử lý lỗi AI; trạng thái này chỉ đánh dấu trong phiên làm việc hiện tại.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 72px)", backgroundColor: DARK_BG, color: "#e2e8f0", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ padding: "20px 24px", display: "flex", gap: "20px", borderBottom: "1px solid rgba(56, 189, 248, 0.15)", backgroundColor: "rgba(15, 23, 42, 0.8)" }}>
        <div style={{ flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "12px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", border: `2px solid ${CYAN}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 15px ${CYAN}40` }}>
            <Activity size={24} color={CYAN} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px", fontWeight: 600 }}>Sức khỏe hệ thống AI</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>{qualityMetrics.success_rate}% <span style={{ fontSize: "13px", color: CYAN, fontWeight: 500 }}>DB</span></div>
          </div>
        </div>

        <div style={{ flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", border: "1px solid rgba(249, 115, 22, 0.2)", borderRadius: "12px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", border: `2px solid ${ACCENT_ORANGE}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 15px ${ACCENT_ORANGE}40` }}>
            <AlertOctagon size={24} color={ACCENT_ORANGE} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px", fontWeight: 600 }}>Cần can thiệp</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>{anomalies.length} <span style={{ fontSize: "13px", color: ACCENT_ORANGE, fontWeight: 500 }}>hội thoại</span></div>
          </div>
        </div>

        <div style={{ flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: "12px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", border: "2px solid #94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={24} color="#94a3b8" />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px", fontWeight: 600 }}>Độ tin cậy trung bình</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff" }}>{Number(qualityMetrics.avg_confidence || 0).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: "420px", borderRight: "1px solid rgba(255,255,255,0.08)", backgroundColor: PANEL_BG, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={16} color={CYAN} /> Hội thoại cần can thiệp
            </h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {loading && <div style={{ color: "#94a3b8", textAlign: "center", padding: "24px", fontSize: "13px" }}>Đang tải lỗi AI từ database...</div>}
            {!loading && anomalies.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: "24px", fontSize: "13px" }}>Database chưa có hội thoại lỗi AI cần can thiệp.</div>}
            {anomalies.map((item) => {
              const sc = colorForStatus(item.type);
              const isActive = activeAnomaly?.id === item.id;
              const isItemResolved = resolvedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  style={{
                    backgroundColor: isActive ? "rgba(56, 189, 248, 0.05)" : "rgba(2, 6, 23, 0.4)",
                    border: `1px solid ${isActive ? sc.color : "rgba(255,255,255,0.05)"}`,
                    borderRadius: "12px",
                    padding: "14px 16px",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.2s",
                    opacity: isItemResolved ? 0.5 : 1,
                  }}
                >
                  {isActive && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", backgroundColor: sc.color }} />}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Cpu size={14} color={sc.color} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{item.id}</span>
                      {isItemResolved && <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", backgroundColor: "#1e293b", color: "#228A61" }}>Đã xử lý trong phiên</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>TIN CẬY</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: sc.color }}>{item.confidence}%</span>
                    </div>
                  </div>

                  <div style={{ fontSize: "12px", color: "#e2e8f0", marginBottom: "8px", lineHeight: 1.4 }}>
                    "{item.question}"
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "6px", backgroundColor: sc.bg, color: sc.color, fontWeight: 600 }}>
                      {item.type}
                    </span>
                    <span style={{ fontSize: "10px", color: "#64748b" }}>{item.waitTime}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, backgroundColor: DARK_BG, padding: "28px 32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          {!activeAnomaly ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>Không có lỗi AI để hiển thị.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0, fontFamily: "monospace" }}>
                      {activeAnomaly.id}
                    </h1>
                    <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "6px", backgroundColor: colorForStatus(activeAnomaly.type).bg, color: colorForStatus(activeAnomaly.type).color, fontWeight: 700 }}>
                      {activeAnomaly.type}
                    </span>
                    {isResolved && (
                      <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "6px", backgroundColor: "rgba(34,138,97,0.15)", color: "#228A61", fontWeight: 700 }}>
                        Đã xử lý trong phiên
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {activeAnomaly.channel} · {activeAnomaly.topic} · Chờ: {activeAnomaly.waitTime}
                  </div>
                  <div style={{ fontSize: "11px", color: ACCENT_ORANGE, marginTop: "4px" }}>{activeAnomaly.reason}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ backgroundColor: PANEL_BG, borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", padding: "18px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Activity size={13} /> Câu hỏi khách hàng
                  </div>
                  <div style={{ fontSize: "14px", color: "#fff", lineHeight: 1.6, padding: "14px", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: "8px", borderLeft: "3px solid #94a3b8" }}>
                    "{activeAnomaly.question}"
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>Khách hàng: {activeAnomaly.customer}</div>
                </div>

                <div style={{ backgroundColor: PANEL_BG, borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", padding: "18px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Brain size={13} /> Trạng thái xử lý AI
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span style={{ color: "#e2e8f0" }}>Độ tin cậy issue</span>
                        <span style={{ color: CYAN, fontFamily: "monospace" }}>{(activeAnomaly.confidence / 100).toFixed(2)}</span>
                      </div>
                      <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                        <div style={{ width: `${activeAnomaly.confidence}%`, height: "100%", backgroundColor: CYAN, borderRadius: "2px" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: PANEL_BG, borderRadius: "12px", border: `1px solid ${colorForStatus(activeAnomaly.type).color}40`, padding: "22px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: colorForStatus(activeAnomaly.type).color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Cpu size={13} /> Câu trả lời AI từ database
                </div>
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setEditedAnswer((prev) => ({ ...prev, [activeAnomaly.id]: e.target.value }))}
                  style={{ width: "100%", minHeight: "100px", backgroundColor: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px", color: "#e2e8f0", fontSize: "13px", lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                />

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
                  <button
                    onClick={() => toast.info("Chưa có API gửi lại câu trả lời cho khách hàng trong backend hiện tại.")}
                    style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: CYAN, color: "#000", border: "none", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  >
                    <Send size={13} /> Gửi lại cho khách hàng
                  </button>

                  <button
                    onClick={() => setShowErrorReasonModal(true)}
                    style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  >
                    <Flag size={13} /> Đánh dấu AI sai
                  </button>

                  <button
                    onClick={() => setShowSheetModal(true)}
                    style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "rgba(56, 189, 248, 0.1)", color: CYAN, border: `1px solid ${CYAN}30`, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  >
                    <FileText size={13} /> Thêm vào Sheet Chatbot
                  </button>

                  <button
                    onClick={() => toast.info("Chưa có API lưu ghi chú lỗi AI trong backend hiện tại.")}
                    style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  >
                    <Terminal size={13} /> Ghi chú lỗi AI
                  </button>

                  <button
                    onClick={() => toast.info("Chưa có API yêu cầu review nội dung AI trong backend hiện tại.")}
                    style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "rgba(249, 115, 22, 0.12)", color: ACCENT_ORANGE, border: `1px solid ${ACCENT_ORANGE}30`, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  >
                    <Shield size={13} /> Yêu cầu xem lại
                  </button>

                  <button
                    onClick={markResolved}
                    disabled={isResolved}
                    style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "rgba(34,138,97,0.12)", color: "#228A61", border: "1px solid rgba(34,138,97,0.3)", fontWeight: 600, cursor: isResolved ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", opacity: isResolved ? 0.6 : 1 }}
                  >
                    <CheckCircle size={13} /> {isResolved ? "Đã xử lý" : "Đánh dấu đã xử lý"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showSheetModal && activeAnomaly && (
        <AddSheetModal
          prefillQuestion={activeAnomaly.question}
          prefillAnswer={currentAnswer}
          onClose={() => setShowSheetModal(false)}
          onSave={async (data) => {
            await createSheetChatbotRow({
              ...data,
              addedBy: "Đề xuất tự động (AI)",
            });
            toast.success("Đã thêm dữ liệu vào Sheet Chatbot");
          }}
        />
      )}

      {showErrorReasonModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#1e293b", borderRadius: "16px", width: "460px", padding: "24px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: "0 0 16px 0" }}>Đánh dấu AI sai</h3>
            <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "20px" }}>
              Backend hiện chỉ có API đọc lỗi AI từ database, chưa có endpoint ghi lý do đánh dấu mới. Không ghi trạng thái giả vào giao diện.
            </div>
            <button onClick={() => setShowErrorReasonModal(false)} style={{ width: "100%", padding: "9px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.08)", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: "13px" }}>Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}
