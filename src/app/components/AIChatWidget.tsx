import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, Sparkles, Minimize2, Maximize2 } from "lucide-react";

// ── Color tokens ──────────────────────────────────────────────────
const NAVY   = "#003865";
const ORANGE = "#D73C01";  // brand anchor — kept but used sparingly
const CTA    = "#ED5206";
const CTA_SOFT = "#F36C2E";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
  time: string;
}

const aiResponses: Record<string, string> = {
  default: "Tôi có thể giúp bạn phân tích dữ liệu từ hệ thống FLIC. Hãy hỏi tôi về KPI, xu hướng hội thoại, phân tích từ khóa, hoặc hiệu suất AI.",
  kpi: "📊 **Tóm tắt KPI hôm nay:**\n• Tổng hội thoại: 1,247 (+12%)\n• AI trả lời thành công: 89.3% (↑ 2.1%)\n• Hội thoại chờ quản lý: 18 (cần xử lý)\n• Tỷ lệ hài lòng: 87% (ổn định)\n\nChủ đề nổi bật: TOEIC (+34%), Lịch thi (+28%)",
  faq: "💡 **Phân tích FAQ thiếu:**\n1. 'Lệ phí thi TOEIC 2025 là bao nhiêu?' - 47 lần hỏi\n2. 'Khi nào có lịch thi VSTEP tháng 3?' - 38 lần\n3. 'Chứng chỉ MOS có thay thế IC3 không?' - 29 lần\n\nGợi ý: Cần bổ sung 3 câu hỏi này vào cơ sở tri thức ngay hôm nay.",
  sentiment: "😊 **Phân tích cảm xúc 7 ngày qua:**\n• Tích cực: 64% (↑ 3%)\n• Trung lập: 22%\n• Tiêu cực: 14% (↓ 2%)\n\nCảnh báo: Cảm xúc tiêu cực tập trung ở chủ đề 'Lệ phí thi' và 'Tra cứu điểm'.",
  keyword: "🔍 **Xu hướng từ khóa tuần này:**\n• Tăng mạnh: 'lịch thi VSTEP', 'đăng ký TOEIC', 'học bổng chuẩn đầu ra'\n• Giảm: 'hoàn phí', 'khiếu nại'\n\nDự báo: Tuần tới từ khóa 'lịch thi' sẽ tăng 40% do gần kỳ thi.",
  hallucination: "⚠️ **Phân tích AI tự tạo thông tin:**\n• Tỷ lệ tự tạo thông tin: 6.2% (trên ngưỡng 5%)\n• Chủ đề hay xảy ra: 'Chuẩn đầu ra', 'Lệ phí đặc biệt'\n• Top câu hỏi AI trả lời sai: 12 câu\n\nKhuyến nghị: Cần xem lại cơ sở tri thức cho chủ đề Chuẩn đầu ra.",
  prediction: "🔮 **Dự báo 7 ngày tới:**\n• Lượng hội thoại sẽ tăng ~18% do gần kỳ thi\n• Chủ đề dự kiến hot: TOEIC, VSTEP, Lịch thi\n• Tỷ lệ AI thất bại có thể tăng nếu không cập nhật FAQ\n\nHành động đề xuất: Chuẩn bị thêm nhân sự quản lý và cập nhật cơ sở tri thức.",
};

const suggestions = [
  "Tóm tắt KPI hôm nay",
  "Phân tích FAQ còn thiếu",
  "Xu hướng từ khóa tuần này",
  "Tỷ lệ AI tự tạo thông tin",
  "Dự báo 7 ngày tới",
  "Phân tích cảm xúc",
];

function getAIResponse(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("kpi") || t.includes("tóm tắt") || t.includes("tổng quan")) return aiResponses.kpi;
  if (t.includes("faq") || t.includes("câu hỏi")) return aiResponses.faq;
  if (t.includes("sentiment") || t.includes("cảm xúc")) return aiResponses.sentiment;
  if (t.includes("keyword") || t.includes("từ khóa")) return aiResponses.keyword;
  if (t.includes("hallucination") || t.includes("sai")) return aiResponses.hallucination;
  if (t.includes("dự báo") || t.includes("prediction") || t.includes("tương lai")) return aiResponses.prediction;
  return aiResponses.default;
}

