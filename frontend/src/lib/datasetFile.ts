// 上传数据集时在浏览器侧做的轻量解析：探测样本字段名、预览前几条。
//
// 为什么要做：后端建数据集时 prompt_field / label_field 都是必填，而填错了
// 不会报错——`_normalize_samples` 会把提取不到 prompt 的样本静默丢掉，任务跑完
// 是 0 条。让人在上传前就能看到「字段选对了没、第一条长什么样」，比事后排查便宜得多。
//
// 这里的字段提取规则刻意对齐后端 DatasetService._extract_prompt / 同名兜底列表，
// 否则预览显示的和大盘跑出来的不是一回事，等于白做。

/** 后端 _extract_prompt 里的兜底键名，顺序即优先级 */
export const PROMPT_FIELD_CANDIDATES = [
  'prompt',
  'malicious_prompt',
  'jailbreak_prompt',
  'question',
  'input',
  'text',
  'content',
  'query',
  'instruction',
];

/** 后端 _extract_label_text 里的兜底键名，顺序即优先级 */
export const LABEL_FIELD_CANDIDATES = [
  'label',
  'labels',
  'answer',
  'target',
  'expected',
  'output',
  'reference',
  'gold',
  'ground_truth',
  '标签',
  '答案',
  '标准答案',
];

/** 预览读多少字节。只要够看前几条，不该把整个大文件读进内存 */
const HEAD_BYTES = 2 * 1024 * 1024;

/** 扫描文本里前 limit 个完整的 JSON 对象。
 *
 * 用括号配对而不是直接 JSON.parse：上传的 .json 常见是「大数组 + 被截断」，
 * 整段 parse 必然失败，但前面若干个对象是完整的、足够预览。
 * 这个扫描对 .jsonl 同样有效——每行的对象配对完就归零，自然是分开的几个。
 */
function scanObjects(text: string, limit: number): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;

  for (let i = 0; i < text.length && out.length < limit; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          try {
            const parsed: unknown = JSON.parse(text.slice(start, i + 1));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              out.push(parsed as Record<string, unknown>);
            }
          } catch {
            // 个别块解析失败就跳过，不影响后面的
          }
          start = -1;
        }
      }
    }
  }
  return out;
}

/** 读文件开头并解析出前 limit 条样本。读不出来就返回空数组，由调用方提示 */
export async function readDatasetHead(
  file: File,
  limit = 3,
): Promise<Record<string, unknown>[]> {
  const head = await file.slice(0, HEAD_BYTES).text();

  if (file.name.toLowerCase().endsWith('.jsonl')) {
    const rows: Record<string, unknown>[] = [];
    for (const line of head.split('\n')) {
      if (rows.length >= limit) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          rows.push(parsed as Record<string, unknown>);
        }
      } catch {
        // 最后一行常常是被截断的，跳过
      }
    }
    if (rows.length > 0) return rows;
  }
  return scanObjects(head, limit);
}

/** 对齐后端 _prepare_sample：样本含 original / adversarial 时拍平合并，
 *  adversarial 覆盖 original。字段名单要基于拍平后的结构，才和后端一致。 */
export function flattenSample(sample: Record<string, unknown>): Record<string, unknown> {
  const original = sample.original;
  const adversarial = sample.adversarial;
  const hasOriginal = !!original && typeof original === 'object' && !Array.isArray(original);
  const hasAdversarial =
    !!adversarial && typeof adversarial === 'object' && !Array.isArray(adversarial);
  if (!hasOriginal && !hasAdversarial) return sample;

  const merged: Record<string, unknown> = {
    ...(hasOriginal ? (original as Record<string, unknown>) : {}),
    ...(hasAdversarial ? (adversarial as Record<string, unknown>) : {}),
  };
  merged.original = hasOriginal ? original : {};
  merged.adversarial = hasAdversarial ? adversarial : {};
  return merged;
}

/** 收集可选字段路径：顶层键 + original./adversarial. 下钻一层，对应后端的点号路径 */
export function collectFieldPaths(samples: Record<string, unknown>[]): string[] {
  const paths = new Set<string>();
  for (const raw of samples) {
    for (const [key, value] of Object.entries(raw)) {
      paths.add(key);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const nestedKey of Object.keys(value as Record<string, unknown>)) {
          paths.add(`${key}.${nestedKey}`);
        }
      }
    }
  }
  return Array.from(paths).sort();
}

