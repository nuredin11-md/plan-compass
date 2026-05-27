import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const supabaseNotConfiguredError = 'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY';

const createFallbackClient = () => {
  const createQueryStub = () => {
    return {
      select: () => queryStub,
      eq: () => queryStub,
      limit: () => queryStub,
      single: async () => ({ data: null, error: { message: supabaseNotConfiguredError } }),
      upsert: () => queryStub,
      insert: () => queryStub,
      delete: () => queryStub,
    } as const;
  };

  const queryStub = createQueryStub();

  return {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null } }),
      signInWithPassword: async () => ({ error: { message: supabaseNotConfiguredError } }),
      signUp: async () => ({ error: { message: supabaseNotConfiguredError } }),
      signOut: async () => ({ error: null }),
    },
    from: () => queryStub,
  } as unknown as typeof import('@supabase/supabase-js').SupabaseClient<Database>;
};

export const supabase: SupabaseClient<Database> =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : (createFallbackClient() as unknown as SupabaseClient<Database>);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.error(supabaseNotConfiguredError);
}
