// frontend/src/services/api.ts
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

// frontend/src/services/api.ts
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const requestUrl = error.config?.url || '';
    
    // Only logout and redirect if a 401 comes from Share Sathi's own endpoints, NOT MeroShare
    if (error.response && error.response.status === 401 && !requestUrl.includes('/meroshare/')) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// ==========================================
// MeroShare Automation Interfaces & API
// ==========================================

export interface MeroShareCredentials {
  dp_id: string;
  username: string;
  password: string;
}

export interface DPOption {
  id: string;
  code: string;
  name: string;
}

export interface MeroShareSyncResponse {
  message: string;
  total_scripts_synced: number;
}

export interface TransactionUpdate {
  price: number;
}

export const meroshareApi = {
  /**
   * Fetches the list of all Depository Participants (DPs) 
   * to populate the dropdown menu in the frontend.
   */
  getCapitals: async (): Promise<DPOption[]> => {
    const response = await api.get('/meroshare/capitals');
    return response.data;
  },

  /**
   * Sends the user's MeroShare credentials to the backend 
   * to automate the fetching and saving of portfolio holdings.
   */
  syncPortfolio: async (credentials: MeroShareCredentials): Promise<MeroShareSyncResponse> => {
    const response = await api.post('/meroshare/sync', credentials);
    return response.data;
  },
};

export const portfolioApi = {
  updateTransactionPrice: async (id: number, data: TransactionUpdate) => {
    const response = await api.put(`/portfolio/${id}`, data);
    return response.data;
  }
};

export const analyticsApi = {
  getPortfolioAdvice: async (): Promise<{ advice: string }> => {
    const response = await api.get('/analytics/portfolio-advice');
    return response.data;
  }
};

export default api;