export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  status?: string;
  roles?: string[];
};

// 后端 UserRepository 中定义的两个角色
export const EVALUATOR_ROLE = "evaluator";
export const ADMIN_ROLE = "platform_admin";

export function hasAdminRole(user: CurrentUser | null | undefined): boolean {
  return Boolean(user?.roles?.includes(ADMIN_ROLE));
}

export const TOKEN_STORAGE_KEY = "safety_platform_access_token";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function buildUrl(path: string) {
  if (!API_BASE) return path;
  if (API_BASE.endsWith("/") && path.startsWith("/")) {
    return `${API_BASE}${path.slice(1)}`;
  }
  if (!API_BASE.endsWith("/") && !path.startsWith("/")) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}

// 后端返回的固定英文提示 -> 中文
const detailToChinese: Record<string, string> = {
  "Incorrect username or password": "邮箱或密码错误",
  "Could not validate credentials": "登录状态无效，请重新登录",
  "Inactive user": "账号未激活，请联系管理员",
  "Email already registered": "该邮箱已注册，请直接登录",
  "Not authorized": "无权访问该资源",
  "Not authorized to access this resource": "无权访问该资源",
  "Task is already queued or running": "任务已在排队或运行中",
  "Task not found": "任务不存在",
  "Dataset not found": "数据集不存在",
  "Model config not found": "模型配置不存在",
  "Name cannot be empty": "姓名不能为空",
  "Password must be at least 6 characters": "密码长度不能少于 6 位",
  "User not found": "用户不存在",
  // 权限
  "Insufficient permissions": "权限不足，该操作仅限平台管理员",
  // 任务
  "Invalid model_config_id": "被测模型配置无效",
  "Invalid dataset_id": "所选数据集无效",
  "Invalid attack_strategy_id": "所选攻击策略无效",
  "Invalid defense_strategy_id": "所选防御策略无效",
  "Invalid metric_set_id": "所选指标集无效",
  "Invalid pagination params": "分页参数不合法",
  "Model config missing": "任务引用的模型配置已缺失",
  "Too many queued or running evaluation tasks": "当前排队或运行中的评测任务过多，请稍后重试",
  // 攻防策略
  "Attack strategy not found": "攻击策略不存在",
  "Defense strategy not found": "防御策略不存在",
  "Attack strategy is in use by evaluation tasks; delete those tasks first": "该攻击策略已被评测任务引用，请先删除相关任务",
  "Defense strategy is in use by evaluation tasks; delete those tasks first": "该防御策略已被评测任务引用，请先删除相关任务",
  "config_json.algorithm is required": "策略配置缺少 algorithm 字段",
  // 平台预置
  "Preset model not found": "平台预置模型不存在",
  "Preset dataset not found": "平台预置数据集不存在",
  "Model key not found": "模型密钥不存在",
  // 数据集与模型配置
  "Dataset is in use by evaluation tasks; delete those tasks first": "该数据集已被评测任务引用，请先删除相关任务",
  "Model config is in use by evaluation tasks; delete those tasks first": "该模型配置已被评测任务引用，请先删除相关任务",
  "Dataset storage_uri missing": "数据集存储地址缺失",
  "Dataset file not found": "数据集文件不存在",
  "Remote dataset not supported": "暂不支持远程数据集",
  "Unsupported dataset format": "不支持的数据集格式",
  "Empty filename": "未选择文件",
  "Only .json or .jsonl allowed": "仅支持 .json 或 .jsonl 文件",
  "Failed to save uploaded file": "上传文件保存失败",
  "Failed to create model config": "创建模型配置失败",
  "Failed to update model config": "更新模型配置失败",
  // 自带密钥（BYOK）—— 这几条都是后端 _resolve_credential 抛的
  "BYOK is not enabled on this server": "服务端未启用自带密钥，请联系管理员配置主密钥，或改用平台预置模型",
  "Provide either api_key or auth_secret_ref, not both": "不能同时提交 API Key 和环境变量名，只能填其中一个",
  "auth_secret_ref must be an environment variable name; use api_key to supply your own credential":
    "环境变量名一栏不能填密文；自带密钥请填在「API Key」里",
  "clear_key cannot be combined with api_key or auth_secret_ref":
    "「清空密钥」不能与 API Key / 环境变量名同时提交",
  "No fields to update": "没有需要修改的内容",
  "Failed to enqueue task": "任务入队失败",
  "Invalid schema_json": "schema_json 格式不正确",
  "Invalid semantic judge model config": "语义裁判模型配置无效",
  "prompt_field is required": "请指定 prompt 字段",
  "label_field is required": "请指定 label 字段",
};

