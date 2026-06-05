import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Plus, Search, Filter, CheckCircle2, XCircle, Clock, AlertTriangle, Edit2, Check, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const NAVY    = "#003865";
const ORANGE  = "#D73C01";
const CTA     = "#ED5206";
const CTA_SOFT= "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const AMBER_50  = "#FFF7E6";
const AMBER_TEXT= "#B7791F";

type SheetStatus = "Có thể sử dụng" | "Chờ xử lý" | "Chờ quản lý xác nhận" | "Đã duyệt" | "Cần chỉnh sửa" | "Bị từ chối";
type RiskLevel = "Thấp" | "Trung bình" | "Cao";
type SourceType = "AI trả lời sai" | "Không tìm thấy dữ liệu" | "AI không chắc chắn" | "Câu hỏi lặp lại nhiều lần" | "Nhân viên đề xuất";

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

const initialRows: SheetRow[] = [
  { id: "CS-001", addedAt: "09:30 hôm nay", addedBy: "Thu Trang", question: "Lệ phí thi TOEIC hiện tại là bao nhiêu?", correctAnswer: "Lệ phí thi TOEIC tại FLIC là 750.000 VNĐ/lần thi. Sinh viên có thẻ được giảm 10%.", topic: "TOEIC", source: "AI trả lời sai", risk: "Thấp", status: "Có thể sử dụng", notes: "AI trả lời sai số tiền, đã kiểm tra bảng giá 2026" },
  { id: "CS-002", addedAt: "08:15 hôm nay", addedBy: "Thùy NT", question: "Thi xong VSTEP bao lâu có kết quả?", correctAnswer: "Kết quả thi VSTEP được trả trong vòng 30 ngày làm việc kể từ ngày thi.", topic: "VSTEP", source: "AI trả lời sai", risk: "Trung bình", status: "Chờ xử lý", notes: "AI nói 2 tháng nhưng thực tế là 30 ngày làm việc" },
  { id: "CS-003", addedAt: "Hôm qua 16:40", addedBy: "Thu Trang", question: "Điểm TOEIC 600 có đủ chuẩn đầu ra không?", correctAnswer: "Điểm TOEIC 600 đạt chuẩn đầu ra cho hầu hết các ngành. Một số ngành đặc biệt yêu cầu 650+. Cần kiểm tra theo ngành học cụ thể.", topic: "Chuẩn đầu ra ngoại ngữ", source: "AI không chắc chắn", risk: "Cao", status: "Chờ quản lý xác nhận", notes: "Câu trả lời liên quan đến quy định trường — cần xác nhận chính thức" },
  { id: "CS-004", addedAt: "Hôm qua 14:00", addedBy: "Thùy NT", question: "Đăng ký thi CNTT nhóm trên 3 bạn thì thế nào?", correctAnswer: "Nhóm từ 3 người trở lên có thể đăng ký thi theo nhóm qua form online. Nhóm trưởng điền thông tin của tất cả thành viên.", topic: "CNTT Cơ bản", source: "Không tìm thấy dữ liệu", risk: "Thấp", status: "Đã duyệt", notes: "" },
  { id: "CS-005", addedAt: "28/05/2026", addedBy: "Thu Trang", question: "Lịch thi VSTEP tháng 6/2026 có chưa?", correctAnswer: "Lịch thi VSTEP tháng 6/2026 sẽ được công bố vào ngày 20/05/2026. Vui lòng theo dõi website chính thức của FLIC.", topic: "VSTEP", source: "AI không chắc chắn", risk: "Thấp", status: "Cần chỉnh sửa", notes: "Cần cập nhật ngày công bố chính xác hơn" },
  { id: "CS-006", addedAt: "27/05/2026", addedBy: "Thùy NT", question: "Hồ sơ đăng ký thi CNTT Nâng cao cần những gì?", correctAnswer: "Hồ sơ đăng ký thi CNTT Nâng cao gồm: CCCD/CMND bản sao, chứng chỉ CNTT Cơ bản (nếu có), phiếu đăng ký điền đầy đủ.", topic: "CNTT Nâng cao", source: "Câu hỏi lặp lại nhiều lần", risk: "Thấp", status: "Đã duyệt", notes: "" },
];

