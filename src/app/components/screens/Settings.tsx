import React, { useState, useEffect } from "react";
import { Users, ChevronRight, User, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { UserManagement } from "./UserManagement";
import {
  confirmPasswordChange,
  getProfile,
  requestPasswordChange,
  updateProfile,
} from "../../services/dashboardApi";

const NAVY = "#003865";
const CTA = "#D73C01";

// --- Shared styles (defined outside component to avoid re-creation on render) ---
const fieldStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1.5px solid rgba(0,56,101,0.12)",
  fontSize: "13px",
  color: NAVY,
  outline: "none",
};

// Defined outside Settings to prevent new references on each render (which causes focus loss)
function SectionTitle({ title }: { title: string }) {
  return <h2 style={{ fontSize: "18px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>{title}</h2>;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid rgba(0,56,101,0.08)", backgroundColor: "#f8fafc", ...style }}>
      {children}
    </div>
  );
}

function PasscodeModal({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) {
  const [passcode, setPasscode] = useState("");
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "320px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
        <h3 style={{ margin: "0 0 16px", color: NAVY, fontSize: "16px" }}>Xác nhận mật khẩu</h3>
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>Vui lòng nhập mật khẩu để xác nhận thay đổi.</p>
        <input
          type="password"
          placeholder="Nhập mật khẩu"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "16px", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: "8px", background: "#f1f5f9", border: "none", color: "#475569", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
          <button onClick={() => { onConfirm(); setPasscode(""); }} style={{ padding: "8px 16px", borderRadius: "8px", background: NAVY, border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

function OtpModal({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: (otp: string) => void }) {
  const [otp, setOtp] = useState("");

  if (!isOpen) return null;

  const handleReset = () => { setOtp(""); };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "360px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#003865", fontSize: "16px" }}>Nhập mã OTP</h3>
          <button onClick={() => { onClose(); handleReset(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
        </div>
        <>
          <div style={{ padding: "14px", backgroundColor: "#f0f4fa", borderRadius: "10px", marginBottom: "16px", fontSize: "13px", color: "#003865", lineHeight: 1.5 }}>
            📧 Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra và nhập mã bên dưới.
          </div>
          <input
            type="text"
            placeholder="Nhập mã OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "16px", boxSizing: "border-box", textAlign: "center", fontSize: "18px", letterSpacing: "4px" }}
          />
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button onClick={() => { onClose(); handleReset(); }} style={{ padding: "8px 16px", borderRadius: "8px", background: "#f1f5f9", border: "none", color: "#475569", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
            <button onClick={() => { if (otp.length < 4) { toast.error("Vui lòng nhập đầy đủ mã OTP"); return; } onConfirm(otp); handleReset(); }} style={{ padding: "8px 16px", borderRadius: "8px", background: "#003865", border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Xác nhận</button>
          </div>
        </>
      </div>
    </div>
  );
}

const adminSections = [
  { id: "profile", label: "Thông tin người dùng", icon: User },
  { id: "users", label: "Người dùng & phân quyền", icon: Users },
];

const staffSections = [
  { id: "profile", label: "Thông tin cá nhân", icon: User },
];

function validSection(defaultSection: string, sections: typeof adminSections) {
  return sections.some((section) => section.id === defaultSection) ? defaultSection : "profile";
}

export function Settings({ defaultSection = "profile" }: { defaultSection?: string }) {
  const { role, user, setUser } = useAuth();
  const sections = role === "staff" ? staffSections : adminSections;
  const [activeSection, setActiveSection] = useState(() => validSection(defaultSection, sections));
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Profile fields state
  const [profileData, setProfileData] = useState({ name: "", email: "", phone: "" });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);

  // Password fields state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Load User Profile from backend DB
  useEffect(() => {
    if (user?.username) {
      setLoadingProfile(true);
      getProfile(user.username)
        .then(data => {
          setProfileData({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
          });
        })
        .catch(err => toast.error(err instanceof Error ? err.message : "Không thể tải hồ sơ người dùng."))
        .finally(() => setLoadingProfile(false));
    }
  }, [user?.username]);

  useEffect(() => {
    setActiveSection(validSection(defaultSection, sections));
  }, [defaultSection, role]);

  const handleSaveProfile = async () => {
    if (!profileData.name.trim()) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }
    if (!user) {
      toast.error("Không tìm thấy thông tin người dùng hiện tại.");
      return;
    }
    try {
      const updatedProfile = await updateProfile({
        username: user.username,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
      });
      setUser({
        ...user,
        username: updatedProfile.username || user.username,
        name: updatedProfile.name || profileData.name,
        email: updatedProfile.email || profileData.email,
        phone: updatedProfile.phone ?? profileData.phone,
        role: updatedProfile.role || user.role,
      });
      toast.success("Cập nhật thông tin tài khoản thành công!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật hồ sơ.");
    }
  };

  const handleRequestOtp = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast.error("Vui lòng nhập đầy đủ các trường mật khẩu");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    if (newPw.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    setRequestingOtp(true);
    try {
      if (!user?.username) throw new Error("Không tìm thấy người dùng hiện tại.");
      const response = await requestPasswordChange({
        username: user.username,
        currentPassword: currentPw,
      });
      toast.success(response.message || "Mã OTP đã được gửi đến email của bạn!");
      setShowOtpModal(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể yêu cầu đổi mật khẩu.");
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleConfirmPasswordChange = async (otpCode: string) => {
    try {
      if (!user?.username) throw new Error("Không tìm thấy người dùng hiện tại.");
      await confirmPasswordChange({
        username: user.username,
        otp: otpCode,
        newPassword: newPw,
      });
      toast.success("Đổi mật khẩu thành công!");
      setShowOtpModal(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mã OTP không chính xác hoặc đã hết hạn.");
    }
  };

  const renderSection = () => {
    if (activeSection === "profile") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SectionTitle title={role === "manager" ? "Thông tin người dùng" : "Thông tin cá nhân"} />
          <Card>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: NAVY, marginBottom: "16px" }}>Thông tin tài khoản</h3>
            {loadingProfile ? (
              <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)" }}>Đang tải thông tin tài khoản từ database...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Họ và tên</label>
                  <input type="text" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Email</label>
                  <input type="text" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Số điện thoại</label>
                  <input type="text" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Vai trò</label>
                  <input type="text" readOnly value={role === "manager" ? "Quản lý CSKH" : "Nhân viên"} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box", backgroundColor: "#f1f5f9" }} />
                </div>
              </div>
            )}
            <button onClick={handleSaveProfile} style={{ marginTop: "16px", padding: "8px 16px", borderRadius: "8px", backgroundColor: NAVY, color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Lưu thông tin</button>
          </Card>
          <Card>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: NAVY, marginBottom: "16px" }}>Đổi mật khẩu</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.5)", marginBottom: "4px" }}>Mật khẩu hiện tại</label>
                <input type="password" placeholder="••••••••" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.5)", marginBottom: "4px" }}>Mật khẩu mới</label>
                <input type="password" placeholder="••••••••" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.5)", marginBottom: "4px" }}>Xác nhận mật khẩu mới</label>
                <input type="password" placeholder="••••••••" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <button
                onClick={handleRequestOtp}
                disabled={requestingOtp}
                style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: requestingOtp ? "#e2e8f0" : "#fff", border: "1px solid rgba(0,56,101,0.15)", color: NAVY, cursor: requestingOtp ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "13px", alignSelf: "flex-start", transition: "all 0.15s" }}
              >
                {requestingOtp ? "Đang gửi OTP..." : "Đổi mật khẩu"}
              </button>
            </div>
          </Card>
        </div>
      );
    }

    if (activeSection === "users") {
      return <div style={{ margin: "-28px" }}><UserManagement /></div>;
    }

    return (
      <div style={{ padding: "32px", textAlign: "center", color: "rgba(0,56,101,0.4)", fontSize: "14px" }}>
        Phần cài đặt này đang được phát triển
      </div>
    );
  };

  return (
    <div style={{ padding: "24px", display: "flex", gap: "24px", maxWidth: "1000px" }}>
      <div style={{ width: "255px", flexShrink: 0 }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)", overflow: "hidden" }}>
          {sections.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", border: "none", background: isActive ? "#fff3ef" : "transparent", cursor: "pointer", color: isActive ? CTA : NAVY, borderLeft: `3px solid ${isActive ? CTA : "transparent"}`, transition: "all 0.15s", textAlign: "left" }}
              >
                <Icon size={16} style={{ color: isActive ? CTA : "rgba(0,56,101,0.5)" }} />
                <span style={{ fontSize: "13px", fontWeight: isActive ? 600 : 400, flex: 1 }}>{label}</span>
                {isActive && <ChevronRight size={12} style={{ color: CTA }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "28px" }}>
          {renderSection()}
        </div>
      </div>

      <PasscodeModal
        isOpen={showPasscodeModal}
        onClose={() => { setShowPasscodeModal(false); setPendingAction(null); }}
        onConfirm={() => {
          if (pendingAction) pendingAction();
          setShowPasscodeModal(false);
          setPendingAction(null);
        }}
      />

      <OtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onConfirm={(otpCode: string) => {
          handleConfirmPasswordChange(otpCode);
        }}
      />
    </div>
  );
}
