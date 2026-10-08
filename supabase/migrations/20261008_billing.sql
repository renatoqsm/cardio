-- Additive billing ledger. No workouts, photos or memberships are removed.
CREATE TABLE IF NOT EXISTS public.billing_order (
 id text PRIMARY KEY, "challengeId" text NOT NULL, "ownerId" text NOT NULL,
 plan text NOT NULL CHECK (plan IN ('monthly','annual')),
 status text NOT NULL, "checkoutId" text UNIQUE, "subscriptionId" text UNIQUE,
 "checkoutUrl" text, "createdAt" timestamptz NOT NULL, "expiresAt" timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_one_open_order ON public.billing_order ("challengeId")
 WHERE status IN ('creating','pending','active','unknown','canceling');
CREATE TABLE IF NOT EXISTS public.billing_payment (
 id text PRIMARY KEY, "orderId" text NOT NULL, "amountCents" integer NOT NULL,
 status text NOT NULL, "startsAt" timestamptz NOT NULL, "endsAt" timestamptz NOT NULL,
 "updatedAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS billing_paid_period ON public.billing_payment ("orderId", "endsAt");
CREATE TABLE IF NOT EXISTS public.billing_event (id text PRIMARY KEY, kind text NOT NULL, "processedAt" timestamptz NOT NULL);
-- Records made while a challenge is blocked must never appear retroactively after payment.
CREATE TABLE IF NOT EXISTS public.record_challenge (
 "recordId" text NOT NULL, "challengeId" text NOT NULL, PRIMARY KEY ("recordId", "challengeId")
);
CREATE TABLE IF NOT EXISTS public.billing_setting (id text PRIMARY KEY, "createdAt" timestamptz NOT NULL);
-- One-time legacy backfill preserves the rankings before the Premium launch.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.billing_setting WHERE id='destinations_initialized') THEN
  INSERT INTO public.record_challenge ("recordId", "challengeId")
   SELECT r.id, c.id FROM public.cardio_record r
   JOIN public.challenge_member m ON m."userId"=r."userId"
   JOIN public.challenge c ON c.id=m."challengeId" AND c.modality=r.modality
   WHERE r."recordDate" BETWEEN c."startDate" AND c."endDate" ON CONFLICT DO NOTHING;
  INSERT INTO public.billing_setting VALUES ('destinations_initialized',now());
 END IF;
END $$;
ALTER TABLE public.billing_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_setting ENABLE ROW LEVEL SECURITY;
-- The dedicated application role alone can read/write this private ledger.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cardio_app') THEN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_order, public.billing_payment,
   public.billing_event, public.record_challenge, public.billing_setting TO cardio_app;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='billing_order' AND policyname='application_access') THEN
   CREATE POLICY application_access ON public.billing_order TO cardio_app USING (true) WITH CHECK (true);
   CREATE POLICY application_access ON public.billing_payment TO cardio_app USING (true) WITH CHECK (true);
   CREATE POLICY application_access ON public.billing_event TO cardio_app USING (true) WITH CHECK (true);
   CREATE POLICY application_access ON public.record_challenge TO cardio_app USING (true) WITH CHECK (true);
   CREATE POLICY application_access ON public.billing_setting TO cardio_app USING (true) WITH CHECK (true);
  END IF;
 END IF;
END $$;
