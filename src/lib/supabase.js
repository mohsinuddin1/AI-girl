import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MED_SUPABASE_URL = process.env.MED_SUPABASE_URL;
const MED_SUPABASE_ANON_KEY = process.env.MED_SUPABASE_ANON_KEY;

if (!MED_SUPABASE_URL || !MED_SUPABASE_ANON_KEY) {
    console.error(
        '[PureScan] FATAL: Missing Supabase env vars.\n' +
        '  MED_SUPABASE_URL=' + (MED_SUPABASE_URL || '(undefined)') + '\n' +
        '  MED_SUPABASE_ANON_KEY=' + (MED_SUPABASE_ANON_KEY ? '(set)' : '(undefined)') + '\n' +
        'Ensure EAS Secrets or .env are configured correctly.'
    );
}

export const supabase = (MED_SUPABASE_URL && MED_SUPABASE_ANON_KEY)
    ? createClient(MED_SUPABASE_URL, MED_SUPABASE_ANON_KEY, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    })
    : null;
