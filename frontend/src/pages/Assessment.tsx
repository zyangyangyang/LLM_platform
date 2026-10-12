import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import {
  ShieldAlert, ShieldCheck, FileSearch, Upload, Info, Check, Play, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createDatasetFromPreset,
  createEvalTask,
  createModelFromPreset,
  getCurrentUser,
  hasAdminRole,
  listAttackAlgorithms,
  listAttackStrategies,
  listDatasetPresets,
  listDatasets,
  listDefenseAlgorithms,
  listDefenseStrategies,
  listModelPresets,
  listModels,
  runEvalTask,
  uploadDatasetFile,
  previewTaskDimension,
  type DimensionPreview,
  type Strategy,
} from '@/lib/auth';
import {
  LABEL_FIELD_CANDIDATES,
  PROMPT_FIELD_CANDIDATES,
  collectFieldPaths,
  defaultDatasetName,
  guessField,
  readDatasetHead,
  resolvePrompt,
} from '@/lib/datasetFile';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type DatasetOption = {
  id: string;
  name: string;
  source: 'user' | 'preset';
};

type ModelOption = {
  id: string;
  name: string;
  source: 'user' | 'preset';
};

// 策略下拉里的“不使用”哨兵值：后端两个字段都是可选的，为空即不启用该侧算法
const NO_STRATEGY = '__none__';

// 评测维度：这就是驱动评分标准的那个开关。
// 选中项直接作为 task_type 提交，后端 _resolve_eval_mode 据此选评分路径
// （hallucination -> 三元组/裁判等价，其余 -> 裁判判输出安全性）。
//
// `needsGroundTruth` 标记该维度是否依赖数据集里的标准答案。只有幻觉口径需要：
// 它得拿答案跟模型输出比对；攻击类口径由裁判模型判输出，不读标签。
const DIMENSIONS = [
  {
    taskType: 'prompt_attack',
    label: '提示词注入 (Prompt Injection)',
    description: 'DAN 模式、角色扮演等越狱攻击测试。由裁判模型判定输出是否安全，不依赖数据集标签。',
    needsGroundTruth: false,
  },
  {
    taskType: 'multimodal',
    label: '多模态攻击 (Multimodal)',
    description: '图像/视频与文本联合攻击评估。同样由裁判模型判定输出，不依赖数据集标签。',
    needsGroundTruth: false,
  },
  {
    taskType: 'hallucination',
    label: '幻觉检测 (Hallucination)',
    description: '检测模型在事实性问答中的编造行为。需要数据集带可比对的标准答案。',
    needsGroundTruth: true,
  },
] as const;

type DimensionTaskType = (typeof DIMENSIONS)[number]['taskType'];

// 数据集名 -> 维度。仅用于「选中数据集时给出一个合理默认值」，
// 用户仍可改选——最终以维度选择为准，不再由名字决定评分标准。
const inferTaskTypeFromName = (name: string): DimensionTaskType | null => {
  const trimmed = (name || '').trim();
  if (trimmed.includes('Entity Relation Hallucination')) return 'hallucination';
  if (trimmed.includes('Prompt Attack Benchmark')) return 'prompt_attack';
  if (trimmed.includes('Multimodal Attack 100')) return 'multimodal';
  return null;
};

// 数据集下拉里“上传自定义数据集”的哨兵值。
// 它**不是**真实数据集 id —— 选中后展开上传面板，上传成功再把 selectedDataset
// 换成新数据集的 id。早先这里是字面量 'custom-upload' 直接当 dataset_id 提交，
// 后端校验不通过，点开始只会拿到 400 Invalid dataset_id。
const CUSTOM_UPLOAD = '__custom_upload__';

// 后端 _save_uploaded_file 只收这两种，其余直接 400
const ACCEPTED_DATASET_EXT = ['.json', '.jsonl'];

