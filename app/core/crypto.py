"""模型密钥的加密存储（BYOK）。

用户自带密钥时，明文只在内存里短暂存在，落库的一律是 Fernet 密文，形如
`enc:v1:<token>`。

**为什么复用 auth_secret_ref 这一列而不是新加列**：该列原本只存「环境变量名」，
加个前缀就能区分两种形态。这样 repo 的 SELECT/INSERT 不用改、`_to_response`
本来就剥离该列、平台密钥池也能用同一套判别；新加列则要同时动 schema、repo 和
两处 Pydantic，等于把同一件事写两遍。

**本模块的异常一律不含 token、也不含明文** —— 只描述失败原因本身。这不是
洁癖：异常会被日志和 HTTP 响应带出去，一旦把密文或密钥拼进消息就等于自己
把敏感值散播到所有能看到报错的地方。
"""

import hashlib
from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.core.config import get_settings

# 密文前缀。带版本号是为了将来换算法时能识别旧数据；
# 也用来和「环境变量名」区分 —— 后者不可能以 `enc:` 开头，
# 而且写入时我们显式拒绝以它开头的环境变量名，杜绝歧义。
ENC_PREFIX = "enc:v1:"

# 与 model_configs.auth_secret_ref / platform_model_keys.secret_ref 的列宽一致。
# 在这里挡住超长值是刻意的：MySQL 在非严格模式下会**静默截断**超长字符串，
# 于是密文写入成功、直到评测时才解密失败，排查成本极高。宁可写入时就报错。
MAX_ENCRYPTED_LENGTH = 512

# 进程内缓存的 MultiFernet，键随主密钥配置变化而重建
_fernet: MultiFernet | None = None
_fernet_source: str | None = None


class CredentialCryptoError(Exception):
    """密钥加解密失败。消息里不含密文与明文。"""


def is_encrypted(ref: object) -> bool:
    """判断某个 auth_secret_ref 是密文，还是环境变量名。"""
    return isinstance(ref, str) and ref.startswith(ENC_PREFIX)


def get_fernet() -> MultiFernet:
    """构造（并缓存）MultiFernet。

    用 MultiFernet 而非单个 Fernet 是为了轮换：配置里密钥按逗号分隔，第一个
    用于加密、全部参与解密。轮换时把新密钥放最前面、旧密钥留在后面，既有密文
    照样解得开，不需要停机重写数据。
    """
    global _fernet, _fernet_source

    keys = get_settings().secret_encryption_keys
    if not keys:
        raise CredentialCryptoError(
            "服务端未启用自带密钥：缺少主密钥 SAFETY_SECRET_ENCRYPTION_KEY"
        )

    source = ",".join(keys)
    if _fernet is None or _fernet_source != source:
        try:
            _fernet = MultiFernet([Fernet(key.encode("ascii")) for key in keys])
        except Exception:
            # from None：原始异常可能带着密钥本身，不能让它冒出去
            raise CredentialCryptoError(
                "主密钥格式非法：应为 Fernet 生成的 urlsafe base64 字符串"
            ) from None
        _fernet_source = source

    return _fernet


def encrypt_secret(plaintext: str) -> str:
    """把明文密钥加密成 `enc:v1:<token>`，用于落库。"""
    text = (plaintext or "").strip()
    if not text:
        raise CredentialCryptoError("密钥不能为空")

    token = get_fernet().encrypt(text.encode("utf-8")).decode("ascii")
    encrypted = f"{ENC_PREFIX}{token}"

    if len(encrypted) > MAX_ENCRYPTED_LENGTH:
        raise CredentialCryptoError(
            f"密钥过长：加密后 {len(encrypted)} 字符，超过 {MAX_ENCRYPTED_LENGTH} 上限"
        )
    return encrypted


def decrypt_secret(ref: str) -> str:
    """把 `enc:v1:<token>` 还原成明文密钥。仅在被调用的那一刻存在于内存。"""
    if not is_encrypted(ref):
        raise CredentialCryptoError("不是加密存储的密钥，无法解密")

    token = ref[len(ENC_PREFIX):]
    try:
        return get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        raise CredentialCryptoError(
            "密钥解密失败：主密钥与该密文不匹配（是否轮换过主密钥？）"
        ) from None
    except Exception:
        raise CredentialCryptoError("密钥解密失败：密文已损坏") from None


def fingerprint(plaintext: str) -> str:
    """明文密钥的短指纹（sha256 前 8 位），仅用于审计记录。

    审计日志需要一个「能认出是哪把钥匙」的标记，但绝不能是密钥本身。
    指纹不可逆，且这里刻意截短，避免被当作校验值滥用。
    """
    return hashlib.sha256((plaintext or "").encode("utf-8")).hexdigest()[:8]
