"""认证与可复用的角色/团队权限依赖。"""

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .db import get_db
from .models import User, UserRole


_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """使用推荐的 Argon2 参数生成密码哈希。"""
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """验证明文密码，不向调用方暴露哈希实现细节。"""
    return _password_hash.verify(password, password_hash)


def _authentication_required() -> HTTPException:
    return HTTPException(status_code=401, detail="authentication required")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """从 session 读取用户，并每次请求重新从数据库加载角色信息。"""
    user_id = request.session.get("user_id")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        raise _authentication_required()

    user = db.get(User, user_id)
    if user is None:
        request.session.clear()
        raise _authentication_required()
    return user


def require_roles(*roles: UserRole | str) -> Callable:
    """生成只允许指定角色通过的 FastAPI 依赖。"""
    allowed_roles = {
        role.value if isinstance(role, UserRole) else role for role in roles
    }

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="insufficient role")
        return current_user

    return dependency


def require_team_access(
    team_id: int,
    current_user: User = Depends(get_current_user),
) -> User:
    """允许 admin 访问全部团队，maintainer 仅访问绑定团队。"""
    if current_user.role == UserRole.ADMIN.value:
        return current_user
    if (
        current_user.role == UserRole.MAINTAINER.value
        and current_user.maintainer_team_id == team_id
    ):
        return current_user
    raise HTTPException(status_code=403, detail="team access denied")
