import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Timer, Flame, ShieldAlert, PhoneForwarded, AlertOctagon, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { closeConversation, getDashboardKpi } from "../../services/dashboardApi";
import type { UrgentAlert } from "../../types/dashboard";

const ORANGE = "#D73C01";
const RED = "#B42318";
const RED_BG = "#FFF1F1";
const RED_BORDER = "#F8CACA";
const AMBER_TEXT = "#B7791F";
const DARK_NAVY = "#0f172a";

type AlertWithRaw = UrgentAlert & {
  raw_source?: string;
  raw_status?: string;
  raw_ai_status?: string;
};

function severityFromAlert(alert: AlertWithRaw) {
  if (alert.type === "overtime") return "Khẩn cấp";
  return alert.priority || "Cao";
}

function sourceForClose(alert: AlertWithRaw) {
  return alert.raw_source || alert.channel;
}

export function UrgentCenter() {
  const { role } = useAuth();
  const [urgentTasks, setUrgentTasks] = useState<AlertWithRaw[]>([]);
  const [activeId, setActiveId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [blink, setBlink] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    const i = setInterval(() => setBlink((b) => !b), 1000);
    return () => clearInterval(i);
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await getDashboardKpi();
      const alerts = data.urgentAlerts as AlertWithRaw[];
      setUrgentTasks(alerts);
      setActiveId((current) => current && alerts.some((alert) => alert.id === current) ? current : alerts[0]?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải cảnh báo khẩn cấp từ database");
      setUrgentTasks([]);
      setActiveId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, []);

  const activeItem = useMemo(() => urgentTasks.find((task) => task.id === activeId) || urgentTasks[0] || null, [urgentTasks, activeId]);

  const handleClose = async () => {
    if (!activeItem) return;
    if (!activeItem.customer || !sourceForClose(activeItem)) {
      toast.error("Cảnh báo thiếu customer/source trong database nên không thể đóng hội thoại.");
      return;
    }

    try {
      await closeConversation(activeItem.customer, sourceForClose(activeItem));
      toast.success("Đã đóng hội thoại khẩn cấp trong database");
      setNote("");
      await loadAlerts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đóng hội thoại khẩn cấp");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 72px)", backgroundColor: "#f8fafc", overflow: "hidden" }}>
      <div style={{ backgroundColor: RED, color: "#fff", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertOctagon size={16} style={{ opacity: blink ? 1 : 0.5, transition: "opacity 0.2s" }} />
          HỆ THỐNG CẢNH BÁO: CÓ {urgentTasks.length} HỘI THOẠI CẦN XỬ LÝ KHẨN CẤP THEO DATABASE.
        </div>
        <button onClick={() => toast.info("Chưa có API nhận/chuyển quyền xử lý hàng loạt trong backend hiện tại.")} style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "4px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>
          Nhận tất cả
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: "400px", backgroundColor: "#fff", borderRight: `1px solid ${ORANGE}40`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px", borderBottom: `1px solid ${ORANGE}20`, backgroundColor: "#fffafa" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: RED, display: "flex", alignItems: "center", gap: "8px", margin: 0, textTransform: "uppercase" }}>
              <Flame size={20} /> Cần Xử Lý Khẩn Cấp
            </h2>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", backgroundColor: "#fff9f5" }}>
            {loading && <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>Đang tải cảnh báo từ database...</div>}
            {!loading && urgentTasks.length === 0 && <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>Không có cảnh báo khẩn cấp trong database.</div>}
            {urgentTasks.map((task) => {
              const severity = severityFromAlert(task);
              const isActive = activeItem?.id === task.id;
              return (
                <div
                  key={task.id}
                  onClick={() => setActiveId(task.id)}
                  style={{
                    backgroundColor: "#fff",
                    border: isActive ? `2px solid ${RED}` : "1px solid #e2e8f0",
                    borderLeft: isActive ? `6px solid ${RED}` : `6px solid ${severity === "Khẩn cấp" ? RED : ORANGE}`,
                    borderRadius: "8px",
                    padding: "16px",
                    cursor: "pointer",
                    boxShadow: isActive ? "0 4px 12px rgba(180,35,24,0.15)" : "0 2px 4px rgba(0,0,0,0.02)",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ backgroundColor: severity === "Khẩn cấp" ? RED : ORANGE, color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase" }}>
                        {severity}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: DARK_NAVY }}>HT-{task.id}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", color: RED, fontWeight: 700, fontSize: "13px", fontFamily: "monospace" }}>
                      <Timer size={14} /> {task.waitTime || "Không có thời gian trong database"}
                    </div>
                  </div>

                  <div style={{ fontSize: "15px", fontWeight: 600, color: DARK_NAVY, marginBottom: "4px" }}>
                    {task.customer || "Không có mã khách hàng trong database"}
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "13px", color: RED, backgroundColor: RED_BG, border: `1px solid ${RED_BORDER}`, padding: "8px", borderRadius: "6px" }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span style={{ fontWeight: 500 }}>{task.desc || task.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
          {!activeItem ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "13px" }}>Không có hội thoại khẩn cấp để xử lý.</div>
          ) : (
            <>
              <div style={{ padding: "24px", borderBottom: `1px solid ${ORANGE}20`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundColor: "#fffafa" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <h1 style={{ fontSize: "24px", fontWeight: 800, color: DARK_NAVY, margin: 0 }}>{activeItem.customer || "Không có mã khách hàng trong database"}</h1>
                    <span style={{ padding: "4px 8px", backgroundColor: "#f1f5f9", borderRadius: "4px", fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{activeItem.channel || "Không có kênh trong database"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: RED, fontWeight: 600, fontSize: "14px" }}>
                    <ShieldAlert size={16} /> {activeItem.title} · {activeItem.topic || "Không phân loại trong database"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button onClick={() => toast.info("Chưa có API chuyển tiếp hội thoại cho trưởng bộ phận trong backend hiện tại.")} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "8px", backgroundColor: "#fff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <PhoneForwarded size={16} /> Chuyển tiếp
                  </button>
                  <button onClick={() => void handleClose()} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "8px", backgroundColor: RED, border: "none", color: "#fff", fontWeight: 600, fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 6px rgba(180,35,24,0.18)" }}>
                    <CheckSquare size={16} /> Bắt buộc hoàn thành
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: "32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#fff" }}>
                <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 700, color: DARK_NAVY, marginBottom: "16px", textTransform: "uppercase" }}>Thông tin cảnh báo từ database</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                    <div><span style={{ color: "#64748b", display: "inline-block", width: "130px" }}>Loại cảnh báo</span><span style={{ color: DARK_NAVY, fontWeight: 600 }}>{activeItem.type}</span></div>
                    <div><span style={{ color: "#64748b", display: "inline-block", width: "130px" }}>Trạng thái hội thoại</span><span style={{ color: AMBER_TEXT, fontWeight: 600 }}>{activeItem.raw_status || "Không có trạng thái raw trong database"}</span></div>
                    <div><span style={{ color: "#64748b", display: "inline-block", width: "130px" }}>Trạng thái AI</span><span style={{ color: RED, fontWeight: 600 }}>{activeItem.raw_ai_status || "Không có trạng thái AI trong database"}</span></div>
                    <div><span style={{ color: "#64748b", display: "inline-block", width: "130px" }}>Mô tả</span><span style={{ color: DARK_NAVY, fontWeight: 500 }}>{activeItem.desc || "Không có mô tả trong database"}</span></div>
                  </div>
                </div>

                <div style={{ backgroundColor: "#fff", border: `2px solid ${RED_BORDER}`, borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: "200px" }}>
                  <div style={{ padding: "16px", backgroundColor: RED_BG, borderBottom: `1px solid ${RED_BORDER}`, fontWeight: 700, color: RED, display: "flex", alignItems: "center", gap: "8px" }}>
                    <Flame size={16} /> Yêu cầu xử lý ưu tiên
                  </div>
                  <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Nhập nội dung xử lý khẩn cấp..."
                      style={{ width: "100%", height: "100px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", fontSize: "14px", outline: "none", resize: "none", marginBottom: "16px" }}
                    />
                    <button onClick={() => void handleClose()} style={{ alignSelf: "flex-end", padding: "12px 24px", borderRadius: "8px", backgroundColor: DARK_NAVY, color: "#fff", border: "none", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                      Gửi & đóng hội thoại
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
