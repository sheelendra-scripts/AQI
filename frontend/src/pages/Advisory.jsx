import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Heart, AlertTriangle, Wind, Activity, Thermometer,
  Eye, Baby, UserCheck, Dumbbell, Zap, Sun, CloudRain,
  CheckCircle, XCircle, Info, Clock, RefreshCw
} from 'lucide-react';
import { useLiveData } from '../hooks/useData';

/* ── AQI data ─────────────────────────────────────── */
const AQI_LEVELS = [
  { max: 50,  label: 'Good',       color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   emoji: '🌿', text: '#15803d' },
  { max: 100, label: 'Satisfactory', color: '#84cc16', bg: 'rgba(132,204,22,0.08)', border: 'rgba(132,204,22,0.25)', emoji: '☀️', text: '#4d7c0f' },
  { max: 200, label: 'Moderate',   color: '#b45309', bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.3)',   emoji: '⚠️', text: '#92400e' },
  { max: 300, label: 'Poor',       color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.3)',  emoji: '🟠', text: '#c2410c' },
  { max: 400, label: 'Very Poor',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   emoji: '🔴', text: '#b91c1c' },
  { max: 999, label: 'Severe',     color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.3)',  emoji: '🚨', text: '#5b21b6' },
];

function getLevel(aqi) {
  return AQI_LEVELS.find(l => aqi <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

/* ── Activity cards ──────────────────────────────── */
const ACTIVITIES = [
  { label: 'Running', icon: Activity, okUpto: 100 },
  { label: 'Cycling', icon: Wind, okUpto: 100 },
  { label: 'Walking', icon: UserCheck, okUpto: 200 },
  { label: 'Children Outdoors', icon: Baby, okUpto: 150 },
  { label: 'Gym Outdoors', icon: Dumbbell, okUpto: 100 },
  { label: 'Schools Open', icon: Eye, okUpto: 200 },
];

/* ── Profiles ───────────────────────────────────── */
const PROFILES = [
  { key: 'general',  label: 'General',    icon: Shield },
  { key: 'children', label: 'Children',   icon: Baby },
  { key: 'elderly',  label: 'Elderly',    icon: Heart },
  { key: 'athlete',  label: 'Athletes',   icon: Dumbbell },
  { key: 'asthma',   label: 'Asthma/COPD', icon: Wind },
  { key: 'pregnant', label: 'Pregnant',   icon: UserCheck },
];

const PROFILE_ADVICE = {
  general: [
    { max: 50,  dos: ['Enjoy outdoor activities freely', 'Open windows for ventilation', 'Great time for morning walks'], donts: [] },
    { max: 100, dos: ['Moderate outdoor activity is fine', 'Monitor for unusual symptoms', 'Keep windows open'], donts: ['Avoid prolonged strenuous exercise if sensitive'] },
    { max: 200, dos: ['Stay indoors during peak hours', 'Use air purifiers if available', 'Stay hydrated'], donts: ['Avoid prolonged outdoor exertion', 'Do not exercise near roads'] },
    { max: 300, dos: ['Wear N95 mask outdoors', 'Keep all windows/doors shut', 'Use air purifiers', 'Check indoor AQI'], donts: ['Avoid outdoor exercise', 'Do not open windows', 'Avoid busy roads'] },
    { max: 999, dos: ['Seal gaps around windows with damp cloth', 'Stay in rooms with air purifiers', 'Wear N95 even indoors if possible'], donts: ['DO NOT go outdoors', 'Avoid any physical exertion', 'Do not open windows or doors'] },
  ],
  children: [
    { max: 50,  dos: ['Outdoor play is safe and encouraged', 'Physical education can proceed', 'Parks and playgrounds are fine'], donts: [] },
    { max: 100, dos: ['Outdoor play is generally fine', 'Shorter sessions outdoors preferred', 'Monitor if child has allergies'], donts: ['Avoid long outdoor sports if child has asthma'] },
    { max: 200, dos: ['Move play indoors', 'Keep school windows closed', 'Ensure sufficient water intake'], donts: ['No outdoor PE classes', 'Avoid playgrounds near roads', 'Do not allow long outdoor sessions'] },
    { max: 300, dos: ['School should cancel all outdoor activities', 'Use air purifiers in classrooms', 'Face masks for any outdoor exposure'], donts: ['No outdoor activities of any kind', 'Avoid opening school windows', 'No sports events'] },
    { max: 999, dos: ['Keep children strictly indoors', 'Use HEPA air purifiers continuously', 'Emergency medications readily available'], donts: ['NO outdoor exposure', 'Schools should close or go online', 'No outdoor travel'] },
  ],
  elderly: [
    { max: 50,  dos: ['Light outdoor walks recommended', 'Morning exercises are safe', 'Enjoy the fresh air'], donts: [] },
    { max: 100, dos: ['Light activities are fine', 'Keep medications handy as precaution', 'Short walks are okay'], donts: ['Avoid strenuous outdoor exercise'] },
    { max: 200, dos: ['Stay primarily indoors', 'Take regular breaks in fresh indoor air', 'Stay well hydrated'], donts: ['Avoid outdoor exercise', 'Do not walk near traffic', 'Avoid peak pollution hours (8–10am, 6–9pm)'] },
    { max: 300, dos: ['Remain indoors entirely', 'Use air purifiers', 'Wear N95 if any outdoor need is unavoidable', 'Have emergency contacts handy'], donts: ['No outdoor exposure', 'Avoid exertion even indoors', 'Do not travel by road without N95'] },
    { max: 999, dos: ['Health emergency protocol', 'Contact doctor or hospital if breathing difficulty', 'Use supplemental oxygen if prescribed'], donts: ['Absolutely no outdoor exposure', 'No strenuous activity', 'Do not delay medical attention'] },
  ],
  athlete: [
    { max: 50,  dos: ['Peak training conditions', 'All outdoor workouts are safe', 'Best time for long runs or rides'], donts: [] },
    { max: 100, dos: ['Moderate outdoor training is fine', 'Warm up properly', 'Stay hydrated'], donts: ['Avoid maximum intensity intervals outdoors'] },
    { max: 200, dos: ['Move training indoors', 'Use gym or indoor tracks', 'Maintain hydration and recovery focus'], donts: ['No outdoor intense workouts', 'Avoid running near roads', 'Skip races or outdoor events'] },
    { max: 300, dos: ['Indoor training only with air purification', 'Reduce training load', 'Focus on recovery and strength'], donts: ['No outdoor workouts', 'No competitions', 'Avoid HIIT outdoors'] },
    { max: 999, dos: ['Rest completely', 'Focus on nutrition and recovery', 'Indoor stretching only if needed'], donts: ['No training of any kind outdoors', 'Avoid cardio even indoors if air is ingressing', 'Skip all outdoor events'] },
  ],
  asthma: [
    { max: 50,  dos: ['Normal outdoor activity is safe', 'Carry inhaler as routine', 'Great conditions for breathing'], donts: [] },
    { max: 100, dos: ['Light-moderate outdoor activity is fine', 'Always carry rescue inhaler', 'Monitor peak flow if available'], donts: ['Avoid prolonged outdoor exertion', 'Avoid areas with smoke or dust'] },
    { max: 200, dos: ['Use prescribed controller medications', 'Keep reliever inhaler accessible at all times', 'Use air purifier at home', 'Monitor symptoms closely'], donts: ['No outdoor exercise', 'Avoid allergen-rich areas', 'Do not skip any scheduled doses'] },
    { max: 300, dos: ['Stay strictly indoors', 'Use nebulizer or spacer if prescribed', 'Contact doctor if symptoms worsen', 'Air purifier running continuously'], donts: ['No outdoor exposure', 'Avoid any physical exertion', 'Do not go near smoke, dust, or chemical sources'] },
    { max: 999, dos: ['Medical emergency preparedness', 'Have emergency plan in place', 'Go to hospital if rescue inhaler not controlling symptoms', 'Call doctor proactively'], donts: ['ZERO outdoor exposure', 'No physical activity', 'Do not ignore any deterioration in breathing'] },
  ],
  pregnant: [
    { max: 50,  dos: ['Light outdoor walks are beneficial', 'Prenatal yoga outdoors is fine', 'Fresh air is good for you and baby'], donts: [] },
    { max: 100, dos: ['Short gentle walks are okay', 'Stay in green/park areas away from traffic', 'Stay well hydrated'], donts: ['Avoid traffic-heavy areas', 'No prolonged outdoor exercise in heat'] },
    { max: 200, dos: ['Limit outdoor time significantly', 'Use indoor exercise alternatives', 'Wear light mask if going out', 'Check with your OB-GYN if concerned'], donts: ['No outdoor physical exercise', 'Avoid areas near construction or traffic', 'Do not walk in peak hours'] },
    { max: 300, dos: ['Stay indoors entirely', 'Air purifier in sleeping/living area', 'N95 mask if any outdoor travel is necessary', 'Inform your OB-GYN about exposure'], donts: ['No outdoor activities', 'Avoid any pollution exposure', 'Do not travel by road without protection'] },
    { max: 999, dos: ['Consult OB-GYN immediately if any respiratory symptoms', 'HEPA air purifiers in all rooms', 'Seek hospital-grade advice on air quality exposure'], donts: ['Absolutely no outdoor exposure', 'Avoid travel during severe episode', 'Do not ignore any symptoms'] },
  ],
};

function getProfileAdvice(profile, aqi) {
  const levels = PROFILE_ADVICE[profile];
  return levels.find(l => aqi <= l.max) || levels[levels.length - 1];
}

/* ── Pollutant health info ───────────────────────── */
const POLLUTANT_INFO = [
  {
    key: 'pm25', label: 'PM 2.5', unit: 'µg/m³',
    safe: 25, moderate: 60, severe: 120,
    color: '#f97316',
    health: 'Fine particles penetrate deep into lungs, causing inflammation, reduced lung function, and cardiovascular stress.',
    tips: ['Wear N95 masks (not surgical) which filter PM2.5', 'HEPA air purifiers are highly effective against PM2.5', 'Avoid outdoor exercise when levels are elevated'],
  },
  {
    key: 'co', label: 'Carbon Monoxide', unit: 'mg/m³',
    safe: 1.0, moderate: 3.0, severe: 6.0,
    color: '#8b5cf6',
    health: 'CO binds to haemoglobin, reducing oxygen delivery to organs. High levels cause headache, dizziness and in extreme cases, fatality.',
    tips: ['Ensure gas appliances are serviced regularly', 'Never run engines in enclosed spaces', 'CO detectors are essential for indoor monitoring'],
  },
  {
    key: 'no2', label: 'Nitrogen Dioxide', unit: 'ppm',
    safe: 0.04, moderate: 0.08, severe: 0.15,
    color: '#0ea5e9',
    health: 'NO₂ irritates airways, aggravates asthma and can cause chronic lung disease with long-term exposure.',
    tips: ['Avoid staying near roads during traffic peaks', 'Keep car windows up in traffic jams', 'Indoor plants like spider plants can help absorb some NO₂'],
  },
  {
    key: 'tvoc', label: 'VOC (TVOC)', unit: 'ppm',
    safe: 0.2, moderate: 0.5, severe: 1.0,
    color: '#b45309',
    health: 'Volatile organic compounds cause eye, nose and throat irritation. Long-term exposure links to liver damage and some cancers.',
    tips: ['Ventilate rooms after using paints, adhesives or cleaning products', 'Avoid freshly painted rooms for 48 hours', 'Activated carbon filters help with TVOC indoors'],
  },
];

function PollutantBar({ value, safe, moderate, severe, color }) {
  const max = severe * 1.5;
  const pct = Math.min(100, (value / max) * 100);
  const status = value <= safe ? 'Safe' : value <= moderate ? 'Elevated' : 'High';
  const statusColor = value <= safe ? '#22c55e' : value <= moderate ? '#b45309' : '#ef4444';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 5 }}>
        <span style={{ color: '#6b7280' }}>Current: <b style={{ color }}>{value}</b></span>
        <span style={{ fontWeight: 700, color: statusColor }}>{status}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#9ca3af', marginTop: 3 }}>
        <span>Safe ≤{safe}</span><span>Moderate ≤{moderate}</span><span>High &gt;{moderate}</span>
      </div>
    </div>
  );
}

