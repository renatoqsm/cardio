-- Preserve old photos/records without marking them as daily-gesture captures.
ALTER TABLE public.cardio_record ADD COLUMN IF NOT EXISTS "captureDay" date;
ALTER TABLE public.cardio_record ADD COLUMN IF NOT EXISTS "gestureId" text;
