-- Allow users to delete their own AI courses/presentations
CREATE POLICY "Users can delete own courses"
ON public.ai_courses
FOR DELETE
USING (auth.uid() = user_id);