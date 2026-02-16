import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Container, Typography } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import ChatRoomList from './components/ChatRoomList';
import ChatRoom from './components/ChatRoom';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

const ChatLayout = () => {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const { user } = useAuth();

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <ChatRoomList onSelectRoom={setSelectedRoom} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedRoom ? (
          <ChatRoom roomId={selectedRoom.id} />
        ) : (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              bgcolor: 'grey.100',
            }}
          >
            <Typography variant="h6" color="text.secondary">
              Select a chat room or start a new conversation
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Container maxWidth={false} disableGutters sx={{ height: '100vh' }}>
          <Routes future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Route path="/login" element={<Login />} />
            <Route
              path="/chat"
              element={
                <PrivateRoute>
                  <ChatLayout />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/chat" replace />} />
          </Routes>
        </Container>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
