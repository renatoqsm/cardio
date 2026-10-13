-- Private personal details are separate from the public name/avatar.
CREATE TABLE IF NOT EXISTS public.user_profile (
 "userId" text PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
 age integer CHECK (age BETWEEN 1 AND 130),
 weight numeric(5,2) CHECK (weight BETWEEN 1 AND 500)
);
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cardio_app') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_profile TO cardio_app;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profile' AND policyname='application_access') THEN
   CREATE POLICY application_access ON public.user_profile TO cardio_app USING (true) WITH CHECK (true);
  END IF;
 END IF;
END $$;
