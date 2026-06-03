import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Search, Filter, Bot, User, AlertTriangle, Send, CheckCircle, UserCheck, Plus, X, ChevronDown, Edit2, BookmarkX, MessageSquareWarning, FilePlus2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const NAVY    = "#003865";
const ORANGE  = "#D73C01";
const CTA     = "#ED5206";
const CTA_SOFT= "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const ORANGE_200= "#FBCBB8";
const AMBER_50  = "#FFF7E6";
const AMBER_TEXT= "#B7791F";
const RED_50    = "#FFF1F1";
const RED_TEXT  = "#B42318";

const conversations = [
  {
    id: "HT-2451",
    customer: "Sinh viên A",
    channel: "Zalo OA",
    topic: "Đăng ký thi CNTT Cơ bản",
    status: "Chờ xử lý",
    time: "14:25",
    lastMsg: "Em muốn đăng ký nhóm trên 3 bạn thì đăng ký thi như thế nào ạ?",
    unread: 2,
    sentiment: "neutral",
    waitTime: "2h 15p",
    aiStatus: "AI không chắc chắn",
    priority: "Ưu tiên cao"
  },
  {
    id: "HT-2449",
    customer: "Sinh viên B",
    channel: "Facebook",
    topic: "Chuẩn đầu ra ngoại ngữ",
    status: "Chờ quản lý xác nhận",
    time: "13:47",
    lastMsg: "Chuẩn đầu ra ngoại ngữ cần chứng chỉ gì ạ?",
    unread: 1,
    sentiment: "negative",
    waitTime: "11h 20p",
    aiStatus: "Cần kiểm duyệt",
    priority: "Ưu tiên cao"
  },
  {
    id: "HT-2445",
    customer: "Sinh viên C",
    channel: "Zalo Business",
    topic: "Lịch thi VSTEP",
    status: "Đang xử lý",
    time: "12:30",
    lastMsg: "Lịch thi VSTEP tháng này có chưa ạ?",
    unread: 0,
    sentiment: "neutral",
    waitTime: "45p",
    aiStatus: "AI trả lời thành công",
    priority: "Ưu tiên trung bình"
  },
  {
    id: "HT-2440",
    customer: "Sinh viên D",
    channel: "Chat Widget",
    topic: "Quên mật khẩu khóa học",
    status: "Hoàn thành",
    time: "10:15",
    lastMsg: "Em quên mật khẩu khóa học Tin học Cơ bản thì lấy lại thế nào?",
    unread: 0,
    sentiment: "positive",
    waitTime: "8p",
    aiStatus: "AI trả lời thành công",
    priority: "Ưu tiên thấp"
  }
];

const chatMessages = [
  { id: 1, role: "user", text: "Xin chào, em muốn hỏi đăng ký thi nhóm", time: "14:20" },
  { id: 2, role: "bot", text: "Chào bạn, hiện tại trung tâm có hỗ trợ đăng ký thi cá nhân qua website. Bạn có thể truy cập...", time: "14:20", aiConfidence: 0.85 },
  { id: 3, role: "user", text: "Em muốn đăng ký nhóm trên 3 bạn thì đăng ký thi như thế nào ạ?", time: "14:22" },
  { id: 4, role: "bot", text: "Với đăng ký nhóm trên 3 bạn, tôi chưa có thông tin chính thức về quy trình gộp nhóm hay ưu đãi. Xin vui lòng đợi nhân viên hỗ trợ.", time: "14:22", aiConfidence: 0.35, isUncertain: true },
  { id: 6, role: "bot", text: "Tôi xin lỗi vì thông tin không đầy đủ. Tôi đã chuyển hội thoại này cho quản lý để được hỗ trợ tốt hơn.", time: "14:24", aiConfidence: 0.35, isUncertain: true },
  { id: 7, role: "user", text: "Tôi muốn biết lệ phí thi TOEIC 2025 là bao nhiêu?", time: "14:25" },
];

