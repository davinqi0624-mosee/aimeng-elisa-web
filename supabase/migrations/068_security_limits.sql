-- 统一安全限流：AI 消耗、注册滥用、后台登录暴力破解。
-- 所有计数在数据库函数中原子执行，应用重启或多台服务器不会绕过限制。

CREATE TABLE IF NOT EXISTS ai_request_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_type TEXT NOT NULL CHECK (bucket_type IN ('ip', 'user', 'global')),
  bucket_key_hash TEXT NOT NULL,
  window_type TEXT NOT NULL CHECK (window_type IN ('10m', 'day')),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  reserved_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bucket_type, bucket_key_hash, window_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_request_usage_updated
  ON ai_request_usage(updated_at);

ALTER TABLE ai_request_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reserve_ai_request(
  p_ip_hash TEXT,
  p_user_id UUID DEFAULT NULL,
  p_estimated_tokens INTEGER DEFAULT 1,
  p_ip_10m_limit INTEGER DEFAULT 20,
  p_ip_day_limit INTEGER DEFAULT 100,
  p_user_10m_limit INTEGER DEFAULT 10,
  p_user_day_limit INTEGER DEFAULT 50,
  p_anonymous_day_limit INTEGER DEFAULT 20,
  p_global_day_limit INTEGER DEFAULT 500,
  p_global_token_day_limit INTEGER DEFAULT 400000
)
RETURNS TABLE(allowed BOOLEAN, retry_after_seconds INTEGER, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_ten_start TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM NOW()) / 600) * 600);
  v_day_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_count INTEGER;
  v_tokens INTEGER;
  v_retry INTEGER;
