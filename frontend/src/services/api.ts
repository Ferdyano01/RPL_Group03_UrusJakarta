import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface PickedImageFile {
  uri: string;
  name: string;
  type: string;
  webFile?: File | null;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'citizen' | 'officer' | 'admin';
  phone_number?: string | null;
  created_at?: string;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface YoloDetection {
  detection_id: number;
  class_id: number;
  class: string;
  confidence: number;
  bounding_box: BoundingBox;
}

export interface LocationContext {
  strategic_score: number;
  strategic_tier: 'low' | 'medium' | 'high';
  road_class: 'arterial' | 'collector' | 'local';
  road_class_label: string;
  population_density_tier: 'low' | 'medium' | 'high';
  detected_region: string;
  nearby_vital_facilities: string[];
  nearby_report_count: number;
  duplicate_count: number;
  score_breakdown?: {
    road_class_score: number;
    poi_proximity_score: number;
    population_density_score: number;
    report_frequency_score: number;
  };
  data_source?: string;
}

export interface PossibleDuplicate {
  id: string;
  title: string;
  address: string | null;
  category: string;
  severity: 'low' | 'medium' | 'high';
  status: string;
  distance_meters: number;
  support_count: number;
  created_at: string | null;
}

export interface AiAnalysisMetadata {
  analyzed_at: string;
  vision_service_available: boolean;
  total_detections: number;
  classes_detected: Record<string, { count: number; max_confidence: number }>;
  detections: YoloDetection[];
  image_dimensions: { width: number; height: number } | null;
  max_confidence: number;
  primary_damage_label: string;
  needs_manual_review: boolean;
  narrative_generator: string;
  original_user_description?: string | null;
  visual_severity?: 'low' | 'medium' | 'high';
  effective_severity?: 'low' | 'medium' | 'high';
  severity_adjusted?: boolean;
  severity_adjustment_reason?: string | null;
  strategic_score?: number;
  priority_score?: number;
  location_context?: LocationContext | null;
  possible_duplicates?: PossibleDuplicate[];
  support_count?: number;
  duplicate_of?: string | null;
}

export interface ReportItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  severity: 'low' | 'medium' | 'high';
  latitude: number;
  longitude: number;
  address: string | null;
  image_url: string | null;
  ai_analysis: AiAnalysisMetadata | null;
  status: string;
  created_at: string;
  updated_at: string;
  reporter?: {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string | null;
    role: string;
  } | null;
  status_history?: {
    id: string;
    previous_status: string | null;
    new_status: string;
    notes: string | null;
    changed_by: string | null;
    created_at: string;
  }[];
  report_routings?: {
    id: string;
    routed_at: string;
    notes: string | null;
    authority?: {
      id: string;
      name: string;
      region: string;
      contact_email: string;
    } | null;
  }[];
}

export interface DraftAnalysisResponse {
  draft: {
    title: string;
    description: string;
    category: string;
    severity: 'low' | 'medium' | 'high';
    visual_severity?: 'low' | 'medium' | 'high';
    severity_adjusted?: boolean;
    severity_adjustment_reason?: string | null;
    strategic_score?: number;
    priority_score?: number;
    location_context?: LocationContext | null;
    possible_duplicates?: PossibleDuplicate[];
    latitude: number;
    longitude: number;
    address: string | null;
    image_url: string | null;
    suggested_status: string;
    needs_manual_review: boolean;
  };
  ai_analysis: AiAnalysisMetadata;
  upload_warning?: string;
}

const STORAGE_KEYS = {
  TOKEN: 'urusjakarta_token',
  USER: 'urusjakarta_user',
  API_URL: 'urusjakarta_api_url',
};

let memoryToken: string | null = null;
let memoryUser: UserProfile | null = null;
let memoryApiUrl: string | null = null;

const getStorageItem = (key: string): string | null => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
  return null;
};

