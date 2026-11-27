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

const DEFAULT_API_URL = 'https://urusjakarta.alamsyah.net';
const JWT_EXPIRY_SKEW_MS = 30_000;

export class AuthSessionError extends Error {
  readonly isAuthError = true;

  constructor(message = 'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.') {
    super(message);
    this.name = 'AuthSessionError';
  }
}

export const isAuthSessionError = (err: unknown): err is AuthSessionError =>
  err instanceof AuthSessionError ||
  Boolean(err && typeof err === 'object' && (err as { isAuthError?: boolean }).isAuthError);

type AuthListener = (authenticated: boolean) => void;
const authListeners = new Set<AuthListener>();

export const subscribeAuthChange = (listener: AuthListener): (() => void) => {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
};

const notifyAuthListeners = (authenticated: boolean) => {
  for (const listener of authListeners) {
    try {
      listener(authenticated);
    } catch {
      // Abaikan error listener individual
    }
  }
};

const STORAGE_KEYS = {
  TOKEN: 'urusjakarta_token',
  USER: 'urusjakarta_user',
  AUTH_API_URL: 'urusjakarta_auth_api_url',
};

let memoryToken: string | null = null;
let memoryUser: UserProfile | null = null;
let memoryAuthApiUrl: string | null = null;

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

const clearStoredAuthData = (notify: boolean) => {
  memoryToken = null;
  memoryUser = null;
  memoryAuthApiUrl = null;
  setStorageItem(STORAGE_KEYS.TOKEN, null);
  setStorageItem(STORAGE_KEYS.USER, null);
  setStorageItem(STORAGE_KEYS.AUTH_API_URL, null);
  if (notify) {
    notifyAuthListeners(false);
  }
};

const decodeBase64UrlAscii = (segment: string): string | null => {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);

  if (typeof globalThis.atob === 'function') {
    try {
      return globalThis.atob(padded);
    } catch {
      return null;
    }
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < padded.length; i += 1) {
    const ch = padded[i];
    if (ch === '=') break;
    const val = alphabet.indexOf(ch);
    if (val === -1) return null;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
};

const isTokenInvalidOrExpired = (token: string): boolean => {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || !parts[1]) {
    return true;
  }
  const decoded = decodeBase64UrlAscii(parts[1]);
  if (!decoded) {
    return true;
  }
  try {
    const payload = JSON.parse(decoded) as { exp?: unknown };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return Date.now() >= payload.exp * 1000 - JWT_EXPIRY_SKEW_MS;
    }
    return false;
  } catch {
    return true;
  }
};

const hasMismatchedAuthApiUrl = (savedApiUrl: string | null): boolean =>
  Boolean(savedApiUrl && savedApiUrl.trim() !== getApiBaseUrl());

export const initAuthStorage = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    void getAuthToken();
    return;
  }
  try {
    const [token, userRaw, authApiUrl] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.USER),
      AsyncStorage.getItem(STORAGE_KEYS.AUTH_API_URL),
    ]);
    if (!token || isTokenInvalidOrExpired(token) || hasMismatchedAuthApiUrl(authApiUrl)) {
      if (token || userRaw || authApiUrl) {
        clearStoredAuthData(false);
      }
      return;
    }
    memoryToken = token;
    memoryAuthApiUrl = authApiUrl;
    if (userRaw) memoryUser = JSON.parse(userRaw) as UserProfile;
  } catch {
    // Abaikan jika gagal membaca AsyncStorage
  }
};

export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (
      protocol === 'http:' &&
      (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname))
    ) {
      return `http://${hostname}:5000`;
    }
    if (protocol === 'https:') {
      return window.location.origin.replace(/\/+$/, '');
    }
  }
  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (typeof extraApiUrl === 'string' && extraApiUrl.trim()) {
    return extraApiUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_API_URL;
};

