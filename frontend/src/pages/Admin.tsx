import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { AlertTriangle, Database, Pencil, RefreshCw, ShieldCheck, Swords, Trash2, KeyRound } from 'lucide-react';
import {
  attackStrategyApi,
  createPlatformDatasetPreset,
  createPlatformModelKey,
  createPlatformModelPreset,
  defenseStrategyApi,
  deletePlatformModelKey,
  getCurrentUser,
  getSystemStatus,
  getTaskSummary,
  hasAdminRole,
  listAttackAlgorithms,
  listDefenseAlgorithms,
  listPlatformDatasetPresets,
  listPlatformModelKeys,
  listPlatformModelPresets,
  type PlatformDatasetPreset,
  type PlatformModelKey,
  type PlatformModelPreset,
  type Strategy,
  type StrategyInput,
  type SystemStatus,
  type TaskSummary,
} from '@/lib/auth';
import {
  buildParams,
  exampleValues,
  paramsToValues,
  STRATEGY_ALGORITHMS,
  type AlgorithmSpec,
  type StrategyKind,
} from '@/lib/strategyAlgorithms';

const SOURCE_TYPE_OPTIONS = [
  { value: 'file_upload', label: '本地文件 (file_upload)' },
  { value: 'url', label: '远程链接 (url)' },
  { value: 's3', label: '对象存储 (s3)' },
];

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: '待执行',
  queued: '排队中',
  running: '运行中',
  finished: '已完成',
  completed: '已完成',
  failed: '失败',
};

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// 后端把 auth_secret_ref / secret_ref 当“环境变量名”用（ModelService._resolve_secret_ref 里 os.getenv），
// 库里不存明文密钥，所以这两个输入框填的都必须是环境变量名。
// 注意：这是在管理员的「平台预置」里 —— 面向普通用户的「我的模型」页面还支持
// 用户自带密钥（BYOK），那条路径走 api_key 字段，由服务端加密后落库。
function parseJSONField(text: string, label: string): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} 不是合法的 JSON`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 需为 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

const PageFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
    <Navbar />
    <main className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">{children}</main>
  </div>
);

const StatusBadge: React.FC<{ value: string; okText?: string }> = ({ value, okText = '正常' }) => (
  <Badge
    variant="outline"
    className={
      value === 'ok'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-red-50 text-red-700 border-red-200'
    }
  >
    {value === 'ok' ? okText : `异常（${value}）`}
  </Badge>
);

// ===== 系统状态 =====

const SystemStatusPanel: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusData, summaryData] = await Promise.all([getSystemStatus(), getTaskSummary()]);
      setStatus(statusData);
      setSummary(summaryData);
    } catch (e: unknown) {
      setError(messageOf(e, '加载系统状态失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <CardDescription>数据库、Redis、Celery broker 的实时探活结果。</CardDescription>
        <Button variant="outline" className="bg-white" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">总体状态</CardTitle></CardHeader>
          <CardContent>
            {status ? <StatusBadge value={status.status} okText="正常 (ok)" /> : <span className="text-sm text-slate-500">-</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">数据库</CardTitle></CardHeader>
          <CardContent>{status ? <StatusBadge value={status.database} /> : <span className="text-sm text-slate-500">-</span>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Redis / Celery Broker</CardTitle></CardHeader>
          <CardContent>{status ? <StatusBadge value={status.redis} /> : <span className="text-sm text-slate-500">-</span>}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">平台预置数量</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">平台模型预置</span>
              <span className="font-semibold">{status?.model_presets ?? '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">平台数据集预置</span>
              <span className="font-semibold">{status?.dataset_presets ?? '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">任务汇总（全平台）</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-muted-foreground">任务总数</span>
              <span className="font-semibold">{summary?.total ?? '-'}</span>
            </div>
            <div className="space-y-1">
              {summary && Object.keys(summary.by_status).length > 0 ? (
                Object.entries(summary.by_status)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{TASK_STATUS_LABELS[key] ?? key}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
              ) : (
                <span className="text-muted-foreground">暂无任务</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ===== 平台模型预置 + Key 池 =====

const ModelPresetPanel: React.FC = () => {
  const [presets, setPresets] = useState<PlatformModelPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    provider: '',
    endpoint: '',
    auth_type: 'bearer',
    auth_secret_ref: '',
    params_json: '',
    description: '',
  });

  const [selectedPreset, setSelectedPreset] = useState<PlatformModelPreset | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPresets(await listPlatformModelPresets());
    } catch (e: unknown) {
      setError(messageOf(e, '加载平台模型预置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.name.trim() || !form.provider.trim() || !form.endpoint.trim()) {
      setError('名称、provider、endpoint 均为必填项');
      return;
    }
    setSaving(true);
    try {
      const created = await createPlatformModelPreset({
        name: form.name.trim(),
        provider: form.provider.trim(),
        endpoint: form.endpoint.trim(),
        auth_type: form.auth_type.trim() || 'bearer',
        auth_secret_ref: form.auth_secret_ref.trim() || undefined,
        params_json: parseJSONField(form.params_json, '推理参数'),
        description: form.description.trim() || undefined,
      });
      setNotice(`平台模型预置「${created.name}」已创建`);
      setForm({ name: '', provider: '', endpoint: '', auth_type: 'bearer', auth_secret_ref: '', params_json: '', description: '' });
      await load();
    } catch (e: unknown) {
      setError(messageOf(e, '创建平台模型预置失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">新建平台模型预置</CardTitle>
          <CardDescription>
            预置模型对所有测评用户可见。密钥只存环境变量名，不落库。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preset-name">名称 *</Label>
                <Input
                  id="preset-name"
                  className="bg-white"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：Qwen Plus 预置"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset-provider">Provider *</Label>
                <Input
                  id="preset-provider"
                  className="bg-white"
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  placeholder="例如：openai"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset-auth-type">Auth Type</Label>
                <Input
                  id="preset-auth-type"
                  className="bg-white"
                  value={form.auth_type}
                  onChange={(e) => setForm({ ...form, auth_type: e.target.value })}
                  placeholder="bearer / api_key / none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preset-endpoint">Endpoint *</Label>
              <Input
                id="preset-endpoint"
                className="bg-white"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preset-secret">密钥环境变量名</Label>
                <Input
                  id="preset-secret"
                  className="bg-white"
                  value={form.auth_secret_ref}
                  onChange={(e) => setForm({ ...form, auth_secret_ref: e.target.value })}
                  placeholder="例如：DASHSCOPE_API_KEY"
                />
                <p className="text-xs text-muted-foreground">
                  填环境变量名而非密钥明文；后端启动时按此名读取，取不到会直接报错。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset-description">描述</Label>
                <Input
                  id="preset-description"
                  className="bg-white"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="选填"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preset-params">推理参数 (JSON)</Label>
              <textarea
                id="preset-params"
                className="w-full min-h-[80px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                value={form.params_json}
                onChange={(e) => setForm({ ...form, params_json: e.target.value })}
                placeholder='{"model": "qwen-plus", "temperature": 0}'
              />
            </div>

            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? '创建中...' : '创建预置'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">平台模型预置（{presets.length}）</CardTitle>
            <Button variant="outline" size="sm" className="bg-white" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead className="w-[110px]">密钥</TableHead>
                <TableHead className="w-[150px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presets.map((preset) => (
                <TableRow key={preset.id}>
                  <TableCell className="font-medium">
                    {preset.name}
                    <div className="font-mono text-xs text-muted-foreground">{preset.id}</div>
                  </TableCell>
                  <TableCell>{preset.provider}</TableCell>
                  <TableCell className="max-w-[280px] truncate" title={preset.endpoint}>{preset.endpoint}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        preset.has_auth_secret
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }
                    >
                      {preset.has_auth_secret ? '已配置' : '未配置'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="bg-white" onClick={() => setSelectedPreset(preset)}>
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                      管理 Key
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {presets.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-6">
                    暂无平台模型预置
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedPreset ? (
        <KeyPoolPanel preset={selectedPreset} onClose={() => setSelectedPreset(null)} />
      ) : null}
    </div>
  );
};

const KeyPoolPanel: React.FC<{ preset: PlatformModelPreset; onClose: () => void }> = ({ preset, onClose }) => {
  const [keys, setKeys] = useState<PlatformModelKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ secret_ref: '', label: '', weight: '1', rpm_limit: '', rps_limit: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setKeys(await listPlatformModelKeys(preset.id));
    } catch (e: unknown) {
      setError(messageOf(e, '加载 Key 池失败'));
    } finally {
      setLoading(false);
    }
  }, [preset.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.secret_ref.trim()) {
      setError('密钥环境变量名为必填项');
      return;
    }
    setSaving(true);
    try {
      await createPlatformModelKey(preset.id, {
        secret_ref: form.secret_ref.trim(),
        label: form.label.trim() || undefined,
        weight: Number(form.weight) || 1,
        rpm_limit: form.rpm_limit.trim() ? Number(form.rpm_limit) : undefined,
        rps_limit: form.rps_limit.trim() ? Number(form.rps_limit) : undefined,
      });
      setForm({ secret_ref: '', label: '', weight: '1', rpm_limit: '', rps_limit: '' });
      await load();
    } catch (e: unknown) {
      setError(messageOf(e, '添加 Key 失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    setError('');
    try {
      await deletePlatformModelKey(preset.id, keyId);
      await load();
    } catch (e: unknown) {
      setError(messageOf(e, '删除 Key 失败'));
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Key 池 · {preset.name}</CardTitle>
            <CardDescription>
              任务调用该预置时，后端用 Redis 游标在各 Key 之间轮询。
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="bg-white" onClick={onClose}>收起</Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="key-secret">密钥环境变量名 *</Label>
            <Input
              id="key-secret"
              className="bg-white"
              value={form.secret_ref}
              onChange={(e) => setForm({ ...form, secret_ref: e.target.value })}
              placeholder="例如：DASHSCOPE_API_KEY1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-label">标签</Label>
            <Input
              id="key-label"
              className="bg-white"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="选填"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-weight">权重</Label>
            <Input
              id="key-weight"
              type="number"
              min={1}
              max={100}
              className="bg-white"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? '添加中...' : '添加 Key'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground -mt-2">
          权重、RPM/RPS 限额当前仅落库，后端尚未按它们调度或限流（见未完成任务清单）。
        </p>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>环境变量名</TableHead>
              <TableHead>标签</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[100px]">权重</TableHead>
              <TableHead className="w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-mono text-xs">{key.secret_ref}</TableCell>
                <TableCell>{key.label || '-'}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      key.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }
                  >
                    {key.status}
                  </Badge>
                </TableCell>
                <TableCell>{key.weight}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleDelete(key.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    删除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {keys.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-6">
                  该预置暂无 Key，任务将回退使用预置自身的密钥环境变量名
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

// ===== 平台数据集预置 =====

const DatasetPresetPanel: React.FC = () => {
  const [presets, setPresets] = useState<PlatformDatasetPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    source_type: 'file_upload',
    storage_uri: '',
    schema_json: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPresets(await listPlatformDatasetPresets());
    } catch (e: unknown) {
      setError(messageOf(e, '加载平台数据集预置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.name.trim() || !form.storage_uri.trim()) {
      setError('名称与存储地址为必填项');
      return;
    }
    setSaving(true);
    try {
      const created = await createPlatformDatasetPreset({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        source_type: form.source_type,
        storage_uri: form.storage_uri.trim(),
        schema_json: parseJSONField(form.schema_json, '数据 schema'),
      });
      setNotice(`平台数据集预置「${created.name}」已创建`);
      setForm({ name: '', description: '', source_type: 'file_upload', storage_uri: '', schema_json: '' });
      await load();
    } catch (e: unknown) {
      setError(messageOf(e, '创建平台数据集预置失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">新建平台数据集预置</CardTitle>
          <CardDescription>预置数据集对全体测评用户可见，可直接用于创建评测任务。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ds-name">名称 *</Label>
                <Input
                  id="ds-name"
                  className="bg-white"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：Prompt Attack Benchmark"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-source-type">来源类型 *</Label>
                <Select
                  value={form.source_type}
                  onValueChange={(value) => setForm({ ...form, source_type: value })}
                >
                  <SelectTrigger id="ds-source-type" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-description">描述</Label>
                <Input
                  id="ds-description"
                  className="bg-white"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="选填"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-storage-uri">存储地址 *</Label>
              <Input
                id="ds-storage-uri"
                className="bg-white"
                value={form.storage_uri}
                onChange={(e) => setForm({ ...form, storage_uri: e.target.value })}
                placeholder="本地文件填绝对路径，远程填 URL"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-schema">数据 schema (JSON)</Label>
              <textarea
                id="ds-schema"
                className="w-full min-h-[80px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                value={form.schema_json}
                onChange={(e) => setForm({ ...form, schema_json: e.target.value })}
                placeholder='{"prompt_field": "prompt"}'
              />
            </div>

            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? '创建中...' : '创建预置'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">平台数据集预置（{presets.length}）</CardTitle>
            <Button variant="outline" size="sm" className="bg-white" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead className="w-[130px]">来源类型</TableHead>
                <TableHead>存储地址</TableHead>
                <TableHead>描述</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presets.map((preset) => (
                <TableRow key={preset.id}>
                  <TableCell className="font-medium">
                    {preset.name}
                    <div className="font-mono text-xs text-muted-foreground">{preset.id}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{preset.source_type}</Badge></TableCell>
                  <TableCell className="max-w-[360px] truncate" title={preset.storage_uri}>{preset.storage_uri}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{preset.description || '-'}</TableCell>
                </TableRow>
              ))}
              {presets.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-slate-500 py-6">
                    暂无平台数据集预置
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ===== 攻防策略 =====
//
// 攻击与防御策略接口形状完全一致，共用这一个面板，只换 api 与算法描述表。
// 这里建出来的策略会出现在「新建评测任务」页的攻防策略下拉里。

const StrategyPanel: React.FC<{ kind: StrategyKind }> = ({ kind }) => {
  const isAttack = kind === 'attack';
  const specTable = STRATEGY_ALGORITHMS[kind];
  const api = isAttack ? attackStrategyApi : defenseStrategyApi;

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [registered, setRegistered] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    algorithm: '',
    paramValues: {} as Record<string, string>,
    rawParams: '',
  });

  const spec: AlgorithmSpec | undefined = form.algorithm ? specTable[form.algorithm] : undefined;

  // 以已注册算法为准；若正在编辑的策略用了已下线的算法，也保留在选项里免得选择框落空。
  const algorithmOptions = useMemo(() => {
    const base = registered.length > 0 ? [...registered] : Object.keys(specTable);
    if (form.algorithm && !base.includes(form.algorithm)) base.push(form.algorithm);
    return base;
  }, [registered, specTable, form.algorithm]);

  const resetForm = useCallback(() => {
    setForm({ name: '', description: '', algorithm: '', paramValues: {}, rawParams: '' });
    setEditingId(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, algos] = await Promise.all([
        api.list(),
        (isAttack ? listAttackAlgorithms() : listDefenseAlgorithms()).catch(() => [] as string[]),
      ]);
      setStrategies(list);
      setRegistered(algos);
    } catch (e: unknown) {
      setError(messageOf(e, '加载策略列表失败'));
    } finally {
      setLoading(false);
    }
  }, [api, isAttack]);

  useEffect(() => {
    load();
  }, [load]);

  // 换算法时清空参数，避免把上一个算法的字段带到新算法上
  const handleAlgorithmChange = (value: string) => {
    setForm((prev) => ({ ...prev, algorithm: value, paramValues: {}, rawParams: '' }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const name = form.name.trim();
    if (!name) {
      setError('策略名称为必填项');
      return;
    }
    if (!form.algorithm) {
      setError('请选择算法');
      return;
    }

    let params: Record<string, unknown>;
    if (spec) {
      params = buildParams(spec, form.paramValues);
    } else {
      const raw = form.rawParams.trim();
      params = {};
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            setError('参数需为 JSON 对象');
            return;
          }
          params = parsed as Record<string, unknown>;
        } catch {
          setError('参数不是合法的 JSON');
          return;
        }
      }
    }

    const payload: StrategyInput = {
      name,
      description: form.description.trim() || undefined,
      config_json: { algorithm: form.algorithm, params },
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.update(editingId, payload);
        setNotice(`策略「${name}」已更新`);
      } else {
        await api.create(payload);
        setNotice(`策略「${name}」已创建，可在新建评测任务时选用`);
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setError(messageOf(e, editingId ? '更新策略失败' : '创建策略失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (strategy: Strategy) => {
    const algorithm = strategy.algorithm ?? '';
    const knownSpec = specTable[algorithm];
    setEditingId(strategy.id);
    setConfirmingId(null);
    setError('');
    setNotice('');
    setForm({
      name: strategy.name,
      description: strategy.description ?? '',
      algorithm,
      paramValues: paramsToValues(knownSpec, strategy.config_json?.params),
      rawParams: knownSpec ? '' : JSON.stringify(strategy.config_json?.params ?? {}, null, 2),
    });
  };

  const handleDelete = async (strategy: Strategy) => {
    setError('');
    setNotice('');
    setDeletingId(strategy.id);
    try {
      await api.remove(strategy.id);
      setNotice(`策略「${strategy.name}」已删除`);
      setConfirmingId(null);
      if (editingId === strategy.id) resetForm();
      await load();
    } catch (e: unknown) {
      setError(messageOf(e, '删除策略失败'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? '编辑策略' : '新建策略'}</CardTitle>
          <CardDescription>
            {isAttack
              ? '攻击策略会改写送入模型的 prompt，用于红队对抗测试。'
              : '防御策略可在输入/输出侧做检测与清洗，检测结论会显示在评测报告的样本明细里。'}
            {' '}策略对所有测评用户可见。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`${kind}-name`}>策略名称 *</Label>
                <Input
                  id={`${kind}-name`}
                  className="bg-white"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={isAttack ? '例如：低频噪声注入' : '例如：危险关键词拦截'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${kind}-algorithm`}>算法 *</Label>
                <Select value={form.algorithm} onValueChange={handleAlgorithmChange}>
                  <SelectTrigger id={`${kind}-algorithm`} className="bg-white">
                    <SelectValue placeholder="选择算法" />
                  </SelectTrigger>
                  <SelectContent>
                    {algorithmOptions.map((algorithm) => (
                      <SelectItem key={algorithm} value={algorithm}>
                        {specTable[algorithm]?.label ?? algorithm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${kind}-description`}>描述</Label>
                <Input
                  id={`${kind}-description`}
                  className="bg-white"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="选填"
                />
              </div>
            </div>

            {spec ? <p className="text-xs text-muted-foreground">{spec.summary}</p> : null}

            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label>算法参数</Label>
                {spec && spec.fields.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700"
                    onClick={() => setForm({ ...form, paramValues: exampleValues(spec) })}
                  >
                    填入示例值
                  </button>
                ) : null}
              </div>

              {spec ? (
                spec.fields.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {spec.fields.map((field) => {
                      const wide = field.type === 'textarea' || field.type === 'stringList';
                      const fieldId = `${kind}-param-${field.key}`;
                      return (
                        <div key={field.key} className={wide ? 'space-y-2 md:col-span-2' : 'space-y-2'}>
                          <Label htmlFor={fieldId} className="text-xs font-normal text-muted-foreground">
                            {field.label}
                          </Label>
                          {wide ? (
                            <textarea
                              id={fieldId}
                              className="w-full min-h-[80px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                              value={form.paramValues[field.key] ?? ''}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  paramValues: { ...form.paramValues, [field.key]: e.target.value },
                                })
                              }
                              placeholder={field.placeholder}
                            />
                          ) : (
                            <Input
                              id={fieldId}
                              className="bg-white"
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={form.paramValues[field.key] ?? ''}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  paramValues: { ...form.paramValues, [field.key]: e.target.value },
                                })
                              }
                              placeholder={field.placeholder}
                            />
                          )}
                          {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">该算法无可调参数。</p>
                )
              ) : (
                <div className="space-y-2">
                  <textarea
                    id={`${kind}-raw-params`}
                    className="w-full min-h-[80px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                    value={form.rawParams}
                    onChange={(e) => setForm({ ...form, rawParams: e.target.value })}
                    placeholder='{"every": 4}'
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.algorithm
                      ? `算法 ${form.algorithm} 未在前端登记参数，请直接填写 params JSON。`
                      : '选择算法后，这里会显示该算法的参数表单。'}
                  </p>
                </div>
              )}
            </div>

            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? '保存中...' : editingId ? '保存修改' : '创建策略'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" className="bg-white" onClick={resetForm}>
                  取消编辑
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">策略列表（{strategies.length}）</CardTitle>
            <Button variant="outline" size="sm" className="bg-white" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead className="w-[180px]">算法</TableHead>
                <TableHead>参数</TableHead>
                <TableHead className="w-[200px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strategies.map((strategy) => (
                <TableRow key={strategy.id}>
                  <TableCell className="font-medium">
                    {strategy.name}
                    {strategy.description ? (
                      <div className="text-xs text-muted-foreground font-normal">{strategy.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {strategy.algorithm ?? '未指定'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate font-mono text-xs text-muted-foreground">
                    {JSON.stringify(strategy.config_json?.params ?? {})}
                  </TableCell>
                  <TableCell>
                    {confirmingId === strategy.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-red-600 text-white border-red-600 hover:bg-red-700"
                          disabled={deletingId === strategy.id}
                          onClick={() => handleDelete(strategy)}
                        >
                          {deletingId === strategy.id ? '删除中...' : '确认删除'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white"
                          onClick={() => setConfirmingId(null)}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="bg-white" onClick={() => handleEdit(strategy)}>
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setConfirmingId(strategy.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          删除
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {strategies.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-slate-500 py-6">
                    暂无{isAttack ? '攻击' : '防御'}策略，请在上方创建
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const StrategyTab: React.FC = () => {
  const [kind, setKind] = useState<StrategyKind>('attack');
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant={kind === 'attack' ? 'default' : 'outline'}
          className={kind === 'attack' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white'}
          onClick={() => setKind('attack')}
        >
          <Swords className="w-4 h-4 mr-1.5" />
          攻击策略
        </Button>
        <Button
          variant={kind === 'defense' ? 'default' : 'outline'}
          className={kind === 'defense' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white'}
          onClick={() => setKind('defense')}
        >
          <ShieldCheck className="w-4 h-4 mr-1.5" />
          防御策略
        </Button>
      </div>
      {/* key 保证切换时重建面板，清掉另一半的编辑态与表单 */}
      <StrategyPanel key={kind} kind={kind} />
    </div>
  );
};

// ===== 页面 =====

const Admin: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setIsAdmin(hasAdminRole(user)))
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <PageFrame>
        <div className="text-sm text-slate-500">正在校验权限...</div>
      </PageFrame>
    );
  }

  if (!isAdmin) {
    return (
      <PageFrame>
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              权限不足
            </CardTitle>
            <CardDescription>
              管理后台仅对平台管理员开放。请让管理员执行
              <span className="font-mono"> python scripts/grant_platform_admin.py &lt;邮箱&gt; </span>
              后重新登录。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard">
              <Button variant="outline" className="bg-white">返回控制台</Button>
            </Link>
          </CardContent>
        </Card>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-foreground">平台管理后台</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-8">
        系统运行状态、攻防策略、平台预置模型与数据集、模型 Key 池。
      </p>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-14 p-1 bg-white border border-border rounded-xl shadow-sm mb-8">
          <TabsTrigger value="status" className="h-full rounded-lg text-base font-medium">
            <ShieldCheck className="w-4 h-4 mr-2" /> 系统状态
          </TabsTrigger>
          <TabsTrigger value="strategies" className="h-full rounded-lg text-base font-medium">
            <Swords className="w-4 h-4 mr-2" /> 攻防策略
          </TabsTrigger>
          <TabsTrigger value="models" className="h-full rounded-lg text-base font-medium">
            <KeyRound className="w-4 h-4 mr-2" /> 平台模型预置
          </TabsTrigger>
          <TabsTrigger value="datasets" className="h-full rounded-lg text-base font-medium">
            <Database className="w-4 h-4 mr-2" /> 平台数据集预置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <SystemStatusPanel />
        </TabsContent>
        <TabsContent value="strategies">
          <StrategyTab />
        </TabsContent>
        <TabsContent value="models">
          <ModelPresetPanel />
        </TabsContent>
        <TabsContent value="datasets">
          <DatasetPresetPanel />
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
};

export default Admin;