const setStorageItem = (key: string, value: string | null) => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    } else if (Platform.OS !== 'web') {
      if (value === null) {
        void AsyncStorage.removeItem(key);
      } else {
        void AsyncStorage.setItem(key, value);
      }
    }
  } catch {
    // Abaikan
  }
};

export const initAuthStorage = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    const [token, userRaw, apiUrl] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.USER),
      AsyncStorage.getItem(STORAGE_KEYS.API_URL),
    ]);
    if (token) memoryToken = token;
    if (userRaw) memoryUser = JSON.parse(userRaw) as UserProfile;
    if (apiUrl) memoryApiUrl = apiUrl;
  } catch {
    // Abaikan jika gagal membaca AsyncStorage
  }
};

const detectDefaultApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.location.protocol === 'https:') {
      return window.location.origin.replace(/\/+$/, '');
    }
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:5000`;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) {
      return `http://${host}:5000`;
    }
  }
  return 'http://localhost:5000';
};

export const getApiBaseUrl = (): string => {
  if (memoryApiUrl) return memoryApiUrl;
  const saved = getStorageItem(STORAGE_KEYS.API_URL);
  if (saved) {
    memoryApiUrl = saved;
    return saved;
  }
  return detectDefaultApiUrl();
};

export const setApiBaseUrl = (url: string) => {
  const cleaned = url.trim().replace(/\/+$/, '');
  memoryApiUrl = cleaned;
  setStorageItem(STORAGE_KEYS.API_URL, cleaned);
};

export const getAuthToken = (): string | null => {
  if (memoryToken) return memoryToken;
  const saved = getStorageItem(STORAGE_KEYS.TOKEN);
  if (saved) {
    memoryToken = saved;
  }
  return memoryToken;
};

export const getCurrentUser = (): UserProfile | null => {
  if (memoryUser) return memoryUser;
  const saved = getStorageItem(STORAGE_KEYS.USER);
  if (saved) {
    try {
      memoryUser = JSON.parse(saved) as UserProfile;
    } catch {
      memoryUser = null;
    }
  }
  return memoryUser;
};

export const setAuthSession = (token: string, user: UserProfile) => {
  memoryToken = token;
  memoryUser = user;
  setStorageItem(STORAGE_KEYS.TOKEN, token);
  setStorageItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

export const updateStoredUser = (user: UserProfile) => {
  memoryUser = user;
  setStorageItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

export const clearAuthSession = () => {
  memoryToken = null;
  memoryUser = null;
  setStorageItem(STORAGE_KEYS.TOKEN, null);
  setStorageItem(STORAGE_KEYS.USER, null);
};

export const resolveImageUrl = (imageUrl?: string | null): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    return imageUrl;
  }
  const baseUrl = getApiBaseUrl();
  if (imageUrl.startsWith('/')) {
    return `${baseUrl}${imageUrl}`;
  }
  if (imageUrl.includes('localhost:5000')) {
    return imageUrl.replace('http://localhost:5000', baseUrl);
  }
  return imageUrl;
};

const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const baseUrl = getApiBaseUrl();
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({
    status: 'error',
    message: `Respons server tidak valid (HTTP ${response.status})`,
  }));

  if (!response.ok || json.status === 'error') {
    throw new Error(json.message || `Permintaan gagal (${response.status})`);
  }

  return json as T;
};

export const checkSystemHealth = async () => {
  try {
    const res = await apiRequest<{
      status: string;
      message: string;
      storage_mode?: string;
      ai_service?: { available: boolean; model_loaded: boolean; url: string };
    }>('/api/health');
    return {
      backendOnline: true,
      storageMode: res.storage_mode || 'supabase',
      aiOnline: Boolean(res.ai_service?.available),
      modelLoaded: Boolean(res.ai_service?.model_loaded),
    };
  } catch {
    return {
      backendOnline: false,
      storageMode: 'offline',
      aiOnline: false,
      modelLoaded: false,
    };
  }
};

export const registerUserApi = async (payload: {
  full_name: string;
  email: string;
  password: string;
  phone_number?: string;
}) => {
  return apiRequest<{ status: string; message: string; data: UserProfile }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
};

