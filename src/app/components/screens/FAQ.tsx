import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { Plus, Search, CheckCircle2, XCircle, Clock, X, Filter } from "lucide-react";
import { toast } from "sonner";
import { ErrorSourceBadge } from "../common/ErrorSourceBadge";
import { FeedbackFormDialog } from "../feedback/FeedbackFormDialog";
import { AI_FAILURE_TAXONOMY, getAiFailureDefinition } from "../../constants/aiFailureTaxonomy";
import {
  createSheetChatbotRow,
  getSheetChatbotRows,
  updateSheetChatbotStatus,
  type SheetChatbotRow,
  type SheetChatbotStatus,
} from "../../services/sheetChatbotApi";

const NAVY = "#003BB9";
const ORANGE = "#D73C01";
const CTA = "#ED5206";
const CTA_SOFT = "#F36C2E";
const AMBER_50 = "#FFF7E6";
const AMBER_TEXT = "#B7791F";
const RED_50 = "#FFF1F1";
const RED_TEXT = "#B42318";

const TIME_PERIODS = ["Hôm nay", "7 ngày qua", "30 ngày qua", "Tháng này", "Tùy chỉnh"];
const FAQ_TOPICS_LANGUAGE = ["TOEIC", "VSTEP", "Chuẩn đầu ra"];
const FAQ_TOPICS_COMPUTER = ["MOS", "IC3", "Tin học cơ bản"];
const RISK_LEVELS = ["Cao", "Trung bình", "Thấp"];
const FAQ_STATUSES: SheetChatbotStatus[] = ["Chờ xử lý", "Đã duyệt", "Cần chỉnh sửa", "Từ chối"];
const FAQ_SOURCES = AI_FAILURE_TAXONOMY.map((item) => item.apiValue);

interface FaqFormState {
  question: string;
  answer: string;
  topic: string;
  source: string;
  riskLevel: string;
  notes: string;
  status: SheetChatbotStatus;
}

const emptyFaqForm: FaqFormState = {
  question: "",
  answer: "",
  topic: "TOEIC",
  source: FAQ_SOURCES[0],
  riskLevel: "Thấp",
  notes: "",
  status: "Chờ xử lý",
};

interface Faq {
  id: string;
  question: string;
  answer: string;
  topic: string;
  proposer: string;
  source: string;
  status: string;
  riskLevel: string;
  date: string;
  notes: string;
}

function mapSheetRowToFaq(row: SheetChatbotRow): Faq {
  return {
    id: row.id,
    question: row.question,
    answer: row.correctAnswer,
    topic: row.topic,
    proposer: row.addedBy,
    source: row.source,
    status: row.status,
    riskLevel: row.risk,
    date: (row.addedAt || row.createdAt || "").slice(0, 10),
    notes: row.notes || "",
  };
}

function displayFailureSource(source: string) {
  return getAiFailureDefinition(source)?.label ?? (source || "Chưa phân loại lỗi AI");
}

function errorOriginForFaq(faq: Faq): "ai" | "staff" | "system" {
  const proposer = faq.proposer.toLocaleLowerCase("vi-VN");
  if (proposer.includes("ai") || proposer.includes("tự động")) return "ai";
  if (proposer.includes("hệ thống")) return "system";
  return "staff";
}

function matchesTimePeriod(dateValue: string, period: string) {
  if (period === "Tất cả" || period === "Tùy chỉnh") return true;
  if (!dateValue) return false;

  const itemDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(itemDate.getTime())) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

  if (period === "Hôm nay") {
    return itemDay.getTime() === today.getTime();
  }

  if (period === "7 ngày qua" || period === "30 ngày qua") {
    const days = period === "7 ngày qua" ? 7 : 30;
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return itemDay >= start && itemDay <= today;
  }

  if (period === "Tháng này") {
    return itemDay.getFullYear() === today.getFullYear() && itemDay.getMonth() === today.getMonth();
  }

  return true;
}

