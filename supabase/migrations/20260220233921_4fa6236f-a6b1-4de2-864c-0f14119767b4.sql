-- Enable realtime for deal_audit_log and deal_escrow
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_escrow;