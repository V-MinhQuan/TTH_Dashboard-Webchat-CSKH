import os

# 1. Update dashboardApi.ts
file_path = 'src/app/services/dashboardApi.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_func = '''
export async function updateSettingsUserRole(username: string, role: string) {
  const resJson = await fetchApiJson<{ success: boolean; data: any; message?: string }>(
    buildApiUrl(`/api/settings/users/${encodeURIComponent(username)}/role`),
    {
      method: "PUT",
      cache: false,
      body: JSON.stringify({ role }),
    }
  );
  if (!resJson.success) {
    throw new Error(resJson.message || "Không thể cập nhật vai trò người dùng.");
  }
  return resJson.data;
}
'''
if 'updateSettingsUserRole' not in content:
    content += '\n' + new_func

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)


# 2. Update backend/app/routers/settings.py
file_path = 'backend/app/routers/settings.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'class UserRoleSchema(BaseModel):' not in content:
    content = content.replace('class UserStatusSchema(BaseModel):', 'class UserRoleSchema(BaseModel):\n    role: str\n\n\nclass UserStatusSchema(BaseModel):')

new_route = '''
@router.put("/users/{username}/role")
def update_user_role(
    username: str,
    body: UserRoleSchema,
    _: SessionClaims = Depends(require_roles("manager")),
):
    try:
        data = user_service.update_user_role(username, body.role)
        return {
            "success": True,
            "message": "Update user role successfully",
            "data": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
'''

if 'def update_user_role(' not in content:
    content = content.replace('@router.put("/users/{username}/status")', new_route + '\n\n@router.put("/users/{username}/status")')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)


# 3. Update backend/app/settings/user_service.py
file_path = 'backend/app/settings/user_service.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_svc = '''
    def update_user_role(self, username: str, role: str) -> dict:
        user_repository.update_user_role(username, role)
        return {"updated": True, "role": role}
'''

if 'def update_user_role(' not in content:
    content = content.replace('    def update_profile(', new_svc + '\n    def update_profile(')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)


# 4. Update backend/app/settings/user_repository.py
file_path = 'backend/app/settings/user_repository.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_repo = '''
    def update_user_role(self, username: str, role: str) -> bool:
        username = username.strip()
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE [WebChat_User] SET VaiTro = %s WHERE UserName = %s",
                (role, username)
            )
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"[UserRepository] Lỗi cập nhật quyền DB: {e}")
            raise e
        finally:
            if conn:
                conn.close()
        return False
'''

if 'def update_user_role(' not in content:
    content = content.replace('    def update_profile(', new_repo + '\n    def update_profile(')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
