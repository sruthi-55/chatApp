import api from './axios';

export const searchUser = async (username) => {
  const token = localStorage.getItem('token');
  const res = await api.get(`/api/user/search/${username}`, {
    params: { username },
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

