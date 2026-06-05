import { useState } from "react";
import { Brain, Cpu, Zap, Activity, AlertOctagon, Check, X, Shield, Terminal, FileText, Flag, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { AddSheetModal } from "./SheetChatbot";

const DARK_BG = "#020617";
const PANEL_BG = "#0f172a";
const CYAN = "#38bdf8";
const ACCENT_ORANGE = "#f97316";
const NAVY = "#003865";

type AIStatus = "AI không chắc chắn" | "AI trả lời sai" | "Không tìm thấy dữ liệu" | "AI có nguy cơ tự tạo thông tin" | "Cần kiểm duyệt";

interface AnomalyItem {
  id: string;
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

const anomalies: AnomalyItem[] = [
  {
    id: "AI-772",
    type: "AI không chắc chắn",
    confidence: 32,
    customer: "Sinh viên A",
    question: "Em muốn đăng ký nhóm trên 3 bạn thì đăng ký thi CNTT Cơ bản như thế nào ạ?",
    aiAnswer: "Dạ em có thể liên hệ phòng đào tạo để được hỗ trợ đăng ký nhóm. Hệ thống của em không tìm thấy hướng dẫn cụ thể về đăng ký nhóm.",
    reason: "Cơ sở tri thức chưa có hướng dẫn đăng ký thi nhóm",
    channel: "Zalo OA",
    topic: "CNTT Cơ bản",
    waitTime: "2 giờ 15 phút",
  },
  {
    id: "AI-771",
    type: "AI có nguy cơ tự tạo thông tin",
    confidence: 15,
    customer: "Sinh viên B",
    question: "Chuẩn đầu ra ngoại ngữ cần chứng chỉ gì ạ?",
    aiAnswer: "Theo quy định, sinh viên cần đạt TOEIC 550 hoặc VSTEP B2 để đáp ứng chuẩn đầu ra ngoại ngữ của trường Đại học Bách Khoa.",
    reason: "AI đưa ra tên trường cụ thể không có trong dữ liệu — AI có nguy cơ tự tạo thông tin",
    channel: "Facebook",
    topic: "Chuẩn đầu ra ngoại ngữ",
    waitTime: "11 giờ 20 phút",
  },
  {
    id: "AI-769",
    type: "Không tìm thấy dữ liệu",
    confidence: 68,
    customer: "Sinh viên C",
    question: "Lịch thi VSTEP tháng 6/2026 có chưa ạ?",
    aiAnswer: "Dạ hệ thống chưa có thông tin về lịch thi VSTEP tháng 6/2026. Anh/chị vui lòng theo dõi website chính thức.",
    reason: "Lịch thi chưa được cập nhật vào Cơ sở tri thức",
    channel: "Zalo Business",
    topic: "VSTEP",
    waitTime: "45 phút",
  },
  {
    id: "AI-768",
    type: "Cần kiểm duyệt",
    confidence: 48,
    customer: "Sinh viên D",
    question: "Học sinh có được giảm giá thi TOEIC không ạ?",
    aiAnswer: "Dạ em không chắc về chính sách giảm giá cho học sinh hiện tại. Anh/chị có thể liên hệ trực tiếp để xác nhận.",
    reason: "Thông tin về chính sách giá cần được xác nhận từ quản lý",
    channel: "Chat Widget",
    topic: "TOEIC",
    waitTime: "30 phút",
  },
  {
    id: "AI-767",
    type: "AI trả lời sai",
    confidence: 28,
    customer: "Sinh viên E",
    question: "Lệ phí thi TOEIC hiện tại là bao nhiêu?",
    aiAnswer: "Lệ phí thi TOEIC tại FLIC là 850.000 VNĐ.",
    reason: "Thông tin lệ phí sai — thực tế là 750.000 VNĐ",
    channel: "Zalo OA",
    topic: "TOEIC",
    waitTime: "1 giờ 5 phút",
  },
];

const aiStatusColor: Record<AIStatus, { color: string; bg: string }> = {
  "AI không chắc chắn": { color: ACCENT_ORANGE, bg: "rgba(249, 115, 22, 0.15)" },
  "AI trả lời sai": { color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
  "Không tìm thấy dữ liệu": { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  "AI có nguy cơ tự tạo thông tin": { color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)" },
  "Cần kiểm duyệt": { color: CYAN, bg: "rgba(56, 189, 248, 0.15)" },
};

export function AIMonitoring() {
  const [activeAnomaly, setActiveAnomaly] = useState<AnomalyItem>(anomalies[0]);
  const [editedAnswer, setEditedAnswer] = useState<Record<string, string>>({});
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [showErrorReasonModal, setShowErrorReasonModal] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const currentAnswer = editedAnswer[activeAnomaly.id] ?? activeAnomaly.aiAnswer;
  const isResolved = resolvedIds.has(activeAnomaly.id);

  const markResolved = () => {
    setResolvedIds(prev => new Set([...prev, activeAnomaly.id]));
    toast.success(`Hội thoại ${activeAnomaly.id} — Đã xử lý bởi nhân viên`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 72px)", backgroundColor: DARK_BG, color: "#e2e8f0", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>

      {/* Top HUD */}
      <div style={{ padding: "20px 24px", display: "flex", gap: "20px", borderBottom: "1px solid rgba(56, 189, 248, 0.15)", backgroundColor: "rgba(15, 23, 42, 0.8)" }}>
        <div style={{ flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "12px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", border: `2px solid ${CYAN}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 15px ${CYAN}40` }}>
            <Activity size={24} color={CYAN} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px", fontWeight: 600 }}>Sức khỏe hệ thống AI</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>98,2% <span style={{ fontSize: "13px", color: CYAN, fontWeight: 500 }}>+0,4%</span></div>
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
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff" }}>84% <span style={{ fontSize: "12px", padding: "2px 6px", backgroundColor: "#334155", borderRadius: "4px", color: "#94a3b8" }}>Cơ sở tri thức FLIC v2.4</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: Anomaly Feed */}
        <div style={{ width: "420px", borderRight: "1px solid rgba(255,255,255,0.08)", backgroundColor: PANEL_BG, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={16} color={CYAN} /> Hội thoại cần can thiệp
            </h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {anomalies.map((item) => {
              const isWarning = item.confidence < 50;
              const sc = aiStatusColor[item.type];
              const isActive = activeAnomaly.id === item.id;
              const isItemResolved = resolvedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => setActiveAnomaly(item)}
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
                      {isItemResolved && <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", backgroundColor: "#1e293b", color: "#228A61" }}>Đã xử lý</span>}
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

        {/* Right: AI Intervention Detail */}
        <div style={{ flex: 1, backgroundColor: DARK_BG, padding: "28px 32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0, fontFamily: "monospace" }}>
                  {activeAnomaly.id}
                </h1>
                <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "6px", backgroundColor: aiStatusColor[activeAnomaly.type].bg, color: aiStatusColor[activeAnomaly.type].color, fontWeight: 700 }}>
                  {activeAnomaly.type}
                </span>
                {isResolved && (
                  <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "6px", backgroundColor: "rgba(34,138,97,0.15)", color: "#228A61", fontWeight: 700 }}>
                    ✓ Đã xử lý bởi nhân viên
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                {activeAnomaly.channel} · {activeAnomaly.topic} · Chờ: {activeAnomaly.waitTime}
              </div>
              <div style={{ fontSize: "11px", color: ACCENT_ORANGE, marginTop: "4px" }}>⚠ {activeAnomaly.reason}</div>
            </div>
          </div>

          {/* Question + AI answer panels */}
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
                    <span style={{ color: "#e2e8f0" }}>Tìm kiếm Cơ sở tri thức</span>
                    <span style={{ color: CYAN, fontFamily: "monospace" }}>{(activeAnomaly.confidence / 100 * 0.95).toFixed(2)}</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                    <div style={{ width: `${activeAnomaly.confidence}%`, height: "100%", backgroundColor: CYAN, borderRadius: "2px" }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                    <span style={{ color: "#e2e8f0" }}>Độ chính xác câu trả lời</span>
                    <span style={{ color: ACCENT_ORANGE, fontFamily: "monospace" }}>{(activeAnomaly.confidence / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                    <div style={{ width: `${activeAnomaly.confidence * 0.85}%`, height: "100%", backgroundColor: ACCENT_ORANGE, borderRadius: "2px" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Edit AI Response */}
          <div style={{ backgroundColor: PANEL_BG, borderRadius: "12px", border: `1px solid ${aiStatusColor[activeAnomaly.type].color}40`, padding: "22px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: aiStatusColor[activeAnomaly.type].color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Cpu size={13} /> Câu trả lời AI — Nhân viên có thể chỉnh sửa trước khi gửi
            </div>
            <textarea
              value={currentAnswer}
              onChange={e => setEditedAnswer(prev => ({ ...prev, [activeAnomaly.id]: e.target.value }))}
              style={{ width: "100%", minHeight: "100px", backgroundColor: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px", color: "#e2e8f0", fontSize: "13px", lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />

            {/* Action buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
              <button
                onClick={() => { toast.success(`Đã gửi câu trả lời đã chỉnh sửa cho ${activeAnomaly.customer}`); markResolved(); }}
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
                onClick={() => { toast.success("Đã thêm ghi chú lỗi AI"); }}
                style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                <Terminal size={13} /> Ghi chú lỗi AI
              </button>

              {activeAnomaly.type === "AI có nguy cơ tự tạo thông tin" || activeAnomaly.type === "Cần kiểm duyệt" ? (
                <button
                  onClick={() => { toast.success("Đã yêu cầu xem lại nội dung AI"); markResolved(); }}
                  style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "rgba(249, 115, 22, 0.12)", color: ACCENT_ORANGE, border: `1px solid ${ACCENT_ORANGE}30`, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                >
                  <Shield size={13} /> Yêu cầu xem lại
                </button>
              ) : null}

              <button
                onClick={markResolved}
                disabled={isResolved}
                style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: isResolved ? "rgba(34,138,97,0.12)" : "rgba(34,138,97,0.12)", color: "#228A61", border: "1px solid rgba(34,138,97,0.3)", fontWeight: 600, cursor: isResolved ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", opacity: isResolved ? 0.6 : 1 }}
              >
                <CheckCircle size={13} /> {isResolved ? "Đã xử lý" : "Đánh dấu đã xử lý"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {showSheetModal && (
        <AddSheetModal
          prefillQuestion={activeAnomaly.question}
          prefillAnswer={currentAnswer}
          onClose={() => setShowSheetModal(false)}
          onSave={(data) => {
            let currentRows = [];
            const saved = localStorage.getItem("flic_sheet_rows");
            if (saved) {
              try {
                currentRows = JSON.parse(saved);
              } catch (e) {
                console.error(e);
              }
            }
            const newRow = {
              id: `CS-${Date.now()}`,
              addedAt: "Vừa thêm",
              addedBy: "Đề xuất tự động (AI)",
              ...data
            };
            currentRows.unshift(newRow);
            localStorage.setItem("flic_sheet_rows", JSON.stringify(currentRows));
            window.dispatchEvent(new Event("storage"));
            toast.success("Đã thêm dữ liệu vào Sheet Chatbot");
          }}
        />
      )}

      {showErrorReasonModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#1e293b", borderRadius: "16px", width: "460px", padding: "24px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: "0 0 16px 0" }}>Chọn lý do đánh dấu AI sai</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {["Không tìm thấy dữ liệu trong Cơ sở tri thức", "Thông tin lỗi thời", "Câu trả lời sai hoàn toàn", "AI không chắc chắn", "AI có nguy cơ tự tạo thông tin", "Ngoài phạm vi FLIC"].map(reason => (
                <button
                  key={reason}
                  onClick={() => {
                    toast.success(`Đã đánh dấu: "${reason}" — lỗi xuất hiện trong Phân tích AI`);
                    setShowErrorReasonModal(false);
                  }}
                  style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.05)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", textAlign: "left", fontSize: "13px" }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button onClick={() => setShowErrorReasonModal(false)} style={{ width: "100%", padding: "9px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.08)", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: "13px" }}>Hủy</button>
          </div>
        </div>
      )}
    </div>
  );
}
