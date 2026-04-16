# GitHub Copilot Instructions

- This repo is a full-stack safety evaluation platform with a Python FastAPI backend and a React + Vite frontend.
- Backend entrypoint: `app/main.py` registers `app/api/router.py` under `settings.api_prefix`, default `/api`.
- Frontend client builds request URLs against `VITE_API_BASE` and expects the backend API under `/api`.

## Backend architecture

- `app/core/config.py`: centralized config via Pydantic `BaseSettings`, loaded with `SAFETY_` env prefix and optional `.env`.
- `app/core/database.py`: manual MySQL access using `pymysql`; no ORM is used.
- `app/repositories/*`: data access layer, raw SQL + JSON fields.
- `app/services/*`: business logic layer. Controllers call services; services call repositories.
- `app/api/*`: FastAPI routers and dependency wiring.
- `app/schemas/*`: Pydantic request/response models used across routers and services.

## Data flow / patterns to preserve

- Authentication: JWT tokens created in `app/core/security.py` and issued by `app/services/auth_service.py`.
- User identity passes through `Depends(get_current_user)` and is enforced in services with `_check_user_access()`.
- Task execution is asynchronous and backgrounded in `TaskService.run_task()` via `asyncio.create_task()`.
- Concurrency is limited by `TASK_RUN_SEMAPHORE` in `app/services/task_service.py`.
- Dataset ingestion supports local `.json` / `.jsonl` file paths and normalizes prompts via `DatasetService._extract_prompt()`.
- Model calls use provider strings and support OpenAI-compatible endpoints, HuggingFace, or generic HTTP via `ModelService.call_model()`.

## Key backend work items

- When editing API surface, keep route definitions in `app/api/*` and logic in `app/services/*`.
- Do not add ORM dependencies unexpectedly; the repo currently relies on SQL in `app/repositories/*`.
- `app/safety_platform.sql` contains the persistence schema; keep DB column names and JSON field usage consistent.
- `dataset_presets_json` and `model_presets_json` are encoded in `app/core/config.py`; changes there affect built-in presets.

## Frontend conventions

- UI is React + TypeScript using Vite in `frontend/`.
- Shared API client logic lives in `frontend/src/lib/auth.ts`.
- Token storage key is `TOKEN_STORAGE_KEY` and is used for Bearer auth on all API requests.
- Pages in `frontend/src/pages/` use hooks and data fetching against the API client functions in `frontend/src/lib/auth.ts`.
- Custom UI components live under `frontend/src/components/ui/` and wrap Radix primitives.

## Developer workflows

- Backend dependency install: `python -m pip install -r app/requirements.txt`.
- Backend run (typical): `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
- Frontend install: `cd frontend && npm install`.
- Frontend dev: `cd frontend && npm run dev`.
- Frontend lint: `cd frontend && npm run lint`.

## Important integration details

- Backend config uses `SAFETY_` env vars; e.g. `SAFETY_SECRET_KEY`, `SAFETY_DB_HOST`, `SAFETY_MODEL_PRESETS_JSON`.
- `ModelService` expects `auth_secret_ref` to be an env var name for OpenAI-style providers.
- Dataset files may be stored locally under `uploads/datasets/{user_id}` when uploaded through the API.
- The primary task path is `/api/eval-tasks`, with `run`, `samples`, and `metrics` endpoints.

## When modifying code

- Inspect `app/services/task_service.py` first for task logic, scoring, and evaluation semantics.
- When changing request validation, update Pydantic types in `app/schemas/*` and ensure routers still match their response models.
- Keep frontend API calls in sync with backend route names in `frontend/src/lib/auth.ts`.

If any instruction is unclear or missing a project-specific piece, I can refine this further.