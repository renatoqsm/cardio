-- Existing challenges and workouts remain cardio. No rows are removed.
ALTER TABLE public.challenge ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'cardio';
ALTER TABLE public.cardio_record ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'cardio';
-- Enforce one strength check-in per person/date even during concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS strength_daily_checkin ON public.cardio_record ("userId", "recordDate") WHERE modality = 'strength';
CREATE INDEX IF NOT EXISTS training_modality_date ON public.cardio_record ("userId", modality, "recordDate");
