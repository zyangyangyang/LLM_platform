CREATE TABLE users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE roles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_roles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  UNIQUE KEY uk_user_role (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (id, name, description)
VALUES
  ('role-evaluator', 'evaluator', 'Evaluation user'),
  ('role-platform-admin', 'platform_admin', 'Platform administrator');

CREATE TABLE model_configs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  auth_type VARCHAR(20) NOT NULL,
  -- 512 而非 255：启用自带密钥（BYOK）后这里还要能放下 Fernet 密文
  -- （enc:v1:<token>，约 319 字符）。老库用 scripts/add_byok_encryption.py 扩列。
  auth_secret_ref VARCHAR(512),
  params_json JSON,
  platform_preset_id VARCHAR(100),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_model_configs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE datasets (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  source_type VARCHAR(30) NOT NULL,
  storage_uri VARCHAR(255) NOT NULL,
  schema_json JSON,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_datasets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_model_presets (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  auth_type VARCHAR(20) NOT NULL DEFAULT 'bearer',
  auth_secret_ref VARCHAR(512),
  params_json JSON,
  description TEXT,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_platform_model_presets_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_model_keys (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  model_preset_id VARCHAR(100) NOT NULL,
  -- 不能再宽：下面的 uk_platform_model_key_ref 唯一索引含本列，
  -- InnoDB DYNAMIC 行格式单条索引键上限 3072 字节，model_preset_id(100)
  -- 已占 400 字节，本列最多 668 字符。512 是留了余量的安全值。
  secret_ref VARCHAR(512) NOT NULL,
  label VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  weight INT NOT NULL DEFAULT 1,
  rpm_limit INT,
  rps_limit INT,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_platform_model_key_ref (model_preset_id, secret_ref),
  CONSTRAINT fk_platform_model_keys_preset FOREIGN KEY (model_preset_id) REFERENCES platform_model_presets(id) ON DELETE CASCADE,
  CONSTRAINT fk_platform_model_keys_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_dataset_presets (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  source_type VARCHAR(30) NOT NULL,
  storage_uri VARCHAR(255) NOT NULL,
  schema_json JSON,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_platform_dataset_presets_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attack_strategies (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  config_json JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE defense_strategies (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  config_json JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE metric_sets (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  metric_list_json JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE eval_tasks (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  model_config_id VARCHAR(36) NOT NULL,
  dataset_id VARCHAR(36) NOT NULL,
  attack_strategy_id VARCHAR(36),
  defense_strategy_id VARCHAR(36),
  metric_set_id VARCHAR(36),
  task_type VARCHAR(50) NOT NULL DEFAULT 'hallucination',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  started_at DATETIME(6),
  finished_at DATETIME(6),
  CONSTRAINT fk_eval_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_tasks_model FOREIGN KEY (model_config_id) REFERENCES model_configs(id),
  CONSTRAINT fk_eval_tasks_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id),
  CONSTRAINT fk_eval_tasks_attack FOREIGN KEY (attack_strategy_id) REFERENCES attack_strategies(id),
  CONSTRAINT fk_eval_tasks_defense FOREIGN KEY (defense_strategy_id) REFERENCES defense_strategies(id),
  CONSTRAINT fk_eval_tasks_metric FOREIGN KEY (metric_set_id) REFERENCES metric_sets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE eval_task_runs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  run_no INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  worker_id VARCHAR(100),
  started_at DATETIME(6),
  finished_at DATETIME(6),
  progress_total INT NOT NULL DEFAULT 0,
  progress_done INT NOT NULL DEFAULT 0,
  error_message TEXT,
  -- 本次运行实际使用的生成参数快照（被测模型 + 裁判），运行开始时写入一次。
  -- model_configs.params_json 是可变的，不存快照则历史报告无法复现。
  -- 结构见 scripts/add_gen_params_to_task_runs.py。不含任何密钥。
  gen_params_json JSON,
  CONSTRAINT fk_eval_task_runs_task FOREIGN KEY (task_id) REFERENCES eval_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE eval_metrics (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  task_run_id VARCHAR(36) NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  details_json JSON,
  CONSTRAINT fk_eval_metrics_run FOREIGN KEY (task_run_id) REFERENCES eval_task_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE eval_sample_results (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  task_run_id VARCHAR(36) NOT NULL,
  sample_id VARCHAR(100) NOT NULL,
  input_text TEXT NOT NULL,
  model_output TEXT NOT NULL,
  labels_json JSON,
  score_json JSON,
  CONSTRAINT fk_eval_sample_results_run FOREIGN KEY (task_run_id) REFERENCES eval_task_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  -- 必须 ≥100：平台预置的 id 是 VARCHAR(100)（管理员可自定义），
  -- 而 STRICT_TRANS_TABLES 下超长写入会报错，审计记录会静默丢失。
  -- 老库用 scripts/add_audit_log_resource_id.py 扩列。
  resource_id VARCHAR(100),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  meta_json JSON,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE task_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  task_run_id VARCHAR(36) NOT NULL,
  log_level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_task_logs_run FOREIGN KEY (task_run_id) REFERENCES eval_task_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
