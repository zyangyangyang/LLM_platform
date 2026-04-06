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

CREATE TABLE model_configs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  auth_type VARCHAR(20) NOT NULL,
  auth_secret_ref VARCHAR(255),
  params_json JSON,
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

CREATE TABLE attack_strategies (
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
  error_message TEXT,
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
  resource_id VARCHAR(36),
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
