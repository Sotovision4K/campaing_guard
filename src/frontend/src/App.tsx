import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import DropzonePage from './pages/dropzone';
import AnomaliesPage from './pages/anomalies';
import InsightsPage from './pages/insights';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <nav className="app-nav">
        <div className="app-nav__brand">Profasee</div>
        <ul className="app-nav__links">
          <li><Link to="/">Upload</Link></li>
          <li><Link to="/anomalies">Anomalies</Link></li>
          <li><Link to="/insights">Insights</Link></li>
        </ul>
      </nav>
      <main className="app-main">
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
