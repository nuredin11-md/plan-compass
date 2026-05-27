
-- Fix 1: Update handle_new_user() to ALWAYS assign 'viewer' role (fixes signup_self_role_selection + trigger_user_role_injection)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'department')::department, 'Health System Strengthening')
  );
  -- SECURITY FIX: Always assign 'viewer' role, ignore user-supplied metadata
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$;

-- Fix 2: Replace overly permissive INSERT policy on monthly_data with department-scoped one
DROP POLICY IF EXISTS "Authenticated users can insert data" ON public.monthly_data;

CREATE POLICY "Users can insert data for own department"
  ON public.monthly_data
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND entered_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.annual_plans ap
      WHERE ap.indicator_code = monthly_data.indicator_code
        AND ap.year = monthly_data.year
        AND (ap.program_area = (public.get_user_department(auth.uid()))::text
             OR public.has_role(auth.uid(), 'admin'))
    )
  );
