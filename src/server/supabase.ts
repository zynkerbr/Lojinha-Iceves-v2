import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Reads credentials from process.env
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('Erro ao inicializar cliente Supabase:', err);
      return null;
    }
  }
  return supabaseInstance;
}

export interface SupabaseStatus {
  configured: boolean;
  urlProvided: boolean;
  keyProvided: boolean;
  maskedUrl?: string;
  connected?: boolean;
  error?: string;
  tablesFound?: string[];
}

export async function checkSupabaseConnection(): Promise<SupabaseStatus> {
  const urlProvided = Boolean(supabaseUrl);
  const keyProvided = Boolean(supabaseKey);

  if (!urlProvided || !keyProvided) {
    return {
      configured: false,
      urlProvided,
      keyProvided,
    };
  }

  const maskedUrl = supabaseUrl.replace(/https?:\/\/([^.]+).*/, 'https://$1...supabase.co');

  try {
    const client = getSupabaseClient();
    if (!client) {
      return {
        configured: false,
        urlProvided,
        keyProvided,
        maskedUrl,
        connected: false,
        error: 'Não foi possível inicializar o cliente Supabase com as credenciais fornecidas.',
      };
    }

    // Attempt a light probe to check connectivity
    const { data, error } = await client.from('settings').select('*').limit(1);

    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      // 42P01 means relation does not exist yet (schema not created yet, but connection is alive!)
      return {
        configured: true,
        urlProvided,
        keyProvided,
        maskedUrl,
        connected: false,
        error: `${error.message} (Código: ${error.code})`,
      };
    }

    return {
      configured: true,
      urlProvided,
      keyProvided,
      maskedUrl,
      connected: true,
    };
  } catch (err: any) {
    return {
      configured: true,
      urlProvided,
      keyProvided,
      maskedUrl,
      connected: false,
      error: err.message || 'Falha ao conectar ao Supabase',
    };
  }
}
