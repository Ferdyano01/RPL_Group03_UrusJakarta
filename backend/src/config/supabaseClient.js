import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan file .env di folder backend selalu termuat dari direktori kerja mana pun
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// Klien standar (user)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Klien khusus server (admin) untuk bypass RLS pada Supabase
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
