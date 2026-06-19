import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { Plus, Search, Filter, CheckCircle2, XCircle, Clock, AlertTriangle, Edit2, Check, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  createSheetChatbotRow,
  getSheetChatbotDuplicates,
  getSheetChatbotRows,
  mergeSheetChatbotToFaq,
  updateSheetChatbotRow,
  updateSheetChatbotStatus,
} from "../../services/sheetChatbotApi";

const NAVY    = "#003865";
const ORANGE  = "#D73C01";
const CTA     = "#ED5206";
const CTA_SOFT= "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const AMBER_50  = "#FFF7E6";
const AMBER_TEXT= "#B7791F";

type SheetStatus = "Chờ xử lý" | "Đã duyệt" | "Cần chỉnh sửa" | "Từ chối";
type RiskLevel = "Thấp" | "Trung bình" | "Cao";
type SourceType = "AI trả lời sai" | "Không tìm thấy dữ liệu" | "AI không chắc chắn" | "Câu hỏi lặp lại nhiều lần" | "Nhân viên đề xuất" | (string & {});

interface SheetRow {
  id: string;
  addedAt: string;
  addedBy: string;
  question: string;
  correctAnswer: string;
  topic: string;
  source: SourceType;
  risk: RiskLevel;
  status: SheetStatus;
  notes: string;
}

const TOPICS = ["TOEIC", "VSTEP", "CNTT Cơ bản", "CNTT Nâng cao", "Chuẩn đầu ra ngoại ngữ", "MOS/IC3", "Lịch thi", "Lệ phí", "Hồ sơ đăng ký", "Tra cứu điểm", "Cấp chứng chỉ"];
const SOURCES: SourceType[] = ["AI trả lời sai", "Không tìm thấy dữ liệu", "AI không chắc chắn", "Câu hỏi lặp lại nhiều lần", "Nhân viên đề xuất"];

const statusConfig: Record<SheetStatus, { bg: string; color: string; icon: typeof CheckCircle2 }> = {
  "Chờ xử lý":     { bg: ORANGE_50, color: ORANGE, icon: Clock },
  "Đã duyệt":      { bg: "#dbeafe", color: "#2563eb", icon: CheckCircle2 },
  "Cần chỉnh sửa": { bg: "#f3e8ff", color: "#7c3aed", icon: Edit2 },
  "Từ chối":       { bg: "#fee2e2", color: "#ef4444", icon: XCircle },
};

const riskConfig: Record<RiskLevel, { bg: string; color: string }> = {
  Thấp:        { bg: "#EAF8F1", color: "#16a34a" },
  "Trung bình": { bg: AMBER_50,  color: AMBER_TEXT },
  Cao:         { bg: ORANGE_50, color: ORANGE },
};

function statusFromRisk(risk: RiskLevel): SheetStatus {
  return "Chờ xử lý";
}

function formatAddedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  if (sameDay) return `${time} hôm nay`;
  if (isYesterday) return `Hôm qua ${time}`;
  return date.toLocaleDateString("vi-VN");
}

interface DuplicateModalProps {
  question: string;
  matches: Array<SheetRow & { similarity: number }>;
  onAddNew: () => void;
  onClose: () => void;
}

function DuplicateModal({ question, matches, onAddNew, onClose }: DuplicateModalProps) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "520px", padding: "24px", boxShadow: "0 16px 48px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={18} style={{ color: ORANGE }} />
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: NAVY, margin: 0 }}>Phát hiện FAQ tương tự</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.6)", marginBottom: "16px" }}>
          Hệ thống tìm thấy FAQ có nội dung tương tự với câu hỏi bạn vừa thêm:
        </div>
        <div style={{ backgroundColor: "#f8fafc", borderRadius: "10px", overflow: "hidden", marginBottom: "20px", border: "1px solid rgba(0,62,154,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9" }}>
                {["Câu hỏi tương tự", "Chủ đề", "Độ giống nhau", "Trạng thái"].map(h => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "11px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: "10px 12px", color: NAVY, fontWeight: 500 }}>{s.question}</td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{s.topic}</span></td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: "12px", fontWeight: 700, color: AMBER_TEXT }}>{Math.round((s.similarity || 0) * 100)}%</span></td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#16a34a" }}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onAddNew} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>Thêm mới</button>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>Xem lại nội dung</button>
        </div>
      </div>
    </div>
  );
}

