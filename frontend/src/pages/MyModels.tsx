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
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  CONNECTION_ERROR_LABELS,
  createModel,
  createModelFromPreset,
  deleteModel,
  listModelPresets,
  listModels,
  listProviders,
  testModelConnection,
  updateModel,
  type ConnectionTest,
  type ModelConfig,
  type Provider,
} from '@/lib/auth';

type ModelPreset = {
  id: string;
  name: string;
  provider?: string;
  description?: string;
};

// Radix 的 Select 不接受空字符串 value，所以用一个哨兵值表示「手填」
const CUSTOM_PROVIDER = '__custom_provider__';
const CUSTOM_MODEL = '__custom_model__';

const DEFAULT_AUTH_TYPE = 'bearer';

// 采样参数的默认值。temperature 取 0 而不是厂商默认值：评测要的是可复现，
// 同一份数据集跑两次得出不同数字，报告就没有意义了。
//
// max_tokens 取 2048 是为了「不要截断」——它设太小会让裁判看到半截回答，
// 把没说完的有害内容判成 safe，那是最不该出现的错（假阴性）。
const DEFAULT_TEMPERATURE = '0';
const DEFAULT_MAX_TOKENS = '2048';

// 这个配置实际会调用哪个模型名：params_json.model 优先，取不到才回落配置名。
// 与后端 ModelService.effective_generation_params 保持同一套规则 —— 两边不一致
// 的话，界面上显示的和真正发出去的就不是一个东西。
function effectiveModelOf(model: ModelConfig): string {
  const raw = model.params_json?.model;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return model.name;
}

// 表格里那行参数摘要。刻意把「什么都没设」写成「厂商默认」而不是「-」：
// 这两种情况在结果上完全不同，前者是厂商替我们定，后者是根本没问题。
function formatGenParams(model: ModelConfig): string {
  const parts: string[] = [];
  if (typeof model.params_json?.temperature === 'number') {
    parts.push(`T=${model.params_json.temperature}`);
  }
  if (typeof model.params_json?.max_tokens === 'number') {
    parts.push(`max=${model.params_json.max_tokens}`);
  }
  return parts.length ? parts.join(' · ') : '厂商默认';
}

