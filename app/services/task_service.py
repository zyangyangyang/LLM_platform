import asyncio
from typing import List, Dict, Any
from datetime import datetime
from fastapi import HTTPException
from app.core.config import get_settings
from app.repositories.task_repo import TaskRepository
from app.repositories.model_config_repo import ModelConfigRepository
from app.repositories.dataset_repo import DatasetRepository
from app.schemas.task import EvalTaskCreate, EvalTaskResponse, EvalTaskRunResponse
from app.services.model_service import ModelService
from app.utils.logger import get_logger
from app.schemas.model_config import ModelConfigResponse
from app.services.dataset_service import DatasetService
from app.repositories.eval_result_repo import EvalResultRepository

logger = get_logger(__name__)
TASK_RUN_SEMAPHORE = asyncio.Semaphore(get_settings().max_concurrent_runs)

class TaskService:
    @staticmethod
    def _check_user_access(resource_user_id: str, user_id: str):
        if resource_user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    @staticmethod
    def create_task(data: EvalTaskCreate, user_id: str) -> EvalTaskResponse:
        TaskService._check_user_access(data.user_id, user_id)

        # Verify model and dataset exist
        model = ModelConfigRepository.get_by_id(data.model_config_id)
        if not model:
            raise HTTPException(status_code=400, detail="Invalid model_config_id")
        TaskService._check_user_access(model["user_id"], user_id)

        dataset = DatasetRepository.get_by_id(data.dataset_id)
        if not dataset:
            raise HTTPException(status_code=400, detail="Invalid dataset_id")
        TaskService._check_user_access(dataset["user_id"], user_id)

        task_id = TaskRepository.create_task(data.model_dump())
        created = TaskRepository.get_task(task_id)
        return EvalTaskResponse(**created)

    @staticmethod
    def list_tasks(user_id: str) -> List[EvalTaskResponse]:
        tasks = TaskRepository.list_tasks(user_id)
        return [EvalTaskResponse(**t) for t in tasks]

    @staticmethod
    def get_task(task_id: str, user_id: str) -> EvalTaskResponse:
        task = TaskRepository.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        TaskService._check_user_access(task['user_id'], user_id)
        return EvalTaskResponse(**task)

    @staticmethod
    async def run_task(task_id: str, user_id: str) -> EvalTaskRunResponse:
        """
        触发任务执行
        """
        task = TaskRepository.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        TaskService._check_user_access(task['user_id'], user_id)

        started_at = datetime.now()
        if not TaskRepository.try_mark_running(task_id, started_at):
            raise HTTPException(status_code=409, detail="Task is already running")

        try:
            run_id = TaskRepository.create_run(task_id)
        except Exception as e:
            TaskRepository.update_status(task_id, 'failed', finished_at=datetime.now())
            raise e

        asyncio.create_task(TaskService._execute_run_logic(task_id, run_id))

        runs = TaskRepository.get_runs(task_id)
        current_run = next((r for r in runs if r['id'] == run_id), None)
        return EvalTaskRunResponse(**current_run)

    @staticmethod
    async def _execute_run_logic(task_id: str, run_id: str):
        """
        后台执行逻辑：读取数据集 -> 调用模型 -> (可选)计算指标
        """
        async with TASK_RUN_SEMAPHORE:
            try:
                logger.info(f"Starting run {run_id} for task {task_id}")
                
                task = TaskRepository.get_task(task_id)
                task_type = task.get('task_type', 'hallucination')
                
                model_config_data = ModelConfigRepository.get_by_id(task['model_config_id'])
                if not model_config_data:
                    raise Exception("Model config missing")
                
                model_config = ModelConfigResponse(**model_config_data)
                dataset_data = DatasetRepository.get_by_id(task['dataset_id'])
                dataset_schema = dataset_data.get("schema_json") if dataset_data else {}
                
                system_prompt = ""
                if task_type == 'hallucination':
                    system_prompt = TaskService._get_system_prompt(dataset_schema)
                elif dataset_schema.get("system_prompt"):
                    system_prompt = dataset_schema.get("system_prompt")

                samples = DatasetService.load_samples_for_task(task['dataset_id'], limit=100)
                
                for sample in samples:
                    messages = []
                    
                    if task_type == 'multimodal':
                        content_parts = []
                        if sample["prompt"]:
                            content_parts.append({"type": "text", "text": sample["prompt"]})
                        
                        raw_data = sample.get("data", {})
                        if "image" in raw_data and raw_data["image"]:
                            img = raw_data["image"]
                            url = img if img.startswith("http") or img.startswith("data:") else f"data:image/jpeg;base64,{img}"
                            content_parts.append({"type": "image_url", "image_url": {"url": url}})
                        elif "image_url" in raw_data and raw_data["image_url"]:
                            content_parts.append({"type": "image_url", "image_url": {"url": raw_data["image_url"]}})
                        
                        if "video" in raw_data and raw_data["video"]:
                            video_val = raw_data["video"]
                            if isinstance(video_val, str):
                                video_val = [video_val]
                            content_parts.append({"type": "video", "video": video_val})
                        elif "video_url" in raw_data and raw_data["video_url"]:
                             content_parts.append({"type": "video", "video": [raw_data["video_url"]]})
                             
                        messages = [{"role": "user", "content": content_parts}]
                        if system_prompt:
                            messages.insert(0, {"role": "system", "content": system_prompt})
                            
                    else:
                        if system_prompt:
                             messages.append({"role": "system", "content": system_prompt})
                        messages.append({"role": "user", "content": sample["prompt"]})

                    try:
                        response_text = await ModelService.call_model(model_config, messages)
                        label_text = TaskService._extract_label_text(sample.get("data"))
                        score = TaskService._compute_score(response_text, label_text)
                        EvalResultRepository.insert_sample_result({
                            "task_run_id": run_id,
                            "sample_id": sample["id"],
                            "input_text": sample["prompt"],
                            "model_output": response_text,
                            "labels_json": {"target_text": label_text} if label_text is not None else {},
                            "score_json": {"exact_match": score}
                        })
                    except Exception as e:
                        logger.error(f"Error calling model for sample {sample['id']}: {e}")
                        EvalResultRepository.insert_sample_result({
                            "task_run_id": run_id,
                            "sample_id": sample["id"],
                            "input_text": sample["prompt"],
                            "model_output": "",
                            "labels_json": {},
                            "score_json": {"error": str(e)}
                        })
                
                logger.info(f"Run {run_id} completed.")
                
                TaskRepository.update_run_status(run_id, 'completed')
                TaskRepository.update_status(task_id, 'finished', finished_at=datetime.now())
                
            except Exception as e:
                logger.error(f"Task execution failed: {e}")
                TaskRepository.update_run_status(run_id, 'failed', error_msg=str(e))
                TaskRepository.update_status(task_id, 'failed', finished_at=datetime.now())

    @staticmethod
    def _extract_label_text(sample_data: Any) -> Any:
        if isinstance(sample_data, dict):
            for key in ["label", "labels", "answer", "target", "expected", "output", "reference", "gold", "ground_truth", "标签", "答案", "参考答案"]:
                if key in sample_data and sample_data[key] is not None:
                    v = sample_data[key]
                    if isinstance(v, list):
                        return v[0] if len(v) > 0 else None
                    return v
        return None

    @staticmethod
    def _compute_score(output_text: str, label_text: Any) -> float:
        if output_text is None or output_text == "":
            return 0.0
        if label_text is None:
            return 0.0
        if isinstance(label_text, list):
            for t in label_text:
                if str(output_text).strip() == str(t).strip():
                    return 1.0
            return 0.0
        return 1.0 if str(output_text).strip() == str(label_text).strip() else 0.0

    @staticmethod
    def _get_system_prompt(schema_json: Dict[str, Any]) -> str:
        if isinstance(schema_json, dict):
            v = schema_json.get("system_prompt")
            if isinstance(v, str) and len(v.strip()) > 0:
                return v
        return (
            "从给定中文文本中抽取所有明确的三元组，字段名格式为 （实体1，关系，实体2），输出例如（华为，总部，深圳）。"
            "只输出关系三元组，不要输出任何其他文字。"
            "若无明确关系，输出 （）。"
            "实体保持原文片段；不要臆测关系。"
        )

    @staticmethod
    def get_task_samples(task_id: str, user_id: str, page: int, size: int):
        if page < 1 or size < 1:
            raise HTTPException(status_code=400, detail="Invalid pagination params")
        if size > 500:
            size = 500
        task = TaskRepository.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        TaskService._check_user_access(task['user_id'], user_id)
        items, total = EvalResultRepository.list_by_task(task_id, page, size)
        from app.schemas.task import EvalSampleResultItem, EvalSampleResultsResponse
        return EvalSampleResultsResponse(
            items=[
                EvalSampleResultItem(
                    sample_id=str(i["sample_id"]),
                    input_text=i["input_text"],
                    model_output=i["model_output"],
                    labels_json=i.get("labels_json"),
                    score_json=i.get("score_json"),
                )
                for i in items
            ],
            total=total,
        )

    @staticmethod
    def get_task_metrics(task_id: str, user_id: str):
        task = TaskRepository.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        TaskService._check_user_access(task['user_id'], user_id)
        items = EvalResultRepository.list_all_by_task(task_id)
        total = len(items)
        if total == 0:
            acc = 0.0
        else:
            s = 0.0
            for i in items:
                score_json = i.get("score_json") or {}
                v = score_json.get("exact_match")
                try:
                    s += float(v) if v is not None else 0.0
                except Exception:
                    s += 0.0
            acc = s / total if total > 0 else 0.0
        from app.schemas.task import EvalMetricItem
        return [
            EvalMetricItem(metric_name="exact_match", metric_value=acc, details_json={"total": total}),
            EvalMetricItem(metric_name="num_samples", metric_value=float(total), details_json=None),
        ]
