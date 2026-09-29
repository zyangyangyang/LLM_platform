# 后端部署说明

本文档说明大模型安全评测平台后端（FastAPI + Celery）的部署步骤。

## 1. 环境要求

- Python 3.11+
- Docker（推荐，用于提供 MySQL 8.0 与 Redis 7），或本机安装 MySQL 8.0、Redis 7

## 2. 启动基础设施（MySQL + Redis）

项目根目录的 `docker-compose.yml` 已配置好 MySQL 与 Redis：

```powershell
docker compose up -d
```

- MySQL：`127.0.0.1:3306`（root / `123456` / 库 `safety_platform`）
- Redis：`127.0.0.1:6379`（Celery broker + 模型限流）
- 首次启动会自动执行 `app/safety_platform.sql` 初始化表结构

> 若 Docker Desktop 引擎未启动，先启动 Docker Desktop 再执行上面的命令。

## 3. 初始化 / 迁移数据库

- **全新部署**：Docker 首次启动已自动建表（含 `attack_strategies`、`defense_strategies` 等），无需手动执行 SQL。
- **旧库升级**（或需要补预置数据时），按顺序执行迁移脚本：

```powershell
python scripts/add_task_type_column.py
python scripts/add_user_roles_and_platform_presets.py
python scripts/add_defense_strategy.py
```

脚本均为幂等，可重复执行。

## 4. 安装后端依赖

```powershell
python -m pip install -r app/requirements.txt
```

## 5. 配置环境变量

模型密钥通过环境变量引用（**不落库**），按需设置：

| 环境变量 | 用途 |
|---|---|
| `DASHSCOPE_API_KEY` | 被测模型（`qwen-plus` 预置）的 API Key |
| `DASHSCOPE_API_KEY1` | 语义裁判模型的 API Key |

可选：用 `SAFETY_` 前缀覆盖平台配置（如 `SAFETY_DB_HOST`、`SAFETY_MAX_CONCURRENT_RUNS`），字段见 `app/core/config.py`。

## 6. 启动后端服务

```powershell
# 终端 1：API 服务
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 终端 2：Celery worker（真正执行评测任务）
python -m celery -A app.workers.celery_app worker --loglevel=info --pool=solo
```

> Windows 上 Celery 必须加 `--pool=solo`；Linux/macOS 可省略。

## 7. 管理员提权

创建攻击/防御策略需要 `platform_admin` 角色。注册用户后执行：

```powershell
python scripts/grant_platform_admin.py <邮箱>
```

## 8. 验证

```powershell
# 健康检查
curl http://localhost:8000/health
# 预期：{"status":"ok"}

# 注册 / 登录
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"123456","name":"admin"}'
```

## 9. 常见问题

- **MySQL 连接被拒绝（WinError 10061）**：Docker Desktop 引擎没启动，先启动 Docker Desktop 再 `docker compose up -d`。
- **创建策略返回 403**：当前用户不是 `platform_admin`，执行第 7 步提权。
- **`git` 命令不存在**：Git 装在 `D:\Git` 但未加入 PATH，将 `D:\Git\cmd` 加入用户 PATH 后重开终端。
- **Celery worker 在 Windows 启动失败**：检查是否漏了 `--pool=solo`。

> 安全提示：默认数据库密码、JWT secret 均为本地开发默认值，生产环境请务必修改。
