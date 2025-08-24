import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';        
import Register from './pages/Register';
import Login from './pages/Login';
import Profile from './pages/Profile';
import HomePage from './pages/HomePage';
import MainPage from './pages/MainPage';

export default function App() {
  return (
    <Router>  {/* BrowserRouter enables navigation without full page reloads */}
      <Routes>
        {/* defines mapping b/w url and component */}
        <Route path="/" element={<MainPage />} />
        <Route path="/register" element={<Register />} /> 
        <Route path="/login" element={<Login />} />


        <Route path="/profile" element={<Profile />} />
        <Route path="/homepage" element={<HomePage />} />
      </Routes>
    </Router>
  );
}

