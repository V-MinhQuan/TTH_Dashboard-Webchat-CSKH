import { useState, useEffect } from "react";
import { Edit2, KeyRound, Loader2, Lock, Search, ShieldAlert, Unlock, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import {
  createSettingsUser,
  getAllUsers,
  resetSettingsUserPassword,
  updateSettingsUserStatus,
} from "../../services/dashboardApi";

const NAVY = "#003865";
const ORANGE = "#D73C01";

const emptyNewUser = {
  username: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  active: true,
};

export function UserManagement() {
  const { role } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);

  const loadUsers = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      toast.error("Không thể tải danh sách người dùng: " + (err?.message || "Lỗi không xác định"));
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllUsers()
      .then((data) => { if (!cancelled) setUsers(data); })
      .catch((err) => { if (!cancelled) toast.error("Không thể tải danh sách người dùng: " + err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isUserActive = (user: any) => {
    if (typeof user.active === "boolean") return user.active;
    return user.status === "Đang hoạt động";
  };

  const handleToggleUserStatus = async (targetUser: any) => {
    const username = targetUser.username || targetUser.id;
    const active = isUserActive(targetUser);
    const nextActive = !active;
    const actionText = nextActive ? "mở khóa" : "khóa";

    if (!window.confirm(`Xác nhận ${actionText} tài khoản ${username}?`)) return;

    setActionLoading(`status:${username}`);
    try {
      await updateSettingsUserStatus(username, nextActive);
      toast.success(nextActive ? "Đã mở khóa tài khoản trong database" : "Đã khóa tài khoản trong database");
      await loadUsers(false);
    } catch (err: any) {
      toast.error(err?.message || "Không thể cập nhật trạng thái tài khoản.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (targetUser: any) => {
    const username = targetUser.username || targetUser.id;
    if (!window.confirm(`Reset mật khẩu tài khoản ${username}?`)) return;

    setActionLoading(`reset:${username}`);
    try {
      const result = await resetSettingsUserPassword(username);
      window.alert(`Mật khẩu tạm thời của ${username}: ${result.temporaryPassword}`);
      toast.success("Đã reset mật khẩu trong database");
    } catch (err: any) {
      toast.error(err?.message || "Không thể reset mật khẩu.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async () => {
    const payload = {
      username: newUser.username.trim(),
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      phone: newUser.phone.trim(),
      password: newUser.password,
      active: newUser.active,
    };

    if (!payload.username || !payload.name || !payload.password) {
      toast.error("Vui lòng nhập tên đăng nhập, họ tên và mật khẩu.");
      return;
    }
    if (payload.password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setActionLoading("create");
    try {
      await createSettingsUser(payload);
      toast.success("Đã tạo người dùng trong database");
      setIsAddingUser(false);
      setNewUser(emptyNewUser);
      await loadUsers(false);
    } catch (err: any) {
      toast.error(err?.message || "Không thể tạo người dùng.");
    } finally {
      setActionLoading(null);
    }
  };

  if (role !== "manager") {
    return (
      <div style={{ padding: "40px", textAlign: "center", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <ShieldAlert size={48} style={{ color: ORANGE, marginBottom: "16px" }} />
        <h2 style={{ color: NAVY, marginBottom: "8px" }}>Không có quyền truy cập</h2>
        <p style={{ color: "rgba(0,56,101,0.6)" }}>Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ Quản lý CSKH nếu cần hỗ trợ.</p>
      </div>
    );
  }

  const keyword = search.toLowerCase();
  const filtered = users.filter((u) =>
    [u.name, u.email, u.username, u.id]
      .some((value) => String(value || "").toLowerCase().includes(keyword))
  );

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(0,56,101,0.5)" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: NAVY }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: "13px" }}>Đang tải danh sách người dùng...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>Quản lý người dùng & phân quyền</h1>
          <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)" }}>Quản lý tài khoản nhân viên, phân công kênh và cấp quyền truy cập hệ thống</p>
        </div>
        <button
          onClick={() => setIsAddingUser(true)}
          style={{ padding: "8px 16px", borderRadius: "10px", backgroundColor: NAVY, color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
        >
          <UserPlus size={16} /> Thêm người dùng
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fff", borderRadius: "10px", padding: "8px 14px", border: "1px solid rgba(0,56,101,0.1)", width: "300px" }}>
          <Search size={16} style={{ color: "rgba(0,56,101,0.4)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email..."
            style={{ border: "none", outline: "none", fontSize: "13px", color: NAVY, width: "100%" }}
          />
        </div>
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,56,101,0.08)", overflow: "hidden", flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid rgba(0,56,101,0.08)" }}>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.6)" }}>TÊN NGƯỜI DÙNG</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.6)" }}>VAI TRÒ</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.6)" }}>HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ fontWeight: 600, color: NAVY, fontSize: "13px" }}>{user.name}</div>
                  <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)", marginTop: "2px" }}>{user.email}</div>
                  <div style={{ fontSize: "11px", color: isUserActive(user) ? "#228A61" : ORANGE, marginTop: "2px", fontWeight: 600 }}>{user.status}</div>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "20px", backgroundColor: user.role === "Quản lý CSKH" ? "#e0e7ff" : "#f1f5f9", color: user.role === "Quản lý CSKH" ? NAVY : "#475569", fontWeight: 600 }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setEditingUser(user)} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: NAVY }} title="Sửa quyền">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleUserStatus(user)}
                      disabled={actionLoading === `status:${user.username || user.id}`}
                      style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: actionLoading === `status:${user.username || user.id}` ? "wait" : "pointer", color: ORANGE }}
                      title={isUserActive(user) ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                    >
                      {actionLoading === `status:${user.username || user.id}` ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : isUserActive(user) ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                    <button
                      onClick={() => handleResetPassword(user)}
                      disabled={actionLoading === `reset:${user.username || user.id}`}
                      style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: actionLoading === `reset:${user.username || user.id}` ? "wait" : "pointer", color: "#64748b" }}
                      title="Reset mật khẩu"
                    >
                      {actionLoading === `reset:${user.username || user.id}` ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <KeyRound size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "480px", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Sửa quyền người dùng</h3>
              <button onClick={() => setEditingUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Tên đăng nhập</label>
                <input readOnly value={editingUser.username || editingUser.id} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", background: "#f8fafc", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Vai trò hiện tại</label>
                <input readOnly value={editingUser.role} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", background: "#f8fafc", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Quyền hiển thị</label>
                <input readOnly value={editingUser.permissions || ""} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", background: "#f8fafc", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ marginBottom: "24px", padding: "12px 14px", borderRadius: "10px", background: "#fff7ed", border: "1px solid rgba(215,60,1,0.16)", color: ORANGE, fontSize: "12px", lineHeight: 1.5 }}>
              Bảng [User] hiện chỉ có thông tin tài khoản, trạng thái, họ tên, email, điện thoại và mật khẩu. Vì chưa có cột role/channel/permission, phần phân quyền chi tiết đang được hiển thị theo quy ước hệ thống và không ghi giả xuống database.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => setEditingUser(null)} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddingUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "560px", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: NAVY, margin: 0 }}>Thêm người dùng mới</h3>
              <button onClick={() => { setIsAddingUser(false); setNewUser(emptyNewUser); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Tên đăng nhập</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="VD: nguyenvana"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Họ tên</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Nhập họ tên"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Nhập email"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Số điện thoại</label>
                <input
                  type="text"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="Nhập số điện thoại"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Mật khẩu tạm thời</label>
                <input
                  type="text"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Tối thiểu 6 ký tự"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Trạng thái tài khoản</label>
                <select
                  value={newUser.active ? "active" : "inactive"}
                  onChange={(e) => setNewUser({ ...newUser, active: e.target.value === "active" })}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm khóa</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "24px", padding: "12px 14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid rgba(0,56,101,0.08)", color: "rgba(0,56,101,0.62)", fontSize: "12px", lineHeight: 1.5 }}>
              Tài khoản mới được ghi vào bảng [User]. Vai trò, kênh quản lý và quyền chi tiết chưa được nhập tại đây vì database hiện chưa có các cột lưu những trường này.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(0,56,101,0.08)" }}>
              <button
                onClick={() => { setIsAddingUser(false); setNewUser(emptyNewUser); }}
                style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
              >
                Hủy
              </button>
              <button
                onClick={handleCreateUser}
                disabled={actionLoading === "create"}
                style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: actionLoading === "create" ? "#cbd5e1" : NAVY, color: "#fff", cursor: actionLoading === "create" ? "wait" : "pointer", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}
              >
                {actionLoading === "create" && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                Tạo tài khoản
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
