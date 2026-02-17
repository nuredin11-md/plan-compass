-- 1. Add DELETE policy on monthly_data
CREATE POLICY "Admins and owners can delete entries"
  ON public.monthly_data
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      entered_by = auth.uid()
      AND created_at > (now() - interval '24 hours')
    )
  );

-- 2. Add server-side validation constraints on monthly_data
ALTER TABLE public.monthly_data
  ADD CONSTRAINT actual_non_negative CHECK (actual >= 0),
  ADD CONSTRAINT actual_reasonable CHECK (actual <= 1000000),
  ADD CONSTRAINT remarks_length CHECK (char_length(remarks) <= 1000),
  ADD CONSTRAINT year_reasonable CHECK (year >= 2000 AND year <= 2100);

-- 3. Add server-side validation constraints on annual_plans
ALTER TABLE public.annual_plans
  ADD CONSTRAINT target_non_negative CHECK (target >= 0),
  ADD CONSTRAINT baseline_non_negative CHECK (baseline >= 0);