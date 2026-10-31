-- Controle de migrações (executado sempre, antes dos demais scripts; idempotente)

CREATE TABLE IF NOT EXISTS migrations_history (
    migration_id SERIAL       PRIMARY KEY,
    description  TEXT         NOT NULL DEFAULT '',
    type         VARCHAR(20)  NOT NULL DEFAULT 'SQL',
    script       VARCHAR(255) NOT NULL UNIQUE,
    installed_on TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    success      BOOLEAN      NOT NULL DEFAULT FALSE
);

-- fn_has_migration_run: true se o script já foi aplicado com sucesso
CREATE OR REPLACE FUNCTION fn_has_migration_run(p_script VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM migrations_history WHERE script = p_script AND success = TRUE);
END; $$ LANGUAGE plpgsql;

-- fn_record_migration: registra (ou atualiza) o resultado da aplicação de um script
CREATE OR REPLACE FUNCTION fn_record_migration(p_script VARCHAR, p_description TEXT, p_success BOOLEAN)
RETURNS VOID AS $$
BEGIN
    INSERT INTO migrations_history (script, description, success)
    VALUES (p_script, p_description, p_success)
    ON CONFLICT (script)
    DO UPDATE SET description = EXCLUDED.description,
                  success     = EXCLUDED.success,
                  installed_on = NOW();
END; $$ LANGUAGE plpgsql;
