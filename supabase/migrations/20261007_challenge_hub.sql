-- Additive, repeatable migration. Existing records and challenge memberships remain.
ALTER TABLE public.challenge ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.challenge ADD COLUMN IF NOT EXISTS "profilePathname" text;
ALTER TABLE public.challenge ADD COLUMN IF NOT EXISTS "coverPathname" text;
ALTER TABLE public.cardio_record ADD COLUMN IF NOT EXISTS "submissionKey" text;
-- Different installers assigned different names to the old daily constraint.
DO $$ DECLARE constraint_name text; BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.cardio_record'::regclass AND contype = 'u'
      AND (SELECT array_agg(attname::text ORDER BY attname)
           FROM pg_attribute WHERE attrelid = conrelid AND attnum = ANY(conkey))
          = ARRAY['recordDate', 'userId']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.cardio_record DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS cardio_record_submission_unique ON public.cardio_record ("userId", "submissionKey");
CREATE INDEX IF NOT EXISTS cardio_record_user_date ON public.cardio_record ("userId", "recordDate");
