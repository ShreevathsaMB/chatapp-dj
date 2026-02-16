import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  CircularProgress,
  Alert,
  Popover,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import { chatApi } from '../services/api';
import { websocketService } from '../services/websocket';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ChatRoom.css';

const ChatRoom = ({ roomId }) => {
  const [messageList, setMessageList] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const roomRef = useRef(null); // Use ref to avoid stale closures in handlers
  const messageListRef = useRef([]); // Use ref to avoid stale closures
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const response = await chatApi.getChatRoom(roomId);
      setRoom(response.data);
      roomRef.current = response.data; // Update ref
      setError(null);
    } catch (error) {
      console.error('Error fetching room:', error);
      setError('Failed to load chat room');
    }
  }, [roomId]);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await chatApi.getMessages(roomId);
      setMessageList(response.data);
      messageListRef.current = response.data; // Update ref
      setError(null);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const handleAuthError = useCallback(() => {
    console.log('Authentication error detected');
    setError('Authentication failed. Please log in again.');
    setWsConnected(false);
    // Clear the session
    logout();
    // Redirect to login
    navigate('/login');
  }, [logout, navigate]);

  const handleWebSocketError = useCallback((event) => {
    console.log('WebSocket error:', event.detail?.message);
    setError(event.detail?.message || 'Connection error occurred');
    setWsConnected(false);
  }, []);

  useEffect(() => {
    // Listen for WebSocket errors
    window.addEventListener('websocket-auth-error', handleAuthError);
    window.addEventListener('websocket-error', handleWebSocketError);

    return () => {
      window.removeEventListener('websocket-auth-error', handleAuthError);
      window.removeEventListener('websocket-error', handleWebSocketError);
    };
  }, [handleAuthError, handleWebSocketError]);

  const connectWebSocket = useCallback(() => {
    try {
      if (!user) {
        handleAuthError();
        return () => { };
      }

      console.log('Connecting to WebSocket for room:', roomId);
      websocketService.connect(roomId);

      // Add WebSocket connection status handler
      const onOpen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        setError(null);
      };

      const onClose = (event) => {
        console.log('WebSocket disconnected with code:', event.code);
        setWsConnected(false);
        if (event.code === 4001) {
          handleAuthError();
        }
      };

      const onError = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      websocketService.socket?.addEventListener('open', onOpen);
      websocketService.socket?.addEventListener('close', onClose);
      websocketService.socket?.addEventListener('error', onError);

      const messageHandler = (data) => {
        console.log('Received message handler in room:', roomId);
        const newMessage = {
          id: data.message_id,
          text: data.message,
          sender: { id: data.user_id, username: data.username },
          timestamp: data.timestamp,
          is_read: false,
          read_by: []
        };

        setMessageList(prev => {
          // Check if message already exists to avoid duplicates from re-connections or races
          if (prev.some(m => m.id === data.message_id)) return prev;
          const newList = [...prev, newMessage];
          messageListRef.current = newList;
          return newList;
        });

        // Mark received messages as read
        if (data.user_id !== user.id) {
          websocketService.sendReadStatus(data.message_id);
        }
      };

      const typingHandler = (data) => {
        if (data.user_id === user.id) return;

        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (data.is_typing) {
            newSet.add(data.username);
          } else {
            newSet.delete(data.username);
          }
          return newSet;
        });
      };

      const readHandler = (data) => {
        const currentRoom = roomRef.current;
        if (!currentRoom || !currentRoom.users) {
          console.warn('Received read status before room data was loaded');
          return;
        }
        setMessageList(prev => {
          const newList = prev.map(msg => {
            if (msg.id === data.message_id) {
              if (msg.read_by.some(reader => reader.id === data.user_id)) {
                return msg;
              }
              const updatedReadBy = [...msg.read_by, { id: data.user_id, username: data.username }];
              const allUsersRead = currentRoom.users.every(user =>
                updatedReadBy.some(reader => reader.id === user.id)
              );
              return {
                ...msg,
                is_read: allUsersRead,
                read_by: updatedReadBy
              };
            }
            return msg;
          });
          messageListRef.current = newList;
          return newList;
        });
      };
      const unMessage = websocketService.onMessage(messageHandler);
      const unTyping = websocketService.onTyping(typingHandler);
      const unRead = websocketService.onRead(readHandler);

      return () => {
        console.log('Cleaning up WebSocket for room:', roomId);
        websocketService.socket?.removeEventListener('open', onOpen);
        websocketService.socket?.removeEventListener('close', onClose);
        websocketService.socket?.removeEventListener('error', onError);
        unMessage();
        unTyping();
        unRead();
        websocketService.disconnect();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setError('Failed to establish real-time connection');
      return () => { };
    }
  }, [roomId, user, handleAuthError]); // Removed room from dependencies

  useEffect(() => {
    fetchRoom();
    fetchMessages();
    const cleanup = connectWebSocket();
    return () => {
      if (cleanup) cleanup();
      websocketService.disconnect();
    };
  }, [roomId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messageList]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !wsConnected) {
      console.log('Cannot send message:', { newMessage, wsConnected });
      return;
    }

    try {
      console.log('Sending message:', newMessage);
      websocketService.sendMessage(newMessage);
      setNewMessage('');
      setError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please check your connection.');
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!wsConnected) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing status
    websocketService.sendTypingStatus(true);

    // Set timeout to stop typing status
    typingTimeoutRef.current = setTimeout(() => {
      websocketService.sendTypingStatus(false);
    }, 1000);
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAddMember = async (userId) => {
    try {
      setAddMemberLoading(true);
      await chatApi.addMember(roomId, userId);
      await fetchRoom();
      setAddMemberDialogOpen(false);
    } catch (error) {
      console.error('Error adding member:', error);
      setError('Failed to add member');
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await chatApi.removeMember(roomId, userId);
      await fetchRoom();
    } catch (error) {
      console.error('Error removing member:', error);
      setError('Failed to remove member');
    }
  };

  const handleDeleteGroup = async () => {
    if (window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      try {
        await chatApi.deleteChatRoom(roomId);
        navigate('/');
      } catch (error) {
        console.error('Error deleting group:', error);
        setError('Failed to delete group');
      }
    }
  };

  const openAddMemberDialog = async () => {
    setAddMemberDialogOpen(true);
    try {
      const response = await chatApi.getUsers();
      // Filter out users already in the room
      const roomUserIds = new Set(room.users.map(u => u.id));
      setAvailableUsers(response.data.filter(u => !roomUserIds.has(u.id)));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  if (loading) {
    return (
      <Box className="loading-container">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="chat-container">
      <Paper className="chat-paper">
        <Box className="chat-header">
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, px: 2 }}>
            <Box className="user-profile-header">
              <Avatar sx={{ mr: 1, bgcolor: 'secondary.main', width: 32, height: 32 }}>
                {user.username[0].toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', lineHeight: 1, color: 'text.secondary' }}>
                  Logged in as
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  {user.username}
                </Typography>
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 2, height: 24, alignSelf: 'center' }} />
            <Typography variant="h6" className="chat-header-title">
              {room?.name || room?.users.map(u => u.username).join(', ')}
            </Typography>
            <Chip
              icon={<GroupIcon />}
              label={`${room?.users?.length || 0} users`}
              onClick={handleClick}
              sx={{ ml: 2, cursor: 'pointer' }}
            />
            {room?.admin?.id === user.id && (
              <Chip
                label="You are Admin"
                color="primary"
                size="small"
                sx={{ ml: 1 }}
              />
            )}
            {!wsConnected && (
              <Typography className="chat-status connecting-text">
                <CircularProgress size={16} color="inherit" /> Connecting...
              </Typography>
            )}
          </Box>
        </Box>

        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          <Box sx={{ p: 2, minWidth: 250 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              Users in this chat
            </Typography>
            <List dense>
              {room?.users?.map((u) => (
                <ListItem
                  key={u.id}
                  secondaryAction={
                    room?.admin?.id === user.id && u.id !== user.id && (
                      <IconButton edge="end" aria-label="remove" onClick={() => handleRemoveMember(u.id)}>
                        <PersonRemoveIcon color="error" />
                      </IconButton>
                    )
                  }
                >
                  <ListItemAvatar>
                    <Avatar>{u.username[0].toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={u.id === user.id ? `${u.username} (You)` : u.username}
                    secondary={u.id === room.admin?.id ? 'Admin' : 'Member'}
                  />
                </ListItem>
              ))}
            </List>
            {room?.admin?.id === user.id && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={openAddMemberDialog}
                  fullWidth
                >
                  Add Member
                </Button>
                {room.is_group_chat && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteGroup}
                    fullWidth
                  >
                    Delete Group
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </Popover>

        <Dialog open={addMemberDialogOpen} onClose={() => setAddMemberDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Add Member</DialogTitle>
          <DialogContent>
            <List sx={{ pt: 0 }}>
              {availableUsers.length === 0 ? (
                <Typography sx={{ p: 2, textAlign: 'center' }}>No users available</Typography>
              ) : (
                availableUsers.map((u) => (
                  <ListItem key={u.id}>
                    <ListItemAvatar>
                      <Avatar>{u.username[0].toUpperCase()}</Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={u.username} />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleAddMember(u.id)}
                      disabled={addMemberLoading}
                    >
                      Add
                    </Button>
                  </ListItem>
                ))
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddMemberDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {error && (
          <Alert severity="error" className="error-alert">
            {error}
          </Alert>
        )}

        <Box className="messages-container">
          <List className="message-list">
            {messageList.map((message) => (
              <ListItem
                key={message.id}
                className={`message-item ${message.sender.id === user.id ? 'message-own' : ''}`}
                sx={{ alignItems: 'flex-start' }}
              >
                {message.sender.id !== user.id && (
                  <ListItemAvatar>
                    <Avatar className="message-avatar">
                      {message.sender.username[0].toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                )}
                <ListItemText
                  primary={
                    <Typography className="message-content">
                      {message.text}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString()}
                      {message.sender.id === user.id && (
                        <span className="read-status">
                          {message.is_read ? (
                            <DoneAllIcon className="read-icon read" />
                          ) : (
                            <DoneIcon className="read-icon" />
                          )}
                        </span>
                      )}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
          {typingUsers.size > 0 && (
            <Typography className="typing-indicator">
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </Typography>
          )}
          <div ref={messagesEndRef} />
        </Box>

        <Box component="form" onSubmit={handleSendMessage} className="input-container">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              className="message-input"
              fullWidth
              placeholder="Type a message..."
              value={newMessage}
              onChange={handleTyping}
              disabled={!wsConnected}
              variant="outlined"
              size="small"
            />
            <IconButton
              type="submit"
              disabled={!wsConnected || !newMessage.trim()}
              className="send-button"
            >
              <SendIcon className="send-icon" />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatRoom; 