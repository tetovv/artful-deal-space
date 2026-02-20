
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-logos', 'brand-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view brand logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-logos');

CREATE POLICY "Authenticated users can upload brand logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'brand-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own brand logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own brand logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