// 含动态内容（名称、ID 等）的后端提示，用正则匹配
const detailPatternToChinese: Array<[RegExp, string]> = [
  [/^Task name '.+' already exists$/, "任务名称已存在，请换一个名称"],
  [/^Model name '.+' already exists$/, "模型名称已存在，请换一个名称"],
  [/^Model name '.+' conflicts with a preset model$/, "模型名称与平台预置模型冲突，请换一个名称"],
  [/^Dataset name '.+' already exists$/, "数据集名称已存在，请换一个名称"],
  [/^Dataset name '.+' conflicts with a preset dataset$/, "数据集名称与平台预置数据集冲突，请换一个名称"],
  [/^Invalid JSON(L)? file: .+$/, "数据文件解析失败，请检查文件格式"],
  [/^Invalid JSONL line: .+$/, "数据文件存在无法解析的行，请检查文件格式"],
  [/^Attack strategy '.+' already exists$/, "攻击策略名称已存在，请换一个名称"],
  [/^Defense strategy '.+' already exists$/, "防御策略名称已存在，请换一个名称"],
  [/^Unknown attack algorithm .+$/, "攻击算法不存在，请重新选择"],
  [/^Unknown defense algorithm .+$/, "防御算法不存在，请重新选择"],
  [/^Unsupported task_type: .+$/, "不支持的任务类型"],
];

// 无 detail 时按状态码兜底
const statusToChinese: Record<number, string> = {
  400: "请求参数错误",
  401: "未授权，请检查登录信息",
  403: "无权限访问",
  404: "请求资源不存在",
  409: "请求冲突，请稍后重试",
  422: "提交内容格式不正确",
  429: "任务队列繁忙，请稍后重试",
  500: "服务器内部错误，请稍后重试",
};

// 取出后端错误响应中的提示文本。
// FastAPI 的 detail 多为字符串，但并发超限等场景会返回对象
// （如 {message, active_tasks, max_concurrent_runs}），需再取一层 message。
function extractDetailText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const nested = (detail as Record<string, unknown>).message;
    if (typeof nested === "string") return nested;
  }
  if (typeof record.message === "string") return record.message;
  return null;
}

function getErrorMessage(data: unknown, status: number) {
  const text = extractDetailText(data);
  if (text) {
    const exact = detailToChinese[text];
    if (exact) return exact;
    for (const [pattern, chinese] of detailPatternToChinese) {
      if (pattern.test(text)) return chinese;
    }
    return text;
  }
  return statusToChinese[status] ?? `请求失败（HTTP ${status}）`;
}

export function saveAccessToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function loginWithPassword(username: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const resp = await fetch(buildUrl("/api/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!resp.ok) {
    const data: unknown = await resp.json().catch(() => ({}));
    throw new Error(getErrorMessage(data, resp.status));
  }

  return resp.json();
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("未检测到登录状态，请先登录");
  }

  const resp = await fetch(buildUrl("/api/auth/users/me"), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      clearAccessToken();
    }
    const data: unknown = await resp.json().catch(() => ({}));
    throw new Error(getErrorMessage(data, resp.status));
  }

  return resp.json();
}

export async function updateCurrentUser(input: { email?: string; name?: string; password?: string }) {
  return apiPutJSON("/api/auth/users/me", input);
}

async function apiGet(path: string) {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(buildUrl(path), { method: "GET", headers });
  if (!resp.ok) {
    const data: unknown = await resp.json().catch(() => ({}));
    throw new Error(getErrorMessage(data, resp.status));
  }
  return resp.json();
}

