import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api, { errorMessage } from '../lib/api';

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/user/register', data);
    return res.data.user;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't create the account"));
  }
});

export const loginUser = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/user/login', data);
    return res.data.user;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't log in"));
  }
});

export const checkAuth = createAsyncThunk('auth/check', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/user/check');
    return data.user;
  } catch (err) {
    // 401 just means "not logged in"; anything else means the server is unreachable
    const status = err.response?.status;
    return rejectWithValue(status === 401 || status === 403 ? null : errorMessage(err));
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try { await api.post('/user/logout'); } catch { /* clear locally either way */ }
  return null;
});

export const deleteAccount = createAsyncThunk('auth/delete', async (_, { rejectWithValue }) => {
  try {
    await api.delete('/user/deleteProfile');
    return null;
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    initialized: false, // first session check finished
    submitting: false, // login / signup in flight
    error: null,
    serverError: null, // backend unreachable on first load
  },
  reducers: {
    clearAuthError: (state) => { state.error = null; },
    sessionExpired: (state) => { state.user = null; state.isAuthenticated = false; },
  },
  extraReducers: (b) => {
    const pending = (state) => { state.submitting = true; state.error = null; };
    const fulfilled = (state, action) => {
      state.submitting = false;
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    };
    const rejected = (state, action) => {
      state.submitting = false;
      state.error = action.payload || 'Something went wrong';
    };
    b.addCase(registerUser.pending, pending).addCase(registerUser.fulfilled, fulfilled).addCase(registerUser.rejected, rejected)
      .addCase(loginUser.pending, pending).addCase(loginUser.fulfilled, fulfilled).addCase(loginUser.rejected, rejected)
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.initialized = true;
        state.serverError = null;
        state.user = action.payload;
        state.isAuthenticated = !!action.payload;
      })
      .addCase(checkAuth.rejected, (state, action) => {
        state.initialized = true;
        state.serverError = action.payload || null;
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(logoutUser.fulfilled, (state) => { state.user = null; state.isAuthenticated = false; })
      .addCase(deleteAccount.fulfilled, (state) => { state.user = null; state.isAuthenticated = false; });
  },
});

export const { clearAuthError, sessionExpired } = authSlice.actions;
export default authSlice.reducer;
