-- ENUM TYPES
CREATE TYPE report_status AS ENUM (
  'draft', 
  'submitted', 
  'pending_review', 
  'verified', 
  'rejected', 
  'routed', 
  'in_progress', 
  'fixed', 
  'closed', 
  'appealed'
);

-- TABEL USERS (Penyimpanan Data Akun & Password Hash Kustom)
CREATE TABLE public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- Menyimpan password yang sudah di-hash dengan bcrypt
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('citizen', 'officer', 'admin')) DEFAULT 'citizen' NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABEL REPORTS (Data Utama Laporan Kerusakan Jalan)
CREATE TABLE public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Direfensikan ke public.users
  title TEXT,
  description TEXT,
  category TEXT, -- Contoh: 'pothole', 'crack', 'sidewalk_damage'
  severity TEXT, -- Contoh: 'low', 'medium', 'high'
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  image_url TEXT,
  ai_analysis JSONB, -- Menyimpan hasil ekstraksi metadata dan analisis dari AI (YOLO/LLM)
  status report_status DEFAULT 'submitted'::report_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABEL STATUS_HISTORY (Melacak Perubahan Alur Laporan)
CREATE TABLE public.status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Direfensikan ke public.users
  previous_status report_status,
  new_status report_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABEL AUTHORITIES & ROUTINGS (Penerusan Tiket ke Instansi/Dinas)
CREATE TABLE public.authorities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- Contoh: 'Dinas Bina Marga DKI Jakarta'
  region TEXT,        -- Contoh: 'Jakarta Selatan'
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.report_routings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  authority_id UUID REFERENCES public.authorities(id) ON DELETE SET NULL,
  routed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  notes TEXT
);

-- TABEL AUDIT_LOGS (Pencatatan Aktivitas & Keamanan Sistem)
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Direfensikan ke public.users
  action TEXT NOT NULL,     -- Contoh: 'UPDATE_REPORT_STATUS', 'DELETE_USER'
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indeks untuk optimasi performa kueri geospasial dan pencarian
CREATE INDEX idx_reports_location ON public.reports(latitude, longitude);
CREATE INDEX idx_reports_status ON public.reports(status);

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;