async function apiPostJSON(path: string, body?: unknown) {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(buildUrl(path), { method: "POST", headers, body: body ? JSON.stringify(body) : undefined });
  if (!resp.ok) {
    const data: unknown = await resp.json().catch(() => ({}));
    throw new Error(getErrorMessage(data, resp.status));
  }
  return resp.json();
}

async function apiPutJSON(path: string, body?: unknown) {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(buildUrl(path), { method: "PUT", headers, body: body ? JSON.stringify(body) : undefined });
  if (!resp.ok) {
    const data: unknown = await resp.json().catch(() => ({}));
    throw new Error(getErrorMessage(data, resp.status));
  }
  return resp.json();
}

async function apiPatchJSON(path: string, body?: unknown) {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(buildUrl(path), { method: "PATCH", headers, body: body ? JSON.stringify(body) : undefined });
  if (!resp.ok) {
    const data: unknown = await resp.json().catch(() => ({}));
    throw new Error(getErrorMessage(data, resp.status));
  }
  return resp.json();
}

async function apiPostForm(path: string, form: FormData) {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(buildUrl(path), { method: "POST", headers, body: form });
  if (!resp.ok) {
    const data: unknown = await resp.json().catch(() => ({}));
    throw new Error(getErrorMessage(data, resp.status));
  }
  return resp.json();
}

// 删除类接口多返回 204 No Content，没有响应体，不能直接 resp.json()
async function apiDelete(path: string) {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(buildUrl(path), { method: "DELETE", headers });
  if (!resp.ok) {
    const data: unknown = await resp.json().catch(() => ({}));
    throw new Error(getErrorMessage(data, resp.status));
  }
  if (resp.status === 204) return null;
  return resp.json().catch(() => null);
}

export async function registerUser(input: { email: string; password: string; name: string }) {
  return apiPostJSON("/api/auth/register", input);
}

export async function listModelPresets() {
  return apiGet("/api/presets");
}

export async function createModelFromPreset(presetId: string) {
  return apiPostJSON(`/api/models/from-preset?preset_id=${encodeURIComponent(presetId)}`);
}

export async function listModels() {
  return apiGet("/api/models");
}

export async function getModelConfig(modelId: string) {
  return apiGet(`/api/models/${modelId}`);
}

// ===== 厂商目录与「我的模型」（自带密钥 BYOK） =====

export type ProviderModel = {
  id: string;
  label: string;
};

export type Provider = {
  id: string;
  label: string;
  protocol: string;
  endpoint: string;
  auth_type: string;
  docs_url: string;
  /** 是否允许填内置清单以外的模型名。豆包要填 ep- 接入点 ID，恒为 true。 */
  allow_custom_model: boolean;
  notes?: string | null;
  models: ProviderModel[];
};

export type ProviderCatalog = {
  providers: Provider[];
  /** 服务端是否配置了主密钥。false 时「自带密钥」表单应禁用并给出提示。 */
  byok_enabled: boolean;
};

export type ModelConfig = {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  endpoint: string;
  auth_type: string;
  params_json?: Record<string, unknown>;
  /** 只表明「配了凭证」，不区分平台预置还是自带密钥，更不回传密钥本身。 */
  has_auth_secret: boolean;
  platform_preset_id?: string | null;
  created_at: string;
};

export type ConnectionTest = {
  ok: boolean;
  latency_ms: number;
  reply_preview: string | null;
  error_code: ModelConnectionErrorCode | null;
  error_message: string | null;
};

export type ModelConnectionErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "timeout"
  | "network"
  | "bad_response";

// 后端 ModelService._classify_probe_error 的错误码 -> 展示用中文
export const CONNECTION_ERROR_LABELS: Record<ModelConnectionErrorCode, string> = {
  unauthorized: "鉴权失败",
  rate_limited: "触发限流",
  not_found: "模型或接口地址不存在",
  timeout: "请求超时",
  network: "网络不通",
  bad_response: "厂商返回异常",
};

function toModelConfig(row: unknown): ModelConfig {
  return row as ModelConfig;
}

export async function listProviders(): Promise<ProviderCatalog> {
  const raw = (await apiGet("/api/providers")) as Partial<ProviderCatalog> | null;
  return {
    providers: Array.isArray(raw?.providers) ? raw!.providers : [],
    // 字段缺失时按「未启用」处理：宁可多提示一句，也不要放行一个必然失败的提交
    byok_enabled: Boolean(raw?.byok_enabled),
  };
}

