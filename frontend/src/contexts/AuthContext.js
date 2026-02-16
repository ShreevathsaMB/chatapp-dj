import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Configure axios defaults
  axios.defaults.baseURL = `http://${window.location.hostname}:8000`;

  // Add request interceptor to add token to all requests
  axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  const login = async (username, password) => {
    try {
      console.log('Attempting login...');

      // Configure axios for this request
      const response = await axios.post('/api/token/', {
        username,
        password,
      }, {
        baseURL: `http://${window.location.hostname}:8000`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 5000, // 5 second timeout
      });

      console.log('Login response:', response.data);

      const { access, refresh } = response.data;
      localStorage.setItem('token', access);
      localStorage.setItem('refreshToken', refresh);

      // Get user data after successful login
      const userResponse = await axios.get('/api/user/', {
        headers: { Authorization: `Bearer ${access}` }
      });
      setUser(userResponse.data);

      return true;
    } catch (error) {
      console.error('Login error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
    navigate('/login');
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return false;
      }

      const response = await axios.get('/api/user/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      if (error.response?.status === 401) {
        // Try to refresh the token
        const refreshed = await refreshToken();
        if (!refreshed) {
          logout();
          return false;
        }
        return true;
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      const refresh = localStorage.getItem('refreshToken');
      if (!refresh) {
        return false;
      }

      const response = await axios.post('/api/token/refresh/', {
        refresh,
      });

      const { access } = response.data;
      localStorage.setItem('token', access);

      // Get user data with new token
      const userResponse = await axios.get('/api/user/', {
        headers: { Authorization: `Bearer ${access}` }
      });
      setUser(userResponse.data);
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated && window.location.pathname !== '/login') {
        navigate('/login');
      }
    };
    initAuth();
  }, [navigate]);

  const value = {
    user,
    login,
    logout,
    loading,
    checkAuth,
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 