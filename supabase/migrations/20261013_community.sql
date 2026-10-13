CREATE TABLE IF NOT EXISTS public.personal_goal (
 "userId" text PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
 "strengthDays" integer CHECK ("strengthDays" BETWEEN 1 AND 7),
 "cardioMinutes" integer CHECK ("cardioMinutes" BETWEEN 1 AND 10080),
 "cardioKilometers" numeric(7,2) CHECK ("cardioKilometers" BETWEEN 0.1 AND 10000)
);
CREATE TABLE IF NOT EXISTS public.record_reaction (
 "recordId" text NOT NULL REFERENCES public.cardio_record(id) ON DELETE CASCADE,
 "challengeId" text NOT NULL REFERENCES public.challenge(id) ON DELETE CASCADE,
 "userId" text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 emoji text NOT NULL CHECK (emoji IN ('💪','🔥','👏')),
 PRIMARY KEY ("recordId","challengeId","userId")
);
CREATE TABLE IF NOT EXISTS public.record_comment (
 id text PRIMARY KEY,
 "recordId" text NOT NULL REFERENCES public.cardio_record(id) ON DELETE CASCADE,
 "challengeId" text NOT NULL REFERENCES public.challenge(id) ON DELETE CASCADE,
 "userId" text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
 "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS record_comment_thread ON public.record_comment ("recordId","challengeId","createdAt");
CREATE TABLE IF NOT EXISTS public.deleted_submission (
 "userId" text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 "submissionKey" text NOT NULL, PRIMARY KEY ("userId","submissionKey")
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['personal_goal','record_reaction','record_comment','deleted_submission'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cardio_app') THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO cardio_app',t);
   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename=t AND policyname='application_access') THEN
    EXECUTE format('CREATE POLICY application_access ON public.%I TO cardio_app USING (true) WITH CHECK (true)',t);
   END IF;
  END IF;
 END LOOP;
END $$;