const statusConfig: Record<string, { bg: string; color: string }> = {
  "Chờ quản lý xác nhận": { bg: ORANGE_50, color: ORANGE },
  "Chờ xử lý":            { bg: AMBER_50,  color: AMBER_TEXT },
  "Đang xử lý":          { bg: "#dbeafe", color: "#3b82f6" },
  "Hoàn thành":           { bg: "#EAF8F1", color: "#228A61" },
};

const sentimentIcon: Record<string, { color: string; char: string }> = {
  positive: { color: "#228A61", char: "😊" },
  neutral:  { color: AMBER_TEXT, char: "😐" },
  negative: { color: RED_TEXT,  char: "😞" },
};

function highlightText(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ backgroundColor: "#fef08a", color: NAVY, borderRadius: "2px", padding: "0 1px" }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

const allStatuses = ["Tất cả", "Chờ xử lý", "Đang xử lý", "Chờ quản lý xác nhận", "Hoàn thành"];
const allChannels = ["Tất cả", "Zalo Business", "Facebook", "Zalo OA", "Chat Widget"];
const allTopics = ["Tất cả", "TOEIC", "VSTEP", "Chuẩn đầu ra", "Tin học", "MOS/IC3", "Lệ phí", "Lịch thi", "Tra cứu điểm"];