const statusConfig: Record<SheetStatus, { bg: string; color: string; icon: typeof CheckCircle2 }> = {
  "Có thể sử dụng":     { bg: "#EAF8F1", color: "#16a34a", icon: CheckCircle2 },
  "Chờ xử lý":          { bg: AMBER_50,  color: AMBER_TEXT, icon: Clock },
  "Chờ quản lý xác nhận": { bg: ORANGE_50, color: ORANGE,     icon: AlertTriangle },
  "Đã duyệt":           { bg: "#dbeafe", color: "#2563eb", icon: CheckCircle2 },
  "Cần chỉnh sửa":       { bg: "#f3e8ff", color: "#7c3aed", icon: Edit2 },
  "Bị từ chối":         { bg: "#f1f5f9", color: "#64748b", icon: XCircle },
};

const riskConfig: Record<RiskLevel, { bg: string; color: string }> = {
  Thấp:        { bg: "#EAF8F1", color: "#16a34a" },
  "Trung bình": { bg: AMBER_50,  color: AMBER_TEXT },
  Cao:         { bg: ORANGE_50, color: ORANGE },
};

function statusFromRisk(risk: RiskLevel): SheetStatus {
  if (risk === "Thấp") return "Có thể sử dụng";
  if (risk === "Trung bình") return "Chờ xử lý";
  return "Chờ quản lý xác nhận";
}

interface DuplicateModalProps {
  question: string;
  onAddNew: () => void;
  onMerge: () => void;
  onClose: () => void;
}

function DuplicateModal({ question, onAddNew, onMerge, onClose }: DuplicateModalProps) {
  const similar = [
    { q: "Lệ phí thi TOEIC là bao nhiêu?", topic: "TOEIC", similarity: "87%", status: "Đã duyệt" },
  ];
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
              {similar.map((s, i) => (
                <tr key={i}>
                  <td style={{ padding: "10px 12px", color: NAVY, fontWeight: 500 }}>{s.q}</td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{s.topic}</span></td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: "12px", fontWeight: 700, color: AMBER_TEXT }}>{s.similarity}</span></td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#16a34a" }}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onAddNew} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>Thêm mới</button>
          <button onClick={onMerge} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>Gộp vào FAQ có sẵn</button>
          <button onClick={onMerge} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>Cập nhật câu trả lời cũ</button>
        </div>
      </div>
    </div>
  );
}

interface AddSheetModalProps {
  prefillQuestion?: string;
  prefillAnswer?: string;
  onClose: () => void;
  onSave?: (row: Omit<SheetRow, "id" | "addedAt" | "addedBy">) => void;
}

export function AddSheetModal({ prefillQuestion = "", prefillAnswer = "", onClose, onSave }: AddSheetModalProps) {
  const [question, setQuestion] = useState(prefillQuestion);
  const [answer, setAnswer] = useState(prefillAnswer);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [source, setSource] = useState<SourceType>(SOURCES[0]);
  const [risk, setRisk] = useState<RiskLevel>("Thấp");
  const [notes, setNotes] = useState("");
  const [showDuplicate, setShowDuplicate] = useState(false);

  const handleSave = () => {
    const lowRisk = ["lệ phí", "toeic", "fee"].some(k => question.toLowerCase().includes(k));
    if (lowRisk) {
      setShowDuplicate(true);
      return;
    }
    doSave();
  };

  const doSave = () => {
    const status = statusFromRisk(risk);
    onSave?.({ question, correctAnswer: answer, topic, source, risk, status, notes });
    if (risk === "Cao") {
      toast.success("Đã thêm vào Sheet Chatbot và chờ quản lý xác nhận");
    } else {
      toast.success("Đã thêm dữ liệu vào Sheet Chatbot");
    }
    onClose();
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: "18px", width: "560px", maxHeight: "90vh", overflowY: "auto", padding: "28px", boxShadow: "0 16px 48px rgba(0,0,0,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Thêm dữ liệu vào Sheet Chatbot</h3>
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
            <button onClick={handleSave} disabled={!question.trim() || !answer.trim()} style={{ flex: 2, padding: "10px", borderRadius: "10px", border: "none", background: (!question.trim() || !answer.trim()) ? "#ccc" : NAVY, color: "#fff", cursor: (!question.trim() || !answer.trim()) ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "13px" }}>
              Lưu vào Sheet Chatbot
            </button>
          </div>
        </div>
      </div>

      {showDuplicate && (
        <DuplicateModal
          question={question}
          onAddNew={() => { setShowDuplicate(false); doSave(); }}
          onMerge={() => { setShowDuplicate(false); toast.success("Đã gộp vào FAQ có sẵn"); onClose(); }}
          onClose={() => setShowDuplicate(false)}
        />
      )}
    </>
  );
}

