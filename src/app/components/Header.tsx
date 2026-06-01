import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Search, Bell, ChevronDown, User, LogOut, ChevronRight, X, Key, Settings, HelpCircle } from "lucide-react";
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
  keyword: "Keywords",
  performance: "Hiệu suất",
  conversation: "Hội thoại",
  sentiment: "Cảm xúc",
  aiinsights: "Phân tích AI",
  chartbuilder: "Biểu đồ",
  settings: "Cài đặt",
  faq: "FAQ",
  chatbot_sheet: "Sheet Chatbot",
  profile: "Hồ sơ",
  personalinfo: "Thông tin cá nhân",
};

const adminNotifications = [
  {
    date: "Hôm nay",
    items: [
      { id: 1, text: "Có 12 lỗi AI mới cần xem xét", type: "alert", time: "5 phút trước", status: "pending", targetScreen: "aiinsights" },
      { id: 2, text: "5 FAQ đang chờ duyệt", type: "warning", time: "20 phút trước", status: "pending", targetScreen: "faq" },
      { id: 3, text: "3 dữ liệu Sheet Chatbot cần kiểm tra", type: "info", time: "1 giờ trước", status: "pending", targetScreen: "chatbot_sheet" },
    ],
  },
  {
    date: "Hôm qua",
    items: [
      { id: 4, text: "Có cập nhật người dùng mới trong Cài đặt", type: "success", time: "14:30", status: "completed", targetScreen: "settings" },
      { id: 5, text: "Kiểm tra hội thoại HT-2451", type: "info", time: "09:15", status: "completed", targetScreen: "conversation" },
    ],
  },
];

const staffNotifications = [
  {
    date: "Hôm nay",
    items: [
      { id: 1, text: "Bạn có 4 hội thoại mới được phân công", type: "alert", time: "10 phút trước", status: "pending", targetScreen: "conversation" },
      { id: 2, text: "2 FAQ của bạn cần chỉnh sửa", type: "warning", time: "30 phút trước", status: "pending", targetScreen: "faq" },
      { id: 3, text: "1 dòng Sheet Chatbot của bạn đã được duyệt", type: "success", time: "1 giờ trước", status: "completed", targetScreen: "chatbot_sheet" },
    ],
  },
  {
    date: "Hôm qua",
    items: [
      { id: 4, text: "Có hội thoại AI trả lời sai cần bạn kiểm tra", type: "warning", time: "16:00", status: "completed", targetScreen: "conversation" },
    ],
  },
];

interface HeaderProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function Header({ activeScreen, onNavigate }: HeaderProps) {
  const { role, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showNewPasswordModal, setShowNewPasswordModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
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

  const notificationsGroups = role === "manager" ? adminNotifications : staffNotifications;

  const dropdownItem = (onClick: () => void, icon: React.ReactNode, label: string, danger = false) => (
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
        <span style={{ color: "rgba(0,56,101,0.4)", fontSize: "13px" }}>FLIC AI Ops</span>
        <ChevronRight size={14} style={{ color: "rgba(0,56,101,0.3)" }} />
        <span style={{ color: NAVY, fontSize: "14px", fontWeight: 600 }}>
          {screenLabels[activeScreen] || "Tổng quan"}
        </span>
      </div>

      {/* Global Search */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#f4f6fa", borderRadius: "10px", padding: "8px 14px", width: "240px", border: "1.5px solid transparent", transition: "border-color 0.2s" }}
        onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = CTA; }}
        onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "transparent"; }}
      >
        <Search size={15} style={{ color: "rgba(0,56,101,0.4)", flexShrink: 0 }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm hội thoại, từ khóa..."
          style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", color: NAVY, width: "100%" }}
        />
      </div>

      {/* Notifications */}
      <div style={{ position: "relative" }} ref={notifRef}>
        <button
          onClick={() => { setShowNotifications(!showNotifications); setShowAvatar(false); }}
          style={{ width: "36px", height: "36px", borderRadius: "10px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: showNotifications ? "#fff3ef" : "#f4f6fa", color: showNotifications ? CTA : NAVY, transition: "all 0.2s", position: "relative" }}
        >
          <Bell size={16} />
          <span style={{ position: "absolute", top: "6px", right: "6px", width: "8px", height: "8px", backgroundColor: ORANGE, borderRadius: "50%", border: "2px solid #fff" }} />
        </button>

        {showNotifications && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "360px", backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 8px 32px rgba(0,56,101,0.15)", border: "1px solid rgba(0,56,101,0.08)", overflow: "hidden", zIndex: 100 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: NAVY, fontSize: "14px" }}>Thông báo</span>
              <span style={{ fontSize: "11px", color: CTA, cursor: "pointer", fontWeight: 600 }}>Đánh dấu tất cả đã đọc</span>
            </div>
            <div style={{ maxHeight: "360px", overflowY: "auto" }}>
              {notificationsGroups.map(group => (
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
            {role === "manager" ? "AD" : "NV"}
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, lineHeight: 1.2 }}>
              {role === "manager" ? "Admin FLIC" : "Nhân viên CSKH"}
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
              <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY }}>{role === "manager" ? "Admin FLIC" : "Nhân viên CSKH"}</div>
              <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)" }}>{role === "manager" ? "admin@flic.edu.vn" : "staff@flic.edu.vn"}</div>
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
