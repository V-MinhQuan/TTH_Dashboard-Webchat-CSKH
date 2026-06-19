import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { Bell, ChevronDown, User, LogOut, X, Settings, HelpCircle } from "lucide-react";
import { getDashboardKpi } from "../services/dashboardApi";
import { getSheetChatbotRows } from "../services/sheetChatbotApi";
import { toast } from "sonner";

const NAVY   = "#003865";
const ORANGE  = "#D73C01";  // brand anchor — used sparingly
const CTA     = "#ED5206";
const CTA_SOFT= "#F36C2E";
const RED_TEXT = "#B42318"; // softer error red
const RED_BG   = "#FFF1F1"; // soft error bg

const screenLabels: Record<string, string> = {
  overview: "Tổng quan",
  channel: "Kênh",
  question: "Phân tích chủ đề",
  keyword: "Từ khóa nổi bật",
  performance: "Hiệu suất",
  conversation: "Hội thoại",
  sentiment: "Phân tích ảm xúc",
  aiinsights: "Hiệu suất AI",
  chartbuilder: "Biểu đồ",
  settings: "Cài đặt",
  faq: "FAQ",
  chatbot_sheet: "Thư viện phản hồi",
  profile: "Hồ sơ",
  personalinfo: "Thông tin cá nhân",
};

type NotificationStatus = "pending" | "completed";
type NotificationType = "alert" | "warning" | "info" | "success";

interface SystemNotification {
  id: string;
  text: string;
  type: NotificationType;
  time: string;
  status: NotificationStatus;
  targetScreen: string;
}

interface NotificationGroup {
  date: string;
  items: SystemNotification[];
}

function formatApiDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getLast30DayRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { startDate: formatApiDate(start), endDate: formatApiDate(end) };
}