interface AddSheetModalProps {
  prefillQuestion?: string;
  prefillAnswer?: string;
  initialValues?: Partial<Omit<SheetRow, "id" | "addedAt" | "addedBy">>;
  onClose: () => void;
  onSave?: (row: Omit<SheetRow, "id" | "addedAt" | "addedBy">) => void | Promise<void>;
}

export function AddSheetModal({ prefillQuestion = "", prefillAnswer = "", initialValues, onClose, onSave }: AddSheetModalProps) {
  const [question, setQuestion] = useState(initialValues?.question ?? prefillQuestion);
  const [answer, setAnswer] = useState(initialValues?.correctAnswer ?? prefillAnswer);
  const [topic, setTopic] = useState(initialValues?.topic ?? TOPICS[0]);
  const [source, setSource] = useState<SourceType>((initialValues?.source as SourceType) ?? SOURCES[0]);
  const [risk, setRisk] = useState<RiskLevel>((initialValues?.risk as RiskLevel) ?? "Thấp");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<Array<SheetRow & { similarity: number }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (initialValues) {
      await doSave();
      return;
    }

    try {
      setIsSaving(true);
      const matches = await getSheetChatbotDuplicates(question, 0.82, 5);
      if (matches.length > 0) {
        setDuplicateMatches(matches as Array<SheetRow & { similarity: number }>);
        setShowDuplicate(true);
        return;
      }
      await doSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể kiểm tra FAQ tương tự");
    } finally {
      setIsSaving(false);
    }
  };

  const doSave = async () => {
    const status = statusFromRisk(risk);
    try {
      setIsSaving(true);
      await onSave?.({ question, correctAnswer: answer, topic, source, risk, status, notes });
      if (risk === "Cao") {
        toast.success("Đã thêm vào Sheet Chatbot và chờ xử lý");
      } else {
        toast.success("Đã thêm dữ liệu vào Sheet Chatbot");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu dữ liệu vào Sheet Chatbot");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: "18px", width: "560px", maxHeight: "90vh", overflowY: "auto", padding: "28px", boxShadow: "0 16px 48px rgba(0,0,0,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>{initialValues ? "Chỉnh sửa dữ liệu thêm vào chatbot" : "Thêm dữ liệu vào Sheet Chatbot"}</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Câu hỏi khách hàng <span style={{ color: ORANGE }}>*</span></label>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", outline: "none", fontSize: "13px", resize: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Câu trả lời đúng <span style={{ color: ORANGE }}>*</span></label>
              <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", outline: "none", fontSize: "13px", resize: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Chủ đề</label>
                <select value={topic} onChange={e => setTopic(e.target.value)} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", outline: "none", fontSize: "13px", color: NAVY, background: "#fff" }}>
                  {TOPICS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Nguồn bổ sung</label>
                <select value={source} onChange={e => setSource(e.target.value as SourceType)} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", outline: "none", fontSize: "13px", color: NAVY, background: "#fff" }}>
                  {SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Mức rủi ro</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {(["Thấp", "Trung bình", "Cao"] as RiskLevel[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRisk(r)}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", border: risk === r ? `2px solid ${riskConfig[r].color}` : "1px solid rgba(0,56,101,0.12)", background: risk === r ? `${riskConfig[r].color}14` : "#fff", color: risk === r ? riskConfig[r].color : "rgba(0,56,101,0.6)", cursor: "pointer", fontWeight: risk === r ? 700 : 400, fontSize: "13px" }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: `${riskConfig[risk].color}10`, border: `1px solid ${riskConfig[risk].color}30`, fontSize: "12px", color: riskConfig[risk].color, fontWeight: 500 }}>
              Trạng thái: <strong>{statusFromRisk(risk)}</strong>
              {risk === "Cao" && " — Sẽ chờ quản lý kiểm duyệt trước khi đưa vào chatbot"}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Ghi chú nội bộ</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", outline: "none", fontSize: "13px", boxSizing: "border-box" }} placeholder="Ghi chú về lỗi AI, nguồn thông tin..." />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
            <button onClick={handleSave} disabled={!question.trim() || !answer.trim() || isSaving} style={{ flex: 2, padding: "10px", borderRadius: "10px", border: "none", background: (!question.trim() || !answer.trim() || isSaving) ? "#ccc" : NAVY, color: "#fff", cursor: (!question.trim() || !answer.trim() || isSaving) ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "13px" }}>
              {isSaving ? "Đang lưu..." : "Lưu vào Sheet Chatbot"}
            </button>
          </div>
        </div>
      </div>

      {showDuplicate && (
        <DuplicateModal
          question={question}
          matches={duplicateMatches}
          onAddNew={() => { setShowDuplicate(false); doSave(); }}
          onClose={() => setShowDuplicate(false)}
        />
      )}
    </>
  );
}

function SheetLoadingState() {
  const block = (style: React.CSSProperties = {}) => (
    <div
      style={{
        borderRadius: "10px",
        background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
        backgroundSize: "200% 100%",
        animation: "sheetShimmer 1.4s infinite",
        ...style,
      }}
    />
  );

  return (
    <div style={{ marginTop: "20px" }}>
      <style>{`
        @keyframes sheetShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      {/* KPI Cards Skeletons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "18px 20px", border: "1px solid rgba(0,62,154,0.07)" }}>
            {block({ width: "40px", height: "28px", marginBottom: "8px" })}
            {block({ width: "60%", height: "14px" })}
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,62,154,0.07)", padding: "20px" }}>
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px", borderBottom: "1px solid rgba(0,62,154,0.07)", paddingBottom: "16px" }}>
          {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} style={{ flex: 1 }}>{block({ width: "80%", height: "16px" })}</div>)}
        </div>
        {[1, 2, 3, 4, 5].map(row => (
          <div key={row} style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            {[1, 2, 3, 4, 5, 6, 7].map(col => <div key={col} style={{ flex: 1 }}>{block({ width: "100%", height: "14px" })}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SheetChatbot() {
  const { role, user } = useAuth();
  const currentUserName = role === "manager" ? "Admin FLIC" : user?.name || "Thu Trang";
  const apiRole = role === "manager" ? "manager" : "staff";
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<SheetRow | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Tất cả");
  const [filterRisk, setFilterRisk] = useState("Tất cả");
  const [showAddModal, setShowAddModal] = useState(false);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getSheetChatbotRows({
        page: 1,
        pageSize: 500,
        role: apiRole,
        addedBy: apiRole === "manager" ? undefined : currentUserName,
      });
      setRows(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải dữ liệu Sheet Chatbot";
      setLoadError(message);
      setRows([]);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiRole, currentUserName]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const autoEditQ = localStorage.getItem("edit_chatbot_question");
    if (autoEditQ && rows.length > 0 && !isLoading) {
      setSearch(autoEditQ);
      localStorage.removeItem("edit_chatbot_question");
      const rowToEdit = rows.find(r => r.question.toLowerCase().includes(autoEditQ.toLowerCase()) || autoEditQ.toLowerCase().includes(r.question.toLowerCase()));
      if (rowToEdit) {
        setEditingRow(rowToEdit);
        setShowAddModal(true);
      }
    }
  }, [rows, isLoading]);

  const filtered = rows.filter(r => {
    const matchSearch = r.question.toLowerCase().includes(search.toLowerCase()) ||
      r.topic.toLowerCase().includes(search.toLowerCase()) ||
      r.addedBy.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "Tất cả" || r.status === filterStatus;
    const matchRisk = filterRisk === "Tất cả" || r.risk === filterRisk;
    const matchRole = role === "manager" ? true : r.addedBy === currentUserName;
    return matchSearch && matchStatus && matchRisk && matchRole;
  });

  const handleAddRow = async (data: Omit<SheetRow, "id" | "addedAt" | "addedBy">) => {
    if (editingRow) {
      const updated = await updateSheetChatbotRow(editingRow.id, data);
      setRows(prev => prev.map(row => row.id === updated.id ? updated : row));
      setEditingRow(null);
      return;
    }

    const created = await createSheetChatbotRow({
      ...data,
      addedBy: currentUserName,
    });
    setRows(prev => [created, ...prev]);
  };

  const updateStatus = async (id: string, status: SheetStatus) => {
    try {
      if (status === "Đã duyệt") {
        await mergeSheetChatbotToFaq(id, currentUserName);
        await loadRows();
        toast.success("Đã cập nhật trạng thái dữ liệu chatbot");
        return;
      }

      const updated = await updateSheetChatbotStatus(id, status, currentUserName);
      setRows(prev => prev.map(row => row.id === updated.id ? updated : row));
      toast.success("Đã cập nhật trạng thái dữ liệu chatbot");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái dữ liệu chatbot");
    }
  };

  const handleMergeFaq = async (id: string) => {
    try {
      await mergeSheetChatbotToFaq(id, currentUserName);
      await loadRows();
      toast.success("Đã duyệt để hiển thị trong danh sách FAQ.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gộp FAQ");
    }
  };

  const closeSheetModal = () => {
    setShowAddModal(false);
    setEditingRow(null);
  };

  const statuses: SheetStatus[] = ["Chờ xử lý", "Đã duyệt", "Cần chỉnh sửa", "Từ chối"];

  const kpiCounts = {
    total: filtered.length,
    pending: rows.filter(r => r.status === "Chờ xử lý").length,
    approved: rows.filter(r => r.status === "Đã duyệt").length,
    rejected: rows.filter(r => r.status === "Từ chối").length,
  };

  return (
    <div style={{ padding: "24px", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>
            {role === "manager" ? "Quản lý thư viện phản hồi" : "Sheet Chatbot của tôi"}
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)", margin: 0 }}>
            {role === "manager" ? "Quản lý, duyệt và cập nhật dữ liệu chatbot từ tất cả nhân viên" : "Câu hỏi đúng bạn đã thêm vào Sheet Chatbot"}
          </p>
        </div>
        <button
          onClick={() => { setEditingRow(null); setShowAddModal(true); }}
          style={{ padding: "9px 18px", borderRadius: "10px", backgroundColor: NAVY, color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
        >
          <Plus size={15} /> Thêm vào Sheet Chatbot
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fff", borderRadius: "10px", padding: "8px 14px", border: "1px solid rgba(0,62,154,0.1)", flex: 1, minWidth: "200px" }}>
          <Search size={15} style={{ color: "rgba(0,62,154,0.4)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo câu hỏi, chủ đề, nhân viên..." style={{ border: "none", outline: "none", fontSize: "13px", color: NAVY, width: "100%", background: "transparent" }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid rgba(0,62,154,0.1)", background: "#fff", color: NAVY, fontSize: "13px", outline: "none" }}>
          <option>Tất cả</option>
          {statuses.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid rgba(0,62,154,0.1)", background: "#fff", color: NAVY, fontSize: "13px", outline: "none" }}>
          <option>Tất cả</option>
          <option>Thấp</option>
          <option>Trung bình</option>
          <option>Cao</option>
        </select>
      </div>

      {isLoading ? (
        <SheetLoadingState />
      ) : (
        <>
          {/* KPI Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Tổng dữ liệu", value: rows.length, color: NAVY },
              { label: "Chờ xử lý", value: kpiCounts.pending, color: ORANGE, warning: true },
              { label: "Đã duyệt", value: kpiCounts.approved, color: "#2563eb" },
              { label: "Từ chối", value: kpiCounts.rejected, color: "#ef4444" },
            ].map(kpi => (
              <div key={kpi.label} style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "18px 20px", border: kpi.warning ? `1px solid ${ORANGE}25` : "1px solid rgba(0,62,154,0.07)", borderLeft: kpi.warning ? `4px solid ${ORANGE}` : `4px solid ${kpi.color}`, boxShadow: "0 2px 8px rgba(0,62,154,0.05)" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, color: kpi.color, marginBottom: "4px" }}>{kpi.value}</div>
                <div style={{ fontSize: "12px", color: "rgba(0,62,154,0.6)" }}>{kpi.label}</div>
              </div>
            ))}
          </div>

      {/* Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,62,154,0.07)", overflow: "hidden", flex: 1, minHeight: 0 }}>
        <div style={{ overflow: "auto", height: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Thời gian thêm", "Người thêm", "Câu hỏi", "Câu trả lời đúng", "Chủ đề", "Nguồn", "Mức rủi ro", "Trạng thái", "Hành động"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,62,154,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,62,154,0.07)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 1, backgroundColor: "#f8fafc" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(loadError || filtered.length === 0) && (
                <tr>
                  <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "rgba(0,62,154,0.4)", fontSize: "13px" }}>
                    {loadError || "Không có dữ liệu phù hợp"}
                  </td>
                </tr>
              )}
              {!loadError && filtered.map(row => {
                const sc = statusConfig[row.status] || { bg: "#f1f5f9", color: "#64748b", icon: Clock };
                const rc = riskConfig[row.risk] || riskConfig["Thấp"];
                const StatusIcon = sc.icon;
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid rgba(0,62,154,0.04)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "12px 14px", color: "rgba(0,62,154,0.55)", whiteSpace: "nowrap" }}>{formatAddedAt(row.addedAt)}</td>
                    <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 600, whiteSpace: "nowrap" }}>{row.addedBy}</td>
                    <td style={{ padding: "12px 14px", maxWidth: "200px" }}>
                      <div style={{ color: NAVY, fontWeight: 500, lineHeight: 1.4, fontSize: "12px" }}>{row.question}</div>
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: "200px" }}>
                      <div style={{ color: "rgba(0,62,154,0.7)", lineHeight: 1.4, fontSize: "12px" }}>{row.correctAnswer.slice(0, 80)}{row.correctAnswer.length > 80 ? "..." : ""}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6", whiteSpace: "nowrap" }}>{row.topic}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "rgba(0,62,154,0.6)", whiteSpace: "nowrap" }}>{row.source}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: rc.bg, color: rc.color, fontWeight: 600 }}>{row.risk}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: sc.bg, color: sc.color, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>
                        <StatusIcon size={10} /> {row.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {role === "manager" ? (
                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                          {row.status === "Chờ quản lý xác nhận" || row.status === "Chờ xử lý" || row.status === "Cần chỉnh sửa" ? (
                            <>
                              <button onClick={() => updateStatus(row.id, "Đã duyệt")} style={{ padding: "3px 9px", borderRadius: "6px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Duyệt</button>
                              <button onClick={() => { setEditingRow(row); setShowAddModal(true); }} style={{ padding: "3px 9px", borderRadius: "6px", border: "1px solid #e9d5ff", background: "#faf5ff", color: "#7c3aed", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Chỉnh sửa</button>
                              <button onClick={() => updateStatus(row.id, "Từ chối")} style={{ padding: "3px 9px", borderRadius: "6px", border: "1px solid rgba(0,62,154,0.12)", background: "#f8fafc", color: "#64748b", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Từ chối</button>
                            </>
                          ) : row.status === "Đã duyệt" ? (
                            <button onClick={() => handleMergeFaq(row.id)} style={{ padding: "3px 9px", borderRadius: "6px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Gộp FAQ</button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "rgba(0,62,154,0.4)" }}>—</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          {row.status === "Cần chỉnh sửa" ? (
                            <button onClick={() => { setEditingRow(row); setShowAddModal(true); }} style={{ padding: "3px 9px", borderRadius: "6px", border: `1px solid #e9d5ff`, background: "#faf5ff", color: "#7c3aed", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Chỉnh sửa</button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "rgba(0,62,154,0.4)" }}>{row.status}</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {showAddModal && (
        <AddSheetModal
          initialValues={editingRow ? {
            question: editingRow.question,
            correctAnswer: editingRow.correctAnswer,
            topic: editingRow.topic,
            source: editingRow.source,
            risk: editingRow.risk,
            status: editingRow.status,
            notes: editingRow.notes,
          } : undefined}
          onClose={closeSheetModal}
          onSave={handleAddRow}
        />
      )}
    </div>
  );
}
