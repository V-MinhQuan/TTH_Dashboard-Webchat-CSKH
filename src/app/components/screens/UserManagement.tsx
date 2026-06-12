import { useState } from "react";
import { Users, Edit2, Lock, KeyRound, Search, UserPlus, X, Check, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";

const NAVY = "#003865";
const ORANGE = "#D73C01";

const initialUsers = [
  { id: 1, name: "Admin FLIC", role: "Quản lý CSKH", email: "admin@flic.edu.vn", channels: "Tất cả", permissions: "Toàn hệ thống", status: "Đang hoạt động", lastLogin: "14:20 hôm nay" },
  { id: 2, name: "Thu Trang", role: "Nhân viên CSKH", email: "thutrang@flic.edu.vn", channels: "Zalo Business, Facebook", permissions: "Xử lý hội thoại, can thiệp AI, đề xuất FAQ", status: "Đang hoạt động", lastLogin: "08:15 hôm nay" },
  { id: 3, name: "Thùy NT", role: "Quản lý CSKH", email: "thuynt@flic.edu.vn", channels: "Zalo OA, Chat Widget", permissions: "Xem và xử lý toàn quyền hệ thống", status: "Đang hoạt động", lastLogin: "Hôm qua" },
  { id: 4, name: "Người dùng thử", role: "Quản lý CSKH", email: "test@flic.edu.vn", channels: "Tất cả", permissions: "Toàn quyền hệ thống (Thử nghiệm)", status: "Đang hoạt động", lastLogin: "1 tuần trước" },
];

export function UserManagement() {
  const { role } = useAuth();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);

  if (role !== "manager") {
    return (
      <div style={{ padding: "40px", textAlign: "center", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <ShieldAlert size={48} style={{ color: ORANGE, marginBottom: "16px" }} />
        <h2 style={{ color: NAVY, marginBottom: "8px" }}>Không có quyền truy cập</h2>
        <p style={{ color: "rgba(0,56,101,0.6)" }}>Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ Quản lý CSKH nếu cần hỗ trợ.</p>
      </div>
    );
  }

  const filtered = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

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
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.6)" }}>KÊNH PHỤ TRÁCH</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.6)" }}>TRẠNG THÁI</th>
              <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: 600, color: "rgba(0,56,101,0.6)" }}>HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ fontWeight: 600, color: NAVY, fontSize: "13px" }}>{user.name}</div>
                  <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)", marginTop: "2px" }}>{user.email}</div>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "20px", backgroundColor: user.role === "Quản lý CSKH" ? "#e0e7ff" : "#f1f5f9", color: user.role === "Quản lý CSKH" ? NAVY : "#475569", fontWeight: 600 }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ fontSize: "12px", color: NAVY }}>{user.channels}</div>
                  <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.5)", marginTop: "4px" }}>{user.permissions}</div>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", color: user.status === "Đang hoạt động" ? "#228A61" : "#94a3b8", fontWeight: 600 }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: user.status === "Đang hoạt động" ? "#228A61" : "#94a3b8" }} />
                    {user.status}
                  </span>
                  <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)", marginTop: "4px" }}>Đăng nhập: {user.lastLogin}</div>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setEditingUser(user)} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: NAVY }} title="Sửa quyền">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => toast.success("Đã khóa tài khoản")} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: ORANGE }} title="Khóa tài khoản">
                      <Lock size={14} />
                    </button>
                    <button onClick={() => toast.success("Đã gửi email reset mật khẩu")} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }} title="Reset mật khẩu">
                      <KeyRound size={14} />
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
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Vai trò</label>
              <select style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px" }} defaultValue={editingUser.role}>
                <option value="Nhân viên CSKH">Nhân viên CSKH</option>
                <option value="Quản lý CSKH">Quản lý CSKH</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Kênh phụ trách</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {["Zalo Business", "Facebook", "Zalo OA", "Chat Widget"].map((ch) => (
                  <label key={ch} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked={editingUser.channels.includes(ch) || editingUser.channels === "Tất cả"} />
                    {ch}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Quyền hạn</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {["Xem hội thoại", "Trả lời hội thoại", "Sửa phản hồi AI", "Đánh dấu AI sai", "Đề xuất FAQ"].map((p) => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => setEditingUser(null)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={() => { toast.success("Đã cập nhật phân quyền người dùng"); setEditingUser(null); }} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Lưu phân quyền</button>
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
              <button onClick={() => setIsAddingUser(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Họ tên</label>
                <input type="text" placeholder="Nhập họ tên" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Email</label>
                <input type="email" placeholder="Nhập email" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Số điện thoại</label>
                <input type="text" placeholder="Nhập số điện thoại" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Mật khẩu tạm thời</label>
                <input type="text" placeholder="Nhập mật khẩu" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Vai trò</label>
                <select style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}>
                  <option value="staff">Nhân viên CSKH</option>
                  <option value="manager">Quản lý CSKH</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Phòng ban</label>
                <select style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}>
                  <option value="cskh">Chăm sóc khách hàng</option>
                  <option value="tuyensinh">Tuyển sinh</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Trạng thái tài khoản</label>
              <select style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm khóa</option>
              </select>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Kênh quản lý</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {["Zalo Business", "Facebook", "Zalo OA", "Chat Widget"].map((ch) => (
                  <label key={`add-${ch}`} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked={false} />
                    {ch}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(0,56,101,0.08)" }}>
              <button onClick={() => setIsAddingUser(false)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={() => { toast.success("Đã tạo người dùng mới"); setIsAddingUser(false); }} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Tạo tài khoản</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}