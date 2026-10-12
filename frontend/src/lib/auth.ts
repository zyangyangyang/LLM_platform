export type LoginResponse = {
  access_token: string;
  token_type: string;
};

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

function getErrorMessage(data: unknown, status: number) {
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
  };

  const statusToChinese: Record<number, string> = {
    400: "请求参数错误",
    401: "未授权，请检查登录信息",
    403: "无权限访问",
    404: "请求资源不存在",
    409: "请求冲突，请稍后重试",
    422: "提交内容格式不正确",
    500: "服务器内部错误，请稍后重试",
  };

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const detail = record.detail;
    const message = record.message;
    if (typeof detail === "string") return detailToChinese[detail] ?? detail;
    if (typeof message === "string") return detailToChinese[message] ?? message;
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

export async function getCurrentUser() {
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
  system_prompt?: string;
}) {
  const form = new FormData();
  form.set("file", params.file);
  form.set("name", params.name);
  if (params.description) form.set("description", params.description);
  if (params.schema_json) form.set("schema_json", params.schema_json);
  if (params.prompt_field) form.set("prompt_field", params.prompt_field);
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

export async function createEvalTask(input: {
  name: string;
  model_config_id: string;
  dataset_id: string;
  task_type?: string;
  attack_strategy_id?: string;
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

export async function runEvalTask(taskId: string) {
  return apiPostJSON(`/api/eval-tasks/${taskId}/run`);
}

export async function getEvalTaskSamples(taskId: string, page = 1, size = 50) {
  return apiGet(`/api/eval-tasks/${taskId}/samples?page=${page}&size=${size}`);
}

export async function getEvalTaskMetrics(taskId: string) {
  return apiGet(`/api/eval-tasks/${taskId}/metrics`);
}

export async function getEvalTaskProgress(taskId: string) {
  return apiGet(`/api/eval-tasks/${taskId}/progress`);
}

// ---------------------------------------------------------------------------
// 排行榜 / Benchmark / 历史对比
// ---------------------------------------------------------------------------

export type BenchmarkScoreItem = {
  benchmark_name: string;
  task_type: string;
  score: number;
  num_runs: number;
  last_run_at?: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  model_name: string;
  provider: string;
  score: number;
  num_runs: number;
  last_run_at?: string | null;
  change?: number | null;
  benchmark_scores: BenchmarkScoreItem[];
};

export type BenchmarkSummary = {
  name: string;
  description?: string | null;
  task_type: string;
  model_count: number;
  run_count: number;
  best_score: number;
  latest_score: number;
  last_run_at?: string | null;
  sample_count: number;
};

export type HistoryPoint = {
  model_name: string;
  benchmark_name: string;
  task_type: string;
  run_no: number;
  score: number;
  sample_count: number;
  finished_at?: string | null;
};

export async function listBenchmarks(): Promise<BenchmarkSummary[]> {
  return apiGet("/api/analytics/benchmarks");
}

export async function getLeaderboard(benchmark?: string): Promise<LeaderboardEntry[]> {
  const q = benchmark ? `?benchmark=${encodeURIComponent(benchmark)}` : "";
  return apiGet(`/api/analytics/leaderboard${q}`);
}

export async function getHistory(
  params: { benchmark?: string; model?: string } = {}
): Promise<HistoryPoint[]> {
  const qs = new URLSearchParams();
  if (params.benchmark) qs.set("benchmark", params.benchmark);
  if (params.model) qs.set("model", params.model);
  const q = qs.toString();
  return apiGet(`/api/analytics/history${q ? `?${q}` : ""}`);
}
