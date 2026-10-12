"""给已物化的预置数据集补上 schema_json.label_field。

背景：`label_field` 决定结果页「按标注分组通过率」那张图怎么分组。`app/core/config.py`
里的预置数据集原先只配了 `prompt_field`，于是 `_extract_label_text` 走兜底键名，
恰好命中取值为常量的 `label` 字段（`harmful` / `是`），那张图就退化成孤零零一根柱子
——看起来正常，实际没有任何分组信息。真正有区分度的是：

    prompt_attack_dataset.json          -> category（27 类，每类 80 条）
    entity_relation_hallucination.json  -> hallucination_type（实体/关联/关系幻觉）

**为什么要脚本**：`schema_json` 是在「从预置物化成本数据集」那一刻复制进 `datasets`
表的。改配置文件只对之后新物化的行有效，**已经存在的行不会跟着变**——用户重新选一次
预置数据集，拿到的仍是旧 schema。

**改不到历史报告**：指标是从 `eval_sample_results.labels_json` 现算的，而那是评测跑的
那一刻写死的。本脚本只影响之后新建的任务；已有任务的图要变只能重跑。

匹配依据是 `storage_uri` 的文件名，不是数据集名——用户可能建过同名的自建数据集，
按名字改会误伤别人的数据。

幂等：已有 label_field 的行会跳过。

用法：python -m scripts.add_label_field_to_preset_datasets
"""

import json
import sys
from pathlib import Path

# `python scripts/xxx.py` 只会把 scripts/ 放进 sys.path，项目根不在其中，
# 于是 `import app` 必然失败。这里自己补上项目根。
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import execute, fetch_all  # noqa: E402

# 数据集文件名 -> 该数据集的标注字段
LABEL_FIELD_BY_FILE = {
    "prompt_attack_dataset.json": "category",
    "entity_relation_hallucination.json": "hallucination_type",
}


def _parse_schema(raw) -> dict:
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def migrate() -> None:
    rows = fetch_all("SELECT id, name, storage_uri, schema_json FROM datasets")
    updated = skipped = untouched = 0

    for row in rows:
        filename = Path(str(row.get("storage_uri") or "").replace("\\", "/")).name
        label_field = LABEL_FIELD_BY_FILE.get(filename)
        if not label_field:
            untouched += 1
            continue

        schema = _parse_schema(row.get("schema_json"))
        if schema.get("label_field"):
            print(f"  [跳过] {row['name'][:30]} 已有 label_field={schema['label_field']!r}")
            skipped += 1
            continue

        schema["label_field"] = label_field
        execute(
            "UPDATE datasets SET schema_json = %s WHERE id = %s",
            (json.dumps(schema, ensure_ascii=False), row["id"]),
        )
        print(f"  [执行] {row['name'][:30]}: + label_field={label_field!r}")
        updated += 1

    print(f"\n  完成：更新 {updated} 行，已是目标状态 {skipped} 行，非预置数据集 {untouched} 行")


if __name__ == "__main__":
    migrate()
