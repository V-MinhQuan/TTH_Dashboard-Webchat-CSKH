import { useState } from "react";
import { ArrowLeft, User, Mail, Building2, Shield, Clock, CheckCircle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";

const NAVY = "#003865";
const CTA = "#ED5206";
const ORANGE = "#D73C01";

interface PersonalInfoProps {
  onNavigate: (screen: string) => void;
}

function OtpModal({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) {
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"otp" | "newpw">("otp");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  if (!isOpen) return null;

  const handleReset = () => { setOtp(""); setStep("otp"); setNewPw(""); setConfirmPw(""); };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "360px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: NAVY, fontSize: "16px" }}>{step === "otp" ? "Nhập mã OTP" : "Đặt mật khẩu mới"}</h3>
          <button onClick={() => { onClose(); handleReset(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
        </div>
        {step === "otp" ? (
          <>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>Mã OTP đã được gửi đến email của bạn</p>
            <input type="text" placeholder="Nhập mã OTP" value={otp} onChange={(e) => setOtp(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "16px", boxSizing: "border-box", textAlign: "center", fontSize: "18px", letterSpacing: "4px" }} />
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => { onClose(); handleReset(); }} style={{ padding: "8px 16px", borderRadius: "8px", background: "#f1f5f9", border: "none", color: "#475569", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={() => setStep("newpw")} style={{ padding: "8px 16px", borderRadius: "8px", background: NAVY, border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Xác nhận</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Mật khẩu mới</label>
              <input type="password" placeholder="••••••••" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>Xác nhận mật khẩu mới</label>
              <input type="password" placeholder="••••••••" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => { onClose(); handleReset(); }} style={{ padding: "8px 16px", borderRadius: "8px", background: "#f1f5f9", border: "none", color: "#475569", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={() => { onConfirm(); handleReset(); }} style={{ padding: "8px 16px", borderRadius: "8px", background: CTA, border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Đổi mật khẩu</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PersonalInfo({ onNavigate }: PersonalInfoProps) {
  const { role } = useAuth();
  const isManager = role === "manager";
  const [showOtpModal, setShowOtpModal] = useState(false);

  return (
    <div style={{ padding: "28px", maxWidth: "760px", margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={() => onNavigate(isManager ? "overview" : "conversation")}
        style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.5)", fontSize: "13px", fontWeight: 500, marginBottom: "24px", padding: 0 }}
        onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = NAVY}
        onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,56,101,0.5)"}
      >
        <ArrowLeft size={15} /> Quay lại
      </button>

      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "28px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%",
            background: isManager ? `linear-gradient(135deg, ${NAVY}, #1565C0)` : `linear-gradient(135deg, ${ORANGE}, #f97316)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "26px", fontWeight: 700,
            boxShadow: "0 4px 16px rgba(0,56,101,0.2)",
          }}>
            {isManager ? "AD" : "NV"}
          </div>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: NAVY, margin: "0 0 4px" }}>
              {isManager ? "Admin FLIC" : "Nhân viên CSKH"}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", padding: "3px 10px", borderRadius: "20px", backgroundColor: isManager ? "#eff6ff" : "#fff7ed", color: isManager ? "#1565C0" : ORANGE, fontWeight: 600 }}>
                {isManager ? "Quản lý CSKH" : "Nhân viên CSKH"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#228A61", fontWeight: 500 }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#228A61" }} />
                Đang hoạt động
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {[
          { icon: User, label: "Họ và tên", value: isManager ? "Admin FLIC" : "Nhân viên CSKH" },
          { icon: Mail, label: "Email", value: isManager ? "admin@flic.edu.vn" : "staff@flic.edu.vn" },
          { icon: Building2, label: isManager ? "Kênh quản lý" : "Kênh phụ trách", value: isManager ? "Tất cả kênh" : "Zalo OA, Facebook" },
          { icon: Clock, label: "Đăng nhập lần cuối", value: "09:38 hôm nay" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "1px solid rgba(0,56,101,0.08)", padding: "18px 20px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#EBF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={17} style={{ color: NAVY }} />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", fontWeight: 600, marginBottom: "4px" }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: "14px", color: NAVY, fontWeight: 600 }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Role-specific section */}
      {isManager ? (
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,56,101,0.08)", padding: "20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Shield size={16} style={{ color: NAVY }} />
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: NAVY, margin: 0 }}>Quyền truy cập hệ thống</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {["Tổng quan", "Phân tích kênh", "Quản lý hội thoại", "AI Insights", "Keywords & Sentiment", "Sheet Chatbot", "Cài đặt hệ thống", "Quản lý người dùng"].map(perm => (
              <div key={perm} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: NAVY }}>
                <CheckCircle size={14} style={{ color: "#228A61", flexShrink: 0 }} />
                {perm}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,56,101,0.08)", padding: "20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <CheckCircle size={16} style={{ color: "#228A61" }} />
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: NAVY, margin: 0 }}>Hiệu suất cá nhân</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {[
              { label: "Hội thoại đã xử lý", value: "24", color: NAVY },
              { label: "Tỷ lệ đúng hạn", value: "98%", color: "#228A61" },
              { label: "Đánh giá TB", value: "4.8/5", color: CTA },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "center", padding: "14px", backgroundColor: "#f8fafc", borderRadius: "10px" }}>
                <div style={{ fontSize: "22px", fontWeight: 700, color, marginBottom: "4px" }}>{value}</div>
                <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}



      <OtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onConfirm={() => { toast.success("Đã đổi mật khẩu thành công"); setShowOtpModal(false); }}
      />
    </div>
  );
}
