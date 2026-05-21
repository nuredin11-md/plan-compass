-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create User Profiles (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    region TEXT NOT NULL,
    department TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_profiles
CREATE TRIGGER tr_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 2. Create Indicators Table
CREATE TABLE IF NOT EXISTS public.indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    description TEXT,
    baseline NUMERIC DEFAULT 0,
    target NUMERIC DEFAULT 100,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Monthly Entries Table (Historical Data for AI Analysis)
CREATE TABLE IF NOT EXISTS public.monthly_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator_code TEXT REFERENCES public.indicators(code) ON DELETE CASCADE,
    month TEXT NOT NULL, -- e.g., 'Meskerem'
    year INTEGER NOT NULL, -- e.g., 2016
    value NUMERIC NOT NULL,
    reported_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create AI Analysis Cache Table
-- To store expensive Gemini API responses and history
CREATE TABLE IF NOT EXISTS public.ai_analysis_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department TEXT NOT NULL,
    analysis_result JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- User Profiles: Everyone can read, owner can update
CREATE POLICY "Profiles are viewable by authenticated users" ON public.user_profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Indicators: Read access for authenticated users
CREATE POLICY "Indicators are viewable by authenticated users" ON public.indicators
    FOR SELECT TO authenticated USING (true);

-- Monthly Entries: Viewable by all, insert by authenticated
CREATE POLICY "Monthly entries are viewable by all" ON public.monthly_entries
    FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert entries" ON public.monthly_entries
    FOR INSERT TO authenticated WITH CHECK (true);

-- AI Logs: Viewable by everyone in the same department
CREATE POLICY "AI logs viewable by department" ON public.ai_analysis_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (department = ai_analysis_logs.department OR role = 'Admin')
        )
    );
CREATE POLICY "Authenticated can create AI logs" ON public.ai_analysis_logs
    FOR INSERT TO authenticated WITH CHECK (true);