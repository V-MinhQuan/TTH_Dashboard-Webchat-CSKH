import re

file_path = 'src/app/components/screens/UserManagement.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add handleInlineRoleChange, replace handleUpdateRole
handle_inline = '''  const handleInlineRoleChange = async (targetUser: any, newRole: string) => {
    const username = targetUser.username || targetUser.id;
    setActionLoading(`role:${username}`);
    try {
      await updateSettingsUserRole(username, newRole);
      toast.success("Đã cập nhật vai trò trong database");
      await loadUsers(false);
    } catch (err: any) {
      toast.error(err?.message || "Không thể cập nhật vai trò.");
    } finally {
      setActionLoading(null);
    }
  };'''

content = re.sub(r'  const handleUpdateRole = async.*?finally \{\n      setActionLoading\(null\);\n    \}\n  \};', handle_inline, content, flags=re.DOTALL)

# 2. Remove editingRoleUser states
content = re.sub(r'  const \[editingRoleUser, setEditingRoleUser\] = useState<any>\(null\);\n  const \[editingRoleValue, setEditingRoleValue\] = useState<string>\(""\);\n', '', content)
content = re.sub(r'  useEffect\(\(\) => \{\n    if \(editingRoleUser\) setEditingRoleValue\(editingRoleUser.role\);\n  \}, \[editingRoleUser\]\);\n\n', '', content)

# 3. Remove Edit Role Modal
content = re.sub(r'      \{\/\* Edit Role Modal \*\/\}.*?\{\/\* Toggle Status Modal \*\/\}', '{/* Toggle Status Modal */}', content, flags=re.DOTALL)

# 4. Remove Edit button
edit_btn = '''                    <button onClick={() => setEditingRoleUser(user)} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: NAVY }} title="Sửa quyền">\n                      <Edit2 size={14} />\n                    </button>\n'''
content = content.replace(edit_btn, '')

# 5. Replace span with select
old_span = '''                  <span style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "20px", backgroundColor: user.role === "Quản lý CSKH" ? "#e0e7ff" : "#f1f5f9", color: user.role === "Quản lý CSKH" ? NAVY : "#475569", fontWeight: 600 }}>
                    {user.role}
                  </span>'''
new_select = '''                  <select
                    value={user.role}
                    onChange={(e) => handleInlineRoleChange(user, e.target.value)}
                    disabled={actionLoading === `role:${user.username || user.id}`}
                    style={{ fontSize: "11px", padding: "4px 24px 4px 12px", borderRadius: "20px", backgroundColor: user.role === "Quản lý CSKH" ? "#e0e7ff" : "#f1f5f9", color: user.role === "Quản lý CSKH" ? NAVY : "#475569", fontWeight: 600, border: "none", outline: "none", cursor: actionLoading === `role:${user.username || user.id}` ? "wait" : "pointer" }}
                  >
                    <option value="Nhân viên CSKH">Nhân viên CSKH</option>
                    <option value="Quản lý CSKH">Quản lý CSKH</option>
                  </select>'''
content = content.replace(old_span, new_select)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
