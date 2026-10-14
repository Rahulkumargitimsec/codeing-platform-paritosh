import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionExpired } from './authSlice';
import api from '../lib/api';

export const store = configureStore({ reducer: { auth: authReducer } });

// If any request comes back 401 while we think we're logged in, the session expired
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.includes('/user/') && store.getState().auth.isAuthenticated) {
      store.dispatch(sessionExpired());
    }
    return Promise.reject(err);
  }
);