export const loginUserApi = async (payload: { email: string; password: string }) => {
  const res = await apiRequest<{
    status: string;
    message: string;
    data: { token: string; user: UserProfile };
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuthSession(res.data.token, res.data.user);
  return res.data;
};

export const fetchMyProfile = async (): Promise<UserProfile> => {
  const res = await apiRequest<{ status: string; data: UserProfile }>('/api/auth/me');
  updateStoredUser(res.data);
  return res.data;
};

export const updateMyProfile = async (payload: {
  full_name: string;
  phone_number?: string;
}): Promise<UserProfile> => {
  const res = await apiRequest<{ status: string; data: UserProfile }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  updateStoredUser(res.data);
  return res.data;
};

const appendImageToFormData = (
  formData: FormData,
  imageFile?: PickedImageFile | null,
  webFile?: File | null
) => {
  if (imageFile?.webFile) {
    formData.append('image', imageFile.webFile, imageFile.name);
  } else if (imageFile) {
    formData.append('image', {
      uri: imageFile.uri,
      name: imageFile.name,
      type: imageFile.type || 'image/jpeg',
    } as any);
  } else if (webFile) {
    formData.append('image', webFile, webFile.name);
  }
};

export const analyzeReportDraftApi = async (params: {
  imageFile?: PickedImageFile | null;
  webFile?: File | null;
  latitude: number | string;
  longitude: number | string;
  address?: string;
  description?: string;
  uploadImage?: boolean;
}): Promise<DraftAnalysisResponse> => {
  const formData = new FormData();
  appendImageToFormData(formData, params.imageFile, params.webFile);
  formData.append('latitude', String(params.latitude));
  formData.append('longitude', String(params.longitude));
  if (params.address) formData.append('address', params.address);
  if (params.description) formData.append('description', params.description);
  formData.append('upload_image', params.uploadImage === false ? 'false' : 'true');

  const res = await apiRequest<{
    status: string;
    message: string;
    data: DraftAnalysisResponse;
  }>('/api/reports/analyze', {
    method: 'POST',
    body: formData,
  });

  return res.data;
};

export const createReportApi = async (params: {
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  latitude: number | string;
  longitude: number | string;
  address?: string;
  image_url?: string | null;
  ai_analysis?: AiAnalysisMetadata | null;
  status?: string;
  imageFile?: PickedImageFile | null;
  webFile?: File | null;
}): Promise<ReportItem> => {
  if (params.imageFile || params.webFile) {
    const formData = new FormData();
    appendImageToFormData(formData, params.imageFile, params.webFile);
    formData.append('latitude', String(params.latitude));
    formData.append('longitude', String(params.longitude));
    if (params.title) formData.append('title', params.title);
    if (params.description) formData.append('description', params.description);
    if (params.category) formData.append('category', params.category);
    if (params.severity) formData.append('severity', params.severity);
    if (params.address) formData.append('address', params.address);
    if (params.image_url) formData.append('image_url', params.image_url);
    if (params.status) formData.append('status', params.status);
    if (params.ai_analysis) {
      formData.append('ai_analysis', JSON.stringify(params.ai_analysis));
    }

    const res = await apiRequest<{ status: string; data: ReportItem }>('/api/reports', {
      method: 'POST',
      body: formData,
    });
    return res.data;
  }

  const res = await apiRequest<{ status: string; data: ReportItem }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify({
      title: params.title,
      description: params.description,
      category: params.category,
      severity: params.severity,
      latitude: Number(params.latitude),
      longitude: Number(params.longitude),
      address: params.address,
      image_url: params.image_url,
      ai_analysis: params.ai_analysis,
      status: params.status,
    }),
  });
  return res.data;
};

export const fetchAllReportsApi = async (params?: {
  status?: string;
  category?: string;
  severity?: string;
  search?: string;
  sort?: 'newest' | 'priority';
  page?: number;
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.category) qs.set('category', params.category);
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.search) qs.set('search', params.search);
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));

  const queryString = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{
    status: string;
    data: ReportItem[];
    pagination: { total: number; page: number; limit: number; total_pages: number };
  }>(`/api/reports${queryString}`);
};

