import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import DropzonePage from './pages/dropzone';
import AnomaliesPage from './pages/anomalies';
import InsightsPage from './pages/insights';
import './styles/global.css';
import styles from './App.module.css';

function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>Profasee</div>
      <ul className={styles.links}>
        <li>
          <Link to="/" className={isActive('/') ? styles.active : ''}>
            Upload
          </Link>
        </li>
        <li>
          <Link to="/anomalies" className={isActive('/anomalies') ? styles.active : ''}>
            Anomalies
          </Link>
        </li>
        <li>
          <Link to="/insights" className={isActive('/insights') ? styles.active : ''}>
            Insights
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<DropzonePage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
          <Route path="/insights" element={<InsightsPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;