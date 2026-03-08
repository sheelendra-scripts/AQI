import React from 'react';
import { Shield, Heart, AlertTriangle, Baby, PersonStanding } from 'lucide-react';
import { motion } from 'framer-motion';

function getCategoryClass(aqi) {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'satisfactory';
  if (aqi <= 200) return 'moderate';
  if (aqi <= 300) return 'poor';
  if (aqi <= 400) return 'verypoor';
  return 'severe';
}

function getAdvisory(aqi) {
  if (aqi <= 50) return {
    title: '🌿 Air Quality is Excellent',
    general: ['Perfect conditions for outdoor activities', 'Great day to go for a walk or jog', 'No precautions needed'],
    vulnerable: ['No restrictions. Enjoy the fresh air!'],
    mask: false,
    outdoor: true,
  };
  if (aqi <= 100) return {
    title: '☀️ Air Quality is Acceptable',
    general: ['Air quality is acceptable for most people', 'Sensitive individuals should watch for symptoms', 'Good day for moderate outdoor activity'],
    vulnerable: ['People with respiratory conditions may experience mild discomfort', 'Monitor breathing if you have asthma'],
    mask: false,
    outdoor: true,
  };
  if (aqi <= 200) return {
    title: '⚠️ Moderate — Reduce Outdoor Exposure',
    general: ['Reduce prolonged outdoor exertion', 'Keep windows closed during peak pollution hours', 'Consider indoor exercise instead', 'Stay hydrated'],
    vulnerable: ['Children & elderly should limit outdoor activity', 'Asthmatics should carry inhalers', 'Use air purifiers at home if available'],
    mask: true,
    outdoor: false,
  };
  if (aqi <= 300) return {
    title: '🔴 Poor — Avoid Outdoor Activities',
    general: ['Avoid outdoor exercise and physical labour', 'Wear N95 mask if going outside', 'Keep all windows and doors shut', 'Use air purifiers at home'],
    vulnerable: ['Stay indoors entirely', 'Keep emergency medications accessible', 'Schools should cancel outdoor PE classes', 'Seek medical help if breathing difficulty occurs'],
    mask: true,
    outdoor: false,
  };
  return {
    title: '🚨 SEVERE — Health Emergency',
    general: ['STAY INDOORS — This is a health emergency', 'Wear N95 mask if any outdoor exposure unavoidable', 'Avoid all physical exertion outdoors', 'Seal windows with wet cloth to prevent dust entry'],
    vulnerable: ['DO NOT go outdoors under any circumstances', 'Seek medical help for breathing difficulty', 'Schools must remain closed', 'Emergency medical services on alert'],
    mask: true,
    outdoor: false,
  };
}

export default function HealthAdvisory({ aqi = 0, source = null }) {
  const advisory = getAdvisory(aqi);
  const catClass = getCategoryClass(aqi);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Title banner */}
      <div className={`glass-card advisory-card ${catClass}`}>
        <div className="advisory-title">{advisory.title}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.82rem', padding: '4px 12px',
            background: advisory.mask ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
            borderRadius: 999, color: advisory.mask ? '#ef4444' : '#22c55e',
            fontWeight: 600,
          }}>
            {advisory.mask ? '😷 Mask Recommended' : '✓ No Mask Needed'}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.82rem', padding: '4px 12px',
            background: advisory.outdoor ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            borderRadius: 999, color: advisory.outdoor ? '#22c55e' : '#ef4444',
            fontWeight: 600,
          }}>
            {advisory.outdoor ? '🏃 Outdoor Safe' : '🏠 Stay Indoors'}
          </span>
        </div>
      </div>

      {/* General population */}
      <div className="glass-card">
        <div className="section-title">
          <Shield size={18} /> General Population
        </div>
        <ul className="advisory-list">
          {advisory.general.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Vulnerable groups */}
      <div className="glass-card">
        <div className="section-title">
          <Heart size={18} style={{ color: '#ef4444' }} /> Vulnerable Groups
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--earth-400)', marginBottom: 8 }}>
          Children · Elderly · Pregnant Women · Asthma/COPD Patients
        </div>
        <ul className="advisory-list">
          {advisory.vulnerable.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Source-specific */}
      {source && source !== 'unknown' && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--amber-500)' }}>
          <div className="section-title">
            <AlertTriangle size={18} style={{ color: 'var(--amber-500)' }} /> Source-Specific Warning
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--earth-600)' }}>
            {source === 'construction' && 'Construction dust has been detected in your area. Avoid walking near building sites and keep windows shut.'}
            {source === 'vehicle' && 'Vehicle exhaust is the primary pollution source. Avoid busy roads and consider public transport.'}
            {source === 'biomass' && 'Biomass burning detected nearby. Avoid areas with visible smoke or haze, especially in the evening.'}
            {source === 'industrial' && 'Industrial emissions detected. Stay away from factory zones and report unusual smoke or odour.'}
          </p>
        </div>
      )}
    </motion.div>
  );
}
