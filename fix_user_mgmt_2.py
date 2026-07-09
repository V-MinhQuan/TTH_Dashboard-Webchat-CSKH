import os

file_path = 'src/app/components/screens/UserManagement.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports to include updateSettingsUserRole
if 'updateSettingsUserRole' not in content:
    content = content.replace('updateSettingsUserStatus,', 'updateSettingsUserStatus,\n  updateSettingsUserRole,')

# 2. Add states
states_injection = '''  const [newUser, setNewUser] = useState(emptyNewUser);
  const [resettingUser, setResettingUser] = useState<any>(null);
  const [editingRoleUser, setEditingRoleUser] = useState<any>(null);
  const [editingRoleValue, setEditingRoleValue] = useState<string>("");
  const [statusToggleUser, setStatusToggleUser] = useState<any>(null);

  useEffect(() => {
    if (editingRoleUser) setEditingRoleValue(editingRoleUser.role);
  }, [editingRoleUser]);'''

content = content.replace('  const [newUser, setNewUser] = useState(emptyNewUser);\n  const [resettingUser, setResettingUser] = useState<any>(null);', states_injection)


# 3. Update handleToggleUserStatus
handle_toggle_code = '''  const handleToggleUserStatus = async (targetUser: any) => {
    setStatusToggleUser(targetUser);
  };

  const confirmToggleStatus = async () => {
    if (!statusToggleUser) return;
    const targetUser = statusToggleUser;
    const username = targetUser.username || targetUser.id;
    const active = isUserActive(targetUser);
    const nextActive = !active;

    setActionLoading(`status:${username}`);
    try {
      await updateSettingsUserStatus(username, nextActive);
      toast.success(nextActive ? "Đã mở khóa tài khoản trong database" : "Đã khóa tài khoản trong database");
      await loadUsers(false);
    } catch (err: any) {
      toast.error(err?.message || "Không thể cập nhật trạng thái tài khoản.");
    } finally {
      setActionLoading(null);
      setStatusToggleUser(null);
    }
  };'''

import re
content = re.sub(r'  const handleToggleUserStatus = async.*?finally \{\n      setActionLoading\(null\);\n    \}\n  \};', handle_toggle_code, content, flags=re.DOTALL)


# 4. Add handleUpdateRole
handle_update_role_code = '''  const handleUpdateRole = async () => {
    if (!editingRoleUser) return;
    const username = editingRoleUser.username || editingRoleUser.id;
    setActionLoading(`role:${username}`);
    try {
      await updateSettingsUserRole(username, editingRoleValue);
      toast.success("Đã cập nhật vai trò trong database");
      setEditingRoleUser(null);
      await loadUsers(false);
    } catch (err: any) {
      toast.error(err?.message || "Không thể cập nhật vai trò.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (targetUser: any) => {'''

content = content.replace('  const handleResetPassword = async (targetUser: any) => {', handle_update_role_code)


# 5. Add the edit button back
edit_btn = '''                    <button onClick={() => setEditingRoleUser(user)} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: NAVY }} title="Sửa quyền">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleUserStatus(user)}'''
content = content.replace('''                    <button
                      onClick={() => handleToggleUserStatus(user)}''', edit_btn)

# 6. Add modals
modals_code = '''      {/* Edit Role Modal */}
      {editingRoleUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "400px", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Sửa quyền người dùng</h3>
              <button onClick={() => setEditingRoleUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Vai trò</label>
              <select
                value={editingRoleValue}
                onChange={(e) => setEditingRoleValue(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
              >
                <option value="Nhân viên CSKH">Nhân viên CSKH</option>
                <option value="Quản lý CSKH">Quản lý CSKH</option>
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => setEditingRoleUser(null)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={handleUpdateRole} disabled={actionLoading === `role:${editingRoleUser.username || editingRoleUser.id}`} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: NAVY, color: "#fff", cursor: actionLoading === `role:${editingRoleUser.username || editingRoleUser.id}` ? "wait" : "pointer", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                {actionLoading === `role:${editingRoleUser.username || editingRoleUser.id}` ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Status Modal */}
      {statusToggleUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "400px", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Xác nhận {isUserActive(statusToggleUser) ? "khóa" : "mở khóa"} tài khoản</h3>
              <button onClick={() => setStatusToggleUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "14px", color: "#475569", marginBottom: "24px", lineHeight: 1.5 }}>
              Bạn chắc chắn muốn {isUserActive(statusToggleUser) ? "khóa" : "mở khóa"} tài khoản <strong>{statusToggleUser.username || statusToggleUser.id}</strong>?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => setStatusToggleUser(null)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={confirmToggleStatus} disabled={actionLoading === `status:${statusToggleUser.username || statusToggleUser.id}`} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: isUserActive(statusToggleUser) ? ORANGE : "#228A61", color: "#fff", cursor: actionLoading === `status:${statusToggleUser.username || statusToggleUser.id}` ? "wait" : "pointer", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                {actionLoading === `status:${statusToggleUser.username || statusToggleUser.id}` ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
'''

content = content.replace('    </div>\n  );\n}\n', modals_code + '    </div>\n  );\n}\n')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
