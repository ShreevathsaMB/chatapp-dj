import React, { useState } from 'react';
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    Popover,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    Button,
    TextField,
    CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EmailIcon from '@mui/icons-material/Email';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../contexts/AuthContext';
import { chatApi } from '../services/api';

const UserProfile = () => {
    const { user, logout, login } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editForm, setEditForm] = useState({
        username: user.username,
        email: user.email || '',
    });

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
        setIsEditing(false);
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await chatApi.updateUser('me', editForm);
            // We need to update the local user state in AuthContext
            // If AuthContext doesn't have an update method, we might need a workaround 
            // or just refresh the page since the token is still valid
            window.location.reload();
        } catch (error) {
            console.error('Error updating profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const open = Boolean(anchorEl);

    return (
        <Box className="user-profile-sidebar">
            <Box
                onClick={handleClick}
                sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    borderTop: '1px solid #eee',
                }}
            >
                <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
                    {user.username[0].toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                    <Typography variant="subtitle2" noWrap fontWeight="bold">
                        {user.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {user.email || 'No email set'}
                    </Typography>
                </Box>
                <LogoutIcon fontSize="small" color="action" />
            </Box>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <Box sx={{ p: 3, width: 300 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Account Settings</Typography>
                        {!isEditing && (
                            <IconButton size="small" onClick={() => setIsEditing(true)}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        )}
                    </Box>

                    {isEditing ? (
                        <Box component="form" onSubmit={handleUpdateProfile}>
                            <TextField
                                fullWidth
                                label="Username"
                                size="small"
                                margin="dense"
                                value={editForm.username}
                                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                required
                            />
                            <TextField
                                fullWidth
                                label="Email"
                                size="small"
                                margin="dense"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                required
                            />
                            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="small"
                                    startIcon={loading ? <CircularProgress size={16} /> : <CheckIcon />}
                                    disabled={loading}
                                    fullWidth
                                >
                                    Save
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<CloseIcon />}
                                    onClick={() => setIsEditing(false)}
                                    disabled={loading}
                                    fullWidth
                                >
                                    Cancel
                                </Button>
                            </Box>
                        </Box>
                    ) : (
                        <List dense>
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: 40 }}><AccountCircleIcon fontSize="small" /></ListItemIcon>
                                <ListItemText primary="Username" secondary={user.username} />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: 40 }}><EmailIcon fontSize="small" /></ListItemIcon>
                                <ListItemText primary="Email Address" secondary={user.email || 'Not set'} />
                            </ListItem>
                            <Divider sx={{ my: 1 }} />
                            <ListItem button onClick={handleLogout} sx={{ color: 'error.main' }}>
                                <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                                <ListItemText primary="Logout" />
                            </ListItem>
                        </List>
                    )}
                </Box>
            </Popover>
        </Box>
    );
};

export default UserProfile;
