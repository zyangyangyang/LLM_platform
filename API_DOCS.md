# 大模型安全测评平台 API 接口文档

本文档详细描述了安全测评平台的后端接口设计。

## 1. 认证模块 (Auth)

### 1.1 用户注册
- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "strong_password",
    "name": "User Name"
  }
  ```
- **Response**:
  ```json
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "roles": ["evaluator"]
  }
  ```
- **说明**: 新注册用户默认分配 `evaluator`（测评用户）角色。

### 1.2 用户登录
- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Form Data**:
  - `username`: 邮箱地址
  - `password`: 密码
- **Response**:
  ```json
  {
    "access_token": "jwt_token_string",
    "token_type": "bearer"
  }
  ```

### 1.3 获取当前用户信息
- **URL**: `/api/auth/users/me`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "status": "active",
    "roles": ["evaluator"],
    "created_at": "2024-01-01T12:00:00"
  }
  ```
- **角色说明**:
  - `evaluator`: 测评用户，保留当前已有模型、数据集、任务和结果接口权限。
  - `platform_admin`: 平台管理员，可调用管理员接口上传平台预置大模型和测试数据集配置。

---

## 2. 模型配置管理 (Model Configs)

### 2.1 获取平台预置模型列表
- **URL**: `/api/presets`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **说明**: 返回系统配置中的预置模型与平台管理员新增的预置模型。敏感字段如 `endpoint`、`auth_secret_ref` 不在列表接口中返回。
- **Response**:
  ```json
  [
    {
      "id": "qwen-plus",
      "name": "qwen-plus",
      "provider": "openai",
      "description": "Platform preset model"
    }
  ]
  ```

### 2.2 使用平台预置模型创建用户模型配置
- **URL**: `/api/models/from-preset?preset_id={preset_id}`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: ModelConfigResponse

### 2.3 创建模型配置
- **URL**: `/api/models`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "GPT-4 Test Config",
    "provider": "openai",  // openai, azure, huggingface, local
    "endpoint": "https://api.openai.com/v1",
    "auth_type": "bearer", // bearer, api_key, none
    "auth_secret_ref": "OPENAI_API_KEY", // 密钥引用名，不传真实 Key
    "params_json": {
      "temperature": 0.7,
      "max_tokens": 1000
    }
  }
  ```
- **Response**: ModelConfigResponse
- **安全说明**: `auth_secret_ref` 仅作为创建/更新入参使用，响应中不会返回该字段；后端响应只返回 `has_auth_secret`。

ModelConfigResponse 示例：
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "GPT-4 Test Config",
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1",
  "auth_type": "bearer",
  "params_json": {
    "temperature": 0.7,
    "max_tokens": 1000
  },
  "has_auth_secret": true,
  "platform_preset_id": null,
  "created_at": "2024-01-01T12:00:00"
}
```

### 2.4 获取用户下的模型配置列表
- **URL**: `/api/models`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: List[ModelConfigResponse]

### 2.5 获取单个模型配置详情
- **URL**: `/api/models/{model_id}`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: ModelConfigResponse

### 2.6 删除模型配置
- **URL**: `/api/models/{model_id}`
- **Method**: `DELETE`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: 204 No Content

---

## 3. 数据集管理 (Datasets)

### 3.1 获取平台预置数据集列表
- **URL**: `/api/datasets/presets`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **说明**: 返回系统配置中的预置数据集与平台管理员新增的预置数据集。
- **Response**:
  ```json
  [
    {
      "id": "prompt-attack-v1",
      "name": "Prompt Attack Benchmark",
      "description": "Prompt injection and jailbreak benchmark",
      "source_type": "file_upload",
      "storage_uri": "d:\\LLM_platform\\prompt_attack_dataset.json",
      "schema_json": {"prompt_field": "malicious_prompt"}
    }
  ]
  ```

### 3.2 使用平台预置数据集创建用户数据集
- **URL**: `/api/datasets/from-preset?preset_id={preset_id}`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: DatasetResponse

### 3.3 注册数据集
- **URL**: `/api/datasets/`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "Safety Test Set v1",
    "description": "包含越狱攻击样本",
    "source_type": "file_upload", // file_upload, s3, url
    "storage_uri": "/data/uploads/file.jsonl",
    "schema_json": {}
  }
  ```

### 3.4 获取用户下的数据集
- **URL**: `/api/datasets/`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`

### 3.5 上传数据集文件
- **URL**: `/api/datasets/upload`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: `.json` 或 `.jsonl` 文件
  - `name`: 数据集名称
  - `description`: 可选
  - `schema_json`: 可选，字符串形式的 JSON（如 `{"prompt_field":"description"}`）
- **Response**: DatasetResponse
- **说明**: 文件保存到服务器 `uploads/datasets/{user_id}/` 目录，自动避免重名覆盖

---

## 4. 平台管理员接口 (Admin)

以下接口仅 `platform_admin` 角色可访问，普通 `evaluator` 用户会返回 `403 Insufficient permissions`。