export const getAuthToken = (): string | null => {
  const token = memoryToken ?? getStorageItem(STORAGE_KEYS.TOKEN);
  if (!token) {
    return null;
  }
  const savedAuthApiUrl = memoryAuthApiUrl ?? getStorageItem(STORAGE_KEYS.AUTH_API_URL);
  if (isTokenInvalidOrExpired(token) || hasMismatchedAuthApiUrl(savedAuthApiUrl)) {
    clearStoredAuthData(false);
    return null;
  }
  memoryToken = token;
  if (savedAuthApiUrl) {
    memoryAuthApiUrl = savedAuthApiUrl;
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
  const baseUrl = getApiBaseUrl();
  memoryToken = token;
  memoryUser = user;
  memoryAuthApiUrl = baseUrl;
  setStorageItem(STORAGE_KEYS.TOKEN, token);
  setStorageItem(STORAGE_KEYS.USER, JSON.stringify(user));
  setStorageItem(STORAGE_KEYS.AUTH_API_URL, baseUrl);
  notifyAuthListeners(true);
};

export const updateStoredUser = (user: UserProfile) => {
  memoryUser = user;
  setStorageItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

export const clearAuthSession = () => {
  clearStoredAuthData(true);
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
  if (imageUrl.includes('127.0.0.1:5000')) {
    return imageUrl.replace('http://127.0.0.1:5000', baseUrl);
  }
  return imageUrl;
};

const createApiHttpError = (
  status: number,
  message: string,
  hadToken: boolean,
  endpoint: string
): Error => {
  const isAuthCredentialEndpoint =
    endpoint.startsWith('/api/auth/login') || endpoint.startsWith('/api/auth/register');
  if (status === 401 && hadToken && !isAuthCredentialEndpoint) {
    clearAuthSession();
    return new AuthSessionError(
      'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.'
    );
  }
  return new Error(message);
};

const sendFormDataNative = <T>(
  url: string,
  endpoint: string,
  method: string,
  headers: Record<string, string>,
  hadToken: boolean,
  body: FormData,
  timeoutMs: number,
  externalSignal?: AbortSignal | null
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanupAbort = () => {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    };

    const finishError = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanupAbort();
      reject(err);
    };

    const onExternalAbort = () => {
      xhr.abort();
      finishError(new Error('Permintaan dibatalkan.'));
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        reject(new Error('Permintaan dibatalkan.'));
        return;
      }
      externalSignal.addEventListener('abort', onExternalAbort);
    }

    xhr.open(method, url);
    xhr.timeout = timeoutMs;

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== 'content-type' && value !== undefined) {
        xhr.setRequestHeader(key, value);
      }
    }

    xhr.onload = () => {
      if (settled) return;
      settled = true;
      cleanupAbort();

      let json: any = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }

      if (!json || typeof json !== 'object') {
        json = {
          status: 'error',
          message: `Respons server tidak valid (HTTP ${xhr.status})`,
        };
      }

      if (xhr.status < 200 || xhr.status >= 300 || json.status === 'error') {
        reject(
          createApiHttpError(
            xhr.status,
            json.message || `Permintaan gagal (HTTP ${xhr.status})`,
            hadToken,
            endpoint
          )
        );
        return;
      }

      resolve(json as T);
    };

    xhr.onerror = () => {
      finishError(
        new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.')
      );
    };

    xhr.ontimeout = () => {
      finishError(
        new Error('Unggahan melebihi batas waktu. Periksa koneksi internet atau perkecil ukuran foto.')
      );
    };

    xhr.onabort = () => {
      finishError(new Error('Permintaan dibatalkan.'));
    };

    xhr.send(body as any);
  });
};

const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<T> => {
  const baseUrl = getApiBaseUrl();
  const token = getAuthToken();
  const hadToken = Boolean(token);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const effectiveTimeout = timeoutMs ?? (isFormData ? 45000 : 20000);

  // Expo SDK 57 Winter fetch tidak mendukung objek { uri, name, type } pada FormData di native;
  // XMLHttpRequest React Native men-stream file:// dan content:// langsung melalui OkHttp.
  if (Platform.OS !== 'web' && isFormData) {
    return sendFormDataNative<T>(
      `${baseUrl}${endpoint}`,
      endpoint,
      (options.method || 'POST').toUpperCase(),
      headers,
      hadToken,
      options.body as FormData,
      effectiveTimeout,
      options.signal
    );
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timerId =
    controller && !options.signal
      ? setTimeout(() => controller.abort(), effectiveTimeout)
      : null;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal ?? controller?.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Koneksi ke server melebihi batas waktu. Periksa jaringan internet Anda.');
    }
    const msg = String(err?.message || '');
    if (
      err instanceof TypeError ||
      /network request failed|failed to fetch|fetch failed|network error/i.test(msg)
    ) {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    }
    throw new Error(msg || 'Gagal menghubungi server.');
  } finally {
    if (timerId) clearTimeout(timerId);
  }

  const json = await response.json().catch(() => ({
    status: 'error',
    message: `Respons server tidak valid (HTTP ${response.status})`,
  }));

  if (!response.ok || json.status === 'error') {
    throw createApiHttpError(
      response.status,
      json.message || `Permintaan gagal (${response.status})`,
      hadToken,
      endpoint
    );
  }

  return json as T;
};

