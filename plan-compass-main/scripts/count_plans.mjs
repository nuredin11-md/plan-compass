import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('Supabase env vars not set: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  try {
    const { data: all, error: e1 } = await supabase.from('hospital_plan_and_performance').select('id, indicator_name, metric_type, fiscal_year');
    if (e1) throw e1;
    console.log('total_rows:', all.length);
    const planRows = all.filter(r => r.metric_type === 'Plan');
    console.log('plan_rows:', planRows.length);
    const uniqueIndicators = new Set(planRows.map(r => r.indicator_name));
    console.log('unique_indicator_names_in_plan_rows:', uniqueIndicators.size);
  } catch (err) {
    console.error('Query failed', err);
    process.exit(2);
  }
}

run();