export async function createModel(input: {
  name: string;
  provider: string;
  endpoint: string;
  auth_type?: string;
  /** 自带密钥的明文。服务端加密后落库，任何响应都不会回传它。 */
  api_key?: string;
  params_json?: Record<string, unknown>;
}): Promise<ModelConfig> {
  return toModelConfig(await apiPostJSON("/api/models", input));
}

export async function updateModel(
  modelId: string,
  input: {
    name?: string;
    provider?: string;
    endpoint?: string;
    auth_type?: string;
    api_key?: string;
    clear_key?: boolean;
    params_json?: Record<string, unknown>;
  },
): Promise<ModelConfig> {
  return toModelConfig(await apiPatchJSON(`/api/models/${modelId}`, input));
}

export async function deleteModel(modelId: string): Promise<void> {
  await apiDelete(`/api/models/${modelId}`);
}

/** 用已保存的配置做一次真实调用。连不通也返回 200，靠 ok=false 表达失败。 */
export async function testModelConnection(modelId: string): Promise<ConnectionTest> {
  return (await apiPostJSON(`/api/models/${modelId}/test`)) as ConnectionTest;
}

export async function listDatasetPresets() {
  return apiGet("/api/datasets/presets");
}

export async function createDatasetFromPreset(presetId: string) {
  return apiPostJSON(`/api/datasets/from-preset?preset_id=${encodeURIComponent(presetId)}`);
}

export async function createDataset(input: {
  name: string;
  description?: string;
  source_type: string;
  storage_uri: string;
  schema_json?: Record<string, unknown>;
}) {
  return apiPostJSON("/api/datasets/", input);
}

export async function uploadDatasetFile(params: {
  file: File;
  name: string;
  description?: string;
  schema_json?: string;
  prompt_field?: string;
  // 后端 _validate_required_schema_fields 强制要求 label_field，
  // 不传必然 400（"label_field is required"）——哪怕这数据集只做攻击评测、
  // 评分根本读不到标签。所以这里必须带上。
  label_field?: string;
  options_field?: string;
  system_prompt?: string;
}) {
  const form = new FormData();
  form.set("file", params.file);
  form.set("name", params.name);
  if (params.description) form.set("description", params.description);
  if (params.schema_json) form.set("schema_json", params.schema_json);
  if (params.prompt_field) form.set("prompt_field", params.prompt_field);
  if (params.label_field) form.set("label_field", params.label_field);
  if (params.options_field) form.set("options_field", params.options_field);
  if (params.system_prompt) form.set("system_prompt", params.system_prompt);
  return apiPostForm("/api/datasets/upload", form);
}

export async function listDatasets() {
  return apiGet("/api/datasets/");
}

export async function getDataset(datasetId: string) {
  return apiGet(`/api/datasets/${datasetId}`);
}

export async function getDatasetSamples(datasetId: string, page = 1, size = 50) {
  return apiGet(`/api/datasets/${datasetId}/samples?page=${page}&size=${size}`);
}

export type DimensionPreview = {
  /** 抽样条数。0 表示读不出样本（如文件缺失），此时两个判定都不可信 */
  probed: number;
  /** 样本里是否有可比对的标准答案，决定幻觉维度能不能选 */
  has_comparable_target: boolean;
  /** 该组合会必然失效，create_task 也会 400 */
  blocked: boolean;
  block_reason: string | null;
  /** 能跑，但结果会被误读——只提醒，不拦 */
  warning: string | null;
};

/** 预检「评测维度 × 数据集」。
 *
 * datasetId 可以是真实数据集 id，也可以是下拉里的预置 id——预置在提交前还没落库，
 * 后端认得这种 id 并直接读配置文件里的样本，所以选中预置时也能立刻拿到提醒。
 */