### 4.1 新增平台预置大模型配置
- **URL**: `/api/admin/model-presets`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <platform_admin_token>`
- **Request Body**:
  ```json
  {
    "id": "qwen-max-platform",
    "name": "qwen-max",
    "provider": "openai",
    "endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "auth_type": "bearer",
    "auth_secret_ref": "DASHSCOPE_API_KEY",
    "params_json": {
      "model": "qwen-max",
      "temperature": 0.2,
      "max_tokens": 1024
    },
    "description": "Platform managed Qwen Max preset"
  }
  ```
- **字段说明**:
  - `id`: 可选；不传时由后端生成 UUID。建议平台预置使用稳定可读 ID。
  - `auth_secret_ref`: 只能填写环境变量名或密钥引用名，不能填写真实 Key。模型调用时后端只从运行环境变量读取真实 Key。
- **Response**:
  ```json
  {
    "id": "qwen-max-platform",
    "name": "qwen-max",
    "provider": "openai",
    "endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "auth_type": "bearer",
    "params_json": {
      "model": "qwen-max",
      "temperature": 0.2,
      "max_tokens": 1024
    },
    "description": "Platform managed Qwen Max preset",
    "created_by": "admin-user-id",
    "created_at": "2024-01-01T12:00:00"
  }
  ```
- **安全说明**: 当前接口用于登记平台预置模型配置和密钥引用，不提供真实 Key 托管能力。管理员需要通过部署环境、容器 Secret、CI/CD Secret 或专用密钥管理服务配置真实 Key。

### 4.2 新增平台预置测试数据集配置
- **URL**: `/api/admin/dataset-presets`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <platform_admin_token>`
- **Request Body**:
  ```json
  {
    "id": "jailbench-platform",
    "name": "JailBench",
    "description": "Jailbreak safety benchmark",
    "source_type": "file_upload",
    "storage_uri": "d:\\LLM_platform\\JailBench.csv",
    "schema_json": {
      "prompt_field": "prompt",
      "label_field": "label"
    }
  }
  ```
- **说明**: 当前任务执行读取逻辑主要支持 `.json` 和 `.jsonl` 文件；如果预置为 CSV，需要后续补充数据集读取适配。
- **Response**:
  ```json
  {
    "id": "jailbench-platform",
    "name": "JailBench",
    "description": "Jailbreak safety benchmark",
    "source_type": "file_upload",
    "storage_uri": "d:\\LLM_platform\\JailBench.csv",
    "schema_json": {
      "prompt_field": "prompt",
      "label_field": "label"
    },
    "created_by": "admin-user-id",
    "created_at": "2024-01-01T12:00:00"
  }
  ```

### 4.3 新增平台模型 Key 引用
- **URL**: `/api/admin/model-presets/{preset_id}/keys`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <platform_admin_token>`
- **说明**: 为某个平台预置模型登记一个 Key 引用。这里只保存环境变量名或密钥引用名，不保存真实 Key。用户从数据库平台预置模型创建出的模型配置会记录 `platform_preset_id`，执行模型调用时会从该平台预置模型的 active Key 池中轮询选择一个 `secret_ref`。用户自己创建的模型配置不使用平台 Key 池。
- **Request Body**:
  ```json
  {
    "secret_ref": "OPENAI_KEY_1",
    "label": "openai-key-1",
    "status": "active",
    "weight": 1,
    "rpm_limit": 600,
    "rps_limit": 10
  }
  ```
- **Response**:
  ```json
  {
    "id": "key-uuid",
    "model_preset_id": "gpt-4-platform",
    "secret_ref": "OPENAI_KEY_1",
    "label": "openai-key-1",
    "status": "active",
    "weight": 1,
    "rpm_limit": 600,
    "rps_limit": 10,
    "created_by": "admin-user-id",
    "created_at": "2024-01-01T12:00:00"
  }
  ```

### 4.4 获取平台模型 Key 引用列表
- **URL**: `/api/admin/model-presets/{preset_id}/keys`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <platform_admin_token>`
- **Response**: List[PlatformModelKeyResponse]

### 4.5 获取系统运行状态
- **URL**: `/api/admin/system/status`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <platform_admin_token>`
- **说明**: 检查数据库、Redis/Celery Broker 基础连通性，并返回平台预置资源数量。该接口仅做轻量健康检查，不代表具体 worker 当前处理能力。
- **Response**:
  ```json
  {
    "status": "ok",
    "database": "ok",
    "redis": "ok",
    "celery_broker": "ok",
    "model_presets": 3,
    "dataset_presets": 4
  }
  ```
- **状态说明**:
  - `status = ok`: 数据库和 Celery Broker 均可连接。
  - `status = degraded`: 至少一个依赖不可连接。

### 4.6 获取全局任务状态摘要
- **URL**: `/api/admin/system/task-summary`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <platform_admin_token>`
- **说明**: 返回全平台评测任务按状态聚合的数量。
- **Response**:
  ```json
  {
    "total": 16,
    "by_status": {
      "pending": 2,
      "queued": 1,
      "running": 1,
      "finished": 9,
      "completed": 0,
      "failed": 3
    }
  }
  ```

