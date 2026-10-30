import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_BASE.replace(/\/api\/v1\/?$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  constructor(message, { status, code, details, errors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.errors = errors || [];
  }
}

function toApiError(error) {
  if (error instanceof ApiError) return error;
  const response = error.response;
  const data = response?.data || {};
  return new ApiError(
    data.message || error.message || 'Something went wrong. Please try again.',
    { status: response?.status, code: data.code, details: data.details, errors: data.errors }
  );
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const isAuthRoute = String(config?.url || '').includes('/auth/');
    if (error.response?.status === 401 && config && !config._retried && !isAuthRoute) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        setAccessToken(null);
      }
    }
    return Promise.reject(toApiError(error));
  }
);

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true, timeout: 15000 })
      .then((response) => {
        setAccessToken(response.data.data.accessToken);
        return response.data.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function readData(promise) {
  const response = await promise;
  return response.data.data;
}

export async function readEnvelope(promise) {
  const response = await promise;
  return response.data;
}

export function errorMessage(error) {
  if (!error) return '';
  if (error.errors?.length) return error.errors.map((row) => row.message).join(', ');
  return error.message || 'Something went wrong.';
}
