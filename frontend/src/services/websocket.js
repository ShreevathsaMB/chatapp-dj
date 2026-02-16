class WebSocketService {
  constructor() {
    this.socket = null;
    this.messageHandlers = new Set();
    this.typingHandlers = new Set();
    this.readHandlers = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    // Backend URL and port for WebSocket - use development default
    this.backendUrl = process.env.NODE_ENV === 'production'
      ? window.location.host
      : `${window.location.hostname}:8000`;
  }

  getAuthToken() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No JWT token found in localStorage');
      return null;
    }
    return token;
  }

  connect(roomId) {
    try {
      // Clean up existing socket if any
      this.disconnect();

      const token = this.getAuthToken();
      console.log('Attempting connection with auth token:', token ? 'Found' : 'Not found');

      if (!token) {
        console.error('No authentication token found. User might not be logged in.');
        const errorEvent = new CustomEvent('websocket-auth-error', {
          detail: { message: 'Authentication required. Please log in.' }
        });
        window.dispatchEvent(errorEvent);
        return;
      }

      // Create WebSocket URL with authentication
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${this.backendUrl}/ws/chat/${roomId}/?token=${token}`;
      console.log('Attempting WebSocket connection to:', wsUrl);

      this.socket = new WebSocket(wsUrl);
      this.reconnectAttempts = 0;

      this.socket.onopen = () => {
        console.log('WebSocket connection established successfully');
        this.reconnectAttempts = 0; // Reset attempts on successful connection

        // Send an initial ping to verify connection
        this.sendPing();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received:', data.type, data);

          switch (data.type) {
            case 'message':
              this.messageHandlers.forEach(handler => handler(data));
              break;
            case 'typing':
              this.typingHandlers.forEach(handler => handler(data));
              break;
            case 'read':
              this.readHandlers.forEach(handler => handler(data));
              break;
            case 'error':
              console.error('Server error:', data.message);
              this.handleError(data.message);
              break;
            case 'pong':
              console.log('Connection verified with server');
              break;
            default:
              console.warn('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error processing message:', error);
          this.handleError('Failed to process message');
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handleError('Connection error occurred');
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket closed with code:', event.code);

        switch (event.code) {
          case 1000: // Normal closure
            console.log('Connection closed normally');
            break;
          case 1006: // Abnormal closure
            console.error('Connection closed abnormally with code:', event.code, 'attempting to reconnect');
            this.handleReconnect(roomId);
            break;
          case 4001: // Custom code for auth failure
          case 4401:
            console.error('Authentication failed with code:', event.code);
            const authErrorEvent = new CustomEvent('websocket-auth-error', {
              detail: { message: 'Authentication failed. Please log in again.' }
            });
            window.dispatchEvent(authErrorEvent);
            break;
          case 4403:
            console.error('Access denied');
            this.handleError('You do not have access to this chat room');
            break;
          default:
            console.error('Connection closed with code:', event.code);
            this.handleReconnect(roomId);
        }
      };

    } catch (error) {
      console.error('Error in connect:', error);
      this.handleError('Failed to establish connection');
    }
  }

  handleError(message) {
    console.error('WebSocket error:', message);
    const errorEvent = new CustomEvent('websocket-error', {
      detail: { message }
    });
    window.dispatchEvent(errorEvent);
  }

  sendPing() {
    try {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    } catch (error) {
      console.warn('Failed to send ping:', error);
    }
  }

  handleReconnect(roomId) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        console.log('Attempting reconnection...');
        this.connect(roomId);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.handleError('Failed to reconnect after maximum attempts');
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      // Remove all existing listeners to prevent memory leaks
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;

      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close(1000, 'Disconnecting normally');
      }
      this.socket = null;
    }
  }

  sendMessage(message) {
    if (!this.socket) {
      console.error('Cannot send message: WebSocket is not connected');
      throw new Error('WebSocket is not connected');
    }

    if (this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket connection is not open. Current state:', this.socket.readyState);
      throw new Error('WebSocket connection is not open');
    }

    try {
      const messageData = {
        type: 'message',
        message
      };
      console.log('Sending message:', messageData);
      this.socket.send(JSON.stringify(messageData));
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  sendTypingStatus(isTyping) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({
          type: 'typing',
          is_typing: isTyping
        }));
      } catch (error) {
        console.error('Error sending typing status:', error);
      }
    }
  }

  sendReadStatus(messageId) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({
          type: 'read',
          message_id: messageId
        }));
      } catch (error) {
        console.error('Error sending read status:', error);
      }
    }
  }

  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onTyping(handler) {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  onRead(handler) {
    this.readHandlers.add(handler);
    return () => this.readHandlers.delete(handler);
  }
}

// Create a singleton instance
export const websocketService = new WebSocketService();
