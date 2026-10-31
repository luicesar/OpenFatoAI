-- fn_delete_meeting_by_session: remove uma reunião pela chave de sessão do app (usada na sincronização)

CREATE OR REPLACE FUNCTION fn_delete_meeting_by_session(p_installation_id UUID, p_session_hash VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE v_rows INT;
BEGIN
    DELETE FROM meetings WHERE installation_id = p_installation_id AND session_hash = p_session_hash;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END; $$ LANGUAGE plpgsql;
