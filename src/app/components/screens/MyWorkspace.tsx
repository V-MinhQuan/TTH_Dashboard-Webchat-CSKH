import { useState } from "react";
import { Search, Clock, CheckCircle, Target, Activity, MoreVertical, Send, FileText, Flag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { AddSheetModal } from "./SheetChatbot";

const NAVY        = "#003BB9";
const ORANGE      = "#D73C01";
const LIGHT_NAVY  = "#EBF2FF";
const AMBER_50    = "#FFF7E6";
const AMBER_TEXT  = "#B7791F";  // softer amber
const RED_50      = "#FFF1F1";
const RED_TEXT    = "#B42318";

const tasks = [
  { id: "HT-2451", name: "Sinh viên A", topic: "Đăng ký thi CNTT Cơ bản", status: "Đang xử lý", time: "10:30", avatar: "A", sla: 85, aiStatus: "AI không chắc chắn" },
  { id: "HT-2449", name: "Sinh viên B", topic: "Chuẩn đầu ra ngoại ngữ", status: "Chờ xử lý", time: "09:50", avatar: "B", sla: 72, aiStatus: "AI thành công" },
  { id: "HT-2445", name: "Sinh viên C", topic: "Lịch thi VSTEP", status: "Đang xử lý", time: "09:15", avatar: "C", sla: 95, aiStatus: "AI thành công" },
  { id: "HT-2440", name: "Sinh viên D", topic: "Quên mật khẩu khóa học", status: "Hoàn thành", time: "08:30", avatar: "D", sla: 100, aiStatus: "AI thành công" },
  { id: "HT-2438", name: "Sinh viên E", topic: "Lệ phí thi TOEIC", status: "Chờ quản lý xác nhận", time: "08:00", avatar: "E", sla: 42, aiStatus: "AI trả lời sai" },
];

const aiStatusColors: Record<string, { bg: string; color: string }> = {
  "AI không chắc chắn": { bg: AMBER_50,  color: AMBER_TEXT },
  "AI thành công":     { bg: "#EAF8F1", color: "#16a34a" },
  "AI trả lời sai":   { bg: RED_50,    color: RED_TEXT },
  "Không tìm thấy dữ liệu": { bg: "#f3e8ff", color: "#7c3aed" },
};

export function MyWorkspace() {
  const { role } = useAuth();
  const [activeTask, setActiveTask] = useState(tasks[0]);
  const [replyText, setReplyText] = useState("");
  const [showSheetModal, setShowSheetModal] = useState(false);

  const handleSend = () => {
    if (!replyText.trim()) return;
    toast.success("Đã gửi phản hồi");
    setReplyText("");
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 72px)", backgroundColor: "#f8fafc", overflow: "hidden" }}>
      
      {/* Cột 1: Hôm nay của bạn (Productivity Panel) */}
      <div style={{ width: "280px", borderRight: "1px solid #e2e8f0", backgroundColor: "#fff", padding: "20px", display: "flex", flexDirection: "column", gap: "24px", overflowY: "auto" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>Hôm nay của bạn</h2>
          <p style={{ fontSize: "13px", color: "#64748b" }}>Thứ Năm, 28/05/2026</p>
        </div>

        <div style={{ padding: "16px", backgroundColor: LIGHT_NAVY, borderRadius: "12px", border: "1px solid rgba(0,56,101,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>NV</div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: NAVY }}>Nhân viên CSKH</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Ca làm: 08:00 - 17:00</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ backgroundColor: "#fff", padding: "12px", borderRadius: "8px", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: NAVY }}>24</div>
              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>Đã xử lý</div>
            </div>
            <div style={{ backgroundColor: "#fff", padding: "12px", borderRadius: "8px", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: AMBER_TEXT }}>5</div>
              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>Đang chờ</div>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Target size={14} /> Cam kết dịch vụ
          </h3>
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#64748b" }}>Tốc độ phản hồi</span>
              <span style={{ fontWeight: 600, color: NAVY }}>98%</span>
            </div>
            <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: "98%", height: "100%", backgroundColor: "#10b981", borderRadius: "3px" }} />
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#64748b" }}>Độ hài lòng</span>
              <span style={{ fontWeight: 600, color: NAVY }}>4.8/5</span>
            </div>
            <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: "96%", height: "100%", backgroundColor: "#3b82f6", borderRadius: "3px" }} />
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Activity size={14} /> Hoạt động gần đây
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { t: "10:25", msg: "Hoàn tất hỗ trợ Trần C" },
              { t: "08:00", msg: "Bắt đầu ca làm việc" },
            ].map((act, i) => (
              <div key={i} style={{ display: "flex", gap: "12px" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", width: "32px", flexShrink: 0, paddingTop: "2px" }}>{act.t}</div>
                <div style={{ fontSize: "12px", color: "#475569", borderLeft: "2px solid #e2e8f0", paddingLeft: "12px", paddingBottom: "12px" }}>{act.msg}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cột 2: Task List (Focus on clean workspace) */}
      <div style={{ width: "340px", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px" }}>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "10px" }} />
            <input 
              type="text" 
              placeholder="Tìm kiếm công việc..." 
              style={{ width: "100%", padding: "10px 10px 10px 36px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "13px", boxSizing: "border-box", backgroundColor: "#fff" }} 
            />
          </div>
          
          <div style={{ display: "flex", gap: "8px" }}>
            {["Tất cả", "Chưa đọc", "Đang xử lý"].map((tab, i) => (
              <button key={i} style={{ padding: "6px 12px", borderRadius: "16px", fontSize: "12px", fontWeight: 500, backgroundColor: i === 0 ? NAVY : "#fff", color: i === 0 ? "#fff" : "#64748b", border: i === 0 ? "none" : "1px solid #e2e8f0", cursor: "pointer", transition: "all 0.2s" }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 20px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {tasks.map((task) => (
            <div 
              key={task.id}
              onClick={() => setActiveTask(task)}
              style={{ 
                padding: "14px", borderRadius: "10px", cursor: "pointer",
                backgroundColor: activeTask.id === task.id ? "#fff" : "transparent",
                border: activeTask.id === task.id ? `1px solid ${NAVY}40` : "1px solid transparent",
                boxShadow: activeTask.id === task.id ? "0 4px 12px rgba(0,56,101,0.05)" : "none",
                transition: "all 0.2s"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: LIGHT_NAVY, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600 }}>
                    {task.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: NAVY }}>{task.name}</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{task.id}</div>
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>{task.time}</div>
              </div>
              <div style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>{task.topic}</div>
              {task.aiStatus !== "AI thành công" && (
                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: aiStatusColors[task.aiStatus]?.bg || "#f1f5f9", color: aiStatusColors[task.aiStatus]?.color || "#64748b", fontWeight: 600 }}>
                    {task.aiStatus}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ flex: 1, height: "4px", backgroundColor: "#e2e8f0", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${task.sla}%`, height: "100%", backgroundColor: task.sla > 50 ? "#10b981" : AMBER_TEXT, borderRadius: "2px" }} />
                </div>
                <span style={{ fontSize: "11px", color: task.sla > 50 ? "#10b981" : AMBER_TEXT, fontWeight: 600 }}>Cam kết {task.sla}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cột 3: Work Area (Clean Chat) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
        {/* Header */}
        <div style={{ height: "64px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: LIGHT_NAVY, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 600 }}>
              {activeTask.avatar}
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: NAVY, margin: 0 }}>{activeTask.name}</h2>
              <div style={{ fontSize: "12px", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }} /> Đang trực tuyến
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {activeTask.aiStatus !== "AI thành công" && (
              <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", backgroundColor: aiStatusColors[activeTask.aiStatus]?.bg || "#f1f5f9", color: aiStatusColors[activeTask.aiStatus]?.color || "#64748b", fontWeight: 600 }}>
                {activeTask.aiStatus}
              </span>
            )}
            <button onClick={() => setShowSheetModal(true)} style={{ padding: "7px 12px", borderRadius: "6px", backgroundColor: "#fff", border: `1px solid ${NAVY}20`, color: NAVY, fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
              <FileText size={13} /> Sheet Chatbot
            </button>
            <button onClick={() => toast.success("Đã đánh dấu đã xử lý")} style={{ padding: "7px 14px", borderRadius: "6px", backgroundColor: "#fff", border: "1px solid #e2e8f0", color: "#475569", fontSize: "13px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle size={14} /> Đánh dấu đã xử lý
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ alignSelf: "center", fontSize: "11px", color: "#94a3b8", backgroundColor: "#f8fafc", padding: "4px 12px", borderRadius: "12px" }}>Hôm nay</div>
          
          <div style={{ display: "flex", gap: "12px", maxWidth: "80%" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: LIGHT_NAVY, flexShrink: 0 }} />
            <div>
              <div style={{ backgroundColor: "#f1f5f9", padding: "12px 16px", borderRadius: "0 12px 12px 12px", fontSize: "13px", color: "#334155", lineHeight: 1.5 }}>
                Dạ cho em hỏi quy trình đăng ký thi chứng chỉ tin học sắp tới như thế nào ạ? Em thấy thông báo trên page nhưng chưa rõ các bước.
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>10:30</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", maxWidth: "80%", alignSelf: "flex-end", flexDirection: "row-reverse" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: NAVY, flexShrink: 0 }} />
            <div>
              <div style={{ backgroundColor: NAVY, padding: "12px 16px", borderRadius: "12px 0 12px 12px", fontSize: "13px", color: "#fff", lineHeight: 1.5 }}>
                Chào bạn, để đăng ký thi chứng chỉ, bạn cần chuẩn bị 2 ảnh 3x4, CMND/CCCD photo và điền form tại phòng Đào tạo nhé. Thời hạn đến hết ngày 30/05.
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", textAlign: "right" }}>10:32</div>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div style={{ padding: "20px", borderTop: "1px solid #e2e8f0", backgroundColor: "#fff" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "12px" }}>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Nhập phản hồi của bạn..."
                style={{ width: "100%", border: "none", outline: "none", backgroundColor: "transparent", resize: "none", fontSize: "13px", minHeight: "40px", fontFamily: "inherit" }}
              />
            </div>
            <button
              onClick={handleSend}
              style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: NAVY, color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {showSheetModal && (
        <AddSheetModal
          prefillQuestion={activeTask.topic}
          onClose={() => setShowSheetModal(false)}
          onSave={() => toast.success("Đã thêm dữ liệu vào Sheet Chatbot")}
        />
      )}
    </div>
  );
}