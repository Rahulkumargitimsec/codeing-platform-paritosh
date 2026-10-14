import axios from 'axios';

// In development Vite proxies /api to the backend (see vite.config.js).
// For a separate deployment set VITE_API_BASE_URL to the backend URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Turn any axios error into a sentence a person can act on
export const errorMessage = (err, fallback = 'Something went wrong. Try again.') => {
  if (!err) return fallback;
  const data = err.response?.data;
  if (typeof data === 'string' && data.trim()) {
    if (data.trim().startsWith('<')) return fallback;
    return data.replace(/^(Error:\s*)+/i, '');
  }
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  if (err.code === 'ERR_NETWORK' || (!err.response && err.request)) {
    return "Can't reach the server. Make sure the backend is running on port 4000.";
  }
  if (err.response?.status === 502 || err.response?.status === 504) {
    return "Can't reach the server. Make sure the backend is running on port 4000.";
  }
  return err.message || fallback;
};

export default api;
