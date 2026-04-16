# AGENT_CONTEXT

## 1. Project Snapshot
- Name/Purpose: LLM safety evaluation platform (backend API + frontend dashboard).
- Repo root: `d:\LLM_platform`
- Primary stacks:
- Backend: FastAPI + Pydantic + PyMySQL + JWT + OpenAI-compatible client
- Frontend: React 19 + TypeScript + Vite + Tailwind + Radix UI
- Data: MySQL schema in `app/safety_platform.sql`; local dataset files (`.json/.jsonl`) are used directly.
- Large local benchmark files exist at repo root (tens of MB).

## 2. High-Level Structure
- `app/`: FastAPI backend.
- `frontend/`: Vite React frontend.
- `scripts/`: DB migration helper (`add_task_type_column.py`).
- Root docs/data:
- `openapi.json` (API schema snapshot)
- `API_DOCS.md` (human-readable API doc)
- benchmark dataset files (`JailBench.csv`, `prompt_attack_dataset.json`, etc.)

## 3. Backend Architecture (Authoritative)
- Entry: `app/main.py`
- Loads settings from `app/core/config.py`
- Mounts `api_router` under `settings.api_prefix` (default `/api`)
- On startup marks any `running` tasks/runs as failed.
- Routing: `app/api/router.py`
- `/auth/*` from `app/api/auth.py`
- model config routes from `app/api/model_configs.py`
- dataset routes from `app/api/datasets.py`
- eval task routes from `app/api/eval_tasks.py`
- Dependency/auth:
- JWT auth dependency in `app/api/deps.py::get_current_user`
- token issuance in `app/services/auth_service.py`
- crypto in `app/core/security.py`
- Layering:
- `api/*` (HTTP handlers) -> `services/*` (business logic) -> `repositories/*` (raw SQL)
- No ORM; all DB access uses `app/core/database.py` helper functions.

## 4. Runtime Configuration
- Config class: `app/core/config.py::Settings`
- Env prefix: `SAFETY_`
- `.env` supported via Pydantic settings.
- Important fields:
- `api_prefix` default `/api`
- DB defaults: host `127.0.0.1`, port `3306`, user `root`, password `123456`, db `safety_platform`
- `model_presets_json`, `dataset_presets_json`, `semantic_judge_model_json`
- `max_concurrent_runs` used by task semaphore.

## 5. Core Backend Capabilities
- Auth:
- `POST /api/auth/register`
- `POST /api/auth/login` (OAuth2 password form)
- `GET /api/auth/users/me`
- Model configs:
- `GET /api/presets`
- `POST /api/models/from-preset?preset_id=...`
- `POST/GET /api/models`
- `GET/DELETE /api/models/{model_id}`
- Datasets:
- `GET /api/datasets/presets`
- `POST /api/datasets/from-preset?preset_id=...`
- `POST/GET /api/datasets/`
- `POST /api/datasets/upload` (`multipart/form-data`)
- `GET /api/datasets/{id}`
- `GET /api/datasets/{id}/samples`
- Eval tasks:
- `POST/GET /api/eval-tasks/`
- `GET /api/eval-tasks/{id}`
- `POST /api/eval-tasks/{id}/run` (async background trigger)
- `GET /api/eval-tasks/{id}/samples`
- `GET /api/eval-tasks/{id}/metrics`

## 6. Task Execution Flow (Critical Path)
1. Create task (`TaskService.create_task`) validates ownership and references.
2. Run task (`TaskService.run_task`) marks task running and creates run record.
3. Background async job (`asyncio.create_task`) executes `_execute_run_logic`.
4. Semaphore `TASK_RUN_SEMAPHORE` limits concurrency (`max_concurrent_runs`).
5. Samples loaded via `DatasetService.load_samples_for_task` (max 100 currently).
6. Model call via `ModelService.call_model`:
- OpenAI-compatible (including dashscope/deepseek/vllm style)
- HuggingFace inference
- generic HTTP fallback
7. Scoring:
- prompt attack mode: safety judged by semantic judge model
- hallucination mode: triple rule match + optional judge model equivalence
8. Per-sample results stored in `eval_sample_results`; task/run status updated.

## 7. Data Model Notes
- Full schema in `app/safety_platform.sql`.
- Primary tables in use by current code:
- `users`
- `model_configs`
- `datasets`
- `eval_tasks`
- `eval_task_runs`
- `eval_sample_results`
- JSON columns are serialized/deserialized manually in repositories.

## 8. Frontend Status
- Entry/router: `frontend/src/App.tsx`
- Routes: `/`, `/login`, `/dashboard`, `/assessment`, `/results`, `/ranking`
- API client + token handling: `frontend/src/lib/auth.ts`
- Token key: `safety_platform_access_token`
- `VITE_API_BASE` supported; otherwise relative paths (works with Vite `/api` proxy).
- Vite proxy: `frontend/vite.config.ts` proxies `/api` -> `http://localhost:8000`.
- Current UI state:
- Login page uses real backend login API.
- Most other pages are largely static/demo UI and not fully wired to backend data flows yet.

## 9. Known Risks / Code Health Observations
- `app/workers/celery_app.py` and `app/workers/task_runner,.py` are zero-byte placeholders; worker subsystem is effectively unused.
- `test_model_connection.py` appears stale and unsafe:
- contains a hardcoded key-like value fallback
- uses schema field `project_id` not present in `ModelConfigResponse` (actual field is `user_id`)
- source files include mixed/garbled non-UTF8 comments/text in multiple files, indicating encoding inconsistency.
- default sensitive config values (JWT secret and DB password) are hardcoded in `config.py`; acceptable only for local dev.
- no real automated tests found beyond the ad-hoc `test_model_connection.py`.

## 10. Local Dev Commands
- Backend install:
```powershell
python -m pip install -r app/requirements.txt
```
- Backend run:
```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Frontend install/run:
```powershell
cd frontend
npm install
npm run dev
```
- Frontend lint:
```powershell
cd frontend
npm run lint
```

## 11. Practical Editing Guidance (for future agent runs)
- Keep API surface changes synchronized across:
- `app/api/*`
- `app/services/*`
- `app/schemas/*`
- `frontend/src/lib/auth.ts`
- Respect service ownership checks (`_check_user_access`) when adding read/write operations.
- Keep DB column names aligned with `app/safety_platform.sql` and repository SQL.
- For task logic changes, start in `app/services/task_service.py`.
- For prompt extraction/data ingestion changes, start in `app/services/dataset_service.py`.
- For provider call changes, start in `app/services/model_service.py`.

