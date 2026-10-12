import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Klien standar (user)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Klien khusus server (admin) untuk bypass RLS pada Supabase
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);