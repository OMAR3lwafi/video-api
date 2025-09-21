DO $$
BEGIN
  -- create publication if missing
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'realtime_publication') THEN
    EXECUTE 'CREATE PUBLICATION realtime_publication;';
  END IF;

  -- add jobs table to publication if not present (use regclass cast)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_publication p ON pr.prpubid = p.oid
    WHERE p.pubname = 'realtime_publication' AND n.nspname = 'public' AND c.relname = 'jobs'
  ) THEN
    PERFORM pg_catalog.pg_publication_add_table('realtime_publication', 'public.jobs'::regclass);
  END IF;

  -- add processing_timeline table to publication if not present (use regclass cast)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_publication p ON pr.prpubid = p.oid
    WHERE p.pubname = 'realtime_publication' AND n.nspname = 'public' AND c.relname = 'processing_timeline'
  ) THEN
    PERFORM pg_catalog.pg_publication_add_table('realtime_publication', 'public.processing_timeline'::regclass);
  END IF;
END$$;

-- Confirm publication membership
SELECT p.pubname, n.nspname, c.relname
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON pr.prrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE p.pubname = 'realtime_publication';