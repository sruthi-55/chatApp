import React, { useEffect, useState } from 'react';
import api from '../api/axios';

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get('/user/me')
      .then(res => setUser(res.data))
      .catch(err => console.error(err));
  }, []);

  if (!user) return <p>Loading...</p>;

  return (
    <div>
      <h2>Profile</h2>
      <p>Username: {user.username}</p>
      <p>Email: {user.email}</p>
      <p>Full Name: {user.full_name}</p>
    </div>
  );
}
