import config from '../config.js';
import { demo } from './backend-demo.js';

/** Demo mode when no Supabase settings are filled in (or ?demo is in the URL). */
export const wantsDemo = !config.supabaseUrl || !config.supabaseAnonKey || new URLSearchParams(location.search).has('demo');

export async function loadBackend() {
  if (wantsDemo) return demo;
  const { createSupabaseBackend } = await import('./backend-supabase.js');
  return createSupabaseBackend(config);
}
