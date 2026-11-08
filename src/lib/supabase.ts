import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isBackendConfigured = Boolean(url && key);

// null عند غياب الإعدادات، حتى لا ينهار التطبيق قبل ربط Supabase
export const supabase = isBackendConfigured ? createClient(url!, key!) : null;
