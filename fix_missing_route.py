import re

file_path = 'backend/app/routers/settings.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add UserRoleSchema
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
    content = content.replace('@router.patch("/users/{username}/status")', new_route + '\n\n@router.patch("/users/{username}/status")')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
