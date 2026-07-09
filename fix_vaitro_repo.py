import re

file_path = 'backend/app/settings/user_repository.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix get_user_by_username
content = content.replace(
    '"SELECT UserName, DangHoatDong, HoTen, ShortName, Email, DienThoai, Password FROM [WebChat_User] WHERE UserName = %s"',
    '"SELECT UserName, DangHoatDong, HoTen, ShortName, Email, DienThoai, Password, VaiTro FROM [WebChat_User] WHERE UserName = %s"'
)

# In get_user_by_username, change role mapping
old_role = '"role": "manager" if row["UserName"] in ("test", "thuynt", "admin") else "staff",'
new_role = '"role": "manager" if row.get("VaiTro") == "Quản lý CSKH" else "staff" if row.get("VaiTro") == "Nhân viên CSKH" else ("manager" if row["UserName"] in ("test", "thuynt", "admin") else "staff"),'
content = content.replace(old_role, new_role)

# 2. Fix get_all_users
content = content.replace(
    '"SELECT UserName, DangHoatDong, HoTen, ShortName, Email, DienThoai FROM [WebChat_User]"',
    '"SELECT UserName, DangHoatDong, HoTen, ShortName, Email, DienThoai, VaiTro FROM [WebChat_User]"'
)

# In get_all_users, change role mapping
old_role2 = '                role = "Quản lý CSKH" if row["UserName"] in ("test", "thuynt", "admin") else "Nhân viên CSKH"'
new_role2 = '                role = row.get("VaiTro") or ("Quản lý CSKH" if row["UserName"] in ("test", "thuynt", "admin") else "Nhân viên CSKH")'
content = content.replace(old_role2, new_role2)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
