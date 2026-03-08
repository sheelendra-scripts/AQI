import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import Analytics from './pages/Analytics';
import Advisory from './pages/Advisory';
import Admin from './pages/Admin';
import MLInsights from './pages/MLInsights';
import AlertsPage from './pages/AlertsPage';
import Landing from './pages/Landing';
import './styles/globals.css';

function Particles() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${10 + i * 16}%`,
            animationDelay: `${i * 2.5}s`,
            animationDuration: `${12 + i * 3}s`,
            width: `${3 + (i % 3)}px`,
            height: `${3 + (i % 3)}px`,
            bottom: '-10px',
          }}
        />
      ))}
    </>
  );
}

function AppShell() {
  const location = useLocation();
  const isLanding = location.pathname === '/landing';

  if (isLanding) {
    return (
      <Routes>
        <Route path="/landing" element={<Landing />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Particles />
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/ml" element={<MLInsights />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/advisory" element={<Advisory />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
