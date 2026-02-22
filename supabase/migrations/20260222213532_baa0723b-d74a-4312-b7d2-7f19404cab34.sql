
-- Add segment_status to montage_segments
ALTER TABLE public.montage_segments
  ADD COLUMN segment_status text NOT NULL DEFAULT 'OK';

-- Montage edit history table
CREATE TABLE public.montage_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  montage_id uuid NOT NULL REFERENCES public.montage_projects(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.montage_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own edit history" ON public.montage_edit_history
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM montage_projects mp WHERE mp.id = montage_edit_history.montage_id AND mp.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own edit history" ON public.montage_edit_history
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM montage_projects mp WHERE mp.id = montage_edit_history.montage_id AND mp.user_id = auth.uid()
  ));
