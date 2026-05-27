
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'department_head', 'data_entry', 'viewer');

-- Departments enum
CREATE TYPE public.department AS ENUM (
  'Maternal & Child Health',
  'Child Health',
  'Nutrition',
  'HIV/AIDS & STI',
  'Tuberculosis',
  'Malaria',
  'WASH',
  'NCD',
  'Health System Strengthening'
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department department NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to get user department
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS department
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Annual plans table (master plan per year)
CREATE TABLE public.annual_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  indicator_code TEXT NOT NULL,
  program_area TEXT NOT NULL,
  sub_program TEXT NOT NULL,
  indicator TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '#',
  baseline NUMERIC NOT NULL DEFAULT 0,
  target NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, indicator_code)
);

ALTER TABLE public.annual_plans ENABLE ROW LEVEL SECURITY;

-- Monthly data table
CREATE TABLE public.monthly_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  indicator_code TEXT NOT NULL,
  actual NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT DEFAULT '',
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, month, indicator_code)
);

ALTER TABLE public.monthly_data ENABLE ROW LEVEL SECURITY;

-- Trigger for auto-creating profile on signup
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
  -- Default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'viewer'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_annual_plans_updated_at BEFORE UPDATE ON public.annual_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_data_updated_at BEFORE UPDATE ON public.monthly_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: users see own profile, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User roles: users can read own role
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Annual plans: department-restricted read, admins can write
CREATE POLICY "Users see own department plans" ON public.annual_plans FOR SELECT USING (
  program_area = (public.get_user_department(auth.uid()))::text
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins can manage plans" ON public.annual_plans FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update plans" ON public.annual_plans FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete plans" ON public.annual_plans FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Monthly data: department-restricted via indicator code join
CREATE POLICY "Users see own department data" ON public.monthly_data FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.annual_plans ap 
    WHERE ap.indicator_code = monthly_data.indicator_code 
    AND ap.year = monthly_data.year
    AND (ap.program_area = (public.get_user_department(auth.uid()))::text OR public.has_role(auth.uid(), 'admin'))
  )
);
CREATE POLICY "Authenticated users can insert data" ON public.monthly_data FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own entries" ON public.monthly_data FOR UPDATE USING (entered_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