/* ── Source info ─────────────────────────────────── */
const SOURCE_INFO = {
  vehicle:      { icon: '🚗', color: '#6366f1', title: 'Vehicle Exhaust Dominant', tips: ['Avoid walking along busy roads', 'Use side streets or parks for outdoor activity', 'Close car windows in heavy traffic', 'Prefer metro/bus over 2-wheelers during peak hours'] },
  industrial:   { icon: '🏭', color: '#64748b', title: 'Industrial Emissions Detected', tips: ['Stay away from factory-adjacent areas', 'Report unusual smoke or chemical smell to CPCB helpline (1800-11-4999)', 'Keep windows closed facing industrial direction', 'Avoid evening walks downwind of industrial zones'] },
  construction: { icon: '🏗️', color: '#d97706', title: 'Construction Dust Elevated', tips: ['Avoid passing through active construction zones', 'Wear N95 mask near building sites', 'Keep windows shut in dust-prone areas', 'Wash face and rinse nose after outdoor exposure'] },
  biomass:      { icon: '🔥', color: '#dc2626', title: 'Biomass Burning Detected', tips: ['Avoid areas with visible smoke or haze', 'Biomass burning peaks in evenings — limit outdoor time then', 'Do not add to burning (waste, leaves)', 'Report illegal crop/waste burning: 1800-11-4999'] },
  mixed:        { icon: '🌫️', color: '#78716c', title: 'Mixed Pollution Sources', tips: ['Multiple sources contributing — limit outdoor exposure', 'HEPA air purifier highly recommended indoors', 'Check CPCB-SAFAR for hourly zone updates', 'Mask recommended for outdoor trips even short ones'] },
};

