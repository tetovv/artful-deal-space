-- Add type column to ai_courses to distinguish courses from presentations
ALTER TABLE public.ai_courses ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'course';

-- Add slides column for presentation data
ALTER TABLE public.ai_courses ADD COLUMN IF NOT EXISTS slides jsonb DEFAULT '[]'::jsonb;