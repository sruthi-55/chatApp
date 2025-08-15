import { useState } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';


export default function Login() {
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({
    usernameOrEmail: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  function handleChange(event){
    setLoginData({
      ...loginData,
      [event.target.name]: event.target.value
    });
  }

  function handleReset(){
    setLoginData({
      usernameOrEmail: '',
      password: ''
    });
    setError('');
  }
  
  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/api/auth/login', loginData);
      localStorage.setItem('token', res.data.token);
      navigate('/api/homepage');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }


  return (
    <form onSubmit={handleSubmit} className={styles["container"]}>
      <h2 className={styles["title"]}>User Login</h2>

      {error && <p className={styles["error-text"]}>{error}</p>}

      
      <div className={styles["form-group"]}>
        <label htmlFor="usernameOrEmail">Username / Email</label>
        <input
          type="text"
          name="usernameOrEmail"
          id="usernameOrEmail"
          value={loginData.usernameOrEmail}
          onChange={handleChange}
          required
        />
      </div>

      
      <div className={styles["form-group"]}>
        <label htmlFor="password">Password</label>
        <input
          type="password"
          name="password"
          id="password"
          value={loginData.password}
          onChange={handleChange}
          required
        />
      </div>

      <div className={styles["button-group"]}>
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <button type="reset" onClick={handleReset} className={`${styles.button} ${styles["cancel-btn"]}`}>Cancel</button>
      </div>
    </form>
  );

}