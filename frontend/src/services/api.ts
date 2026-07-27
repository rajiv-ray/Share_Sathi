import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';

// 1. Create a centralized Axios instance pointing to your FastAPI backend
const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1', 
});

// 2. Add an Interceptor to automatically inject the JWT token securely
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Check if a token exists in the browser's local storage
    const token = localStorage.getItem('access_token');
    
    // If it exists, append it to the Authorization header
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 3. Add a response interceptor to handle expired tokens globally
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // If the backend rejects a token (e.g., 401 Unauthorized), log the user out
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token');
      // Forcefully redirect the user back to the login page
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;