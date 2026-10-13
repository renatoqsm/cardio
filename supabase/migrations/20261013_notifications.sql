CREATE TABLE IF NOT EXISTS public.notification_preference (
 "userId" text PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
 cardio boolean NOT NULL DEFAULT true,
 strength boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.push_subscription (
 id text PRIMARY KEY,
 "userId" text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE,
 p256dh text NOT NULL,
 auth text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscription_user ON public.push_subscription ("userId");
CREATE TABLE IF NOT EXISTS public.notification_outbox (
 "recordId" text NOT NULL REFERENCES public.cardio_record(id) ON DELETE CASCADE,
 "subscriptionId" text NOT NULL REFERENCES public.push_subscription(id) ON DELETE CASCADE,
 "challengeId" text NOT NULL REFERENCES public.challenge(id) ON DELETE CASCADE,
 attempts integer NOT NULL DEFAULT 0,
 "availableAt" timestamptz NOT NULL DEFAULT now(),
 "lockedUntil" timestamptz,
 "createdAt" timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY ("recordId","subscriptionId")
);
CREATE INDEX IF NOT EXISTS notification_outbox_available ON public.notification_outbox ("availableAt");
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['notification_preference','push_subscription','notification_outbox'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cardio_app') THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO cardio_app',t);
   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='application_access') THEN
    EXECUTE format('CREATE POLICY application_access ON public.%I TO cardio_app USING (true) WITH CHECK (true)',t);
   END IF;
  END IF;
 END LOOP;
END $$;
