-- Create optional private schema for internal-only functions
CREATE SCHEMA IF NOT EXISTS private;

-- Helper: user_role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'anon'
  );
END;
$$;
ALTER FUNCTION public.user_role() SET search_path = '';

-- Helper: user_id
CREATE OR REPLACE FUNCTION public.user_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
END;
$$;
ALTER FUNCTION public.user_id() SET search_path = '';

-- Helper: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.user_role() IN ('admin', 'service_account');
END;
$$;
ALTER FUNCTION public.is_admin() SET search_path = '';

-- Helper: is_service
CREATE OR REPLACE FUNCTION public.is_service()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.user_role() = 'service_account';
END;
$$;
ALTER FUNCTION public.is_service() SET search_path = '';

-- Helper: client_ip (defensive)
CREATE OR REPLACE FUNCTION public.client_ip()
RETURNS INET
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.headers', true)::json->>'x-forwarded-for')::inet,
    (current_setting('request.headers', true)::json->>'x-real-ip')::inet,
    '127.0.0.1'::inet
  );
EXCEPTION WHEN OTHERS THEN
  RETURN '127.0.0.1'::inet;
END;
$$;
ALTER FUNCTION public.client_ip() SET search_path = '';

-- can_subscribe_to_job moved to public
CREATE OR REPLACE FUNCTION public.can_subscribe_to_job(job_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_client_ip INET;
BEGIN
  IF public.is_admin() OR public.is_service() THEN
    RETURN TRUE;
  END IF;

  SELECT client_ip INTO job_client_ip FROM public.jobs WHERE id = job_uuid;

  RETURN job_client_ip IS NULL OR job_client_ip = public.client_ip();
END;
$$;
ALTER FUNCTION public.can_subscribe_to_job(uuid) SET search_path = '';

-- Grant execute for the functions that should be callable by the API roles
GRANT EXECUTE ON FUNCTION public.user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_service() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_ip() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_subscribe_to_job(uuid) TO anon, authenticated;