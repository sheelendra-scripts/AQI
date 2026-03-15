import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Shield, FileText, Wind,
  Menu, X, Leaf, Activity, Map, Brain, Bell, Factory
} from 'lucide-react';
import { useLiveData } from '../hooks/useData';
import NotificationBell from './NotificationBell';

const navItems = [
  { path: '/landing', label: 'Home', icon: Leaf },
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/map', label: 'Ward Map', icon: Map },
  { path: '/wind', label: 'Wind Analysis', icon: Wind },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/ml', label: 'ML Insights', icon: Brain },
  { path: '/plume', label: 'Plume Map', icon: Factory },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/advisory', label: 'Health Advisory', icon: Shield },
  { path: '/admin', label: 'Admin Panel', icon: FileText },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data } = useLiveData();
  const location = useLocation();

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo-icon" style={{ width: 36, height: 36, borderRadius: 10 }}>
            <Leaf size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--forest-800)' }}>
            AQMS
          </span>
        </div>
        <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo + notification bell */}
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-logo-icon">
              <Leaf size={22} color="white" />
            </div>
            <div className="sidebar-logo-text">
              <h1>AQMS</h1>
              <span>Air Quality Intelligence</span>
            </div>
          </div>
          <NotificationBell />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Live status indicator */}
        <div className="sidebar-status">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span className={`status-dot ${data ? '' : 'offline'}`} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: data ? 'var(--forest-700)' : 'var(--earth-500)' }}>
              {data ? 'Live — Sensor Active' : 'Connecting...'}
            </span>
          </div>
          {data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--earth-500)' }}>
              <Activity size={12} />
              <span>AQI {data.aqi} · {data.aqi_category}</span>
            </div>
          )}
          <div style={{ fontSize: '0.7rem', color: 'var(--earth-400)', marginTop: 6 }}>
            Ward 01 — Sensor Node
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
            zIndex: 99, backdropFilter: 'blur(4px)'
          }}
        />
      )}
    </>
  );
}