export function FAQ() {
  const { role, user } = useAuth();
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const currentUserName = role === "manager" ? "Admin FLIC" : user?.name || "Nhân viên";
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFaqs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await getSheetChatbotRows({ page: 1, pageSize: 500, role });
      setFaqs(response.data.map(mapSheetRowToFaq));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải FAQ từ database.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void loadFaqs();
  }, [loadFaqs]);

  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<Faq | null>(null);
  const [showEditSuggestModal, setShowEditSuggestModal] = useState(false);
  const [suggestedAnswer, setSuggestedAnswer] = useState("");
  const [suggestionReason, setSuggestionReason] = useState("");

  // Filters state
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [filterTopic, setFilterTopic] = useState("Tất cả");
  const [filterRisk, setFilterRisk] = useState("Tất cả");
  const [filterStatus, setFilterStatus] = useState("Tất cả");
  const [filterTime, setFilterTime] = useState("30 ngày qua");

  // Admin Tạo FAQ form state
  const [faqForm, setFaqForm] = useState(emptyFaqForm);

  const filtered = faqs.filter(
    (f) => {
      const matchSearch = f.question.toLowerCase().includes(search.toLowerCase()) || f.topic.toLowerCase().includes(search.toLowerCase());
      const matchTopic = filterTopic === "Tất cả" || f.topic === filterTopic;
      const matchRisk = filterRisk === "Tất cả" || f.riskLevel === filterRisk;
      const matchStatus = filterStatus === "Tất cả" || f.status === filterStatus;
      const matchTime = matchesTimePeriod(f.date, filterTime);
      return matchSearch && matchTopic && matchRisk && matchStatus && matchTime;
    }
  );

  const handleApproveFaq = async (faq: Faq) => {
    try {
      await updateSheetChatbotStatus(faq.id, "Đã duyệt", currentUserName);
      await loadFaqs();
      toast.success("Đã duyệt FAQ trong database");
      if (selectedFaq?.id === faq.id) {
        setShowDetailModal(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể duyệt FAQ");
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!selectedFaq) return;
    if (!suggestedAnswer.trim()) {
      toast.error("Vui lòng nhập câu trả lời đề xuất");
      return;
    }

    try {
      await createSheetChatbotRow({
        question: selectedFaq.question,
        correctAnswer: suggestedAnswer.trim(),
        topic: selectedFaq.topic,
        source: getAiFailureDefinition(selectedFaq.source)?.apiValue ?? FAQ_SOURCES[0],
        risk: selectedFaq.riskLevel as "Thấp" | "Trung bình" | "Cao",
        status: "Chờ xử lý",
        notes: [
          `Đề xuất chỉnh sửa cho ${selectedFaq.id}.`,
          `Câu trả lời liên quan: ${selectedFaq.answer || "Chưa có câu trả lời."}`,
          suggestionReason.trim() ? `Lý do đề xuất: ${suggestionReason.trim()}` : "Lý do đề xuất: Chưa cung cấp.",
        ].join("\n"),
        addedBy: currentUserName,
      });
      await loadFaqs();
      toast.success("Đã gửi đề xuất chỉnh sửa vào database");
      setSuggestedAnswer("");
      setSuggestionReason("");
      setShowEditSuggestModal(false);
      setShowDetailModal(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi đề xuất chỉnh sửa");
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setEditingFaqId(null);
    setFaqForm(emptyFaqForm);
  };

  const statusStyle = (status: string) => {
    if (status === "Đã duyệt") return { color: "#228A61" };
    if (status === "Chờ xử lý") return { color: AMBER_TEXT };
    return { color: RED_TEXT };
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "Đã duyệt") return <CheckCircle2 size={12} />;
    if (status === "Chờ xử lý") return <Clock size={12} />;
    return <XCircle size={12} />;
  };

  const fieldStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(0,56,101,0.12)",
    outline: "none",
    fontSize: "13px",
    color: NAVY,
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: NAVY,
    marginBottom: "6px",
  };

  const handleResetFilters = () => {
    setFilterTopic("Tất cả");
    setFilterRisk("Tất cả");
    setFilterStatus("Tất cả");
    setFilterTime("30 ngày qua");
    toast.info("Đã đặt lại bộ lọc");
  };

  const SelectField = ({ label, value, options, onChange, style, groups }: { label: string; value: string; options?: string[]; onChange: (v: string) => void; style?: React.CSSProperties, groups?: { label: string, options: string[] }[] }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", ...style }}>
      <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.05em" }}>
        {label.toUpperCase()}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1.5px solid rgba(0,56,101,0.12)",
          fontSize: "13px",
          color: NAVY,
          backgroundColor: "#fff",
          cursor: "pointer",
          outline: "none",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23003865' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          paddingRight: "28px",
        }}
      >
        <option value="Tất cả">Tất cả</option>
        {groups ? groups.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map(o => <option key={o} value={o}>{o}</option>)}
          </optgroup>
        )) : options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ padding: "24px", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>FAQ</h1>
          <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)" }}>
            {role === "manager" ? "Quản lý và duyệt câu hỏi thường gặp" : "Xem và đề xuất câu hỏi thường gặp"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fff", borderRadius: "10px", padding: "8px 14px", border: "1px solid rgba(0,56,101,0.1)", width: "260px" }}>
            <Search size={16} style={{ color: "rgba(0,56,101,0.4)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo câu hỏi..."
              style={{ border: "none", outline: "none", fontSize: "13px", color: NAVY, width: "100%", background: "transparent" }}
            />
          </div>
          {role === "manager" && (
            <button
              onClick={() => { setFaqForm(emptyFaqForm); setEditingFaqId(null); setShowCreateModal(true); }}
              style={{ padding: "9px 18px", borderRadius: "10px", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}
            >
              <Plus size={16} /> Tạo FAQ
            </button>
          )}
        </div>
      </div>

      {/* Sticky Filter Panel */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          border: "1px solid rgba(0,56,101,0.08)",
          boxShadow: "0 2px 8px rgba(0,56,101,0.05)",
          marginBottom: "20px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            cursor: "pointer",
            borderBottom: isFilterExpanded ? "1px solid rgba(0,56,101,0.06)" : "none",
          }}
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={15} style={{ color: ORANGE }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>Bộ lọc FAQ</span>
          </div>
          <span style={{ fontSize: "11px", color: "rgba(0,56,101,0.4)" }}>Tự động cập nhật khi thay đổi bộ lọc</span>
        </div>

        {isFilterExpanded && (
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", alignItems: "end" }}>
              <SelectField
                label="Chủ đề"
                value={filterTopic}
                onChange={setFilterTopic}
                groups={[
                  { label: "Chương trình Ngoại ngữ", options: FAQ_TOPICS_LANGUAGE },
                  { label: "Chương trình Tin học", options: FAQ_TOPICS_COMPUTER }
                ]}
              />
              <SelectField
                label="Mức độ rủi ro"
                value={filterRisk}
                options={RISK_LEVELS}
                onChange={setFilterRisk}
              />
              <SelectField
                label="Trạng thái"
                value={filterStatus}
                options={FAQ_STATUSES}
                onChange={setFilterStatus}
              />
              <SelectField
                label="Khoảng thời gian"
                value={filterTime}
                options={TIME_PERIODS}
                onChange={setFilterTime}
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,56,101,0.08)", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                {["CÂU HỎI", "CHỦ ĐỀ", "RỦI RO", "NGUỒN", "TRẠNG THÁI", "HÀNH ĐỘNG"].map((h) => (
                  <th key={h} style={{ padding: "13px 18px", fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.55)", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} style={{ padding: "36px", textAlign: "center", color: "rgba(0,56,101,0.5)", fontSize: "13px" }}>Đang tải FAQ từ database...</td>
                </tr>
              )}
              {!isLoading && loadError && (
                <tr>
                  <td colSpan={6} style={{ padding: "36px", textAlign: "center", color: RED_TEXT, fontSize: "13px" }}>{loadError}</td>
                </tr>
              )}
              {!isLoading && !loadError && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "36px", textAlign: "center", color: "rgba(0,56,101,0.5)", fontSize: "13px" }}>Database chưa có FAQ phù hợp với bộ lọc hiện tại.</td>
                </tr>
              )}
              {!isLoading && !loadError && filtered.map((faq) => (
                <tr key={faq.id} style={{ borderBottom: "1px solid rgba(0,56,101,0.04)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  onClick={() => {
                    setSelectedFaq(faq);
                    setShowDetailModal(true);
                  }}
                >
                  <td style={{ padding: "14px 18px", maxWidth: "250px" }}>
                    <div style={{ fontWeight: 600, color: NAVY, fontSize: "13px", lineHeight: 1.4 }}>{faq.question}</div>
                    {faq.answer && <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" }}>{faq.answer}</div>}
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6", fontWeight: 600 }}>{faq.topic}</span>
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "20px", backgroundColor: faq.riskLevel === "Cao" ? RED_50 : faq.riskLevel === "Trung bình" ? AMBER_50 : "#EAF8F1", color: faq.riskLevel === "Cao" ? RED_TEXT : faq.riskLevel === "Trung bình" ? AMBER_TEXT : "#228A61", fontWeight: 600 }}>{faq.riskLevel}</span>
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: "11px", color: "rgba(0,56,101,0.6)" }}>{faq.source}</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600, ...statusStyle(faq.status) }}>
                      <StatusIcon status={faq.status} /> {faq.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {role === "manager" ? (
                        <>
                          {faq.status !== "Đã duyệt" && (
                            <button onClick={(e) => {
                              e.stopPropagation();
                              void handleApproveFaq(faq);
                            }} style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#228A61", cursor: "pointer", fontWeight: 600, fontSize: "11px" }}>Duyệt</button>
                          )}
                          <button onClick={(e) => {
                            e.stopPropagation();
                            setEditingFaqId(faq.id);
                            setFaqForm({ question: faq.question, answer: faq.answer, topic: faq.topic, source: faq.source, riskLevel: faq.riskLevel, notes: faq.notes, status: faq.status as SheetChatbotStatus });
                            setShowCreateModal(true);
                          }} style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "11px" }}>Chỉnh sửa</button>
                        </>
                      ) : (
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFaq(faq);
                          setShowDetailModal(true);
                        }} style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "11px" }}>Xem chi tiết</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin: Tạo FAQ Modal */}
      {showCreateModal && role === "manager" && (
        <FeedbackFormDialog
          open
          mode={editingFaqId ? "edit" : "create"}
          editingId={editingFaqId ?? undefined}
          prefillData={{
            question: faqForm.question,
            answer: faqForm.answer,
            topic: faqForm.topic,
            source: faqForm.source,
            notes: faqForm.notes,
            risk: faqForm.riskLevel as "Thấp" | "Trung bình" | "Cao",
            status: faqForm.status,
          }}
          onClose={closeCreateModal}
          onSaved={async () => {
            await loadFaqs();
            setEditingFaqId(null);
            setFaqForm(emptyFaqForm);
          }}
        />
      )}

      {/* Xem chi tiết FAQ Modal */}
      {showDetailModal && selectedFaq && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "520px", borderRadius: "18px", padding: "28px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 700, color: NAVY, margin: 0 }}>Chi tiết FAQ</h3>
              <button onClick={() => setShowDetailModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Câu hỏi</label>
                <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", backgroundColor: "#f8fafc", fontSize: "13px", color: NAVY, lineHeight: 1.5 }}>{selectedFaq.question}</div>
              </div>
              <div>
                <label style={labelStyle}>Câu trả lời AI / Chính thức</label>
                <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", backgroundColor: "#f8fafc", fontSize: "13px", color: NAVY, lineHeight: 1.5, minHeight: "80px" }}>{selectedFaq.answer || <span style={{ color: "rgba(0,56,101,0.35)", fontStyle: "italic" }}>Chưa có câu trả lời</span>}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Chủ đề</label>
                  <div style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", backgroundColor: "#f8fafc", fontSize: "13px", color: NAVY }}>{selectedFaq.topic}</div>
                </div>
                <div>
                  <label style={labelStyle}>Trạng thái</label>
                  <div style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", backgroundColor: "#f8fafc", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", width: "100%", ...statusStyle(selectedFaq.status) }}>
                    <StatusIcon status={selectedFaq.status} /> {selectedFaq.status}
                  </div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Nguồn gốc lỗi sai</label>
                <div style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", backgroundColor: "#f8fafc", fontSize: "13px", color: NAVY, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <ErrorSourceBadge source={errorOriginForFaq(selectedFaq)} />
                  <span>{displayFailureSource(selectedFaq.source)}</span>
                </div>
              </div>
              {selectedFaq.notes && (
                <div>
                  <label style={labelStyle}>Ghi chú nội bộ</label>
                  <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", backgroundColor: "#fffbeb", fontSize: "13px", color: NAVY, lineHeight: 1.5 }}>{selectedFaq.notes}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
              <button onClick={() => setShowDetailModal(false)} style={{ padding: "9px 18px", borderRadius: "9px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Đóng</button>
              {role === "staff" ? (
                <>
                  <button onClick={() => { setSuggestedAnswer(selectedFaq.answer); setSuggestionReason(""); setShowEditSuggestModal(true); }} style={{ padding: "9px 18px", borderRadius: "9px", border: `1px solid ${ORANGE}`, background: "#fff", color: ORANGE, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Đề xuất chỉnh sửa</button>
                  <button onClick={() => { toast.info("FAQ này đã được lấy trực tiếp từ thư viện phản hồi trong database."); setShowDetailModal(false); }} style={{ padding: "9px 18px", borderRadius: "9px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px", boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}>Đã có trong thư viện phản hồi</button>
                </>
              ) : (
                <>
                  <button onClick={() => {
                    setEditingFaqId(selectedFaq.id);
                    setFaqForm({ question: selectedFaq.question, answer: selectedFaq.answer, topic: selectedFaq.topic, source: selectedFaq.source, riskLevel: selectedFaq.riskLevel, notes: selectedFaq.notes, status: selectedFaq.status as SheetChatbotStatus });
                    setShowDetailModal(false);
                    setShowCreateModal(true);
                  }} style={{ padding: "9px 18px", borderRadius: "9px", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Chỉnh sửa</button>
                  {selectedFaq.status !== "Đã duyệt" && (
                    <button onClick={() => {
                      void handleApproveFaq(selectedFaq);
                    }} style={{ padding: "9px 18px", borderRadius: "9px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px", boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}>Duyệt FAQ</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff: Đề xuất chỉnh sửa Modal */}
      {showEditSuggestModal && selectedFaq && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "480px", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Đề xuất chỉnh sửa</h3>
              <button onClick={() => setShowEditSuggestModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Câu hỏi gốc</label>
                <div style={{ padding: "9px 12px", borderRadius: "8px", backgroundColor: "#f8fafc", border: "1px solid rgba(0,56,101,0.08)", fontSize: "13px", color: "rgba(0,56,101,0.6)" }}>{selectedFaq.question}</div>
              </div>
              <div>
                <label style={labelStyle}>Câu trả lời đề xuất</label>
                <textarea value={suggestedAnswer} onChange={(e) => setSuggestedAnswer(e.target.value)} rows={4} placeholder="Nhập câu trả lời bạn đề xuất thay thế..." style={{ ...fieldStyle, resize: "none" }} />
              </div>
              <div>
                <label style={labelStyle}>Lý do chỉnh sửa</label>
                <input value={suggestionReason} onChange={(e) => setSuggestionReason(e.target.value)} placeholder="Lý do chỉnh sửa..." style={fieldStyle} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => setShowEditSuggestModal(false)} style={{ padding: "9px 18px", borderRadius: "9px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={() => { void handleSubmitSuggestion(); }} style={{ padding: "9px 18px", borderRadius: "9px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Gửi đề xuất</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