/* ── AQI Gauge ───────────────────────────────────── */
function AqiGauge({ aqi }) {
  const level = getLevel(aqi);
  const pct = Math.min(100, (aqi / 500) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        background: `conic-gradient(${level.color} ${pct * 3.6}deg, rgba(0,0,0,0.06) 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          width: 90, height: 90, borderRadius: '50%', background: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: level.color, lineHeight: 1 }}>{aqi}</span>
          <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>AQI</span>
        </div>
      </div>
      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: level.text }}>{level.label}</span>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────── */
export default function AdvisoryPage() {
  const { data, loading, refetch } = useLiveData();
  const [profile, setProfile]     = useState('general');

  const aqi    = data?.aqi    || 0;
  const source = data?.source_detected || null;
  const level  = getLevel(aqi);
  const advice = getProfileAdvice(profile, aqi);

  const cardStyle = {
    background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(14px)',
    borderRadius: 18, border: '1px solid rgba(16,185,129,0.1)',
    boxShadow: '0 2px 20px rgba(0,0,0,0.04)',
    padding: '22px 26px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.75rem',
            background: 'linear-gradient(135deg, #064e3b, #047857)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Health Advisory
          </h1>
          <p style={{ margin: '6px 0 0', color: '#78716c', fontSize: '0.9rem' }}>
            Personalised guidance based on live air quality data
          </p>
        </div>
        <button onClick={refetch} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)',
          background: 'rgba(16,185,129,0.06)', cursor: 'pointer',
          fontSize: '0.82rem', fontWeight: 600, color: '#065f46',
        }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </motion.div>

      {/* AQI Status Banner */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        style={{ ...cardStyle, background: level.bg, border: `1.5px solid ${level.border}`, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <AqiGauge aqi={aqi} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: level.text, marginBottom: 6 }}>
              {level.emoji} {aqi <= 50 ? 'Air quality is excellent today' :
                aqi <= 100 ? 'Air quality is acceptable' :
                aqi <= 200 ? 'Moderate — reduce outdoor exposure' :
                aqi <= 300 ? 'Poor — avoid outdoor activities' :
                aqi <= 400 ? 'Very poor — health risk for everyone' :
                'Severe — health emergency'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
              {[
                { ok: aqi <= 200, yes: '✓ No Mask Needed', no: '😷 N95 Mask Required' },
                { ok: aqi <= 100, yes: '🏃 Outdoor Safe', no: '🏠 Stay Indoors' },
                { ok: aqi <= 150, yes: '🪟 Open Windows', no: '🚪 Keep Windows Shut' },
              ].map(({ ok, yes, no }, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: 999, fontWeight: 600, fontSize: '0.82rem',
                  background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: ok ? '#15803d' : '#b91c1c',
                  border: `1px solid ${ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  {ok ? yes : no}
                </span>
              ))}
            </div>
            {data && (
              <div style={{ marginTop: 12, fontSize: '0.78rem', color: '#9ca3af' }}>
                Last updated: {new Date(data.timestamp).toLocaleTimeString()} &nbsp;·&nbsp;
                PM2.5: <b style={{ color: '#f97316' }}>{data.pm25} µg/m³</b> &nbsp;·&nbsp;
                CO: <b style={{ color: '#8b5cf6' }}>{data.co} mg/m³</b> &nbsp;·&nbsp;
                NO₂: <b style={{ color: '#0ea5e9' }}>{data.no2} ppm</b>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Profile Selector */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 10 }}>Select Your Profile</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PROFILES.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setProfile(key)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
              borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem',
              background: profile === key
                ? 'linear-gradient(135deg, #065f46, #047857)'
                : 'rgba(255,255,255,0.7)',
              color: profile === key ? '#fff' : '#6b7280',
              backdropFilter: 'blur(8px)',
              boxShadow: profile === key ? '0 4px 12px rgba(6,95,70,0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.2s',
            }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Do's & Don'ts */}
      <AnimatePresence mode="wait">
        <motion.div key={`${profile}-${aqi}`}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ delay: 0.05 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Do's */}
          <div style={{ ...cardStyle, borderTop: '3px solid #22c55e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CheckCircle size={18} color="#22c55e" />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#064e3b' }}>Do's</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {advice.dos.length === 0
                ? <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No special precautions needed.</p>
                : advice.dos.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#22c55e', fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: '0.87rem', color: '#374151', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))
              }
            </div>
          </div>
          {/* Don'ts */}
          <div style={{ ...cardStyle, borderTop: '3px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <XCircle size={18} color="#ef4444" />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#991b1b' }}>Don'ts</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {advice.donts.length === 0
                ? <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No restrictions — enjoy the clean air!</p>
                : advice.donts.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#ef4444', fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✕</span>
                    <span style={{ fontSize: '0.87rem', color: '#374151', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Activity Safety */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 12 }}>Activity Safety Guide</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
          {ACTIVITIES.map(({ label, icon: Icon, okUpto }) => {
            const safe = aqi <= okUpto;
            return (
              <div key={label} style={{
                ...cardStyle, padding: '16px 18px', textAlign: 'center',
                borderTop: `3px solid ${safe ? '#22c55e' : '#ef4444'}`,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, margin: '0 auto 10px',
                  background: safe ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} color={safe ? '#22c55e' : '#ef4444'} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: safe ? '#15803d' : '#b91c1c' }}>
                  {safe ? '✓ Safe' : '✕ Avoid'}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Pollutant Breakdown */}
      {data && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 12 }}>Pollutant Health Impact</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {POLLUTANT_INFO.map(p => (
              <div key={p.key} style={{ ...cardStyle, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: p.color }}>{p.label}</span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{p.unit}</span>
                </div>
                <PollutantBar
                  value={data[p.key] || 0}
                  safe={p.safe} moderate={p.moderate} severe={p.severe}
                  color={p.color}
                />
                <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '10px 0 8px', lineHeight: 1.5 }}>{p.health}</p>
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 8 }}>
                  {p.tips.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span style={{ color: p.color, flexShrink: 0 }}>·</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.4 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Source-specific panel */}
      {source && source !== 'unknown' && SOURCE_INFO[source] && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div style={{
            ...cardStyle,
            borderLeft: `4px solid ${SOURCE_INFO[source].color}`,
            background: `${SOURCE_INFO[source].color}08`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: '1.5rem' }}>{SOURCE_INFO[source].icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: SOURCE_INFO[source].color }}>
                  {SOURCE_INFO[source].title}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
                  Detected by ML model · Source-specific advice below
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {SOURCE_INFO[source].tips.map((tip, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '10px 14px',
                  fontSize: '0.83rem', color: '#374151', lineHeight: 1.5,
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <Info size={13} color={SOURCE_INFO[source].color} style={{ marginTop: 2, flexShrink: 0 }} />
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* CPCB AQI Scale reference */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 12 }}>CPCB National AQI Scale</div>
        <div style={{
          ...cardStyle, padding: '16px 20px',
          display: 'flex', flexWrap: 'wrap', gap: 8,
        }}>
          {AQI_LEVELS.map(l => (
            <div key={l.label} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
              borderRadius: 10, background: l.bg, border: `1px solid ${l.border}`,
              flex: '1 1 140px',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: l.text }}>{l.label}</div>
                <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>≤{l.max === 999 ? '500+' : l.max}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  );
}
