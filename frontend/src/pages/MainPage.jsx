import { Link } from 'react-router-dom';
import styles from './MainPage.module.css';

export default function MainPage(){
  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <h1 className={styles.title}>Welcome to chatApp</h1>
        
        <div className={styles.actions}>
          <Link to="/login" className={styles.btn}>Login</Link>
          <Link to="/register" className={styles.btnSecondary}>Register</Link>
        </div>
      </div>
    </div>
  );
}