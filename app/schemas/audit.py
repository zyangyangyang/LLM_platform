from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """审计记录。`meta_json` 由写入方保证不含任何密钥明文或密文。"""

    id: str
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    meta_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True
