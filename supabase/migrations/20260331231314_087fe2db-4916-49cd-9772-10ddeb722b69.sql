CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  changes JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No one can update audit logs
CREATE POLICY "No one can update audit logs"
  ON public.audit_logs FOR UPDATE
  USING (false);

-- No one can delete audit logs
CREATE POLICY "No one can delete audit logs"
  ON public.audit_logs FOR DELETE
  USING (false);