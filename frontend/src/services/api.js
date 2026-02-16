import axios from 'axios';

const API_BASE_URL = `http://${window.location.hostname}:8000/api`;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor to add auth token and handle CSRF
api.interceptors.request.use(config => {
  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Add CSRF token if available
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];

  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });

      // Return a more detailed error message
      const errorMessage = error.response.data.detail ||
        error.response.data.message ||
        error.response.data.error ||
        (typeof error.response.data === 'string' ? error.response.data : null) ||
        'An error occurred';

      return Promise.reject(new Error(errorMessage));
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Request error:', error.request);
      return Promise.reject(new Error('No response from server. Please check your connection.'));
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
      return Promise.reject(error);
    }
  }
);

export const chatApi = {
  // Auth operations
  getCsrfToken: () => api.get('/csrf/'),
  getCurrentUser: () => api.get('/users/me/'),

  // User operations
  getUsers: () => api.get('/users/'),
  createUser: (data) => api.post('/users/', data),
  updateUser: (userId, data) => api.patch(`/users/${userId}/`, data),

  // Chat room operations
  getChatRooms: () => api.get('/chat-rooms/'),
  getChatRoom: (roomId) => api.get(`/chat-rooms/${roomId}/`),
  createChatRoom: (data) => api.post('/chat-rooms/', data),
  updateChatRoom: (roomId, data) => api.patch(`/chat-rooms/${roomId}/`, data),
  deleteChatRoom: (roomId) => api.delete(`/chat-rooms/${roomId}/`),
  addMember: (roomId, userId) => api.post(`/chat-rooms/${roomId}/add_member/`, { user_id: userId }),
  removeMember: (roomId, userId) => api.post(`/chat-rooms/${roomId}/remove_member/`, { user_id: userId }),

  // Message operations
  getMessages: (roomId) => api.get(`/chat-rooms/${roomId}/messages/`),
  sendMessage: (roomId, data) => api.post(`/chat-rooms/${roomId}/messages/`, data),
  updateMessage: (messageId, data) => api.patch(`/messages/${messageId}/`, data),
  deleteMessage: (messageId) => api.delete(`/messages/${messageId}/`),
  markMessageAsRead: (messageId) => api.post(`/messages/${messageId}/read/`),
};

export default chatApi; 