interface HeaderProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function Header({ activeScreen, onNavigate }: HeaderProps) {
  const { role, user, logout } = useAuth();
  const { settings } = useSettings();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showNewPasswordModal, setShowNewPasswordModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [notificationsGroups, setNotificationsGroups] = useState<NotificationGroup[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setShowAvatar(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const notifDotColor: Record<string, string> = {
    alert: ORANGE,
    warning: "#B7791F",
    info: "#3b82f6",
    success: "#228A61",
  };

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);

    try {
      const range = getLast30DayRange();
      const [kpiData, sheetData] = await Promise.all([
        getDashboardKpi(range).catch((error) => {
          console.warn("Không thể tải KPI cho thông báo hệ thống", error);
          return null;
        }),
        getSheetChatbotRows({ pageSize: 1, role }).catch((error) => {
          console.warn("Không thể tải Sheet Chatbot cho thông báo hệ thống", error);
          return null;
        }),
      ]);

      if (!kpiData && !sheetData) {
        throw new Error("Không API thông báo nào phản hồi thành công");
      }

      const items: SystemNotification[] = [];
      const overtimeCount = kpiData?.urgentAlerts.filter((alert) => alert.type === "overtime").length ?? 0;
      const aiFailures = Number(kpiData?.aiFailures || 0);
      const pendingManager = Number(sheetData?.stats?.pendingManager ?? sheetData?.stats?.pending ?? 0);
      const needsEdit = Number(sheetData?.stats?.needsEdit || 0);

      if (overtimeCount > 0) {
        const id = `dashboard:overtime:${overtimeCount}`;
        items.push({
          id,
          text: `${overtimeCount} hội thoại đang chờ quá 10 giờ`,
          type: "alert",
          time: "Cập nhật theo dữ liệu Dashboard",
          status: "pending",
          targetScreen: "overview",
        });
      }

      if (settings.aiFailAlert && aiFailures > 0) {
        const id = `dashboard:ai-failures:${aiFailures}`;
        items.push({
          id,
          text: `${aiFailures} phản hồi AI cần kiểm tra trong 30 ngày qua`,
          type: "warning",
          time: "Cập nhật theo dữ liệu Dashboard",
          status: "pending",
          targetScreen: "aiinsights",
        });
      }

      if (pendingManager > 0) {
        const id = `sheet-chatbot:pending:${pendingManager}`;
        items.push({
          id,
          text: `${pendingManager} dòng Sheet Chatbot chờ quản lý duyệt`,
          type: "info",
          time: "Cập nhật theo Sheet Chatbot",
          status: "pending",
          targetScreen: "chatbot_sheet",
        });
      }

      if (needsEdit > 0) {
        const id = `sheet-chatbot:needs-edit:${needsEdit}`;
        items.push({
          id,
          text: `${needsEdit} dòng Sheet Chatbot cần chỉnh sửa`,
          type: "warning",
          time: "Cập nhật theo Sheet Chatbot",
          status: "pending",
          targetScreen: "chatbot_sheet",
        });
      }

      setNotificationsGroups(items.length ? [{ date: "Dữ liệu hệ thống", items }] : []);
    } catch (error) {
      console.error("Không thể tải thông báo hệ thống", error);
      setNotificationsError("Không thể tải thông báo hệ thống");
      setNotificationsGroups([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [role, settings.aiFailAlert]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      await loadNotifications();
    };

    load();
    const intervalId = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const pendingWorkCount = notificationsGroups.reduce((acc, group) => acc + group.items.filter(n => n.status !== "completed").length, 0);

  const dropdownItem = (onClick: () => void, icon: ReactNode, label: string, danger = false) => (
    <div
      onClick={onClick}
      style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", color: danger ? RED_TEXT : NAVY, transition: "background 0.15s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = danger ? RED_BG : "#f8fafc"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
    >
      {icon} {label}
    </div>
  );

  const handleChangePassword = () => {
    setShowAvatar(false);
    setShowOtpModal(true);
  };

  const handleOtpConfirm = () => {
    if (otpCode.length < 4) { toast.error("Vui lòng nhập đầy đủ mã OTP"); return; }
    setShowOtpModal(false);
    setOtpCode("");
    setShowNewPasswordModal(true);
  };

  return (
    <header
      style={{
        height: "72px",
        backgroundColor: "#fff",
        borderBottom: "1px solid rgba(0,56,101,0.08)",
        display: "flex",
        alignItems: "center",
        padding: "0 28px",
        gap: "16px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 1px 8px rgba(0,56,101,0.06)",
      }}
    >
      {/* Breadcrumb */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: NAVY, fontSize: "14px", fontWeight: 700 }}>
          {screenLabels[activeScreen] || "Tổng quan"}
        </span>
      </div>

      {/* Notifications */}
      <div style={{ position: "relative" }} ref={notifRef}>
        <button
          onClick={() => { setShowNotifications(!showNotifications); setShowAvatar(false); }}
          style={{ width: "36px", height: "36px", borderRadius: "10px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: showNotifications ? "#fff3ef" : "#f4f6fa", color: showNotifications ? CTA : NAVY, transition: "all 0.2s", position: "relative" }}
        >
          <Bell size={16} />
          {pendingWorkCount > 0 && <span style={{ position: "absolute", top: "6px", right: "6px", width: "8px", height: "8px", backgroundColor: ORANGE, borderRadius: "50%", border: "2px solid #fff" }} />}
        </button>

        {showNotifications && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "360px", backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 8px 32px rgba(0,56,101,0.15)", border: "1px solid rgba(0,56,101,0.08)", overflow: "hidden", zIndex: 100 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: "14px" }}>Thông báo hệ thống</div>
                <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", marginTop: "3px" }}>
                  {pendingWorkCount > 0 ? `${pendingWorkCount} công việc cần xử lý` : "Không có công việc cần xử lý"}
                </div>
              </div>
            </div>
            <div style={{ maxHeight: "360px", overflowY: "auto" }}>
              {notificationsLoading && (
                <div style={{ padding: "28px 20px", textAlign: "center", color: "rgba(0,56,101,0.45)", fontSize: "13px" }}>
                  Đang tải thông báo...
                </div>
              )}

              {!notificationsLoading && notificationsError && (
                <div style={{ padding: "20px", color: RED_TEXT, fontSize: "13px", lineHeight: 1.5 }}>
                  {notificationsError}. Vui lòng kiểm tra kết nối API.
                </div>
              )}

              {!notificationsLoading && !notificationsError && notificationsGroups.length === 0 && (
                <div style={{ padding: "28px 20px", textAlign: "center", color: "rgba(0,56,101,0.45)", fontSize: "13px" }}>
                  Không có thông báo cần xử lý
                </div>
              )}

              {!notificationsLoading && !notificationsError && notificationsGroups.map(group => (
                <div key={group.date}>
                  <div style={{ padding: "8px 20px", backgroundColor: "#f8fafc", fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", borderBottom: "1px solid rgba(0,56,101,0.04)" }}>
                    {group.date.toUpperCase()}
                  </div>
                  {group.items.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => { setShowNotifications(false); onNavigate(n.targetScreen); }}
                      style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,56,101,0.04)", display: "flex", gap: "12px", cursor: "pointer", transition: "background 0.15s", opacity: n.status === "completed" ? 0.55 : 1 }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f8fafc"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"}
                    >
                      <div style={{ flexShrink: 0, marginTop: "2px" }}>
                        {n.status === "completed" ? (
                          <div style={{ width: "16px", height: "16px", borderRadius: "4px", backgroundColor: "#228A61", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        ) : (
                          <div style={{ width: "16px", height: "16px", borderRadius: "4px", border: `2px solid ${notifDotColor[n.type] || CTA}` }} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", color: NAVY, lineHeight: 1.4, fontWeight: n.status === "pending" ? 600 : 400 }}>{n.text}</div>
                        <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.4)", marginTop: "4px", display: "flex", gap: "6px", alignItems: "center" }}>
                          <span>{n.time}</span>
                          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(0,56,101,0.05)", fontWeight: 500 }}>
                            → {screenLabels[n.targetScreen] || n.targetScreen}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div style={{ position: "relative" }} ref={avatarRef}>
        <button
          onClick={() => { setShowAvatar(!showAvatar); setShowNotifications(false); }}
          style={{ display: "flex", alignItems: "center", gap: "8px", border: "none", cursor: "pointer", background: "transparent", borderRadius: "10px", padding: "4px 8px", transition: "background 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f4f6fa"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"}
        >
          <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: role === "manager" ? `linear-gradient(135deg, ${NAVY}, #1565C0)` : `linear-gradient(135deg, #64748b, #94a3b8)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "13px", fontWeight: 600 }}>
            {user ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : (role === "manager" ? "AD" : "NV")}
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, lineHeight: 1.2 }}>
              {user ? user.name : (role === "manager" ? "Admin FLIC" : "Nhân viên CSKH")}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.4)" }}>
              {role === "manager" ? "Quản lý CSKH" : "Nhân viên CSKH"}
            </div>
          </div>
          <ChevronDown size={14} style={{ color: "rgba(0,56,101,0.4)" }} />
        </button>

        {showAvatar && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "210px", backgroundColor: "#fff", borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,56,101,0.15)", border: "1px solid rgba(0,56,101,0.08)", overflow: "hidden", zIndex: 100 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,56,101,0.06)", backgroundColor: "#f8fafc" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY }}>{user ? user.name : (role === "manager" ? "Admin FLIC" : "Nhân viên CSKH")}</div>
              <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)" }}>{user ? user.email : (role === "manager" ? "admin@flic.edu.vn" : "staff@flic.edu.vn")}</div>
            </div>
            {dropdownItem(() => { onNavigate(role === "manager" ? "personalinfo" : "profile"); setShowAvatar(false); }, <User size={15} style={{ color: NAVY }} />, "Thông tin cá nhân")}
            {dropdownItem(() => { onNavigate("settings"); setShowAvatar(false); }, <Settings size={15} style={{ color: NAVY }} />, role === "manager" ? "Cài đặt" : "Cài đặt cá nhân")}
            {dropdownItem(() => { toast.info("Trung tâm trợ giúp đang cập nhật..."); setShowAvatar(false); }, <HelpCircle size={15} style={{ color: NAVY }} />, "Trợ giúp")}
            <div style={{ height: "1px", backgroundColor: "rgba(0,56,101,0.08)" }} />
            {dropdownItem(() => { setShowLogoutModal(true); setShowAvatar(false); }, <LogOut size={15} style={{ color: RED_TEXT }} />, "Đăng xuất", true)}
          </div>
        )}
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "380px", borderRadius: "18px", padding: "28px", boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Nhập mã OTP</h3>
              <button onClick={() => { setShowOtpModal(false); setOtpCode(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "14px", backgroundColor: "#f0f4fa", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", color: NAVY, lineHeight: 1.5 }}>
              📧 Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra và nhập mã bên dưới.
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Mã OTP</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Nhập mã 6 chữ số"
                style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "18px", letterSpacing: "6px", textAlign: "center", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setShowOtpModal(false); setOtpCode(""); }} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={handleOtpConfirm} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: CTA, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* New Password Modal */}
      {showNewPasswordModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "380px", borderRadius: "18px", padding: "28px", boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Đặt mật khẩu mới</h3>
              <button onClick={() => setShowNewPasswordModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Mật khẩu mới</label>
                <input type="password" placeholder="Nhập mật khẩu mới" style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Xác nhận mật khẩu</label>
                <input type="password" placeholder="Nhập lại mật khẩu mới" style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowNewPasswordModal(false)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={() => { setShowNewPasswordModal(false); toast.success("Đã đổi mật khẩu thành công"); }} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: CTA, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Lưu mật khẩu</button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "360px", borderRadius: "16px", padding: "28px", boxShadow: "0 12px 48px rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "12px", marginBottom: "24px" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "50%", backgroundColor: RED_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LogOut size={22} style={{ color: RED_TEXT }} />
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: NAVY, marginBottom: "6px" }}>Xác nhận đăng xuất</div>
                <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", lineHeight: 1.5 }}>Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={() => { setShowLogoutModal(false); logout(); }} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: RED_TEXT, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Đăng xuất</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
