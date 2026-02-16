import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import { chatApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import UserProfile from './UserProfile';
import '../styles/ChatRoomList.css';

const ChatRoomList = ({ onSelectRoom }) => {
  const [rooms, setRooms] = useState([]);
  const [open, setOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const { user, logout } = useAuth();
  const [error, setError] = useState(null);

  const fetchRooms = async () => {
    try {
      const response = await chatApi.getChatRooms();
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await chatApi.getUsers();
      setAvailableUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleDialogOpen = async () => {
    setOpen(true);
    await fetchUsers();
  };

  const handleDialogClose = () => {
    setOpen(false);
    setRoomName('');
    setUsername('');
    setSelectedUsers([]);
  };

  const handleCreateRoom = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setDialogLoading(true);
      const response = await chatApi.createChatRoom({
        name: roomName || null,
        users: [...selectedUsers, user.id],
        is_group_chat: true
      });
      const newRoom = response.data;
      setRooms(prev => [...prev, newRoom]);
      handleDialogClose();
      onSelectRoom(newRoom);
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    try {
      await chatApi.deleteChatRoom(roomId);
      setRooms(prev => prev.filter(room => room.id !== roomId));
    } catch (error) {
      console.error('Error deleting room:', error);
    }
  };

  const getRoomName = (room) => {
    if (room.name) return room.name;
    const otherUsers = room.users?.filter(u => u.id !== user?.id) || [];
    return otherUsers.map(u => u.username).join(', ');
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="chat-room-list">
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleDialogOpen}
          fullWidth
        >
          New Chat
        </Button>
      </Box>
      <Divider />
      <List className="room-list">
        {rooms.map((room) => (
          <ListItem
            key={room.id}
            button
            onClick={() => onSelectRoom(room)}
            className="room-item"
          >
            <ListItemAvatar>
              <Avatar className="room-avatar">
                {room.name ? room.name[0].toUpperCase() : room.users
                  .filter(u => u.id !== user.id)
                  .map(u => u.username[0].toUpperCase())
                  .join('')}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={room.name || room.users
                .filter(u => u.id !== user.id)
                .map(u => u.username)
                .join(', ')}
              secondary={
                <Typography variant="body2" color="text.secondary">
                  {room.last_message?.text || 'No messages yet'}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>

      <Dialog
        open={open}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Start New Chat</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Room Name (Optional)"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              fullWidth
              disabled={dialogLoading}
            />
            <Typography variant="subtitle2" color="textSecondary">
              Select Users to Chat With:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {availableUsers.map((availableUser) => (
                <Button
                  key={availableUser.id}
                  variant={selectedUsers.includes(availableUser.id) ? "contained" : "outlined"}
                  size="small"
                  onClick={() => {
                    setSelectedUsers(prev =>
                      prev.includes(availableUser.id)
                        ? prev.filter(id => id !== availableUser.id)
                        : [...prev, availableUser.id]
                    );
                  }}
                  disabled={dialogLoading}
                >
                  {availableUser.username}
                </Button>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={dialogLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateRoom}
            variant="contained"
            disabled={selectedUsers.length === 0 || dialogLoading}
          >
            {dialogLoading ? <CircularProgress size={24} /> : 'Create Chat'}
          </Button>
        </DialogActions>
      </Dialog>
      <UserProfile />
    </Box>
  );
};

export default ChatRoomList; 