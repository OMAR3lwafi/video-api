-- Create the extensions schema and install pgcrypto there (recommended)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Example table definition using gen_random_uuid()
CREATE TABLE IF NOT EXISTS public.example_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  data text
);