-- OpenFatoAI — schema inicial: reuniões, configurações, versão do app e logs de ações
-- Idempotente: seguro para rodar em banco vazio ou já inicializado.
-- Convenção: colunas de data/hora por último. Todo acesso a dados via funções fn_<verbo>_<entidade>.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABELAS
-- =============================================================================

-- app_settings: configurações globais (listas de modelos de IA, serviços opcionais)
CREATE TABLE IF NOT EXISTS app_settings (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    value       JSONB        NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- app_version: versões publicadas (alimenta o aviso de atualização do app)
CREATE TABLE IF NOT EXISTS app_version (
    id           SERIAL      PRIMARY KEY,
    version      VARCHAR(20) NOT NULL,
    download_url TEXT        NOT NULL,
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    released_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- action_logs: auditoria simples. installation_id é o UUID anônimo da instalação do app.
CREATE TABLE IF NOT EXISTS action_logs (
    id              BIGSERIAL   PRIMARY KEY,
    installation_id UUID,
    ip              VARCHAR(45) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'success',
    details         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- meetings: sessões salvas (Home = 1, Transcrições = 2), por instalação.
-- Espelha a tabela local do app (SQLite), sem e-mail nem vínculo a conta.
CREATE TABLE IF NOT EXISTS meetings (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id  UUID         NOT NULL,
    session_hash     VARCHAR(64)  NOT NULL,
    meeting_type     SMALLINT     NOT NULL DEFAULT 1 CHECK (meeting_type IN (1, 2)),
    summary_type     VARCHAR(50),
    transcript_text  TEXT,
    ai_summary       TEXT,
    prompt_used      TEXT,
    recorded_seconds INT          NOT NULL DEFAULT 0 CHECK (recorded_seconds >= 0),
    ai_provider      VARCHAR(50),
    ai_model         VARCHAR(100),
    language         VARCHAR(10),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (installation_id, session_hash)
);

CREATE INDEX IF NOT EXISTS idx_meetings_installation_created
    ON meetings (installation_id, created_at DESC);

-- =============================================================================
-- FUNÇÕES — app_settings
-- =============================================================================

-- fn_get_app_setting: devolve o valor (JSON como texto) ou NULL se não existir
CREATE OR REPLACE FUNCTION fn_get_app_setting(p_key VARCHAR)
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT s.value::TEXT FROM app_settings s WHERE s.setting_key = p_key);
END; $$ LANGUAGE plpgsql;

-- fn_upsert_app_setting: cria ou atualiza uma configuração
CREATE OR REPLACE FUNCTION fn_upsert_app_setting(p_key VARCHAR, p_value JSONB)
RETURNS VOID AS $$
BEGIN
    INSERT INTO app_settings (setting_key, value)
    VALUES (p_key, p_value)
    ON CONFLICT (setting_key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END; $$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNÇÕES — app_version
-- =============================================================================

DROP FUNCTION IF EXISTS fn_get_latest_app_version() CASCADE;
CREATE OR REPLACE FUNCTION fn_get_latest_app_version()
RETURNS TABLE (
    id           INTEGER,
    version      VARCHAR,
    download_url TEXT,
    is_active    BOOLEAN,
    released_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT v.id, v.version, v.download_url, v.is_active, v.released_at, v.created_at
    FROM app_version v
    WHERE v.is_active = TRUE
    ORDER BY v.released_at DESC, v.id DESC
    LIMIT 1;
END; $$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNÇÕES — action_logs
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_create_action_log(
    p_installation_id UUID,
    p_ip              VARCHAR,
    p_action          VARCHAR,
    p_status          VARCHAR,
    p_details         TEXT)
RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO action_logs (installation_id, ip, action, status, details)
    VALUES (p_installation_id, p_ip, p_action, COALESCE(p_status, 'success'), p_details)
    RETURNING id INTO v_id;
    RETURN v_id;
END; $$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNÇÕES — meetings (sempre filtradas por installation_id)
-- =============================================================================

-- fn_upsert_meeting: cria ou atualiza pela chave (installation_id, session_hash); devolve o id
DROP FUNCTION IF EXISTS fn_upsert_meeting(UUID, VARCHAR, SMALLINT, VARCHAR, TEXT, TEXT, TEXT, INT, VARCHAR, VARCHAR, VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION fn_upsert_meeting(
    p_installation_id  UUID,
    p_session_hash     VARCHAR,
    p_meeting_type     SMALLINT,
    p_summary_type     VARCHAR,
    p_transcript_text  TEXT,
    p_ai_summary       TEXT,
    p_prompt_used      TEXT,
    p_recorded_seconds INT,
    p_ai_provider      VARCHAR,
    p_ai_model         VARCHAR,
    p_language         VARCHAR)
RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO meetings (installation_id, session_hash, meeting_type, summary_type, transcript_text,
                          ai_summary, prompt_used, recorded_seconds, ai_provider, ai_model, language)
    VALUES (p_installation_id, p_session_hash, COALESCE(p_meeting_type, 1), p_summary_type, p_transcript_text,
            p_ai_summary, p_prompt_used, COALESCE(p_recorded_seconds, 0), p_ai_provider, p_ai_model, p_language)
    ON CONFLICT (installation_id, session_hash)
    DO UPDATE SET meeting_type     = EXCLUDED.meeting_type,
                  summary_type     = EXCLUDED.summary_type,
                  transcript_text  = EXCLUDED.transcript_text,
                  ai_summary       = EXCLUDED.ai_summary,
                  prompt_used      = EXCLUDED.prompt_used,
                  recorded_seconds = EXCLUDED.recorded_seconds,
                  ai_provider      = EXCLUDED.ai_provider,
                  ai_model         = EXCLUDED.ai_model,
                  language         = EXCLUDED.language,
                  updated_at       = NOW()
    RETURNING id INTO v_id;
    RETURN v_id;
END; $$ LANGUAGE plpgsql;

-- fn_get_meeting: uma reunião da instalação
DROP FUNCTION IF EXISTS fn_get_meeting(UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION fn_get_meeting(p_installation_id UUID, p_id UUID)
RETURNS TABLE (
    id               UUID,
    installation_id  UUID,
    session_hash     VARCHAR,
    meeting_type     SMALLINT,
    summary_type     VARCHAR,
    transcript_text  TEXT,
    ai_summary       TEXT,
    prompt_used      TEXT,
    recorded_seconds INTEGER,
    ai_provider      VARCHAR,
    ai_model         VARCHAR,
    language         VARCHAR,
    created_at       TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.id, m.installation_id, m.session_hash, m.meeting_type, m.summary_type, m.transcript_text,
           m.ai_summary, m.prompt_used, m.recorded_seconds, m.ai_provider, m.ai_model, m.language,
           m.created_at, m.updated_at
    FROM meetings m
    WHERE m.installation_id = p_installation_id AND m.id = p_id;
END; $$ LANGUAGE plpgsql;

-- fn_list_meetings: lista paginada (mais recentes primeiro), com filtro por tipo e busca de texto.
-- total_count é o total que atende ao filtro (ignora limit/offset), para paginação.
DROP FUNCTION IF EXISTS fn_list_meetings(UUID, SMALLINT, TEXT, INT, INT) CASCADE;
CREATE OR REPLACE FUNCTION fn_list_meetings(
    p_installation_id UUID,
    p_meeting_type    SMALLINT DEFAULT NULL,
    p_search          TEXT     DEFAULT NULL,
    p_limit           INT      DEFAULT 15,
    p_offset          INT      DEFAULT 0)
RETURNS TABLE (
    id               UUID,
    installation_id  UUID,
    session_hash     VARCHAR,
    meeting_type     SMALLINT,
    summary_type     VARCHAR,
    transcript_text  TEXT,
    ai_summary       TEXT,
    prompt_used      TEXT,
    recorded_seconds INTEGER,
    ai_provider      VARCHAR,
    ai_model         VARCHAR,
    language         VARCHAR,
    created_at       TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ,
    total_count      BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.id, m.installation_id, m.session_hash, m.meeting_type, m.summary_type, m.transcript_text,
           m.ai_summary, m.prompt_used, m.recorded_seconds, m.ai_provider, m.ai_model, m.language,
           m.created_at, m.updated_at,
           COUNT(*) OVER () AS total_count
    FROM meetings m
    WHERE m.installation_id = p_installation_id
      AND (p_meeting_type IS NULL OR m.meeting_type = p_meeting_type)
      AND (p_search IS NULL OR p_search = ''
           OR m.ai_summary      ILIKE '%' || p_search || '%'
           OR m.transcript_text ILIKE '%' || p_search || '%'
           OR m.ai_provider     ILIKE '%' || p_search || '%')
    ORDER BY m.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0);
END; $$ LANGUAGE plpgsql;

-- fn_delete_meeting: remove uma reunião da instalação; true se removeu
DROP FUNCTION IF EXISTS fn_delete_meeting(UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION fn_delete_meeting(p_installation_id UUID, p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_rows INT;
BEGIN
    DELETE FROM meetings WHERE installation_id = p_installation_id AND id = p_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END; $$ LANGUAGE plpgsql;

-- =============================================================================
-- SEEDS
-- =============================================================================

INSERT INTO app_settings (setting_key, value, description) VALUES
    ('kokoro_tts',
     '{"server_url":"http://host.docker.internal:8880","api_key":"","voice_pt":"pf_dora","voice_en":"af_heart"}',
     'Kokoro TTS service configuration'),
    ('libretranslate',
     '{"server_url":"http://host.docker.internal:5001","api_key":""}',
     'LibreTranslate service configuration'),
    ('anthropic_models',
     '["claude-opus-4-8","claude-opus-4-7","claude-sonnet-4-6","claude-haiku-4-5-20251001"]',
     'Available Anthropic models'),
    ('openai_models',
     '["gpt-4o","gpt-4o-mini","o1","o3-mini","gpt-4.1","gpt-4.1-mini"]',
     'Available OpenAI models'),
    ('gemini_models',
     '["gemini-3.5-flash","gemini-3.1-flash-lite","gemini-3.1-pro-preview"]',
     'Available Gemini models')
ON CONFLICT (setting_key) DO NOTHING;