BEGIN
  p_estimated_tokens := GREATEST(1, LEAST(COALESCE(p_estimated_tokens, 1), 5000));
  p_ip_hash := COALESCE(NULLIF(p_ip_hash, ''), 'unknown-ip');

  INSERT INTO ai_request_usage(bucket_type, bucket_key_hash, window_type, window_start)
  VALUES
    ('ip', p_ip_hash, '10m', v_ten_start),
    ('ip', p_ip_hash, 'day', v_day_start),
    ('global', 'global', 'day', v_day_start)
  ON CONFLICT DO NOTHING;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO ai_request_usage(bucket_type, bucket_key_hash, window_type, window_start)
    VALUES ('user', p_user_id::TEXT, '10m', v_ten_start), ('user', p_user_id::TEXT, 'day', v_day_start)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT request_count INTO v_count FROM ai_request_usage
    WHERE bucket_type = 'ip' AND bucket_key_hash = p_ip_hash AND window_type = '10m' AND window_start = v_ten_start FOR UPDATE;
  IF v_count >= GREATEST(1, p_ip_10m_limit) THEN
    v_retry := GREATEST(1, CEIL(extract(epoch FROM (v_ten_start + interval '10 minutes' - v_now)))::INTEGER);
    RETURN QUERY SELECT FALSE, v_retry, '当前网络的 AI 请求过于频繁，请稍后再试'; RETURN;
  END IF;

  SELECT request_count INTO v_count FROM ai_request_usage
    WHERE bucket_type = 'ip' AND bucket_key_hash = p_ip_hash AND window_type = 'day' AND window_start = v_day_start FOR UPDATE;
  IF v_count >= GREATEST(1, p_ip_day_limit) THEN
    v_retry := GREATEST(1, CEIL(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::INTEGER);
    RETURN QUERY SELECT FALSE, v_retry, '当前网络今日的 AI 使用次数已达到上限'; RETURN;
  END IF;

  IF p_user_id IS NULL THEN
    SELECT request_count INTO v_count FROM ai_request_usage
      WHERE bucket_type = 'ip' AND bucket_key_hash = p_ip_hash AND window_type = 'day' AND window_start = v_day_start;
    IF v_count >= GREATEST(1, p_anonymous_day_limit) THEN
      v_retry := GREATEST(1, CEIL(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::INTEGER);
      RETURN QUERY SELECT FALSE, v_retry, '匿名试用次数已用完，请登录后继续使用'; RETURN;
    END IF;
  ELSE
    SELECT request_count INTO v_count FROM ai_request_usage
      WHERE bucket_type = 'user' AND bucket_key_hash = p_user_id::TEXT AND window_type = '10m' AND window_start = v_ten_start FOR UPDATE;
    IF v_count >= GREATEST(1, p_user_10m_limit) THEN
      v_retry := GREATEST(1, CEIL(extract(epoch FROM (v_ten_start + interval '10 minutes' - v_now)))::INTEGER);
      RETURN QUERY SELECT FALSE, v_retry, '您的 AI 请求过于频繁，请稍后再试'; RETURN;
    END IF;
    SELECT request_count INTO v_count FROM ai_request_usage
      WHERE bucket_type = 'user' AND bucket_key_hash = p_user_id::TEXT AND window_type = 'day' AND window_start = v_day_start FOR UPDATE;
    IF v_count >= GREATEST(1, p_user_day_limit) THEN
      v_retry := GREATEST(1, CEIL(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::INTEGER);
      RETURN QUERY SELECT FALSE, v_retry, '您的 AI 今日使用次数已达到上限'; RETURN;
    END IF;
  END IF;

  SELECT request_count, reserved_tokens INTO v_count, v_tokens FROM ai_request_usage
    WHERE bucket_type = 'global' AND bucket_key_hash = 'global' AND window_type = 'day' AND window_start = v_day_start FOR UPDATE;
  IF v_count >= GREATEST(1, p_global_day_limit) OR v_tokens + p_estimated_tokens > GREATEST(1, p_global_token_day_limit) THEN
    v_retry := GREATEST(1, CEIL(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::INTEGER);
    RETURN QUERY SELECT FALSE, v_retry, '网站今日 AI 服务额度已达到安全上限，请明天再试'; RETURN;
  END IF;

  UPDATE ai_request_usage SET request_count = request_count + 1, reserved_tokens = reserved_tokens + p_estimated_tokens, updated_at = v_now
    WHERE bucket_type = 'ip' AND bucket_key_hash = p_ip_hash AND window_type IN ('10m', 'day') AND window_start IN (v_ten_start, v_day_start);
  UPDATE ai_request_usage SET request_count = request_count + 1, reserved_tokens = reserved_tokens + p_estimated_tokens, updated_at = v_now
    WHERE bucket_type = 'global' AND bucket_key_hash = 'global' AND window_type = 'day' AND window_start = v_day_start;
  IF p_user_id IS NOT NULL THEN
    UPDATE ai_request_usage SET request_count = request_count + 1, reserved_tokens = reserved_tokens + p_estimated_tokens, updated_at = v_now
      WHERE bucket_type = 'user' AND bucket_key_hash = p_user_id::TEXT AND window_type IN ('10m', 'day') AND window_start IN (v_ten_start, v_day_start);
  END IF;

  RETURN QUERY SELECT TRUE, 0, '';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_request(TEXT, UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_request(TEXT, UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;

CREATE TABLE IF NOT EXISTS registration_security_usage (
  key_type TEXT NOT NULL CHECK (key_type IN ('ip', 'email')),
  key_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key_type, key_hash, window_start)
);

CREATE OR REPLACE FUNCTION public.reserve_registration_attempt(p_ip_hash TEXT, p_email_hash TEXT)
RETURNS TABLE(allowed BOOLEAN, retry_after_seconds INTEGER, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_hour TIMESTAMPTZ := date_trunc('hour', NOW());
  v_day TIMESTAMPTZ := date_trunc('day', NOW());
  v_ip_count INTEGER;
  v_email_count INTEGER;
BEGIN
  INSERT INTO registration_security_usage(key_type, key_hash, window_start)
  VALUES ('ip', COALESCE(NULLIF(p_ip_hash, ''), 'unknown-ip'), v_hour), ('email', COALESCE(NULLIF(p_email_hash, ''), 'unknown-email'), v_day)
  ON CONFLICT DO NOTHING;
  SELECT attempt_count INTO v_ip_count FROM registration_security_usage WHERE key_type = 'ip' AND key_hash = p_ip_hash AND window_start = v_hour FOR UPDATE;
  SELECT attempt_count INTO v_email_count FROM registration_security_usage WHERE key_type = 'email' AND key_hash = p_email_hash AND window_start = v_day FOR UPDATE;
  IF v_ip_count >= 20 THEN RETURN QUERY SELECT FALSE, 3600, '当前网络注册请求过于频繁，请稍后重试'; RETURN; END IF;
  IF v_email_count >= 3 THEN RETURN QUERY SELECT FALSE, 86400, '该邮箱今日注册尝试次数已达到上限'; RETURN; END IF;
  UPDATE registration_security_usage SET attempt_count = attempt_count + 1, updated_at = v_now WHERE key_type = 'ip' AND key_hash = p_ip_hash AND window_start = v_hour;
  UPDATE registration_security_usage SET attempt_count = attempt_count + 1, updated_at = v_now WHERE key_type = 'email' AND key_hash = p_email_hash AND window_start = v_day;
  RETURN QUERY SELECT TRUE, 0, '';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_registration_attempt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_registration_attempt(TEXT, TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS admin_login_security (
  key_type TEXT NOT NULL CHECK (key_type IN ('ip', 'username')),
  key_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key_type, key_hash)
);

CREATE OR REPLACE FUNCTION public.check_admin_login_lock(p_username_hash TEXT, p_ip_hash TEXT)
RETURNS TABLE(locked BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_until TIMESTAMPTZ; v_retry INTEGER := 0;
BEGIN
  SELECT GREATEST(COALESCE(MAX(locked_until), '-infinity'::timestamptz), '-infinity'::timestamptz) INTO v_until
  FROM admin_login_security WHERE key_hash IN (p_username_hash, p_ip_hash);
  IF v_until > NOW() THEN v_retry := CEIL(extract(epoch FROM (v_until - NOW())))::INTEGER; END IF;
  RETURN QUERY SELECT v_retry > 0, v_retry;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_admin_login_failure(p_username_hash TEXT, p_ip_hash TEXT)
RETURNS TABLE(retry_after_seconds INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_now TIMESTAMPTZ := NOW(); v_key TEXT; v_type TEXT; v_count INTEGER; v_lock INTEGER := 0; v_max INTEGER := 0;
BEGIN
  FOR v_key, v_type IN SELECT * FROM (VALUES (p_username_hash, 'username'), (p_ip_hash, 'ip')) AS keys(key_hash, key_type) LOOP
    INSERT INTO admin_login_security(key_type, key_hash, failed_attempts, last_failed_at, updated_at)
    VALUES (v_type, v_key, 1, v_now, v_now)
    ON CONFLICT (key_type, key_hash) DO UPDATE SET
      failed_attempts = CASE
        WHEN admin_login_security.last_failed_at < v_now - interval '1 hour' THEN 1
        ELSE admin_login_security.failed_attempts + 1
      END,
      locked_until = NULL,
      last_failed_at = v_now,
      updated_at = v_now;
    SELECT failed_attempts INTO v_count FROM admin_login_security WHERE key_type = v_type AND key_hash = v_key FOR UPDATE;
    v_lock := CASE WHEN v_count >= 20 THEN 86400 WHEN v_count >= 10 THEN 3600 WHEN v_count >= 5 THEN 900 ELSE 0 END;
    IF v_lock > v_max THEN v_max := v_lock; END IF;
    UPDATE admin_login_security SET locked_until = CASE WHEN v_lock > 0 THEN v_now + make_interval(secs => v_lock) ELSE NULL END WHERE key_type = v_type AND key_hash = v_key;
  END LOOP;
  RETURN QUERY SELECT v_max;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_admin_login_failures(p_username_hash TEXT, p_ip_hash TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ DELETE FROM admin_login_security WHERE key_hash IN (p_username_hash, p_ip_hash); $$;

REVOKE ALL ON FUNCTION public.check_admin_login_lock(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_admin_login_failure(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_admin_login_failures(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_login_lock(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_admin_login_failure(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_admin_login_failures(TEXT, TEXT) TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_request_usage_expiry ON ai_request_usage(window_start);
COMMENT ON TABLE ai_request_usage IS 'AI 请求配额与预估 token 账本，按 IP、用户和全站窗口原子限流。';
COMMENT ON TABLE admin_login_security IS '后台登录失败计数与渐进式锁定记录，不保存密码。';

NOTIFY pgrst, 'reload schema';
