import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Register from './pages/Register';
import Login from './pages/Login';
import Profile from './pages/Profile';
import HomePage from './pages/HomePage';
import MainPage from './pages/MainPage';
import { io } from 'socket.io-client';

export default function App() {
  const socket = useRef(null);

  useEffect(() => {
    // initialize one persistent socket for the whole app
    socket.current = io(import.meta.env.VITE_BACKEND_URL, { withCredentials: true });

    // register current user if logged in
    const userId = localStorage.getItem('userId');
    if (userId) {
      socket.current.emit('registerUser', userId);
    }

    return () => {
      socket.current.disconnect();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage socket={socket} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/homepage" element={<HomePage socket={socket} />} />
      </Routes>
    </Router>
  );
}
