-- Allow users to update their own role (delete old + insert new)
CREATE POLICY "Users can delete own non-admin roles"
ON public.user_roles
FOR DELETE
USING (auth.uid() = user_id AND role IN ('user', 'creator', 'advertiser'));

CREATE POLICY "Users can insert own non-admin roles"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id AND role IN ('user', 'creator', 'advertiser'));