// 把输入框里的字符串转成正数。空串 = 不设置（用厂商默认值），不是 0。
function parseOptionalNumber(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function providerLabel(providers: Provider[], providerId: string) {
  return providers.find((p) => p.id === providerId)?.label ?? providerId;
}

const MyModels = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [byokEnabled, setByokEnabled] = useState(false);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [presets, setPresets] = useState<ModelPreset[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');

  const [tab, setTab] = useState('byok');

  // ---- 自带密钥表单 ----
  const [providerId, setProviderId] = useState('');
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [modelChoice, setModelChoice] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [temperatureInput, setTemperatureInput] = useState(DEFAULT_TEMPERATURE);
  const [maxTokensInput, setMaxTokensInput] = useState(DEFAULT_MAX_TOKENS);
  const [submitting, setSubmitting] = useState(false);
  const [rotationId, setRotationId] = useState<string | null>(null);
  const [rotationKey, setRotationKey] = useState('');
  const [paramsEditingId, setParamsEditingId] = useState<string | null>(null);
  const [paramsDraft, setParamsDraft] = useState({ model: '', temperature: '', maxTokens: '' });
  const [savingParams, setSavingParams] = useState(false);

  // ---- 每行的测试 / 删除状态 ----
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ConnectionTest>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === providerId) ?? null,
    [providers, providerId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // 厂商目录可能因后端版本较旧而不存在，但它不该拖垮整页 —— 单独兜住
      const [catalog, modelList, presetList] = await Promise.all([
        listProviders().catch(() => ({ providers: [] as Provider[], byok_enabled: false })),
        listModels(),
        listModelPresets().catch(() => []),
      ]);
      setProviders(catalog.providers);
      setByokEnabled(catalog.byok_enabled);
      setModels(Array.isArray(modelList) ? modelList : []);
      setPresets(Array.isArray(presetList) ? presetList : []);
      // 服务端没配主密钥时，默认落在「平台预置」页 —— 免得用户一进来就撞墙
      setTab(catalog.byok_enabled ? 'byok' : 'preset');
    } catch (error: unknown) {
      setLoadError(messageOf(error, '加载模型列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 切换厂商：带出官方 endpoint 与首个模型，用户仍可改（中转地址）
  const handleProviderChange = (value: string) => {
    setProviderId(value);
    setFormError('');
    if (value === CUSTOM_PROVIDER) {
      setEndpoint('');
      setModelChoice(CUSTOM_MODEL);
      return;
    }
    const provider = providers.find((p) => p.id === value);
    if (!provider) return;
    setEndpoint(provider.endpoint);
    const first = provider.models[0]?.id ?? CUSTOM_MODEL;
    setModelChoice(first);
    if (!name.trim()) setName(first === CUSTOM_MODEL ? '' : first);
  };

  const handleModelChange = (value: string) => {
    setModelChoice(value);
    if (value !== CUSTOM_MODEL && !name.trim()) setName(value);
  };

  // 自填地址一律按 provider='openai' 落库：后端只对「历史白名单 ∪ 厂商注册表」
  // 里的 provider 走 OpenAI 兼容分支，用户自造的标识（如 my-relay）会静默落到
  // 通用 HTTP 兜底，协议完全不同，而且要等评测跑到一半才暴露。
  // 中转地址本身就是 OpenAI 兼容的，openai 正是它该用的值。
  const effectiveProvider = providerId === CUSTOM_PROVIDER ? 'openai' : providerId;
  const effectiveModel = modelChoice === CUSTOM_MODEL ? customModel.trim() : modelChoice;

  const resetForm = () => {
    setProviderId('');
    setName('');
    setEndpoint('');
    setModelChoice('');
    setCustomModel('');
    setApiKey('');
    setTemperatureInput(DEFAULT_TEMPERATURE);
    setMaxTokensInput(DEFAULT_MAX_TOKENS);
    setFormError('');
  };

  // 校验采样参数。返回 null 表示通过；返回字符串是给用户看的错误文案。
  // 留空是合法输入（= 不发这个字段），所以「空」与「填错」必须分得开。
  const validateSamplingParams = (): string | null => {
    const temperature = parseOptionalNumber(temperatureInput);
    if (Number.isNaN(temperature)) {
      return 'Temperature 请填 0 或以上的数字；留空表示不指定，用厂商默认值';
    }
    const maxTokens = parseOptionalNumber(maxTokensInput);
    if (Number.isNaN(maxTokens)) {
      return 'Max Tokens 请填正整数；留空表示不指定，用厂商默认值';
    }
    if (maxTokens !== null && (!Number.isInteger(maxTokens) || maxTokens < 1)) {
      return 'Max Tokens 需为大于 0 的整数';
    }
    return null;
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setNotice('');

    if (!effectiveProvider) return setFormError('请填写厂商标识');
    if (!name.trim()) return setFormError('请填写模型名称');
    if (!/^https?:\/\//i.test(endpoint.trim())) {
      return setFormError('接口地址需以 http:// 或 https:// 开头');
    }
    if (!effectiveModel) return setFormError('请填写模型名');
    if (!apiKey.trim()) return setFormError('请填写 API Key');
    const paramError = validateSamplingParams();
    if (paramError) return setFormError(paramError);

    // 留空的参数不写进去 —— 不发的字段厂商用自己的默认值，比我们猜一个更准。
    // 猜错的代价很实：推理模型（如 deepseek-reasoner）收到 temperature 直接 400。
    const temperature = parseOptionalNumber(temperatureInput);
    const maxTokens = parseOptionalNumber(maxTokensInput);
    const params: Record<string, unknown> = { model: effectiveModel };
    if (temperature !== null) params.temperature = temperature;
    if (maxTokens !== null) params.max_tokens = maxTokens;

    setSubmitting(true);
    try {
      await createModel({
        name: name.trim(),
        provider: effectiveProvider,
        endpoint: endpoint.trim(),
        auth_type: DEFAULT_AUTH_TYPE,
        // 明文只在这一跳里出现；服务端加密落库，任何响应都不回传
        api_key: apiKey.trim(),
        params_json: params,
      });
      resetForm();
      setNotice('模型已保存。请点下方「测试连接」确认真的能调通 —— 密钥或模型名写错时，评测跑到一半才会暴露。');
      await load();
    } catch (error: unknown) {
      setFormError(messageOf(error, '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPreset = async (preset: ModelPreset) => {
    setAddingPresetId(preset.id);
    setNotice('');
    setFormError('');
    try {
      await createModelFromPreset(preset.id);
      setNotice(`已添加「${preset.name}」`);
      await load();
    } catch (error: unknown) {
      setFormError(messageOf(error, '添加平台预置模型失败'));
    } finally {
      setAddingPresetId(null);
    }
  };

  const handleTest = async (model: ModelConfig) => {
    setTestingId(model.id);
    try {
      const result = await testModelConnection(model.id);
      setTestResults((prev) => ({ ...prev, [model.id]: result }));
    } catch (error: unknown) {
      // 走到这里说明请求本身失败（网络/鉴权/后端 500），与「厂商连不通」不同
      setTestResults((prev) => ({
        ...prev,
        [model.id]: {
          ok: false,
          latency_ms: 0,
          reply_preview: null,
          error_code: 'bad_response',
          error_message: messageOf(error, '测试请求失败'),
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleRotateKey = async (model: ModelConfig) => {
    if (!rotationKey.trim()) return;
    setFormError('');
    setNotice('');
    try {
      await updateModel(model.id, { api_key: rotationKey.trim() });
      setRotationId(null);
      setRotationKey('');
      setNotice('密钥已更新。建议重新执行一次「测试连接」。');
      await load();
    } catch (error: unknown) {
      setFormError(messageOf(error, '更新密钥失败'));
    }
  };

  // 打开某个已有配置的参数编辑行。draft 用输入框的字符串形态，
  // 空串代表「这个字段没设」，不能顺手写成 0 —— 0 是个真实取值。
  const openParamsEditor = (model: ModelConfig) => {
    if (paramsEditingId === model.id) return setParamsEditingId(null);
    const params = model.params_json ?? {};
    setParamsDraft({
      model: effectiveModelOf(model),
      temperature: typeof params.temperature === 'number' ? String(params.temperature) : '',
      maxTokens: typeof params.max_tokens === 'number' ? String(params.max_tokens) : '',
    });
    setParamsEditingId(model.id);
    setFormError('');
    setNotice('');
  };

  const handleSaveParams = async (model: ModelConfig) => {
    setFormError('');
    setNotice('');
    const modelName = paramsDraft.model.trim();
    if (!modelName) return setFormError('模型名不能为空 —— 它决定实际调用哪个模型');

    const temperature = parseOptionalNumber(paramsDraft.temperature);
    if (Number.isNaN(temperature)) {
      return setFormError('Temperature 请填 0 或以上的数字；留空表示不指定');
    }
    const maxTokens = parseOptionalNumber(paramsDraft.maxTokens);
    if (Number.isNaN(maxTokens) || (maxTokens !== null && (!Number.isInteger(maxTokens) || maxTokens < 1))) {
      return setFormError('Max Tokens 需为大于 0 的整数；留空表示不指定');
    }

    // 整份覆盖 params_json，不留空字段：编辑行上的空框就是「不要这个参数」，
    // 若改成合并，用户就再也删不掉一个已经写进去的 temperature。
    const nextParams: Record<string, unknown> = { model: modelName };
    if (temperature !== null) nextParams.temperature = temperature;
    if (maxTokens !== null) nextParams.max_tokens = maxTokens;

    setSavingParams(true);
    try {
      await updateModel(model.id, { params_json: nextParams });
      setParamsEditingId(null);
      setNotice(`「${model.name}」的生成参数已更新。已跑完的历史报告不受影响，它们留的是当时的快照。`);
      await load();
    } catch (error: unknown) {
      setFormError(messageOf(error, '保存生成参数失败'));
    } finally {
      setSavingParams(false);
    }
  };

  const handleDelete = async (model: ModelConfig) => {
    setDeletingId(model.id);
    setFormError('');
    setNotice('');
    try {
      await deleteModel(model.id);
      setConfirmingId(null);
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
      await load();
    } catch (error: unknown) {
      setFormError(messageOf(error, '删除失败'));
    } finally {
      setDeletingId(null);
    }
  };

  const addedPresetNames = useMemo(
    () => new Set(models.map((m) => m.name)),
    [models],
  );

  const renderTestResult = (result: ConnectionTest | undefined) => {
    if (!result) return null;
    const label = result.error_code
      ? CONNECTION_ERROR_LABELS[result.error_code] ?? '调用失败'
      : '';
    return (
      <div
        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
          result.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}
      >
        {result.ok ? (
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        )}
        <div className="space-y-0.5">
          <div>
            {result.ok
              ? `连接正常（${result.latency_ms} ms）`
              : `${label}：${result.error_message ?? '调用失败'}`}
          </div>
          {result.ok && result.reply_preview ? (
            <div className="text-emerald-700/80">模型回复：{result.reply_preview}</div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-[1440px] mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">我的模型</h1>
            <p className="text-sm text-slate-500 mt-1">
              接入自己的大模型 API，或在平台预置里一键添加。评测任务从这里选用模型。
            </p>
          </div>
          <Button variant="outline" className="bg-white" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {loadError ? (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {loadError}
          </div>
        ) : null}
        {notice ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {notice}
          </div>
        ) : null}
        {formError ? (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>添加模型</CardTitle>
            <CardDescription>
              自带密钥的模型按「请求次数」直接计费到你的账号；平台预置模型由管理员统一配置。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="byok" disabled={!byokEnabled}>
                  自带密钥
                </TabsTrigger>
                <TabsTrigger value="preset">平台预置</TabsTrigger>
              </TabsList>

              <TabsContent value="byok" className="pt-4">
                {!byokEnabled ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      服务端未启用自带密钥（缺少主密钥 <code>SAFETY_SECRET_ENCRYPTION_KEY</code>），
                      暂时只能用平台预置模型。请联系管理员开启后重试。
                    </div>
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={handleCreate}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="provider">厂商 *</Label>
                        <Select value={providerId} onValueChange={handleProviderChange}>
                          <SelectTrigger id="provider" className="bg-white">
                            <SelectValue placeholder="选择厂商" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id}>
                                {provider.label}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_PROVIDER}>OpenAI 兼容中转地址</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="model-name">模型名称 *</Label>
                        <Input
                          id="model-name"
                          className="bg-white"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="例如：DeepSeek 生产环境"
                        />
                        <p className="text-xs text-muted-foreground">
                          仅用于在本平台内区分，评测列表里显示的就是它
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endpoint">接口地址 *</Label>
                      <Input
                        id="endpoint"
                        className="bg-white font-mono text-sm"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                        placeholder="https://api.deepseek.com/v1"
                      />
                      <p className="text-xs text-muted-foreground">
                        选厂商后会自动带出官方地址，可改成中转/代理地址
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model-id">模型名 *</Label>
                      {providerId && providerId !== CUSTOM_PROVIDER && selectedProvider ? (
                        <Select value={modelChoice} onValueChange={handleModelChange}>
                          <SelectTrigger id="model-id" className="bg-white">
                            <SelectValue placeholder="选择模型" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedProvider.models.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.label}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_MODEL}>自定义…</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}
                      {modelChoice === CUSTOM_MODEL || !providerId || providerId === CUSTOM_PROVIDER ? (
                        <Input
                          className="bg-white font-mono text-sm"
                          value={customModel}
                          onChange={(e) => setCustomModel(e.target.value)}
                          placeholder={providerId ? '填写厂商文档里的模型 ID' : '请先选择厂商'}
                          disabled={!providerId}
                        />
                      ) : null}
                      {selectedProvider?.notes ? (
                        <p className="text-xs text-amber-700">{selectedProvider.notes}</p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="temperature">Temperature</Label>
                        <Input
                          id="temperature"
                          type="number"
                          step="0.1"
                          min="0"
                          className="bg-white font-mono text-sm"
                          value={temperatureInput}
                          onChange={(e) => setTemperatureInput(e.target.value)}
                          placeholder="留空则不指定"
                        />
                        <p className="text-xs text-muted-foreground">
                          建议保持 0：评测要的是可复现，同一份数据集跑两次得不同数字，报告就没意义了。
                          推理模型（如 <code>deepseek-reasoner</code>）不接受这个参数，请留空。
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-tokens">Max Tokens</Label>
                        <Input
                          id="max-tokens"
                          type="number"
                          step="1"
                          min="1"
                          className="bg-white font-mono text-sm"
                          value={maxTokensInput}
                          onChange={(e) => setMaxTokensInput(e.target.value)}
                          placeholder="留空则不指定"
                        />
                        <p className="text-xs text-muted-foreground">
                          设太小会截断模型回答，裁判看到半截内容就可能把没说完的有害回答判成安全。
                          建议不低于 2048；留空则用厂商默认值。
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key *</Label>
                      <Input
                        id="api-key"
                        type="password"
                        autoComplete="off"
                        className="bg-white font-mono text-sm"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="粘贴厂商控制台签发的密钥"
                      />
                      <p className="text-xs text-muted-foreground">
                        提交后由服务端加密存储，页面与接口都不会再回显这只密钥
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={submitting}>
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-4 h-4 mr-2" />
                            保存模型
                          </>
                        )}
                      </Button>
                      <Button type="button" variant="outline" className="bg-white" onClick={resetForm}>
                        清空
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="preset" className="pt-4">
                {presets.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">
                    平台暂未配置预置模型，请联系管理员在管理后台添加。
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {presets.map((preset) => {
                      const added = addedPresetNames.has(preset.name);
                      return (
                        <div
                          key={preset.id}
                          className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
                        >
                          <div>
                            <div className="font-medium text-slate-900">{preset.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {preset.description || preset.provider || '平台预置模型'}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white w-full"
                            disabled={added || addingPresetId === preset.id}
                            onClick={() => void handleAddPreset(preset)}
                          >
                            {addingPresetId === preset.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                添加中...
                              </>
                            ) : added ? (
                              '已添加'
                            ) : (
                              '一键添加'
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>我的模型</CardTitle>
            <CardDescription>
              共 {models.length} 个。新建评测时可在「目标评测模型」里选用。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="w-[150px]">厂商</TableHead>
                  <TableHead className="w-[190px]">实际调用的模型</TableHead>
                  <TableHead className="w-[170px]">生成参数</TableHead>
                  <TableHead className="w-[110px]">凭证</TableHead>
                  <TableHead className="w-[260px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => {
                  const result = testResults[model.id];
                  const modelName = effectiveModelOf(model);
                  // 配置名和实调模型名不一致时必须显形。老数据里就有这种：
                  // 配置叫 deepseek-chat，params_json.model 却是 deepseek-flash。
                  // 不标出来，用户会一直以为自己测的是名字上写的那一个。
                  const nameDiverged = modelName !== model.name;
                  return (
                    <React.Fragment key={model.id}>
                      <TableRow>
                        <TableCell className="font-medium">{model.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {providerLabel(providers, model.provider)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={nameDiverged ? 'text-amber-700' : 'text-muted-foreground'}>
                              {modelName}
                            </span>
                            {nameDiverged ? (
                              <span
                                title={`配置名是「${model.name}」，实际调用的是「${modelName}」`}
                                className="shrink-0"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-muted-foreground">
                              {formatGenParams(model)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white h-7 px-2 text-xs"
                              onClick={() => openParamsEditor(model)}
                            >
                              {paramsEditingId === model.id ? '收起' : '修改'}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {model.platform_preset_id ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              平台预置
                            </Badge>
                          ) : model.has_auth_secret ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              已配置密钥
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                              未配置
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {confirmingId === model.id ? (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-red-600 text-white border-red-600 hover:bg-red-700"
                                disabled={deletingId === model.id}
                                onClick={() => void handleDelete(model)}
                              >
                                {deletingId === model.id ? '删除中...' : '确认删除'}
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
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white"
                                disabled={testingId === model.id}
                                onClick={() => void handleTest(model)}
                              >
                                {testingId === model.id ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Plug className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                测试连接
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white"
                                onClick={() => {
                                  setRotationId(rotationId === model.id ? null : model.id);
                                  setRotationKey('');
                                }}
                              >
                                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                                换密钥
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setConfirmingId(model.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                删除
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>

                      {paramsEditingId === model.id ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-slate-50">
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">实际调用的模型名</Label>
                                  <Input
                                    className="bg-white font-mono text-sm"
                                    value={paramsDraft.model}
                                    onChange={(e) =>
                                      setParamsDraft((prev) => ({ ...prev, model: e.target.value }))
                                    }
                                    placeholder="厂商文档里的模型 ID"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Temperature</Label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    className="bg-white font-mono text-sm"
                                    value={paramsDraft.temperature}
                                    onChange={(e) =>
                                      setParamsDraft((prev) => ({ ...prev, temperature: e.target.value }))
                                    }
                                    placeholder="留空 = 不指定"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Max Tokens</Label>
                                  <Input
                                    type="number"
                                    step="1"
                                    min="1"
                                    className="bg-white font-mono text-sm"
                                    value={paramsDraft.maxTokens}
                                    onChange={(e) =>
                                      setParamsDraft((prev) => ({ ...prev, maxTokens: e.target.value }))
                                    }
                                    placeholder="留空 = 不指定"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  disabled={savingParams}
                                  onClick={() => void handleSaveParams(model)}
                                >
                                  {savingParams ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                      保存中...
                                    </>
                                  ) : (
                                    '保存参数'
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-white"
                                  onClick={() => setParamsEditingId(null)}
                                >
                                  取消
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                  改动只影响之后发起的评测；已完成的报告留的是运行时的快照。
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}

                      {rotationId === model.id ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-slate-50">
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="password"
                                autoComplete="off"
                                className="bg-white font-mono text-sm max-w-md"
                                value={rotationKey}
                                onChange={(e) => setRotationKey(e.target.value)}
                                placeholder="粘贴新的 API Key"
                              />
                              <Button
                                size="sm"
                                disabled={!rotationKey.trim()}
                                onClick={() => void handleRotateKey(model)}
                              >
                                保存新密钥
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-white"
                                onClick={() => {
                                  setRotationId(null);
                                  setRotationKey('');
                                }}
                              >
                                取消
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}

                      {result ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-slate-50 pt-0">
                            {renderTestResult(result)}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
                {models.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-slate-500 py-6">
                      还没有模型，请在上方添加
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyModels;