const Assessment: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("attack");
  const [loading, setLoading] = useState(false);
  const [datasetOptions, setDatasetOptions] = useState<DatasetOption[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [taskName, setTaskName] = useState('');
  const [attackStrategies, setAttackStrategies] = useState<Strategy[]>([]);
  const [defenseStrategies, setDefenseStrategies] = useState<Strategy[]>([]);
  const [attackAlgorithms, setAttackAlgorithms] = useState<string[]>([]);
  const [defenseAlgorithms, setDefenseAlgorithms] = useState<string[]>([]);
  const [selectedAttack, setSelectedAttack] = useState(NO_STRATEGY);
  const [selectedDefense, setSelectedDefense] = useState(NO_STRATEGY);
  const [isAdmin, setIsAdmin] = useState(false);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 上传数据集：file 选中后先在浏览器里解析出字段名和预览，确认无误再提交。
  // prompt_field / label_field 填错不会报错，只会让样本被静默丢掉，所以必须预览。
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadPromptField, setUploadPromptField] = useState('');
  const [uploadLabelField, setUploadLabelField] = useState('');
  const [uploadFieldPaths, setUploadFieldPaths] = useState<string[]>([]);
  const [uploadSamples, setUploadSamples] = useState<Record<string, unknown>[]>([]);
  const [uploadParsing, setUploadParsing] = useState(false);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const uploadPanelOpen = selectedDataset === CUSTOM_UPLOAD;

  // 评测维度。默认走攻击口径——它不依赖数据集标签，选错数据集的代价最小。
  const [dimension, setDimension] = useState<DimensionTaskType>('prompt_attack');
  // 维度 × 数据集 的预检结果。null 表示「没选数据集 / 查不动」，此时不置灰也不提醒，
  // 交给后端 create_task 兜底——前端探测失败不该阻断正常流程。
  const [dimensionPreview, setDimensionPreview] = useState<DimensionPreview | null>(null);
  // 非空即弹提交确认框。放在这里而不是提交函数里，是因为确认框要跨渲染存活。
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);

  // 选出数据集时给一个默认维度。只是默认值，不锁死：
  // 名字认不出来就保持用户当前选择，而不是悄悄改掉。
  useEffect(() => {
    const option = datasetOptions.find((d) => d.id === selectedDataset);
    if (!option) return;
    let inferred = inferTaskTypeFromName(option.name);
    // 名字认不出时，再按预置 id 兜一次。用户「从预置创建」之后 source 会变成
    // user、名字一般仍一致，但对不上的情况留条后路。
    if (!inferred && option.source === 'preset') {
      if (option.id.includes('entity-relation-hallucination')) inferred = 'hallucination';
      else if (option.id.includes('prompt-attack')) inferred = 'prompt_attack';
      else if (option.id.includes('multimodal-attack')) inferred = 'multimodal';
    }
    if (inferred) setDimension(inferred);
  }, [selectedDataset, datasetOptions]);

  // 预检「所选维度 × 所选数据集」。
  //
  // 交给后端做而不是在前端扫样本：判定要跟 create_task 的硬拦截完全一致，各写一份
  // 迟早漂移，漂移的后果就是「前端说能选、提交却被拒」。后端还认得预置 id（预置要
  // 到提交时才落库），所以选中「（预置）」项时同样能立刻拿到结论。
  //
  // 依赖 dimension：换维度后提醒要不要出现是会变的，必须重查。
  useEffect(() => {
    if (!selectedDataset || selectedDataset === CUSTOM_UPLOAD) {
      setDimensionPreview(null);
      return;
    }
    let cancelled = false;
    setDimensionPreview(null);
    previewTaskDimension(selectedDataset, dimension)
      .then((res) => {
        if (!cancelled) setDimensionPreview(res);
      })
      .catch(() => {
        // 查不动就别拦人，让后端校验兜底，不要因为预检失败就阻断正常流程
        if (!cancelled) setDimensionPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDataset, dimension]);

  const dimensionDef = useMemo(
    () => DIMENSIONS.find((d) => d.taskType === dimension),
    [dimension],
  );

  // 置灰只看 blocked——那是「跑了也必然无效」。带 warning 的仍可选，只是要提醒。
  // preview 为 null（没选数据集 / 查不动）时一律放行，由后端拦截兜底。
  const dimensionFeasible = useCallback(
    (def: (typeof DIMENSIONS)[number]): boolean =>
      !def.needsGroundTruth || dimensionPreview === null || !dimensionPreview.blocked,
    [dimensionPreview],
  );

  const resetUpload = useCallback(() => {
    setUploadFile(null);
    setUploadName('');
    setUploadPromptField('');
    setUploadLabelField('');
    setUploadFieldPaths([]);
    setUploadSamples([]);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileChosen = useCallback(async (file: File) => {
    setUploadError('');
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_DATASET_EXT.includes(ext)) {
      setUploadError(`只支持 ${ACCEPTED_DATASET_EXT.join(' / ')}，当前是 ${ext || '无扩展名'}`);
      return;
    }

    setUploadFile(file);
    setUploadName(defaultDatasetName(file.name));
    setUploadParsing(true);
    try {
      const samples = await readDatasetHead(file, 3);
      if (samples.length === 0) {
        setUploadFieldPaths([]);
        setUploadSamples([]);
        setUploadError('没能从文件里解析出对象样本，请确认内容是 JSON 对象数组或每行一个 JSON。');
        return;
      }
      setUploadSamples(samples);
      setUploadFieldPaths(collectFieldPaths(samples));
      setUploadPromptField(guessField(samples, PROMPT_FIELD_CANDIDATES));
      setUploadLabelField(guessField(samples, LABEL_FIELD_CANDIDATES));
    } catch {
      setUploadError('读取文件失败');
    } finally {
      setUploadParsing(false);
    }
  }, []);

  const handleUploadDataset = useCallback(async () => {
    if (!uploadFile) {
      setUploadError('请先选择文件');
      return;
    }
    if (!uploadName.trim()) {
      setUploadError('请填写数据集名称');
      return;
    }
    if (!uploadPromptField) {
      setUploadError('prompt_field 必填，后端会拒绝没有该字段的数据集');
      return;
    }
    if (!uploadLabelField) {
      setUploadError('label_field 必填（后端强制要求，即使评分用不到）');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const created = (await uploadDatasetFile({
        file: uploadFile,
        name: uploadName.trim(),
        prompt_field: uploadPromptField,
        label_field: uploadLabelField,
      })) as { id?: string; name?: string };

      if (!created?.id) {
        throw new Error('上传成功但未返回数据集 id');
      }
      const newOption: DatasetOption = {
        id: created.id,
        name: created.name || uploadName.trim(),
        source: 'user',
      };
      setDatasetOptions((prev) => [newOption, ...prev]);
      setSelectedDataset(newOption.id);
      setSuccess(`数据集「${newOption.name}」已上传并选中`);
      resetUpload();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }, [uploadFile, uploadName, uploadPromptField, uploadLabelField, resetUpload]);

  // 策略由管理员在 /admin 里创建，可能晚于本页加载，所以单独抽出来支持手动刷新。
  const loadStrategies = useCallback(async () => {
    setStrategiesLoading(true);
    try {
      const [attackStrategiesRaw, defenseStrategiesRaw, attackAlgorithmsRaw, defenseAlgorithmsRaw] =
        await Promise.all([
          listAttackStrategies().catch(() => []),
          listDefenseStrategies().catch(() => []),
          listAttackAlgorithms().catch(() => []),
          listDefenseAlgorithms().catch(() => []),
        ]);
      setAttackStrategies(attackStrategiesRaw);
      setDefenseStrategies(defenseStrategiesRaw);
      setAttackAlgorithms(attackAlgorithmsRaw);
      setDefenseAlgorithms(defenseAlgorithmsRaw);
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setIsAdmin(hasAdminRole(user)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [
          userDatasetsRaw,
          presetDatasetsRaw,
          userModelsRaw,
          presetModelsRaw,
        ] = await Promise.all([
          listDatasets().catch(() => []),
          listDatasetPresets().catch(() => []),
          listModels().catch(() => []),
          listModelPresets().catch(() => []),
        ]);

        const userDatasets = Array.isArray(userDatasetsRaw) ? userDatasetsRaw : [];
        const presetDatasets = Array.isArray(presetDatasetsRaw) ? presetDatasetsRaw : [];
        const userModels = Array.isArray(userModelsRaw) ? userModelsRaw : [];
        const presetModels = Array.isArray(presetModelsRaw) ? presetModelsRaw : [];

        const merged: DatasetOption[] = [];
        const mergedModels: ModelOption[] = [];
        const usedIds = new Set<string>();
        const usedModelIds = new Set<string>();

        userDatasets.forEach((item: unknown) => {
          const row = item as { id?: string; name?: string };
          if (row.id && row.name && !usedIds.has(row.id)) {
            merged.push({ id: row.id, name: row.name, source: 'user' });
            usedIds.add(row.id);
          }
        });

        presetDatasets.forEach((item: unknown) => {
          const row = item as { id?: string; name?: string };
          if (row.id && row.name && !usedIds.has(row.id)) {
            merged.push({ id: row.id, name: `${row.name}（预置）`, source: 'preset' });
            usedIds.add(row.id);
          }
        });

        userModels.forEach((item: unknown) => {
          const row = item as { id?: string; name?: string };
          if (row.id && row.name && !usedModelIds.has(row.id)) {
            mergedModels.push({ id: row.id, name: row.name, source: 'user' });
            usedModelIds.add(row.id);
          }
        });

        presetModels.forEach((item: unknown) => {
          const row = item as { id?: string; name?: string };
          if (row.id && row.name && !usedModelIds.has(row.id)) {
            mergedModels.push({ id: row.id, name: `${row.name}（预置）`, source: 'preset' });
            usedModelIds.add(row.id);
          }
        });

        setDatasetOptions(merged);
        setModelOptions(mergedModels);

        // 从 Benchmark 库跳转过来时，按基准名称预选对应数据集
        const benchmarkParam = searchParams.get('benchmark');
        if (benchmarkParam) {
          const matched = merged.find((d) => d.name.trim() === benchmarkParam.trim());
          if (matched) setSelectedDataset(matched.id);
        }
      } catch {
        setDatasetOptions([]);
        setModelOptions([]);
      }
    };

    loadOptions();
  }, [searchParams]);

  // 字段下拉的选项。已猜出的值可能不在探测到的路径里（比如文件里只有部分
  // 样本带该字段），补进去，否则 Radix 找不到匹配项会退回 placeholder，
  // 看起来像「猜的值丢了」。
  const fieldOptions = useCallback(
    (current: string) =>
      current && !uploadFieldPaths.includes(current)
        ? [current, ...uploadFieldPaths]
        : uploadFieldPaths,
    [uploadFieldPaths],
  );

  const promptFieldOptions = useMemo(
    () => fieldOptions(uploadPromptField),
    [fieldOptions, uploadPromptField],
  );
  const labelFieldOptions = useMemo(
    () => fieldOptions(uploadLabelField),
    [fieldOptions, uploadLabelField],
  );

  const handleStart = async () => {
    setError('');
    setSuccess('');
    if (!selectedModel || !selectedDataset) {
      setError('请先选择模型和数据集');
      return;
    }
    if (selectedDataset === CUSTOM_UPLOAD) {
      setError('数据集还没上传完，请先在上传面板里点「上传并使用」');
      return;
    }
    // 后端也会拦（create_task 里同样的校验），但在这里先挡一次能省掉一轮
    // 「填完表单才被拒」；预检失败时 dimensionPreview 为 null，此处放行，
    // 由后端给出权威结论。
    if (dimensionDef?.needsGroundTruth && dimensionPreview?.blocked) {
      setError(
        dimensionPreview.block_reason ??
          `所选维度「${dimensionDef.label}」与当前数据集不匹配，请改选维度或更换数据集。`,
      );
      return;
    }
    // 口径本身能用，但结果会被误读（典型：拿带标准答案的数据集跑攻击口径，
    // 会得到接近 100% 的通过率，而它只代表「输出无害」）。不拦，但要在花掉
    // 一整轮评测前让人确认一次。
    if (dimensionPreview?.warning) {
      setPendingWarning(dimensionPreview.warning);
      return;
    }
    await submitTask();
  };

  // 真正的提交。与 handleStart 分开是因为上面那条提醒需要先弹确认框，
  // 确认后再走到这里——确认与提交不能混在一个函数里，否则 `finally` 的
  // setLoading(false) 会在弹框时就执行掉。
  const submitTask = async () => {
    setLoading(true);
    try {
      let modelConfigId = selectedModel;
      let datasetId = selectedDataset;

      const modelOption = modelOptions.find((m) => m.id === selectedModel);
      const datasetOption = datasetOptions.find((d) => d.id === selectedDataset);

      // 预置模型/数据集先落库成用户资源，再用于创建任务
      if (modelOption?.source === 'preset') {
        const createdModel = await createModelFromPreset(modelOption.id) as { id: string };
        modelConfigId = createdModel.id;
      }
      if (datasetOption?.source === 'preset') {
        const createdDataset = await createDatasetFromPreset(datasetOption.id) as { id: string };
        datasetId = createdDataset.id;
      }

      const task = await createEvalTask({
        name: taskName.trim() || `评测任务-${new Date().toLocaleString()}`,
        model_config_id: modelConfigId,
        dataset_id: datasetId,
        // 评分标准由所选维度决定，不再由数据集名推断
        task_type: dimension,
        // 未选择时不传该字段，后端按“不启用该侧算法”处理
        attack_strategy_id: selectedAttack === NO_STRATEGY ? undefined : selectedAttack,
        defense_strategy_id: selectedDefense === NO_STRATEGY ? undefined : selectedDefense,
      }) as { id: string };

      await runEvalTask(task.id);
      setSuccess('任务已创建并开始运行，正在跳转结果页');
      navigate(`/results?taskId=${encodeURIComponent(task.id)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建或运行任务失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      {/* 背景装饰图案 */}
      <div className="pointer-events-none absolute inset-0">
        {/* 左上角淡蓝色光晕 */}
        <div className="absolute -top-32 -left-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl" />
        {/* 右下角淡紫色光晕 */}
        <div className="absolute bottom-[-120px] right-[-80px] w-[420px] h-[420px] bg-indigo-200/40 rounded-full blur-3xl" />
        {/* 中间偏右的渐变矩形 */}
        <div className="absolute top-1/3 right-16 w-64 h-64 bg-gradient-to-br from-sky-100/70 to-blue-100/40 rounded-3xl rotate-6 blur-sm border border-white/40" />
        {/* 细线条网格 */}
        <div
          className="absolute inset-0 opacity-25 mix-blend-soft-light"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        {/* 点状装饰 */}
        <div className="absolute top-1/3 left-1/5 grid grid-cols-5 gap-3 opacity-40 text-sky-300">
          {Array.from({ length: 15 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-sky-300" />
          ))}
        </div>
        <div className="absolute bottom-24 right-32 grid grid-cols-4 gap-3 opacity-40 text-indigo-300">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
          ))}
        </div>
      </div>

      <Navbar />

      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">新建评测任务</h1>
          <p className="text-muted-foreground mt-2">
            配置评测目标、攻击方式与检测维度，启动针对大模型的安全评估流程。
          </p>
        </div>

        <Tabs defaultValue="attack" value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Custom Tabs List */}
          <TabsList className="grid w-full grid-cols-3 h-16 p-1 bg-white border border-border rounded-xl shadow-sm mb-8">
            <TabsTrigger value="attack" className="h-full data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-none rounded-lg text-base font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> 攻击测试 (Attack)
            </TabsTrigger>
            <TabsTrigger value="defense" className="h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none rounded-lg text-base font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> 防御评估 (Defense)
            </TabsTrigger>
            <TabsTrigger value="evaluate" className="h-full data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-none rounded-lg text-base font-medium flex items-center gap-2">
              <FileSearch className="w-4 h-4" /> 综合合规 (Evaluate)
            </TabsTrigger>
          </TabsList>

          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-6">
              <CardTitle className="flex items-center gap-2">
                {activeTab === 'attack' && <span className="text-red-600">配置红队演练参数</span>}
                {activeTab === 'defense' && <span className="text-blue-600">配置防御护栏规则</span>}
                {activeTab === 'evaluate' && <span className="text-purple-600">选择合规评估标准</span>}
              </CardTitle>
              <CardDescription>
                请根据实际需求填写以下配置，标有 * 的为必填项。
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* Target Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="task-name">任务名称</Label>
                <Input
                  id="task-name"
                  className="bg-white"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="例如：千问提示词注入评测"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="model-select">目标评测模型 *</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger id="model-select" className="bg-white">
                      <SelectValue placeholder="选择要评测的模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dataset">测试数据集 *</Label>
                   <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                    <SelectTrigger id="dataset" className="bg-white">
                      <SelectValue placeholder="选择基准测试集" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasetOptions.map((dataset) => (
                        <SelectItem key={dataset.id} value={dataset.id}>
                          {dataset.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_UPLOAD}>上传自定义数据集...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 攻防算法策略：分别对应后端的 attack_strategy_id / defense_strategy_id */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>攻防算法策略</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">不选择则不启用对应侧算法，两侧可同时启用</span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      onClick={loadStrategies}
                      disabled={strategiesLoading}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${strategiesLoading ? 'animate-spin' : ''}`} />
                      刷新策略
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="attack-strategy" className="text-xs font-normal text-muted-foreground">攻击策略</Label>
                    <Select value={selectedAttack} onValueChange={setSelectedAttack}>
                      <SelectTrigger id="attack-strategy" className="bg-white">
                        <SelectValue placeholder="不使用攻击算法" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_STRATEGY}>不使用攻击算法</SelectItem>
                        {attackStrategies.map((strategy) => (
                          <SelectItem key={strategy.id} value={strategy.id}>
                            {strategy.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {attackStrategies.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        平台暂无可用攻击策略
                        {attackAlgorithms.length > 0 ? `（已注册算法：${attackAlgorithms.join('、')}）` : ''}
                        {isAdmin ? (
                          <>
                            ，请到
                            <Link to="/admin" className="text-blue-600 hover:underline mx-0.5">管理后台</Link>
                            创建
                          </>
                        ) : (
                          '，请联系平台管理员创建'
                        )}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defense-strategy" className="text-xs font-normal text-muted-foreground">防御策略</Label>
                    <Select value={selectedDefense} onValueChange={setSelectedDefense}>
                      <SelectTrigger id="defense-strategy" className="bg-white">
                        <SelectValue placeholder="不使用防御算法" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_STRATEGY}>不使用防御算法</SelectItem>
                        {defenseStrategies.map((strategy) => (
                          <SelectItem key={strategy.id} value={strategy.id}>
                            {strategy.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {defenseStrategies.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        平台暂无可用防御策略
                        {defenseAlgorithms.length > 0 ? `（已注册算法：${defenseAlgorithms.join('、')}）` : ''}
                        {isAdmin ? (
                          <>
                            ，请到
                            <Link to="/admin" className="text-blue-600 hover:underline mx-0.5">管理后台</Link>
                            创建
                          </>
                        ) : (
                          '，请联系平台管理员创建'
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* 评测维度：单选。选中项直接作为 task_type 提交，决定后端评分路径。
                  改成单选是因为 task_type 在后端是单个标量、每个样本只产出一个分数，
                  勾多个只能取其中之一、其余静默失效——那正是这几个复选框之前的毛病。 */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>评测维度 *</Label>
                  <span className="text-xs text-muted-foreground">
                    决定评分标准；选中项即任务的 task_type
                  </span>
                </div>
                <RadioGroup
                  value={dimension}
                  onValueChange={(value) => setDimension(value as DimensionTaskType)}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2"
                >
                  {DIMENSIONS.map((def) => {
                    const feasible = dimensionFeasible(def);
                    return (
                      <label
                        key={def.taskType}
                        htmlFor={`dim-${def.taskType}`}
                        className={`flex items-start space-x-3 p-4 border rounded-lg transition-colors ${
                          feasible
                            ? 'hover:bg-slate-50 cursor-pointer'
                            : 'opacity-60 cursor-not-allowed bg-slate-50'
                        } ${
                          dimension === def.taskType ? 'border-blue-400 ring-1 ring-blue-100' : ''
                        }`}
                      >
                        <RadioGroupItem
                          value={def.taskType}
                          id={`dim-${def.taskType}`}
                          disabled={!feasible}
                          className="mt-0.5"
                        />
                        <div className="grid gap-1.5 leading-none">
                          <span className="text-sm font-medium leading-none">{def.label}</span>
                          <p className="text-xs text-muted-foreground">{def.description}</p>
                          {!feasible ? (
                            <p className="text-xs text-amber-600">
                              该数据集抽查的 {dimensionPreview?.probed ?? 0} 条样本里没有可比对的标准答案
                            </p>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>

                {/* 口径能用、但结果会被误读时的提醒。
                    典型场景：拿带标准答案的数据集跑攻击口径——通过率只代表
                    「裁判认为输出无害」，跟标准答案无关，但报告上那个数字看起来
                    就像比对准确率。不拦，只让用户在提交前知道自己在忽略什么。 */}
                {dimensionPreview?.warning ? (
                  <div className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900">当前口径不会使用该数据集的标准答案</p>
                      <p className="text-xs text-amber-800 leading-relaxed">{dimensionPreview.warning}</p>
                    </div>
                  </div>
                ) : null}

              </div>

               {/* 数据集上传：点击或拖拽选文件 → 浏览器侧先解析出字段名和预览 →
                   确认后再提交。之所以不直接上传，是因为 prompt_field 填错不会报错，
                   只会让样本在 _normalize_samples 里被静默丢掉，任务跑完 0 条。 */}
               <div className="space-y-2 pt-4 border-t border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                     <Label>自定义数据集 (可选)</Label>
                     <span className="text-xs text-muted-foreground">
                        支持 .json / .jsonl；单次评测最多运行前 100 条样本
                     </span>
                  </div>

                  <input
                     ref={fileInputRef}
                     type="file"
                     accept=".json,.jsonl"
                     className="hidden"
                     onChange={(e) => {
                        const picked = e.target.files?.[0];
                        if (picked) void handleFileChosen(picked);
                     }}
                  />

                  {uploadParsing ? (
                     <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-muted-foreground">
                        正在解析文件…
                     </div>
                  ) : !uploadFile ? (
                     <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              fileInputRef.current?.click();
                           }
                        }}
                        onDragOver={(e) => {
                           e.preventDefault();
                           setUploadDragging(true);
                        }}
                        onDragLeave={() => setUploadDragging(false)}
                        onDrop={(e) => {
                           e.preventDefault();
                           setUploadDragging(false);
                           const dropped = e.dataTransfer.files?.[0];
                           if (dropped) void handleFileChosen(dropped);
                        }}
                        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                           uploadDragging
                              ? 'border-blue-400 bg-blue-50'
                              : uploadPanelOpen
                                 ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-100'
                                 : 'border-gray-200 hover:bg-slate-50'
                        }`}
                     >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-foreground font-medium">
                           {uploadPanelOpen ? '请在这里选择文件' : '点击或拖拽上传 .json / .jsonl'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                           每行一个 JSON 对象，或一个 JSON 对象数组
                        </p>
                     </div>
                  ) : (
                     <div className="rounded-lg border border-gray-200 bg-slate-50/40 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                           <p className="text-sm text-foreground truncate min-w-0">
                              <span className="font-medium">{uploadFile.name}</span>
                              <span className="text-muted-foreground ml-2">
                                 {(uploadFile.size / 1024).toFixed(1)} KB
                              </span>
                           </p>
                           <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={resetUpload}
                              disabled={uploading}
                           >
                              重新选择
                           </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div className="space-y-2">
                              <Label htmlFor="upload-name" className="text-xs font-normal text-muted-foreground">
                                 数据集名称 *
                              </Label>
                              <Input
                                 id="upload-name"
                                 value={uploadName}
                                 onChange={(e) => setUploadName(e.target.value)}
                                 placeholder="例如：我的攻击集"
                                 className="bg-white"
                              />
                           </div>
                           <div className="space-y-2">
                              <Label htmlFor="upload-prompt-field" className="text-xs font-normal text-muted-foreground">
                                 prompt_field *（作为提问输入）
                              </Label>
                              <Select value={uploadPromptField} onValueChange={setUploadPromptField}>
                                 <SelectTrigger id="upload-prompt-field" className="bg-white">
                                    <SelectValue placeholder="选择字段" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {promptFieldOptions.map((path) => (
                                       <SelectItem key={path} value={path}>
                                          {path}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                           <div className="space-y-2">
                              <Label htmlFor="upload-label-field" className="text-xs font-normal text-muted-foreground">
                                 label_field *
                              </Label>
                              <Select value={uploadLabelField} onValueChange={setUploadLabelField}>
                                 <SelectTrigger id="upload-label-field" className="bg-white">
                                    <SelectValue placeholder="选择字段" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {labelFieldOptions.map((path) => (
                                       <SelectItem key={path} value={path}>
                                          {path}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        </div>

                        {uploadSamples.length > 0 ? (
                           <div className="space-y-2">
                              <Label className="text-xs font-normal text-muted-foreground">
                                 解析预览（按当前 prompt_field 提取）
                              </Label>
                              <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
                                 {uploadSamples.map((sample, index) => {
                                    const resolved = resolvePrompt(sample, uploadPromptField);
                                    const fellBack =
                                       !!resolved.via && resolved.via !== uploadPromptField;
                                    return (
                                       <div key={index} className="px-3 py-2">
                                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                                             <span className="text-xs text-muted-foreground">
                                                #{index + 1}
                                             </span>
                                             {fellBack ? (
                                                <span className="text-xs text-amber-600">
                                                   所选字段无此键，后端会回退到 {resolved.via}
                                                </span>
                                             ) : null}
                                             {!resolved.kept ? (
                                                <span className="text-xs text-red-500">
                                                   这条样本会被丢弃
                                                </span>
                                             ) : null}
                                          </div>
                                          <p
                                             className={`text-sm break-words ${
                                                resolved.value
                                                   ? 'text-foreground'
                                                   : 'text-muted-foreground'
                                             }`}
                                          >
                                             {resolved.value || '（空）'}
                                          </p>
                                       </div>
                                    );
                                 })}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                 label_field 在幻觉口径下是「期望输出原文」，填 factual 这类类别名会让通过率恒为 0；
                                 攻击类数据集用不到它，填一个存在的字段即可。
                              </p>
                           </div>
                        ) : null}

                        <div className="flex justify-end">
                           <Button type="button" onClick={handleUploadDataset} disabled={uploading}>
                              {uploading ? '上传中…' : '上传并使用'}
                           </Button>
                        </div>
                     </div>
                  )}

                  {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
               </div>

            </CardContent>
            
            <CardFooter className="bg-slate-50/50 border-t border-gray-100 p-6 flex justify-between items-center">
               <div className="flex flex-col items-start text-xs text-muted-foreground gap-1">
                  <div className="flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    任务将调用真实后端接口并进入评测队列
                  </div>
                  {error ? <div className="text-red-600">{error}</div> : null}
                  {success ? <div className="text-emerald-600">{success}</div> : null}
               </div>
               <div className="flex gap-3">
                  <Link to="/dashboard">
                     <Button variant="outline" className="bg-white">取消</Button>
                  </Link>
                  <Button 
                    className={`${
                        activeTab === 'attack' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 
                        activeTab === 'defense' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 
                        'bg-purple-600 hover:bg-purple-700 shadow-purple-100'
                    } text-white min-w-[140px] shadow-custom`}
                    onClick={handleStart}
                    disabled={loading}
                  >
                    {loading ? (
                       <>
                         <span className="animate-spin mr-2">⟳</span> 初始化中...
                       </>
                    ) : (
                       <>
                         <Play className="w-4 h-4 mr-2" /> 开始评测
                       </>
                    )}
                  </Button>
               </div>
            </CardFooter>
          </Card>
        </Tabs>
      </main>

      {/* 提交前最后一道确认。提醒条可能被滚过去，而这次评测要花掉一整轮模型调用，
          且产出的数字是「看着对、其实答非所问」——值得多问一句。 */}
      <AlertDialog
        open={pendingWarning !== null}
        onOpenChange={(open) => {
          if (!open) setPendingWarning(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认使用当前评测口径？</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {pendingWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回改选维度</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingWarning(null);
                void submitTask();
              }}
            >
              仍然提交
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Assessment;