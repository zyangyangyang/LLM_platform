from app.core.database import execute


def main():
    execute(
        """
        CREATE TABLE IF NOT EXISTS roles (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          name VARCHAR(50) NOT NULL UNIQUE,
          description TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    execute(
        """
        CREATE TABLE IF NOT EXISTS user_roles (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          role_id VARCHAR(36) NOT NULL,
          UNIQUE KEY uk_user_role (user_id, role_id),
          CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    execute(
        """
        INSERT IGNORE INTO roles (id, name, description)
        VALUES
          ('role-evaluator', 'evaluator', 'Evaluation user'),
          ('role-platform-admin', 'platform_admin', 'Platform administrator')
        """
    )
    execute(
        """
        CREATE TABLE IF NOT EXISTS platform_model_presets (
          id VARCHAR(100) NOT NULL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          provider VARCHAR(50) NOT NULL,
          endpoint VARCHAR(255) NOT NULL,
          auth_type VARCHAR(20) NOT NULL DEFAULT 'bearer',
          auth_secret_ref VARCHAR(255),
          params_json JSON,
          description TEXT,
          created_by VARCHAR(36) NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          CONSTRAINT fk_platform_model_presets_user FOREIGN KEY (created_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    execute(
        """
        CREATE TABLE IF NOT EXISTS platform_dataset_presets (
          id VARCHAR(100) NOT NULL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          source_type VARCHAR(30) NOT NULL,
          storage_uri VARCHAR(255) NOT NULL,
          schema_json JSON,
          created_by VARCHAR(36) NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          CONSTRAINT fk_platform_dataset_presets_user FOREIGN KEY (created_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    execute(
        """
        CREATE TABLE IF NOT EXISTS platform_model_keys (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          model_preset_id VARCHAR(100) NOT NULL,
          secret_ref VARCHAR(255) NOT NULL,
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    try:
        execute("ALTER TABLE model_configs ADD COLUMN platform_preset_id VARCHAR(100)")
    except Exception:
        pass


if __name__ == "__main__":
    main()