function getTime() {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "ai",
      text: "Xin chào! Tôi là **FLIC AI Assistant** 👋\n\nTôi có thể giúp bạn phân tích:\n• KPI và số liệu dashboard\n• Xu hướng hội thoại & keyword\n• Hiệu suất AI chatbot\n• Phân tích cảm xúc\n• Dự báo và khuyến nghị",
      time: getTime(),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now(), role: "user", text, time: getTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const aiText = getAIResponse(text);
      const aiMsg: Message = { id: Date.now() + 1, role: "ai", text: aiText, time: getTime() };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200 + Math.random() * 600);
  };

  const formatText = (text: string) => {
    return text.split("\n").map((line, i) => {
      const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `<strong>${m}</strong>`);
      return <div key={i} style={{ lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: boldFormatted || "&nbsp;" }} />;
    });
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            /* Softened gradient — no #ff7630 */
            background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`,
            /* Reduced glow opacity */
            boxShadow: `0 4px 16px rgba(237,82,6,0.22), 0 0 0 0 rgba(237,82,6,0.18)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            animation: "glowPulse 2s infinite",
          }}
        >
          <Sparkles size={24} style={{ color: "#fff" }} />
          <style>{`
            @keyframes glowPulse {
              0%   { box-shadow: 0 4px 16px rgba(237,82,6,0.22), 0 0 0 0 rgba(237,82,6,0.18); }
              70%  { box-shadow: 0 4px 16px rgba(237,82,6,0.22), 0 0 0 12px rgba(237,82,6,0); }
              100% { box-shadow: 0 4px 16px rgba(237,82,6,0.22), 0 0 0 0 rgba(237,82,6,0); }
            }
            @keyframes typingDot {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            width: "420px",
            height: isMinimized ? "64px" : "580px",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 16px 48px rgba(0,56,101,0.18), 0 4px 12px rgba(237,82,6,0.08)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            border: "1px solid rgba(0,56,101,0.1)",
          }}
        >
          {/* Header — navy structure, subtle orange accent */}
          <div
            style={{
              background: `linear-gradient(135deg, ${NAVY} 0%, #1565C0 100%)`,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid rgba(255,255,255,0.25)",
              }}
            >
              <Bot size={18} style={{ color: "#fff" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>Trợ lý AI chính thức từ FLIC <Sparkles size={12} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#228A61", boxShadow: "0 0 4px #228A61" }} />
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "11px", fontWeight: 500 }}>Đang hoạt động</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{ width: "28px", height: "28px", borderRadius: "8px", border: "none", background: "rgba(0,0,0,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
              >
                {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{ width: "28px", height: "28px", borderRadius: "8px", border: "none", background: "rgba(0,0,0,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", gap: "12px" }}>
                {messages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "8px", alignItems: "flex-end" }}>
                    {msg.role === "ai" && (
                      /* Softened AI avatar — navy instead of full orange */
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: `linear-gradient(135deg, ${NAVY}, #1565C0)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Bot size={12} style={{ color: "#fff" }} />
                      </div>
                    )}
                    <div style={{ maxWidth: "75%" }}>
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          backgroundColor: msg.role === "user" ? NAVY : "#fff",
                          color: msg.role === "user" ? "#fff" : NAVY,
                          fontSize: "13px",
                          lineHeight: 1.5,
                          boxShadow: "0 2px 8px rgba(0,56,101,0.08)",
                          /* Softer border for AI messages */
                          border: msg.role === "ai" ? `1px solid rgba(237,82,6,0.12)` : "none"
                        }}
                      >
                        {formatText(msg.text)}
                      </div>
                      <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.35)", marginTop: "4px", textAlign: msg.role === "user" ? "right" : "left" }}>
                        {msg.time}
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: `linear-gradient(135deg, ${NAVY}, #1565C0)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bot size={12} style={{ color: "#fff" }} />
                    </div>
                    <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", backgroundColor: "#fff", boxShadow: "0 2px 8px rgba(0,56,101,0.08)", display: "flex", gap: "4px", alignItems: "center", border: `1px solid rgba(237,82,6,0.10)` }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: CTA, opacity: 0.5, animation: `typingDot 1.4s infinite ${i * 0.2}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions */}
              <div style={{ padding: "8px 16px", backgroundColor: "#f8fafc", borderTop: "1px solid rgba(0,56,101,0.06)", display: "flex", gap: "6px", overflowX: "auto", scrollbarWidth: "none" }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "20px",
                      border: `1px solid rgba(0,56,101,0.15)`,
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: "11px",
                      color: NAVY,
                      whiteSpace: "nowrap",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = CTA;
                      (e.currentTarget as HTMLButtonElement).style.color = CTA;
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFF4EE";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,56,101,0.15)";
                      (e.currentTarget as HTMLButtonElement).style.color = NAVY;
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fff";
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: "12px 16px", backgroundColor: "#fff", borderTop: "1px solid rgba(0,56,101,0.08)", display: "flex", gap: "8px" }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder="Hỏi AI về dữ liệu FLIC..."
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid rgba(0,56,101,0.12)",
                    fontSize: "13px",
                    color: NAVY,
                    outline: "none",
                    backgroundColor: "#f8fafc",
                  }}
                  onFocus={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = CTA}
                  onBlur={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0,56,101,0.12)"}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isTyping}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    border: "none",
                    /* Softened send button gradient */
                    background: input.trim() && !isTyping ? `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)` : "#e2e8f0",
                    cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                    flexShrink: 0,
                    /* Softer shadow */
                    boxShadow: input.trim() && !isTyping ? "0 4px 12px rgba(237,82,6,0.18)" : "none",
                  }}
                >
                  <Send size={16} style={{ color: input.trim() && !isTyping ? "#fff" : "rgba(0,56,101,0.3)" }} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