export interface ReverseGeocodeResponse {
  available: boolean;
  address: string | null;
  region?: string | null;
  source?: string;
}

export const reverseGeocodeApi = async (
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResponse> => {
  const qs = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });
  const res = await apiRequest<{ status: string; data: ReverseGeocodeResponse }>(
    `/api/reports/reverse-geocode?${qs.toString()}`
  );
  return res.data;
};

export const confirmDuplicateReportApi = async (
  reportId: string,
  notes?: string
): Promise<ReportItem> => {
  const res = await apiRequest<{ status: string; data: ReportItem }>(
    `/api/reports/${reportId}/confirm-duplicate`,
    {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }
  );
  return res.data;
};

export const fetchMyReportsApi = async (params?: {
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));

  const queryString = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{
    status: string;
    data: ReportItem[];
    pagination: { total: number; page: number; limit: number; total_pages: number };
  }>(`/api/reports/my-reports${queryString}`);
};

export const fetchReportDetailApi = async (id: string): Promise<ReportItem> => {
  const res = await apiRequest<{ status: string; data: ReportItem }>(`/api/reports/${id}`);
  return res.data;
};

export const updateReportApi = async (
  id: string,
  payload: Partial<{
    title: string;
    description: string;
    category: string;
    severity: string;
    address: string;
    status: string;
    status_notes: string;
  }>
): Promise<ReportItem> => {
  const res = await apiRequest<{ status: string; data: ReportItem }>(`/api/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
};

export const deleteReportApi = async (id: string) => {
  return apiRequest<{ status: string; message: string }>(`/api/reports/${id}`, {
    method: 'DELETE',
  });
};

export const routeReportToAuthorityApi = async (
  id: string,
  payload?: { authority_id?: string; notes?: string }
): Promise<ReportItem> => {
  const res = await apiRequest<{ status: string; data: ReportItem }>(
    `/api/reports/${id}/route`,
    {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }
  );
  return res.data;
};

export const formatStatusBadge = (status: string) => {
  const s = (status || 'submitted').toLowerCase();
  if (['routed', 'in_progress'].includes(s)) {
    return { label: 'Diproses', rawLabel: s.toUpperCase(), bg: '#FDE047', text: '#111827' };
  }
  if (['fixed', 'closed'].includes(s)) {
    return { label: 'Selesai', rawLabel: s.toUpperCase(), bg: '#86EFAC', text: '#111827' };
  }
  if (s === 'rejected') {
    return { label: 'Ditolak', rawLabel: 'REJECTED', bg: '#FCA5A5', text: '#111827' };
  }
  if (s === 'pending_review') {
    return { label: 'Perlu Tinjauan', rawLabel: 'PENDING REVIEW', bg: '#FDBA74', text: '#111827' };
  }
  return { label: 'Menunggu', rawLabel: s.toUpperCase(), bg: '#FFFFFF', text: '#111827' };
};

export const formatSeverityBadge = (severity?: string) => {
  const sev = (severity || 'medium').toLowerCase();
  if (sev === 'high') {
    return { label: 'Parah', bg: '#FF5E00', text: '#FFFFFF' };
  }
  if (sev === 'low') {
    return { label: 'Ringan', bg: '#D9F99D', text: '#111827' };
  }
  return { label: 'Sedang', bg: '#FDE047', text: '#111827' };
};

export const formatCategoryLabel = (category?: string) => {
  const map: Record<string, string> = {
    pothole: 'Lubang Jalan',
    crack: 'Retak Permukaan Jalan',
    surface_damage: 'Pengelupasan Aspal',
    sidewalk_damage: 'Kerusakan Trotoar',
    undamaged: 'Kondisi Jalan Normal',
  };
  return map[(category || '').toLowerCase()] || category || 'Kerusakan Jalan';
};

export const formatDateID = (isoString?: string) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
};