export async function previewTaskDimension(
  datasetId: string,
  taskType: string,
): Promise<DimensionPreview> {
  const query = new URLSearchParams({ dataset_id: datasetId, task_type: taskType });
  const raw = (await apiGet(`/api/eval-tasks/dimension-preview?${query}`)) as Partial<DimensionPreview>;
  // 兜住字段缺失：后端老版本或异常响应时不该让整个表单炸掉
  return {
    probed: raw?.probed ?? 0,
    has_comparable_target: raw?.has_comparable_target ?? false,
    blocked: raw?.blocked ?? false,
    block_reason: raw?.block_reason ?? null,
    warning: raw?.warning ?? null,
  };
}

export type Strategy = {
  id: string;
  name: string;
  description?: string;
  algorithm?: string;
  config_json?: Record<string, unknown>;
};

// 创建/更新共用的请求体。后端 PATCH 复用的是 Create 模型（全量替换，非增量），
// 所以 name 与 config_json 每次都必须完整下发。
export type StrategyInput = {
  name: string;
  description?: string;
  config_json: Record<string, unknown>;
};

// 后端策略响应的 config_json 里带着 algorithm，抽出来便于在界面上标注算法类型
function toStrategy(item: unknown): Strategy | null {
  const row = item as {
    id?: string;
    name?: string;
    description?: string;
    config_json?: { algorithm?: string };
  } | null;
  if (!row?.id || !row.name) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    algorithm: row.config_json?.algorithm,
    config_json: row.config_json as Record<string, unknown> | undefined,
  };
}

function toStrategyList(raw: unknown): Strategy[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toStrategy).filter((item): item is Strategy => item !== null);
}

// 攻击/防御两组接口形状完全一致，用工厂生成，避免写 6 份几乎相同的函数。
// 写接口均要求 platform_admin 角色，非管理员后端返回 403。
function makeStrategyApi(basePath: string) {
  return {
    list: async (): Promise<Strategy[]> => toStrategyList(await apiGet(`${basePath}/`)),
    create: async (input: StrategyInput): Promise<Strategy> => {
      const created = toStrategy(await apiPostJSON(`${basePath}/`, input));
      if (!created) throw new Error("策略创建成功但响应格式异常");
      return created;
    },
    update: async (strategyId: string, input: StrategyInput): Promise<Strategy> => {
      const updated = toStrategy(await apiPatchJSON(`${basePath}/${strategyId}`, input));
      if (!updated) throw new Error("策略更新成功但响应格式异常");
      return updated;
    },
    remove: async (strategyId: string): Promise<void> => {
      await apiDelete(`${basePath}/${strategyId}`);
    },
  };
}

export const attackStrategyApi = makeStrategyApi("/api/attack-strategies");
export const defenseStrategyApi = makeStrategyApi("/api/defense-strategies");

export async function listAttackStrategies(): Promise<Strategy[]> {
  return attackStrategyApi.list();
}

export async function listDefenseStrategies(): Promise<Strategy[]> {
  return defenseStrategyApi.list();
}

export async function listAttackAlgorithms(): Promise<string[]> {
  const raw = await apiGet("/api/attack-strategies/algorithms");
  return Array.isArray(raw) ? raw : [];
}

export async function listDefenseAlgorithms(): Promise<string[]> {
  const raw = await apiGet("/api/defense-strategies/algorithms");
  return Array.isArray(raw) ? raw : [];
}

// ===== 平台管理员接口（均需要 platform_admin 角色，否则后端返回 403） =====

export type SystemStatus = {
  status: string;
  database: string;
  redis: string;
  celery_broker: string;
  model_presets: number;
  dataset_presets: number;
};

export type TaskSummary = {
  total: number;
  by_status: Record<string, number>;
};

export type PlatformModelPreset = {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  auth_type: string;
  params_json?: Record<string, unknown>;
  description?: string;
  has_auth_secret: boolean;
  created_by: string;
  created_at: string;
};

export type PlatformModelKey = {
  id: string;
  model_preset_id: string;
  secret_ref: string;
  label?: string;
  status: string;
  weight: number;
  rpm_limit?: number;
  rps_limit?: number;
  created_by: string;
  created_at: string;
};

export type PlatformDatasetPreset = {
  id: string;
  name: string;
  description?: string;
  source_type: string;
  storage_uri: string;
  schema_json?: Record<string, unknown>;
  created_by: string;
  created_at: string;
};