const HEALTH_CACHE_TTL_MS = 10_000;
const REPORTS_CACHE_TTL_MS = 15_000;

interface HealthSummary {
  backendOnline: boolean;
  storageMode: string;
  aiOnline: boolean;
  modelLoaded: boolean;
}

interface ReportsListPayload {
  status: string;
  data: ReportItem[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

let cachedHealthEntry: { value: HealthSummary; expiresAt: number } | null = null;
let inFlightHealthRequest: Promise<HealthSummary> | null = null;

const reportsListCache = new Map<string, { value: ReportsListPayload; expiresAt: number }>();
const inFlightReportsRequests = new Map<string, Promise<ReportsListPayload>>();

export const invalidateReportsCache = () => {
  reportsListCache.clear();
  inFlightReportsRequests.clear();
};

export const checkSystemHealth = async (forceRefresh = false): Promise<HealthSummary> => {
  const now = Date.now();
  if (!forceRefresh && cachedHealthEntry && cachedHealthEntry.expiresAt > now) {
    return cachedHealthEntry.value;
  }
  if (!forceRefresh && inFlightHealthRequest) {
    return inFlightHealthRequest;
  }

  inFlightHealthRequest = (async () => {
    try {
      const res = await apiRequest<{
        status: string;
        message: string;
        storage_mode?: string;
        ai_service?: { available: boolean; model_loaded: boolean; url: string };
      }>('/api/health');
      const result: HealthSummary = {
        backendOnline: true,
        storageMode: res.storage_mode || 'supabase',
        aiOnline: Boolean(res.ai_service?.available),
        modelLoaded: Boolean(res.ai_service?.model_loaded),
      };
      cachedHealthEntry = { value: result, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS };
      return result;
    } catch {
      return {
        backendOnline: false,
        storageMode: 'offline',
        aiOnline: false,
        modelLoaded: false,
      };
    } finally {
      inFlightHealthRequest = null;
    }
  })();

  return inFlightHealthRequest;
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

export const uploadImageApi = async (
  imageFile: PickedImageFile
): Promise<{ url: string }> => {
  const formData = new FormData();
  appendImageToFormData(formData, imageFile);

  const res = await apiRequest<{
    status: string;
    message: string;
    data: { url: string };
  }>('/api/upload', {
    method: 'POST',
    body: formData,
  });

  return res.data;
};

export const analyzeReportDraftApi = async (params: {
  imageFile?: PickedImageFile | null;
  webFile?: File | null;
  latitude: number | string;
  longitude: number | string;
  address?: string;
  description?: string;
  imageUrl?: string | null;
  uploadImage?: boolean;
}): Promise<DraftAnalysisResponse> => {
  const formData = new FormData();
  appendImageToFormData(formData, params.imageFile, params.webFile);
  formData.append('latitude', String(params.latitude));
  formData.append('longitude', String(params.longitude));
  if (params.address) formData.append('address', params.address);
  if (params.description) formData.append('description', params.description);
  if (params.imageUrl) formData.append('image_url', params.imageUrl);
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
    invalidateReportsCache();
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
  invalidateReportsCache();
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
  forceRefresh?: boolean;
}): Promise<ReportsListPayload> => {
  const qs = new URLSearchParams();
  qs.set('status', params?.status || 'SEMUA');
  if (params?.category) qs.set('category', params.category);
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.search) qs.set('search', params.search);
  qs.set('sort', params?.sort || 'newest');
  qs.set('page', String(params?.page || 1));
  qs.set('limit', String(params?.limit || 50));

  const queryString = `?${qs.toString()}`;
  const now = Date.now();
  const cached = reportsListCache.get(queryString);
  if (!params?.forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }
  const existing = inFlightReportsRequests.get(queryString);
  if (!params?.forceRefresh && existing) {
    return existing;
  }

  const reqPromise = apiRequest<ReportsListPayload>(`/api/reports${queryString}`)
    .then((data) => {
      reportsListCache.set(queryString, {
        value: data,
        expiresAt: Date.now() + REPORTS_CACHE_TTL_MS,
      });
      return data;
    })
    .finally(() => {
      inFlightReportsRequests.delete(queryString);
    });

  inFlightReportsRequests.set(queryString, reqPromise);
  return reqPromise;
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
  invalidateReportsCache();
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
  invalidateReportsCache();
  return res.data;
};

export const deleteReportApi = async (id: string) => {
  const res = await apiRequest<{ status: string; message: string }>(`/api/reports/${id}`, {
    method: 'DELETE',
  });
  invalidateReportsCache();
  return res;
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
  invalidateReportsCache();
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

