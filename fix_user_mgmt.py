import re

file_path = 'src/app/components/screens/UserManagement.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update emptyNewUser
content = content.replace(
    '''const emptyNewUser = {
  username: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  active: true,
};''',
    '''const emptyNewUser = {
  username: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  active: true,
  role: "Nhân viên CSKH",
};'''
)

# 2. Add resetting state
content = content.replace(
    '''const [newUser, setNewUser] = useState(emptyNewUser);''',
    '''const [newUser, setNewUser] = useState(emptyNewUser);
  const [resettingUser, setResettingUser] = useState<any>(null);'''
)

# 3. Update handleResetPassword
content = content.replace(
    '''  const handleResetPassword = async (targetUser: any) => {
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
  };''',
    '''  const handleResetPassword = async (targetUser: any) => {
    setResettingUser(targetUser);
  };

  const confirmResetPassword = async () => {
    if (!resettingUser) return;
    const username = resettingUser.username || resettingUser.id;
    setActionLoading(`reset:${username}`);
    try {
      const result = await resetSettingsUserPassword(username);
      window.alert(`Mật khẩu tạm thời của ${username}: ${result.temporaryPassword}`);
      toast.success("Đã reset mật khẩu trong database");
    } catch (err: any) {
      toast.error(err?.message || "Không thể reset mật khẩu.");
    } finally {
      setActionLoading(null);
      setResettingUser(null);
    }
  };'''
)

# 4. Update handleCreateUser to pass role
content = content.replace(
    '''      password: newUser.password,
      active: newUser.active,
    };''',
    '''      password: newUser.password,
      active: newUser.active,
      role: newUser.role,
    };'''
)

# 5. Remove "Sửa quyền" button
content = content.replace(
    '''                    <button onClick={() => setEditingUser(user)} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: NAVY }} title="Sửa quyền">
                      <Edit2 size={14} />
                    </button>''',
    ''
)

# 6. Remove editingUser modal block entirely
pattern = re.compile(r'\s*\{\/\* Edit Modal \*\/\}.*?setEditingUser\(null\).*?\}\).*?</div>\n\s*\}\)', re.DOTALL)
content = pattern.sub('', content)

# 7. Replace role placeholder text and add select to AddUserModal
# We'll replace the div with the text:
# <div style={{ marginBottom: "24px", padding: "12px 14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid rgba(0,56,101,0.08)", color: "rgba(0,56,101,0.62)", fontSize: "12px", lineHeight: 1.5 }}>...
text_block = '''            <div style={{ marginBottom: "24px", padding: "12px 14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid rgba(0,56,101,0.08)", color: "rgba(0,56,101,0.62)", fontSize: "12px", lineHeight: 1.5 }}>
              Tài khoản mới được ghi vào bảng WebChat_User. Vai trò, kênh quản lý và quyền chi tiết chưa được nhập tại đây vì database hiện chưa có các cột lưu những trường này.
            </div>'''
role_select = '''            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>Vai trò</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
              >
                <option value="Nhân viên CSKH">Nhân viên CSKH</option>
                <option value="Quản lý CSKH">Quản lý CSKH</option>
              </select>
            </div>'''
content = content.replace(text_block, role_select)

# 8. Add reset modal at the end, right before return ( ...
reset_modal = '''      {/* Reset Password Modal */}
      {resettingUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "400px", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Reset mật khẩu</h3>
              <button onClick={() => setResettingUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)" }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "14px", color: "#475569", marginBottom: "24px", lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn reset mật khẩu cho tài khoản <strong>{resettingUser.username || resettingUser.id}</strong> không?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => setResettingUser(null)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", color: NAVY, cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Hủy</button>
              <button onClick={confirmResetPassword} disabled={actionLoading === `reset:${resettingUser.username || resettingUser.id}`} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: ORANGE, color: "#fff", cursor: actionLoading === `reset:${resettingUser.username || resettingUser.id}` ? "wait" : "pointer", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                {actionLoading === `reset:${resettingUser.username || resettingUser.id}` ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
                Reset mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}
'''
# insert it before `    </div>` at the end
content = content.replace('    </div>\n  );\n}\n', reset_modal + '    </div>\n  );\n}\n')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
