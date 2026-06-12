import { useState, useEffect } from "react";
import { Bell, Database, Users, Save, ChevronRight, User, MessageSquare, Eye, ArrowLeft, Shield, Sliders, Globe, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { UserManagement } from "./UserManagement";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const CTA = "#D73C01";

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
          <h3 style={{ margin: 0, color: "#003865", fontSize: "16px" }}>{step === "otp" ? "Nhập mã OTP" : "Đặt mật khẩu mới"}</h3>
          <button onClick={() => { onClose(); handleReset(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
        </div>
        {step === "otp" ? (
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
              <button onClick={() => { if (otp.length < 4) { toast.error("Vui lòng nhập đầy đủ mã OTP"); return; } setStep("newpw"); }} style={{ padding: "8px 16px", borderRadius: "8px", background: "#003865", border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Xác nhận</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#003865", marginBottom: "6px" }}>Mật khẩu mới</label>
              <input type="password" placeholder="••••••••" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#003865", marginBottom: "6px" }}>Xác nhận mật khẩu mới</label>
              <input type="password" placeholder="••••••••" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => { onClose(); handleReset(); }} style={{ padding: "8px 16px", borderRadius: "8px", background: "#f1f5f9", border: "none", color: "#475569", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={() => { if (!newPw || newPw !== confirmPw) { toast.error("Mật khẩu xác nhận không khớp"); return; } onConfirm(); handleReset(); }} style={{ padding: "8px 16px", borderRadius: "8px", background: "#D73C01", border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Đổi mật khẩu</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const adminSections = [
  { id: "profile", label: "Thông tin người dùng", icon: User },
  { id: "datasource", label: "Nguồn dữ liệu", icon: Database },
  { id: "channel_config", label: "Cấu hình kênh", icon: Globe },
  { id: "users", label: "Người dùng & phân quyền", icon: Users },
  { id: "notifications", label: "Thông báo", icon: Bell },
];

const staffSections = [
  { id: "profile", label: "Thông tin cá nhân", icon: User },
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "channels", label: "Kênh phụ trách", icon: MessageSquare },
  { id: "display", label: "Tùy chọn hiển thị", icon: Eye },
];

interface ToggleProps { value: boolean; onChange: (v: boolean) => void; }

function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: "44px", height: "24px", borderRadius: "12px", backgroundColor: value ? CTA : "#e2e8f0", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: "3px", left: value ? "22px" : "3px", width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
    </div>
  );
}

export function Settings({ defaultSection = "notifications" }: { defaultSection?: string }) {
  const { role, user } = useAuth();
  const sections = role === "manager" ? adminSections : staffSections;
  const [activeSection, setActiveSection] = useState(defaultSection);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    setActiveSection(defaultSection);
  }, [defaultSection]);

  const [settings, setSettings] = useState({
    emailNotif: true, slackNotif: false, aiFailAlert: true, weeklyReport: true,
    autoEscalate: true, hallucinationDetect: true, autoFAQ: false,
    compactView: false, language: "vi", exportFormat: "xlsx", dataRetention: "90",
    showAiFailed: true, sortBy: "newest", pageSize: "20",
    channelZaloOA: true, channelZaloBiz: false, channelFacebook: true, channelWidget: false,
    alertFailRate: 15, alertResponseTime: 30, alertUncertainRate: 25,
    dataSourceZalo: true, dataSourceFb: true, dataSourceWidget: true, dataSyncInterval: "5",
  });

  const update = (key: string, value: any) => setSettings({ ...settings, [key]: value });

  const handleSave = () => {
    if (activeSection === "profile") {
      setPendingAction(() => () => toast.success("Đã lưu cài đặt thành công"));
      setShowPasscodeModal(true);
    } else {
      toast.success("Đã lưu cài đặt thành công");
    }
  };

  const fieldStyle = {
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1.5px solid rgba(0,56,101,0.12)",
    fontSize: "13px",
    color: NAVY,
    outline: "none",
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <h2 style={{ fontSize: "18px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>{title}</h2>
  );

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid rgba(0,56,101,0.08)", backgroundColor: "#f8fafc", ...style }}>
      {children}
    </div>
  );

  const renderSection = () => {
    if (role === "staff" && !staffSections.find((s) => s.id === activeSection)) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center", gap: "16px" }}>
          <div style={{ width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={28} style={{ color: ORANGE }} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: NAVY, marginBottom: "8px" }}>Không có quyền truy cập</div>
            <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", lineHeight: 1.6, maxWidth: "380px" }}>
              Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ Quản lý CSKH nếu cần hỗ trợ.
            </div>
          </div>
          <button onClick={() => setActiveSection("profile")} style={{ padding: "9px 22px", borderRadius: "9px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={14} /> Quay lại
          </button>
        </div>
      );
    }

    if (activeSection === "profile") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SectionTitle title={role === "manager" ? "Thông tin người dùng" : "Thông tin cá nhân"} />
          <Card>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: NAVY, marginBottom: "16px" }}>Thông tin tài khoản</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Họ và tên</label>
                <input type="text" defaultValue={user ? user.name : (role === "manager" ? "Admin FLIC" : "Nhân viên CSKH")} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Email</label>
                <input type="text" defaultValue={user ? user.email : (role === "manager" ? "admin@flic.edu.vn" : "staff@flic.edu.vn")} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Số điện thoại</label>
                <input type="text" defaultValue="0123456789" style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Vai trò</label>
                <input type="text" readOnly value={role === "manager" ? "Quản lý CSKH" : "Nhân viên"} style={{ ...fieldStyle, width: "100%", boxSizing: "border-box", backgroundColor: "#f1f5f9" }} />
              </div>
            </div>
            <button onClick={handleSave} style={{ marginTop: "16px", padding: "8px 16px", borderRadius: "8px", backgroundColor: NAVY, color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Lưu thông tin</button>
          </Card>
          <Card>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: NAVY, marginBottom: "16px" }}>Đổi mật khẩu</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" }}>
              {["Mật khẩu hiện tại", "Mật khẩu mới", "Xác nhận mật khẩu mới"].map((label) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.5)", marginBottom: "4px" }}>{label}</label>
                  <input type="password" placeholder="••••••••" style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
              ))}
              <button onClick={() => {
                setShowOtpModal(true);
              }} style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "#fff", border: "1px solid rgba(0,56,101,0.15)", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px", alignSelf: "flex-start" }}>
                Đổi mật khẩu
              </button>
            </div>
          </Card>
        </div>
      );
    }

    if (activeSection === "users") {
      return <div style={{ margin: "-28px" }}><UserManagement /></div>;
    }

    if (activeSection === "notifications") {
      const notifItems = role === "manager"
        ? [
            { label: "Thông báo qua Email", desc: "Nhận cảnh báo và báo cáo qua email", key: "emailNotif" },
            { label: "Thông báo qua Slack", desc: "Kết nối Slack workspace để nhận alert", key: "slackNotif" },
            { label: "Cảnh báo AI thất bại", desc: "Thông báo ngay khi tỷ lệ AI thất bại vượt ngưỡng", key: "aiFailAlert" },
            { label: "Báo cáo tuần tự động", desc: "Gửi báo cáo tổng hợp mỗi thứ Hai", key: "weeklyReport" },
          ]
        : [
            { label: "Thông báo hội thoại mới", desc: "Nhận thông báo khi có hội thoại mới được phân công", key: "emailNotif" },
            { label: "Cảnh báo AI thất bại", desc: "Thông báo khi AI trả lời không đúng trong kênh phụ trách", key: "aiFailAlert" },
            { label: "Báo cáo hiệu suất tuần", desc: "Nhận tóm tắt hiệu suất cá nhân mỗi tuần", key: "weeklyReport" },
          ];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SectionTitle title="Thông báo" />
          {notifItems.map(({ label, desc, key }) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(0,56,101,0.08)", backgroundColor: "#f8fafc" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: NAVY }}>{label}</div>
                <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginTop: "2px" }}>{desc}</div>
              </div>
              <Toggle value={(settings as any)[key]} onChange={(v) => update(key, v)} />
            </div>
          ))}
        </div>
      );
    }

    if (activeSection === "datasource" && role === "manager") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SectionTitle title="Nguồn dữ liệu" />
          <Card>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: NAVY, marginBottom: "16px" }}>Kết nối nguồn dữ liệu</h3>
            {[
              { key: "dataSourceZalo", label: "Zalo OA", desc: "Đồng bộ hội thoại từ Zalo Official Account" },
              { key: "dataSourceFb", label: "Facebook Messenger", desc: "Đồng bộ hội thoại từ Facebook Fanpage" },
              { key: "dataSourceWidget", label: "Chat Widget", desc: "Đồng bộ hội thoại từ widget nhúng trên website" },
            ].map(({ key, label, desc }) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: NAVY }}>{label}</div>
                  <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginTop: "2px" }}>{desc}</div>
                </div>
                <Toggle value={(settings as any)[key]} onChange={(v) => update(key, v)} />
              </div>
            ))}
          </Card>
          <Card>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: NAVY, marginBottom: "12px" }}>Cài đặt đồng bộ</h3>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 600, fontSize: "13px", color: NAVY, marginBottom: "8px" }}>Chu kỳ đồng bộ dữ liệu</div>
              <select value={settings.dataSyncInterval} onChange={(e) => update("dataSyncInterval", e.target.value)} style={{ ...fieldStyle }}>
                <option value="1">Mỗi 1 phút</option>
                <option value="5">Mỗi 5 phút</option>
                <option value="15">Mỗi 15 phút</option>
                <option value="30">Mỗi 30 phút</option>
              </select>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px", color: NAVY, marginBottom: "8px" }}>Định dạng xuất mặc định</div>
              <select value={settings.exportFormat} onChange={(e) => update("exportFormat", e.target.value)} style={{ ...fieldStyle }}>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
                <option value="pdf">PDF (.pdf)</option>
              </select>
            </div>
          </Card>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px", color: NAVY }}>Thời gian lưu trữ dữ liệu</div>
                <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginTop: "2px" }}>Dữ liệu hội thoại sẽ được lưu trong thời gian này</div>
              </div>
              <select value={settings.dataRetention} onChange={(e) => update("dataRetention", e.target.value)} style={{ ...fieldStyle }}>
                <option value="30">30 ngày</option>
                <option value="90">90 ngày</option>
                <option value="365">1 năm</option>
              </select>
            </div>
          </Card>
        </div>
      );
    }

    if (activeSection === "channel_config" && role === "manager") {
      const channels = [
        { key: "channelZaloOA", label: "Zalo OA", desc: "Kênh Zalo Official Account chính" },
        { key: "channelZaloBiz", label: "Zalo Business", desc: "Kênh Zalo Business doanh nghiệp" },
        { key: "channelFacebook", label: "Facebook", desc: "Kênh Facebook Fanpage" },
        { key: "channelWidget", label: "Chat Widget", desc: "Kênh widget nhúng trên website" },
      ];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SectionTitle title="Cấu hình kênh" />
          <Card>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: NAVY, marginBottom: "16px" }}>Kênh đang hoạt động</h3>
            {channels.map(({ key, label, desc }) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: NAVY }}>{label}</div>
                  <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginTop: "2px" }}>{desc}</div>
                </div>
                <Toggle value={(settings as any)[key]} onChange={(v) => update(key, v)} />
              </div>
            ))}
          </Card>
          <Card>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: NAVY, marginBottom: "16px" }}>Phân công nhân viên</h3>
            <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.6)", lineHeight: 1.7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span>Zalo OA</span>
                <select style={{ ...fieldStyle, fontSize: "12px" }}>
                  <option>Nhân viên A (NV-001)</option>
                  <option>Nhân viên B (NV-002)</option>
                  <option>Tự động phân công</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Facebook</span>
                <select style={{ ...fieldStyle, fontSize: "12px" }}>
                  <option>Nhân viên B (NV-002)</option>
                  <option>Nhân viên A (NV-001)</option>
                  <option>Tự động phân công</option>
                </select>
              </div>
            </div>
          </Card>
        </div>
      );
    }



    if (activeSection === "channels" && role === "staff") {
      const channelList = [
        { key: "channelZaloOA", label: "Zalo OA" },
        { key: "channelZaloBiz", label: "Zalo Business" },
        { key: "channelFacebook", label: "Facebook" },
        { key: "channelWidget", label: "Chat Widget" },
      ];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SectionTitle title="Kênh phụ trách" />
          <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)", marginTop: "-12px" }}>Chọn các kênh bạn phụ trách để lọc hội thoại và thông báo phù hợp</p>
          {channelList.map(({ key, label }) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(0,56,101,0.08)", backgroundColor: "#f8fafc" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", color: NAVY }}>{label}</div>
              <Toggle value={(settings as any)[key]} onChange={(v) => update(key, v)} />
            </div>
          ))}
        </div>
      );
    }

    if (activeSection === "display" && role === "staff") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SectionTitle title="Tùy chọn hiển thị hội thoại" />
          <Card style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: NAVY, marginBottom: "8px" }}>Số hội thoại mỗi trang</div>
              <select value={settings.pageSize} onChange={(e) => update("pageSize", e.target.value)} style={{ ...fieldStyle }}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: NAVY, marginBottom: "8px" }}>Sắp xếp theo</div>
              <select value={settings.sortBy} onChange={(e) => update("sortBy", e.target.value)} style={{ ...fieldStyle }}>
                <option value="newest">Mới nhất</option>
                <option value="priority">Ưu tiên cao</option>
                <option value="unread">Chưa xử lý trước</option>
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: NAVY }}>Hiển thị hội thoại AI thất bại</div>
                <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginTop: "2px" }}>Ưu tiên hiển thị hội thoại AI trả lời sai</div>
              </div>
              <Toggle value={settings.showAiFailed} onChange={(v) => update("showAiFailed", v)} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: NAVY }}>Chế độ gọn</div>
                <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginTop: "2px" }}>Hiển thị nhiều hội thoại hơn trong cùng không gian</div>
              </div>
              <Toggle value={settings.compactView} onChange={(v) => update("compactView", v)} />
            </div>
          </Card>
        </div>
      );
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
          {activeSection !== "users" && (
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(0,56,101,0.08)" }}>
              <button onClick={handleSave} style={{ padding: "10px 28px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg, ${ORANGE}, ${CTA})`, cursor: "pointer", color: "#fff", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(215,60,1,0.3)" }}>
                <Save size={16} /> Lưu thay đổi
              </button>
            </div>
          )}
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
        onConfirm={() => {
          toast.success("Đã đổi mật khẩu thành công");
          setShowOtpModal(false);
        }}
      />
    </div>
  );
}