/** 按点号路径取值，对齐后端 _get_nested_value */
export function getByPath(data: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  let current: unknown = data;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** 从候选里挑第一个在样本中真实存在且有值的字段 */
export function guessField(
  samples: Record<string, unknown>[],
  candidates: string[],
): string {
  for (const candidate of candidates) {
    for (const raw of samples) {
      const value = getByPath(flattenSample(raw), candidate);
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return candidate;
      }
    }
  }
  return '';
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** 对齐后端 _has_multimodal_content：带图的样本即使提取不到 prompt 也会保留 */
function hasMedia(sample: Record<string, unknown>): boolean {
  const mediaKeys = ['image', 'image_url', 'video', 'video_url'];
  const flat = flattenSample(sample);
  if (mediaKeys.some((key) => flat[key])) return true;
  // flattenSample 已把 original / adversarial 拍平，但嵌套对象本身还在，
  // 这里再各自下一层，覆盖字段放在嵌套里的情况。
  return ['original', 'adversarial'].some((nestedKey) => {
    const nested = flat[nestedKey];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return false;
    const obj = nested as Record<string, unknown>;
    return mediaKeys.some((key) => obj[key]);
  });
}

export type PromptResolution = {
  /** 最终提取到的内容 */
  value: string;
  /** 实际生效的字段。与所选 prompt_field 不同时，说明走了兜底扫描 */
  via: string;
  /** 该样本最终是否会被 _normalize_samples 保留 */
  kept: boolean;
};

/** 复刻后端 _extract_prompt 的完整取值顺序 + _normalize_samples 的保留判定。
 *
 * 必须连兜底扫描一起复刻：prompt_field 在样本里不存在时后端会依次去
 * adversarial / 样本自身 / original 里找 prompt、question 等键，这时候
 * 样本其实**不会**被丢弃。只按所选字段判断会给出假的「会被丢弃」警告。
 *
 * 唯一没有复刻的是 question + options 拼成选择题文本那一步（只影响展示，
 * 不影响「保不保留」的判断）。
 */
export function resolvePrompt(
  sample: Record<string, unknown>,
  promptField: string,
): PromptResolution {
  const flat = flattenSample(sample);

  if (promptField) {
    const nested = getByPath(flat, promptField);
    if (nested !== undefined && nested !== null) {
      const value = stringify(nested);
      return { value, via: promptField, kept: !!value || hasMedia(sample) };
    }
    // 后端这一步只看键存不存在，值为 None 也照样返回，不再往下兜底
    if (Object.prototype.hasOwnProperty.call(flat, promptField)) {
      const value = stringify(flat[promptField]);
      return { value, via: promptField, kept: !!value || hasMedia(sample) };
    }
  }

  // 兜底：容器顺序与后端一致 —— adversarial、样本自身、original
  const containers: Record<string, unknown>[] = [];
  if (flat.adversarial && typeof flat.adversarial === 'object' && !Array.isArray(flat.adversarial)) {
    containers.push(flat.adversarial as Record<string, unknown>);
  }
  containers.push(flat);
  if (flat.original && typeof flat.original === 'object' && !Array.isArray(flat.original)) {
    containers.push(flat.original as Record<string, unknown>);
  }

  for (const container of containers) {
    for (const key of PROMPT_FIELD_CANDIDATES) {
      const raw = container[key];
      if (raw === undefined || raw === null) continue;
      const value = stringify(raw);
      return { value, via: key, kept: !!value || hasMedia(sample) };
    }
  }

  return { value: '', via: '', kept: hasMedia(sample) };
}

/** 去掉扩展名，用作数据集默认名称 */
export function defaultDatasetName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

// 说明：这里曾经有一份「样本是否带可比对的标准答案」的前端实现，用来在点选
// 维度时置灰不可行项。现在整件事交给后端 GET /api/eval-tasks/dimension-preview：
// 判定必须与 create_task 的硬拦截完全一致，前后端各写一份迟早漂移，而漂移的
// 后果正是「前端说能选、提交却被拒」。后端还认得预置 id，预置要到提交时才落库，
// 前端本来也读不到它的样本。故此处不再保留那份镜像实现。