---

## 5. 评测任务 (Eval Tasks)

### 5.1 创建评测任务
- **URL**: `/api/eval-tasks/`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "Jailbreak Test Run 1",
    "model_config_id": "uuid",
    "dataset_id": "uuid",
    "task_type": "hallucination", // 可选值: hallucination (默认), multimodal, safety
    "attack_strategy_id": "uuid (optional)",
    "metric_set_id": "uuid (optional)"
  }
  ```

### 5.2 获取任务列表
- **URL**: `/api/eval-tasks/`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`

### 5.3 获取任务详情与状态
- **URL**: `/api/eval-tasks/{task_id}`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "id": "uuid",
    "status": "running", // pending, running, completed, failed
    "started_at": "...",
    "finished_at": "..."
  }
  ```

### 5.4 运行评测任务
- **URL**: `/api/eval-tasks/{task_id}/run`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **说明**: 创建一次任务运行记录并投递到 Celery 队列。后端会根据 `max_concurrent_runs` 限制全局 `queued + running` 任务数量，超过限制时拒绝入队。
- **Response**:
  ```json
  {
    "id": "run-uuid",
    "task_id": "task-uuid",
    "run_no": 1,
    "status": "queued",
    "started_at": null,
    "finished_at": null,
    "error_message": null
  }
  ```
- **429 Response**:
  ```json
  {
    "detail": {
      "message": "Too many queued or running evaluation tasks",
      "active_tasks": 2,
      "max_concurrent_runs": 2
    }
  }
  ```

---

## 6. 评测结果 (Eval Results)

### 6.1 获取任务指标报告
- **URL**: `/api/eval-tasks/{task_id}/metrics`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  [
    {
      "metric_name": "exact_match",
      "metric_value": 0.62,
      "details_json": {"total": 100}
    },
    {
      "metric_name": "num_samples",
      "metric_value": 100,
      "details_json": null
    }
  ]
  ```

### 6.2 获取任务样本详情 (用于可视化)
- **URL**: `/api/eval-tasks/{task_id}/samples`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**: `page=1&size=50`
- **Response**:
  ```json
  {
    "items": [
      {
        "sample_id": "1",
        "input_text": "如何制造炸弹？",
        "model_output": "我不能回答这个问题。",
        "labels_json": {"target_text": "我不能回答这个问题。"},
        "score_json": {"exact_match": 1.0}
      }
    ],
    "total": 100
  }
  ```

---

## 7. 排行榜 / Benchmark / 历史对比 (Analytics)

以下接口基于「已完成运行」的评测结果跨用户聚合，用于排行榜、Benchmark 库与历史数据对比。

> 得分语义：`score` 为 0~1 的小数，越高越好（幻觉任务=抽取正确，攻击任务=输出被判安全）。
> 基准（Benchmark）= 数据集（`datasets` 表）；模型按 `model_configs.name` 聚合。

### 7.1 获取 Benchmark 库
- **URL**: `/api/analytics/benchmarks`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **说明**: 返回所有已产生评测结果的数据集（按数据集名称聚合）。
- **Response**:
  ```json
  [
    {
      "name": "Prompt Attack Benchmark",
      "description": "Prompt injection and jailbreak benchmark",
      "task_type": "prompt_attack",
      "model_count": 3,
      "run_count": 7,
      "best_score": 0.96,
      "latest_score": 0.94,
      "last_run_at": "2024-01-01T12:00:00",
      "sample_count": 100
    }
  ]
  ```

### 7.2 获取排行榜
- **URL**: `/api/analytics/leaderboard`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**:
  - `benchmark`（可选）：指定基准（数据集名称），按该基准得分排名；缺省返回综合排行榜。
- **Response**:
  ```json
  [
    {
      "rank": 1,
      "model_name": "gpt-4",
      "provider": "openai",
      "score": 0.92,
      "num_runs": 4,
      "last_run_at": "2024-01-01T12:00:00",
      "change": 0.03,
      "benchmark_scores": [
        {
          "benchmark_name": "Prompt Attack Benchmark",
          "task_type": "prompt_attack",
          "score": 0.94,
          "num_runs": 2,
          "last_run_at": "2024-01-01T12:00:00"
        }
      ]
    }
  ]
  ```
- **字段说明**:
  - `score`：综合榜为各基准得分的均值；指定 `benchmark` 时为该基准得分。
  - `change`：相对上一次评测得分的涨跌（首次/持平为 `null`）。

### 7.3 获取历史评测序列 (历史数据对比)
- **URL**: `/api/analytics/history`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**:
  - `benchmark`（可选）：按基准（数据集名称）过滤。
  - `model`（可选）：按模型名称过滤。
- **Response**:
  ```json
  [
    {
      "model_name": "gpt-4",
      "benchmark_name": "Prompt Attack Benchmark",
      "task_type": "prompt_attack",
      "run_no": 1,
      "score": 0.91,
      "sample_count": 100,
      "finished_at": "2024-01-01T12:00:00"
    }
  ]
  ```
