import { useState, useEffect } from "react";
import { AlertTriangle, Timer, Flame, ShieldAlert, PhoneForwarded, AlertOctagon, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";

const ORANGE   = "#D73C01";
const RED      = "#B42318";   // softer red instead of #ef4444
const RED_BG   = "#FFF1F1";   // soft red background
const RED_BORDER= "#F8CACA";  // soft red border
const AMBER_TEXT= "#B7791F"; // amber audit-trail warning
const DARK_NAVY = "#0f172a";

const urgentTasks = [
  { id: "HT-2451", customer: "Sinh viên B", reason: "Chuẩn đầu ra ngoại ngữ — Chờ quản lý xác nhận > 11 giờ", severity: "Khẩn cấp", timeRemaining: "-02:15:00", channel: "Facebook" },
  { id: "HT-2449", customer: "Sinh viên A", reason: "Đăng ký thi CNTT nhóm — AI không chắc chắn", severity: "Cao", timeRemaining: "00:14:59", channel: "Zalo OA" },
  { id: "HT-2440", customer: "Sinh viên D", reason: "Lệ phí TOEIC — Khách hàng phàn nàn AI trả lời sai", severity: "Cao", timeRemaining: "00:45:00", channel: "Zalo Business" },
];

export function UrgentCenter() {
  const { role } = useAuth();
  const [activeItem, setActiveItem] = useState(urgentTasks[0]);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const i = setInterval(() => setBlink(b => !b), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 72px)", backgroundColor: "#f8fafc", overflow: "hidden" }}>
      
      {/* Alert Strip — softer red */}
      <div style={{ backgroundColor: RED, color: "#fff", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertOctagon size={16} style={{ opacity: blink ? 1 : 0.5, transition: "opacity 0.2s" }} />
          HỆ THỐNG CẢNH BÁO: CÓ 3 HỘI THOẠI ĐANG TRỄ HẠN XỬ LÝ NGHIÊM TRỌNG. YÊU CẦU XỬ LÝ NGAY LẬP TỨC!
        </div>
        <button style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "4px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>
          Nhận tất cả
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Command List (War Room style) */}
        <div style={{ width: "400px", backgroundColor: "#fff", borderRight: `1px solid ${ORANGE}40`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px", borderBottom: `1px solid ${ORANGE}20`, backgroundColor: "#fffafa" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: RED, display: "flex", alignItems: "center", gap: "8px", margin: 0, textTransform: "uppercase" }}>
              <Flame size={20} /> Cần Xử Lý Khẩn Cấp
            </h2>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", backgroundColor: "#fff9f5" }}>
            {urgentTasks.map((task) => (
              <div 
                key={task.id}
                onClick={() => setActiveItem(task)}
                style={{ 
                  backgroundColor: "#fff",
                  border: activeItem.id === task.id ? `2px solid ${RED}` : "1px solid #e2e8f0",
                  borderLeft: activeItem.id === task.id ? `6px solid ${RED}` : `6px solid ${task.severity === 'Khẩn cấp' ? RED : ORANGE}`,
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "pointer",
                  boxShadow: activeItem.id === task.id ? "0 4px 12px rgba(239, 68, 68, 0.15)" : "0 2px 4px rgba(0,0,0,0.02)",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ backgroundColor: task.severity === 'Khẩn cấp' ? RED : ORANGE, color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase" as const }}>
                      {task.severity}
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: DARK_NAVY }}>{task.id}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: RED, fontWeight: 700, fontSize: "13px", fontFamily: "monospace" }}>
                    <Timer size={14} /> {task.timeRemaining}
                  </div>
                </div>
                
                <div style={{ fontSize: "15px", fontWeight: 600, color: DARK_NAVY, marginBottom: "4px" }}>
                  {task.customer}
                </div>
                
                <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "13px", color: RED, backgroundColor: RED_BG, border: `1px solid ${RED_BORDER}`, padding: "8px", borderRadius: "6px" }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontWeight: 500 }}>{task.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
          
          <div style={{ padding: "24px", borderBottom: `1px solid ${ORANGE}20`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundColor: "#fffafa" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 800, color: DARK_NAVY, margin: 0 }}>{activeItem.customer}</h1>
                <span style={{ padding: "4px 8px", backgroundColor: "#f1f5f9", borderRadius: "4px", fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{activeItem.channel}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: RED, fontWeight: 600, fontSize: "14px" }}>
                <ShieldAlert size={16} /> {activeItem.reason} - Kênh hỗ trợ ưu tiên
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => toast.success("Đã chuyển tiếp cho Trưởng bộ phận")} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "8px", backgroundColor: "#fff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <PhoneForwarded size={16} /> Chuyển tiếp
              </button>
              <button onClick={() => toast.success("Đã đóng hội thoại khẩn cấp")} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "8px", backgroundColor: RED, border: "none", color: "#fff", fontWeight: 600, fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 6px rgba(180,35,24,0.18)" }}>
                <CheckSquare size={16} /> Bắt buộc hoàn thành
              </button>
            </div>
          </div>

          <div style={{ flex: 1, padding: "32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#fff" }}>
            
            <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: DARK_NAVY, marginBottom: "16px", textTransform: "uppercase" }}>Lịch sử vi phạm (Nhật ký kiểm tra)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
                  <span style={{ color: "#64748b", width: "120px", fontFamily: "monospace" }}>08:15:22 T5</span>
                  <span style={{ color: DARK_NAVY, fontWeight: 500 }}>Khách hàng gửi yêu cầu hỗ trợ (Yêu cầu mới)</span>
                </div>
                <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
                  <span style={{ color: "#64748b", width: "120px", fontFamily: "monospace" }}>09:15:22 T5</span>
                  <span style={{ color: AMBER_TEXT, fontWeight: 600 }}>Cảnh báo vàng: 1 giờ chưa phản hồi</span>
                </div>
                <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
                  <span style={{ color: "#64748b", width: "120px", fontFamily: "monospace" }}>10:15:22 T5</span>
                  <span style={{ color: RED, fontWeight: 700 }}>Trễ hạn xử lý: Quá 2 giờ chưa xử lý</span>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", border: `2px solid ${RED_BORDER}`, borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: "200px" }}>
              <div style={{ padding: "16px", backgroundColor: RED_BG, borderBottom: `1px solid ${RED_BORDER}`, fontWeight: 700, color: RED, display: "flex", alignItems: "center", gap: "8px" }}>
                <Flame size={16} /> Yêu cầu xử lý ưu tiên
              </div>
              <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <textarea 
                  placeholder="Nhập nội dung xử lý khẩn cấp..." 
                  style={{ width: "100%", height: "100px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", fontSize: "14px", outline: "none", resize: "none", marginBottom: "16px" }}
                />
                <button style={{ alignSelf: "flex-end", padding: "12px 24px", borderRadius: "8px", backgroundColor: DARK_NAVY, color: "#fff", border: "none", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                  Gửi & đóng hội thoại
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}