export function ConversationDetail({ mode = "conversation" }: { mode?: string }) {
  const { role } = useAuth();
  const [selectedConv, setSelectedConv] = useState(conversations[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [activeStatus, setActiveStatus] = useState("Tất cả");
  const [activeChannel, setActiveChannel] = useState("Tất cả");
  const [activeTopic, setActiveTopic] = useState("Tất cả");
  const [showFilters, setShowFilters] = useState(false);
  const [activeDateFilter, setActiveDateFilter] = useState("Tuần");

  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const [showAIErrorModal, setShowAIErrorModal] = useState(false);
  const [aiErrorReason, setAiErrorReason] = useState("");
  const [aiErrorNote, setAiErrorNote] = useState("");

  const filtered = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || c.customer.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q) || c.lastMsg.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    const matchStatus = activeStatus === "Tất cả" || c.status === activeStatus;
    const matchChannel = activeChannel === "Tất cả" || c.channel === activeChannel;
    const matchTopic = activeTopic === "Tất cả" || c.topic === activeTopic;
    return matchSearch && matchStatus && matchChannel && matchTopic;
  });

  // Styles per mode
  const getContainerStyle = () => {
    if (mode === "todo") return { backgroundColor: "#fff5f0" };
    if (mode === "ai_intervention") return { background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", color: "#e2e8f0" };
    return { backgroundColor: "#fafbfc" }; // default / conversation
  };

  const getListStyle = () => {
    if (mode === "todo") return { borderRight: `1px solid ${ORANGE}40`, backgroundColor: "#fff9f5" };
    if (mode === "ai_intervention") return { borderRight: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(15,23,42,0.6)" };
    return { borderRight: "1px solid rgba(0,56,101,0.08)", backgroundColor: "#fafbfc" }; // default
  };

  const getCardStyle = (isActive: boolean) => {
    if (mode === "todo") {
      return {
        padding: "16px", cursor: "pointer", borderBottom: `1px solid ${ORANGE}20`,
        backgroundColor: isActive ? "#ffeee6" : "transparent",
        borderLeft: isActive ? `3px solid ${ORANGE}` : "3px solid transparent",
        transition: "all 0.15s",
      };
    }
    if (mode === "ai_intervention") {
      return {
        padding: "16px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)",
        backgroundColor: isActive ? "rgba(215,60,1,0.15)" : "transparent",
        borderLeft: isActive ? `3px solid ${ORANGE}` : "3px solid transparent",
        transition: "all 0.15s",
      };
    }
    return {
      padding: "16px", cursor: "pointer", borderBottom: "1px solid rgba(0,56,101,0.05)",
      backgroundColor: isActive ? "#fff" : "transparent",
      borderLeft: isActive ? `3px solid ${NAVY}` : "3px solid transparent",
      boxShadow: isActive ? "0 2px 8px rgba(0,56,101,0.04)" : "none",
      transition: "all 0.15s",
    };
  };

  const getTextNavy = () => mode === "ai_intervention" ? "#fff" : NAVY;
  const getTextMuted = () => mode === "ai_intervention" ? "rgba(255,255,255,0.6)" : "rgba(0,56,101,0.6)";

  return (
    <div style={{ display: "flex", height: "calc(100vh - 72px)", overflow: "hidden", ...getContainerStyle() }}>
      {/* Left: Conversation List */}
      <div style={{ width: "360px", flexShrink: 0, display: "flex", flexDirection: "column", ...getListStyle() }}>

        {/* Search + Filter Toggle */}
        <div style={{ padding: "14px 14px 0" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fff", borderRadius: "10px", padding: "8px 12px", border: "1px solid rgba(0,56,101,0.1)" }}>
              <Search size={14} style={{ color: "rgba(0,56,101,0.4)" }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nội dung, keyword, khách hàng..."
                style={{ border: "none", outline: "none", fontSize: "12px", color: NAVY, flex: 1, background: "transparent" }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  <X size={13} style={{ color: "rgba(0,56,101,0.4)" }} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{ padding: "0 10px", borderRadius: "10px", border: showFilters ? `1.5px solid ${ORANGE}` : "1px solid rgba(0,56,101,0.1)", background: showFilters ? "#fff3ef" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", color: showFilters ? ORANGE : "rgba(0,56,101,0.5)", fontSize: "12px" }}
            >
              <Filter size={13} /> <ChevronDown size={11} />
            </button>
          </div>

          {/* Result Count */}
          {searchQuery && (
            <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)", marginBottom: "8px" }}>
              <span style={{ color: ORANGE, fontWeight: 700 }}>{filtered.length}</span> kết quả cho "{searchQuery}"
            </div>
          )}

          {/* Date Filter */}
          <div style={{ display: "flex", gap: "4px", marginBottom: showFilters ? "8px" : "10px" }}>
            {["Ngày", "Tuần", "Tháng"].map((d) => (
              <button
                key={d}
                onClick={() => setActiveDateFilter(d)}
                style={{ padding: "4px 10px", borderRadius: "20px", border: activeDateFilter === d ? `1.5px solid ${ORANGE}` : "1px solid rgba(0,56,101,0.12)", background: activeDateFilter === d ? "#fff3ef" : "#fff", color: activeDateFilter === d ? ORANGE : "rgba(0,56,101,0.6)", cursor: "pointer", fontSize: "11px", fontWeight: activeDateFilter === d ? 600 : 400, transition: "all 0.15s" }}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid rgba(0,56,101,0.1)", padding: "12px", marginBottom: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "rgba(0,56,101,0.45)", letterSpacing: "0.05em", marginBottom: "5px" }}>TRẠNG THÁI</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {allStatuses.map((s) => (
                    <button key={s} onClick={() => setActiveStatus(s)}
                      style={{ padding: "3px 9px", borderRadius: "20px", border: activeStatus === s ? `1.5px solid ${ORANGE}` : "1px solid rgba(0,56,101,0.12)", background: activeStatus === s ? "#fff3ef" : "#f8fafc", color: activeStatus === s ? ORANGE : "rgba(0,56,101,0.6)", cursor: "pointer", fontSize: "10px", fontWeight: activeStatus === s ? 600 : 400 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "rgba(0,56,101,0.45)", letterSpacing: "0.05em", marginBottom: "5px" }}>KÊNH</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {allChannels.map((ch) => (
                    <button key={ch} onClick={() => setActiveChannel(ch)}
                      style={{ padding: "3px 9px", borderRadius: "20px", border: activeChannel === ch ? `1.5px solid ${NAVY}` : "1px solid rgba(0,56,101,0.12)", background: activeChannel === ch ? `${NAVY}10` : "#f8fafc", color: activeChannel === ch ? NAVY : "rgba(0,56,101,0.6)", cursor: "pointer", fontSize: "10px", fontWeight: activeChannel === ch ? 600 : 400 }}>
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "rgba(0,56,101,0.45)", letterSpacing: "0.05em", marginBottom: "5px" }}>CHỦ ĐỀ</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {allTopics.map((t) => (
                    <button key={t} onClick={() => setActiveTopic(t)}
                      style={{ padding: "3px 9px", borderRadius: "20px", border: activeTopic === t ? `1.5px solid #3b82f6` : "1px solid rgba(0,56,101,0.12)", background: activeTopic === t ? "#eff6ff" : "#f8fafc", color: activeTopic === t ? "#3b82f6" : "rgba(0,56,101,0.6)", cursor: "pointer", fontSize: "10px", fontWeight: activeTopic === t ? 600 : 400 }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Status Pills */}
          {!showFilters && (
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "10px" }}>
              {["Tất cả", "Chờ xử lý", "Chờ quản lý xác nhận"].map((s) => (
                <button key={s} onClick={() => setActiveStatus(s)}
                  style={{ padding: "4px 10px", borderRadius: "20px", border: activeStatus === s ? `1.5px solid ${ORANGE}` : "1px solid rgba(0,56,101,0.12)", background: activeStatus === s ? "#fff3ef" : "#fff", color: activeStatus === s ? ORANGE : "rgba(0,56,101,0.6)", cursor: "pointer", fontSize: "10px", fontWeight: activeStatus === s ? 600 : 400, transition: "all 0.15s" }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation Items */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "rgba(0,56,101,0.4)", fontSize: "13px" }}>
              Không tìm thấy hội thoại nào
            </div>
          ) : (
            filtered.map((conv) => {
              const isSelected = selectedConv.id === conv.id;
              const si = sentimentIcon[conv.sentiment];
              const ss = statusConfig[conv.status] || { bg: "#f1f5f9", color: "#64748b" };
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  style={{
                    padding: "12px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(0,56,101,0.05)",
                    backgroundColor: isSelected ? "#fff3ef" : "transparent",
                    borderLeft: isSelected ? `3px solid ${ORANGE}` : "3px solid transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f5f7fa"; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontWeight: 600, fontSize: "13px", color: NAVY }}>{conv.customer}</span>
                    <span style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)" }}>{conv.time}</span>
                  </div>
                  <div style={{ display: "flex", gap: "5px", marginBottom: "5px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{conv.channel}</span>
                    <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "rgba(0,56,101,0.6)" }}>{conv.topic}</span>
                    <span style={{ fontSize: "11px" }}>{si.char}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {highlightText(conv.lastMsg, searchQuery)}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: ss.bg, color: ss.color, fontWeight: 500 }}>{conv.status}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {conv.waitTime !== "-" && (
                        <span style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)" }}>⏱ {conv.waitTime}</span>
                      )}
                      {conv.unread > 0 && (
                        <span style={{ fontSize: "10px", backgroundColor: ORANGE, color: "#fff", borderRadius: "20px", padding: "1px 6px", fontWeight: 700 }}>{conv.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(0,56,101,0.06)", fontSize: "11px", color: "rgba(0,56,101,0.4)", textAlign: "center" }}>
          {filtered.length}/{conversations.length} hội thoại
        </div>
      </div>

      {/* Right: Chat Detail */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
        {/* Chat Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,56,101,0.08)", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "15px", color: NAVY }}>{selectedConv.customer}</div>
            <div style={{ display: "flex", gap: "8px", marginTop: "2px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{selectedConv.channel}</span>
              <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "rgba(0,56,101,0.6)" }}>{selectedConv.topic}</span>
              <span style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)", fontFamily: "monospace" }}>{selectedConv.id}</span>
              <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "20px", backgroundColor: statusConfig[selectedConv.status]?.bg || "#f1f5f9", color: statusConfig[selectedConv.status]?.color || "#64748b", fontWeight: 600 }}>{selectedConv.status}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {role === "manager" ? (
              <>
                <button onClick={() => toast.success("Đã duyệt hội thoại")} style={{ padding: "7px 13px", borderRadius: "8px", border: "none", background: "#228A61", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <CheckCircle size={12} /> Duyệt
                </button>
                <button onClick={() => toast.error("Đã từ chối hội thoại")} style={{ padding: "7px 13px", borderRadius: "8px", border: `1px solid ${ORANGE}30`, background: "#fff5f5", color: ORANGE, cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <X size={12} /> Từ chối
                </button>
                <button onClick={() => toast.info("Đã yêu cầu chỉnh sửa")} style={{ padding: "7px 13px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <Edit2 size={12} /> Yêu cầu chỉnh sửa
                </button>
                <button onClick={() => toast.success("Đã thêm vào FAQ")} style={{ padding: "7px 13px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <Plus size={12} /> Thêm vào FAQ
                </button>
                <button onClick={() => toast.success("Đã cập nhật Sheet Chatbot")} style={{ padding: "7px 13px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <FilePlus2 size={12} /> Thêm vào Sheet Chatbot
                </button>
                <button onClick={() => setShowAIErrorModal(true)} style={{ padding: "7px 13px", borderRadius: "8px", border: `1px solid ${ORANGE}30`, background: "#fff5f5", color: ORANGE, cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <BookmarkX size={12} /> Đánh dấu AI sai
                </button>
                <button onClick={() => toast.success("Đã đánh dấu hoàn thành")} style={{ padding: "7px 13px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, ${ORANGE}, #ED5206)`, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <CheckCircle2 size={12} /> Đánh dấu đã xử lý
                </button>
              </>
            ) : (
              <>
                <button onClick={() => toast.success("Đã đánh dấu cần xử lý")} style={{ padding: "7px 13px", borderRadius: "8px", border: `1px solid ${ORANGE}30`, background: "#fff5f5", color: ORANGE, cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <AlertTriangle size={12} /> Đánh dấu cần xử lý
                </button>
                <button onClick={() => toast.success("Đã gửi hội thoại cho quản lý kiểm duyệt")} style={{ padding: "7px 13px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <UserCheck size={12} /> Chuyển quản lý kiểm duyệt
                </button>
                <button onClick={() => toast.success("Đã thêm vào FAQ đề xuất")} style={{ padding: "7px 13px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, ${ORANGE}, #ED5206)`, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <Plus size={12} /> Thêm vào FAQ
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chat Timeline */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#f8fafc" }}>
          {chatMessages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "10px", alignItems: "flex-start" }}>
              <div style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: msg.role === "bot" ? `linear-gradient(135deg, ${NAVY}, #1565C0)` : `linear-gradient(135deg, #64748b, #94a3b8)`,
              }}>
                {msg.role === "bot" ? <Bot size={14} style={{ color: "#fff" }} /> : <User size={14} style={{ color: "#fff" }} />}
              </div>
              <div style={{ maxWidth: "60%" }}>
                {/* Uncertain AI message banner — softer warning */}
                {(msg as any).isUncertain && (
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "6px", padding: "8px 12px", borderRadius: "10px", backgroundColor: ORANGE_50, border: `1px solid ${ORANGE_200}` }}>
                    <AlertTriangle size={13} style={{ color: ORANGE, flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", color: ORANGE, fontWeight: 600, lineHeight: 1.4 }}>Thông tin do AI tạo ra. Vui lòng kiểm tra trước khi phản hồi.</span>
                  </div>
                )}
                <div style={{
                  padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  backgroundColor: (msg as any).isUncertain ? "#fff8f7" : msg.role === "user" ? NAVY : mode === "ai_intervention" ? "rgba(255,255,255,0.05)" : "#fff",
                  color: msg.role === "user" ? "#fff" : getTextNavy(),
                  fontSize: "13px",
                  lineHeight: 1.6,
                  boxShadow: mode === "ai_intervention" ? "none" : "0 2px 8px rgba(0,56,101,0.08)",
                  border: (msg as any).isUncertain ? `1.5px solid ${ORANGE}40` : mode === "ai_intervention" && msg.role === "bot" ? "1px solid rgba(255,255,255,0.1)" : "none",
                  whiteSpace: "pre-line",
                }}>
                  {msg.text}
                </div>
                {msg.role === "bot" && (msg as any).aiConfidence && !(msg as any).isUncertain && (
                  <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle size={10} style={{ color: "#228A61" }} />
                    <span style={{ fontSize: "10px", color: "#228A61" }}>Mức độ tin cậy: {((msg as any).aiConfidence * 100).toFixed(0)}%</span>
                  </div>
                )}
                <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.35)", marginTop: "3px", textAlign: msg.role === "user" ? "right" : "left" }}>{msg.time}</div>

                {/* Cụm Can thiệp AI cho nhân viên */}
                {role === "staff" && msg.role === "bot" && (msg as any).isUncertain && (
                  <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap", flexDirection: "column" }}>
                    {editingMessageId === msg.id ? (
                      <div style={{ padding: "12px", backgroundColor: "#fff", borderRadius: "8px", border: `1px solid ${NAVY}30` }}>
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px", outline: "none", resize: "none", boxSizing: "border-box", marginBottom: "8px" }}
                        />
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button onClick={() => setEditingMessageId(null)} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 500 }}>Hủy</button>
                          <button onClick={() => { toast.success("Đã gửi phản hồi đã chỉnh sửa cho khách hàng"); setEditingMessageId(null); }} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "6px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}><Send size={10}/> Gửi khách hàng</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button onClick={() => { setEditingMessageId(msg.id); setEditingText(msg.text); }} style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "6px", border: `1px solid ${NAVY}30`, background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}><Edit2 size={12}/> Sửa câu trả lời</button>
                        <button onClick={() => setShowAIErrorModal(true)} style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "6px", border: `1px solid ${ORANGE}30`, background: "#fff5f5", color: ORANGE, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}><X size={12}/> Đánh dấu AI sai</button>
                        <button onClick={() => toast.success("Đã gửi hội thoại cho quản lý kiểm duyệt")} style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "6px", border: `1px solid ${NAVY}30`, background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}><UserCheck size={12}/> Chuyển quản lý kiểm duyệt</button>
                        <button onClick={() => toast.success("Đã mở modal đề xuất FAQ")} style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "6px", border: `1px solid ${NAVY}30`, background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}><FilePlus2 size={12}/> Đề xuất FAQ</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Reply Box */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(0,56,101,0.08)", display: "flex", gap: "10px", alignItems: "flex-end", backgroundColor: "#fff" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)", marginBottom: "4px", fontWeight: 600, letterSpacing: "0.04em" }}>GHI CHÚ NỘI BỘ</div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Nhập ghi chú hoặc phản hồi cho quản lý..."
              rows={2}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1.5px solid rgba(0,56,101,0.12)",
                fontSize: "13px",
                color: NAVY,
                outline: "none",
                resize: "none",
                boxSizing: "border-box",
                backgroundColor: "#f8fafc",
              }}
            />
          </div>
          <button
            onClick={() => { if (replyText) { toast.success("Đã gửi ghi chú"); setReplyText(""); } }}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              border: "none",
              background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(237,82,6,0.18)",
              flexShrink: 0,
            }}
          >
            <Send size={16} style={{ color: "#fff" }} />
          </button>
        </div>

        {showAIErrorModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ backgroundColor: "#fff", width: "400px", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Ghi nhận lỗi AI</h3>
                <button onClick={() => setShowAIErrorModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Lý do lỗi</label>
                <select value={aiErrorReason} onChange={(e) => setAiErrorReason(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px" }}>
                  <option value="">Chọn lý do...</option>
                  <option value="AI trả lời sai">AI trả lời sai</option>
                  <option value="Không tìm thấy dữ liệu">Không tìm thấy dữ liệu</option>
                  <option value="Không hiểu câu hỏi">Không hiểu câu hỏi</option>
                  <option value="AI không chắc chắn">AI không chắc chắn</option>
                  <option value="AI có nguy cơ tự tạo thông tin">AI có nguy cơ tự tạo thông tin</option>
                </select>
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Ghi chú thêm</label>
                <textarea value={aiErrorNote} onChange={(e) => setAiErrorNote(e.target.value)} rows={3} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", resize: "none" }} placeholder="Mô tả chi tiết lỗi để admin dễ kiểm tra..." />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button onClick={() => setShowAIErrorModal(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
                <button onClick={() => { toast.success("Đã ghi nhận lỗi AI"); setShowAIErrorModal(false); }} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px", boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}>Xác nhận lỗi</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