export async function getSystemStatus(): Promise<SystemStatus> {
  return apiGet("/api/admin/system/status");
}

export async function getTaskSummary(): Promise<TaskSummary> {
  return apiGet("/api/admin/system/task-summary");
}

export async function listPlatformModelPresets(): Promise<PlatformModelPreset[]> {
  const raw = await apiGet("/api/admin/model-presets");
  return Array.isArray(raw) ? raw : [];
}

export async function createPlatformModelPreset(input: {
  name: string;
  provider: string;
  endpoint: string;
  auth_type?: string;
  auth_secret_ref?: string;
  params_json?: Record<string, unknown>;
  description?: string;
}): Promise<PlatformModelPreset> {
  return apiPostJSON("/api/admin/model-presets", input);
}

export async function listPlatformModelKeys(presetId: string): Promise<PlatformModelKey[]> {
  const raw = await apiGet(`/api/admin/model-presets/${presetId}/keys`);
  return Array.isArray(raw) ? raw : [];
}

export async function createPlatformModelKey(
  presetId: string,
  input: {
    secret_ref: string;
    label?: string;
    status?: string;
    weight?: number;
    rpm_limit?: number;
    rps_limit?: number;
  },
): Promise<PlatformModelKey> {
  return apiPostJSON(`/api/admin/model-presets/${presetId}/keys`, input);
}

export async function deletePlatformModelKey(presetId: string, keyId: string) {
  return apiDelete(`/api/admin/model-presets/${presetId}/keys/${keyId}`);
}

export async function listPlatformDatasetPresets(): Promise<PlatformDatasetPreset[]> {
  const raw = await apiGet("/api/admin/dataset-presets");
  return Array.isArray(raw) ? raw : [];
}

export async function createPlatformDatasetPreset(input: {
  name: string;
  description?: string;
  source_type: string;
  storage_uri: string;
  schema_json?: Record<string, unknown>;
}): Promise<PlatformDatasetPreset> {
  return apiPostJSON("/api/admin/dataset-presets", input);
}

export async function createEvalTask(input: {
  name: string;
  model_config_id: string;
  dataset_id: string;
  task_type?: string;
  attack_strategy_id?: string;
  defense_strategy_id?: string;
  metric_set_id?: string;
}) {
  return apiPostJSON("/api/eval-tasks/", input);
}

export async function listEvalTasks() {
  return apiGet("/api/eval-tasks/");
}

export async function getEvalTask(taskId: string) {
  return apiGet(`/api/eval-tasks/${taskId}`);
}

// 注意：后端 DELETE /api/eval-tasks/{id} 不校验任务状态，运行中的任务也会被直接删除，
// 调用方须自行阻止对 queued/running 任务的删除。
export async function deleteEvalTask(taskId: string) {
  return apiDelete(`/api/eval-tasks/${taskId}`);
}

export async function runEvalTask(taskId: string) {
  return apiPostJSON(`/api/eval-tasks/${taskId}/run`);
}

export async function getEvalTaskSamples(taskId: string, page = 1, size = 50) {
  return apiGet(`/api/eval-tasks/${taskId}/samples?page=${page}&size=${size}`);
}

// 后端 TaskService.get_task_metrics 下发的指标项。
// details_json 是自由结构，各指标含义不同，见 EvalMetricDetails。
export type EvalMetricItem = {
  metric_name: string;
  metric_value: number;
  details_json?: EvalMetricDetails | null;
};

export type EvalMetricDetails = {
  total?: number;
  // 有判定结论的样本数（= total - errors）。通过率的分母，errors 不计入。
  judged?: number;
  passed?: number;
  failed?: number;
  errors?: number;
  defended?: number;
  hits?: number;
  by_label?: Record<string, { total: number; passed: number; pass_rate: number }>;
};

export async function getEvalTaskMetrics(taskId: string): Promise<EvalMetricItem[]> {
  const raw = await apiGet(`/api/eval-tasks/${taskId}/metrics`);
  return Array.isArray(raw) ? raw : [];
}

export async function getEvalTaskProgress(taskId: string) {
  return apiGet(`/api/eval-tasks/${taskId}/progress`);
}
