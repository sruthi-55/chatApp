import axios from 'axios';          // to make http req from frontend to backend

console.log(import.meta.env.VITE_BACKEND_URL)
// customize instance - global configs
const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api`,     // backend URL with /api prefix
});


// run this code before every request (request interceptor)
// or after every response (response interceptor)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;       // adds auth header to http req
  }
  return config;      // returns config 
});

export default api;
