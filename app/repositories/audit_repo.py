"""审计日志的写入与查询。

`audit_logs` 表建库时就有，但此前零代码引用。凭证类操作（创建/轮换模型密钥、
维护平台 Key 池）必须留痕 —— 事后要能回答「谁、什么时候、动了哪个资源的凭证」。

**meta_json 里绝不能放密钥。** 需要标记「是哪把钥匙」时只用
`app/core/crypto.py` 的 `fingerprint()`（sha256 前 8 位）：不可逆，够用来判断
两次操作动的是不是同一把钥匙，但还原不出密钥。
"""

import json
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.database import execute, fetch_all
from app.utils.logger import get_logger

logger = get_logger(__name__)


class AuditRepository:
    # 与 audit_logs.action / resource_type 的列宽一致
    MAX_ACTION_LENGTH = 50
    MAX_RESOURCE_TYPE_LENGTH = 50

    @staticmethod
    def record(
        user_id: Optional[str],
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        """写一条审计记录。

        **失败只记 warning、不抛异常**（fail-open）：审计是次要副作用，不该因为
        它写不进去就让用户建不了模型。代价是审计破损不会浮到用户面前，所以这里
        必须留下 warning —— 静默失败才是真正危险的。

        若将来审计成为合规硬要求，把这个 try 去掉改成 fail-closed 即可，调用方
        无需改动。

        `user_id` 为空时直接跳过：audit_logs.user_id 有指向 users 的外键，
        系统级操作没有主体用户，硬塞一个假 id 只会污染数据。
        """
        if not user_id:
            logger.warning(
                f"Skip audit record without actor: action={action}, resource={resource_type}"
            )
            return

        try:
            execute(
                """
                INSERT INTO audit_logs
                (id, user_id, action, resource_type, resource_id, meta_json)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    str(uuid4()),
                    user_id,
                    action[: AuditRepository.MAX_ACTION_LENGTH],
                    resource_type[: AuditRepository.MAX_RESOURCE_TYPE_LENGTH],
                    resource_id,
                    json.dumps(meta, ensure_ascii=False) if meta else None,
                ),
            )
        except Exception as exc:
            # 故意不 re-raise，见上方说明
            logger.warning(
                f"Write audit log failed (ignored): action={action}, "
                f"resource={resource_type}, error={exc}"
            )

    @staticmethod
    def list_recent(
        limit: int = 100,
        resource_type: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """按时间倒序读审计记录，供管理员排查。"""
        conditions = []
        params: List[Any] = []
        if resource_type:
            conditions.append("resource_type = %s")
            params.append(resource_type)
        if user_id:
            conditions.append("user_id = %s")
            params.append(user_id)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(max(1, min(int(limit), 500)))

        rows = fetch_all(
            f"""
            SELECT id, user_id, action, resource_type, resource_id, created_at, meta_json
            FROM audit_logs
            {where}
            ORDER BY created_at DESC
            LIMIT %s
            """,
            tuple(params),
        )

        for row in rows:
            if isinstance(row.get("meta_json"), str):
                try:
                    row["meta_json"] = json.loads(row["meta_json"])
                except json.JSONDecodeError:
                    row["meta_json"] = None
        return rows