export function SheetChatbot() {
  const { role } = useAuth();
  
  // Load from localStorage or initialRows
  const [rows, setRows] = useState<SheetRow[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("flic_sheet_rows");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed parsing flic_sheet_rows", e);
        }
      }
    }
    return initialRows;
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("flic_sheet_rows", JSON.stringify(rows));
  }, [rows]);

  // Sync rows periodically across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "flic_sheet_rows" && e.newValue) {
        try {
          setRows(JSON.parse(e.newValue));
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Tất cả");
  const [filterRisk, setFilterRisk] = useState("Tất cả");
  const [showAddModal, setShowAddModal] = useState(false);


  const filtered = rows.filter(r => {
    const matchSearch = r.question.toLowerCase().includes(search.toLowerCase()) ||
      r.topic.toLowerCase().includes(search.toLowerCase()) ||
      r.addedBy.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "Tất cả" || r.status === filterStatus;
    const matchRisk = filterRisk === "Tất cả" || r.risk === filterRisk;
    const matchRole = role === "manager" ? true : r.addedBy === "Thu Trang";
    return matchSearch && matchStatus && matchRisk && matchRole;
  });

  const handleAddRow = (data: Omit<SheetRow, "id" | "addedAt" | "addedBy">) => {
    const newRow: SheetRow = {
      id: `CS-${String(rows.length + 1).padStart(3, "0")}`,
      addedAt: "Vừa thêm",
      addedBy: role === "manager" ? "Admin FLIC" : "Thu Trang",
      ...data,
    };
    setRows(prev => [newRow, ...prev]);
  };

  const updateStatus = (id: string, status: SheetStatus) => {
    setRows(prev => {
      const updatedRows = prev.map(r => r.id === id ? { ...r, status } : r);
      if (status === "Đã duyệt") {
        const approvedRow = updatedRows.find(r => r.id === id);
        if (approvedRow) {
          let currentFaqs = [];
          const saved = localStorage.getItem("flic_faqs");
          if (saved) {
            try {
              currentFaqs = JSON.parse(saved);
            } catch (e) {
              console.error(e);
            }
          }
          let faqTopic = approvedRow.topic;
          if (faqTopic === "Chuẩn đầu ra ngoại ngữ") faqTopic = "Chuẩn đầu ra";
          if (faqTopic === "CNTT Cơ bản" || faqTopic === "CNTT Nâng cao" || faqTopic === "MOS/IC3") faqTopic = "MOS";

          const exists = currentFaqs.some((f: any) => f.question.toLowerCase() === approvedRow.question.toLowerCase());
          if (!exists) {
            const newFaq = {
              id: `FAQ-${Date.now()}`,
              question: approvedRow.question,
              answer: approvedRow.correctAnswer,
              topic: faqTopic,
              proposer: approvedRow.addedBy,
              source: approvedRow.source,
              status: "Đã duyệt",
              riskLevel: approvedRow.risk,
              date: new Date().toISOString().split('T')[0],
              notes: approvedRow.notes || "Duyệt từ Sheet Chatbot"
            };
            currentFaqs.unshift(newFaq);
            localStorage.setItem("flic_faqs", JSON.stringify(currentFaqs));
            window.dispatchEvent(new Event("storage"));
          }
        }
      }
      return updatedRows;
    });
    toast.success("Đã cập nhật trạng thái dữ liệu chatbot");
  };

  const statuses: SheetStatus[] = ["Có thể sử dụng", "Chờ xử lý", "Chờ quản lý xác nhận", "Đã duyệt", "Cần chỉnh sửa", "Bị từ chối"];

  const kpiCounts = {
    total: filtered.length,
    pending: rows.filter(r => r.status === "Chờ quản lý xác nhận").length,
    approved: rows.filter(r => r.status === "Đã duyệt").length,
    usable: rows.filter(r => r.status === "Có thể sử dụng").length,
  };

  return (
    <div style={{ padding: "24px", height: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>
            {role === "manager" ? "Quản lý Sheet Chatbot" : "Sheet Chatbot của tôi"}
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)", margin: 0 }}>
            {role === "manager" ? "Quản lý, duyệt và cập nhật dữ liệu chatbot từ tất cả nhân viên" : "Câu hỏi đúng bạn đã thêm vào Sheet Chatbot"}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: "9px 18px", borderRadius: "10px", backgroundColor: NAVY, color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
        >
          <Plus size={15} /> Thêm vào Sheet Chatbot
        </button>
      </div>

      {/* KPI Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {[
          { label: "Tổng dữ liệu", value: rows.length, color: NAVY },
          { label: "Chờ quản lý xác nhận", value: kpiCounts.pending, color: ORANGE, warning: true },
          { label: "Đã duyệt", value: kpiCounts.approved, color: "#2563eb" },
          { label: "Có thể sử dụng", value: kpiCounts.usable, color: "#16a34a" },
        ].map(kpi => (
          <div key={kpi.label} style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "18px 20px", border: kpi.warning ? `1px solid ${ORANGE}25` : "1px solid rgba(0,62,154,0.07)", borderLeft: kpi.warning ? `4px solid ${ORANGE}` : `4px solid ${kpi.color}`, boxShadow: "0 2px 8px rgba(0,62,154,0.05)" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: kpi.color, marginBottom: "4px" }}>{kpi.value}</div>
            <div style={{ fontSize: "12px", color: "rgba(0,62,154,0.6)" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
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

      {/* Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,62,154,0.07)", overflow: "hidden", flex: 1 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Thời gian thêm", "Người thêm", "Câu hỏi", "Câu trả lời đúng", "Chủ đề", "Nguồn", "Mức rủi ro", "Trạng thái", "Hành động"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,62,154,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,62,154,0.07)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "rgba(0,62,154,0.4)", fontSize: "13px" }}>
                    Không có dữ liệu phù hợp
                  </td>
                </tr>
              )}
              {filtered.map(row => {
                const sc = statusConfig[row.status];
                const rc = riskConfig[row.risk];
                const StatusIcon = sc.icon;
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid rgba(0,62,154,0.04)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "12px 14px", color: "rgba(0,62,154,0.55)", whiteSpace: "nowrap" }}>{row.addedAt}</td>
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
                          {row.status === "Chờ quản lý xác nhận" || row.status === "Chờ xử lý" ? (
                            <>
                              <button onClick={() => updateStatus(row.id, "Đã duyệt")} style={{ padding: "3px 9px", borderRadius: "6px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Duyệt</button>
                              <button onClick={() => updateStatus(row.id, "Cần chỉnh sửa")} style={{ padding: "3px 9px", borderRadius: "6px", border: "1px solid #e9d5ff", background: "#faf5ff", color: "#7c3aed", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Chỉnh sửa</button>
                              <button onClick={() => updateStatus(row.id, "Bị từ chối")} style={{ padding: "3px 9px", borderRadius: "6px", border: "1px solid rgba(0,62,154,0.12)", background: "#f8fafc", color: "#64748b", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Từ chối</button>
                            </>
                          ) : row.status === "Đã duyệt" ? (
                            <button onClick={() => {
                              let currentFaqs = [];
                              const saved = localStorage.getItem("flic_faqs");
                              if (saved) {
                                try {
                                  currentFaqs = JSON.parse(saved);
                                } catch (e) {
                                  console.error(e);
                                }
                              }
                              let faqTopic = row.topic;
                              if (faqTopic === "Chuẩn đầu ra ngoại ngữ") faqTopic = "Chuẩn đầu ra";
                              if (faqTopic === "CNTT Cơ bản" || faqTopic === "CNTT Nâng cao" || faqTopic === "MOS/IC3") faqTopic = "MOS";

                              const exists = currentFaqs.some((f: any) => f.question.toLowerCase() === row.question.toLowerCase());
                              if (exists) {
                                toast.info("FAQ này đã tồn tại trong danh sách FAQ!");
                              } else {
                                const newFaq = {
                                  id: `FAQ-${Date.now()}`,
                                  question: row.question,
                                  answer: row.correctAnswer,
                                  topic: faqTopic,
                                  proposer: row.addedBy,
                                  source: row.source,
                                  status: "Đã duyệt",
                                  riskLevel: row.risk,
                                  date: new Date().toISOString().split('T')[0],
                                  notes: row.notes || "Gộp từ Sheet Chatbot"
                                };
                                currentFaqs.unshift(newFaq);
                                localStorage.setItem("flic_faqs", JSON.stringify(currentFaqs));
                                window.dispatchEvent(new Event("storage"));
                                toast.success("Đã gộp vào danh sách FAQ thành công!");
                              }
                            }} style={{ padding: "3px 9px", borderRadius: "6px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Gộp FAQ</button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "rgba(0,62,154,0.4)" }}>—</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          {row.status === "Cần chỉnh sửa" ? (
                            <button onClick={() => setShowAddModal(true)} style={{ padding: "3px 9px", borderRadius: "6px", border: `1px solid #e9d5ff`, background: "#faf5ff", color: "#7c3aed", cursor: "pointer", fontSize: "10px", fontWeight: 600 }}>Chỉnh sửa</button>
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

      {showAddModal && (
        <AddSheetModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddRow}
        />
      )}
    </div>
  );
}
