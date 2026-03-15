import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from 'framer-motion';
import {
  Wind, Activity, Shield, Brain, Map, Bell,
  BarChart3, FileText, Leaf, ArrowRight, Wifi,
  TrendingUp, Zap, ChevronDown, ArrowUpRight, Minus, Eye,
} from 'lucide-react';
import { useLiveData } from '../hooks/useData';

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */
function aqiColor(aqi) {
  if (!aqi) return '#64748b';
  if (aqi <= 50) return '#22c55e'; if (aqi <= 100) return '#84cc16';
  if (aqi <= 200) return '#b45309'; if (aqi <= 300) return '#f97316';
  return '#ef4444';
}
function aqiBand(aqi) {
  if (!aqi) return 'N/A';
  if (aqi <= 50) return 'Good'; if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate'; if (aqi <= 300) return 'Poor';
  return 'Severe';
}

/* ═══════════════════════════════════════════════════════
   GRAIN OVERLAY — cinematic film noise
   ═══════════════════════════════════════════════════════ */
function Grain() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
      opacity: 0.035, mixBlendMode: 'overlay',
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat', backgroundSize: 256,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════
   SCROLL PROGRESS BAR
   ═══════════════════════════════════════════════════════ */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  return (
    <motion.div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 3,
      background: 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)',
      transformOrigin: '0%', scaleX, zIndex: 10000,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════
   TEXT REVEAL — word-by-word on scroll into view
   ═══════════════════════════════════════════════════════ */
function RevealText({ children, style = {}, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const text = typeof children === 'string' ? children : '';
  const words = text.split(' ');
  return (
    <span ref={ref} style={{ display: 'inline', ...style }}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: 'inline-block', overflow: 'hidden', marginRight: '0.3em' }}>
          <motion.span
            initial={{ y: '110%', rotate: 3 }}
            animate={inView ? { y: 0, rotate: 0 } : {}}
            transition={{ duration: 0.7, delay: delay + wi * 0.04, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'inline-block' }}
          >{word}</motion.span>
        </span>
      ))}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   MAGNETIC BUTTON — follows cursor on hover
   ═══════════════════════════════════════════════════════ */
function MagneticButton({ children, onClick, style = {}, accent = false }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const handleMouse = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setPos({ x: (e.clientX - cx) * 0.25, y: (e.clientY - cy) * 0.25 });
  };
  return (
    <motion.button ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: accent ? '16px 40px' : '14px 28px',
        borderRadius: 60, cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
        letterSpacing: '-0.01em', border: 'none',
        background: accent ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
        color: accent ? '#fff' : '#d1fae5',
        boxShadow: accent ? '0 8px 40px rgba(16,185,129,0.35)' : 'none',
        ...(accent ? {} : { border: '1px solid rgba(255,255,255,0.15)' }),
        transition: 'box-shadow 0.3s', ...style,
      }}
    >{children}</motion.button>
  );
}

/* ═══════════════════════════════════════════════════════
   INFINITE MARQUEE
   ═══════════════════════════════════════════════════════ */
function Marquee({ items, speed = 32, reverse = false }) {
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', padding: '14px 0' }}>
      <motion.div
        animate={{ x: reverse ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'inline-flex', gap: 48 }}
      >
        {[...items, ...items].map((t, i) => (
          <span key={i} style={{
            fontSize: 'clamp(0.85rem, 1.2vw, 1rem)', fontWeight: 600,
            color: 'rgba(255,255,255,0.12)', letterSpacing: '0.1em',
            textTransform: 'uppercase', fontFamily: 'var(--font-display)',
          }}>{t}</span>
        ))}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COUNTER — animates 0 → value on scroll
   ═══════════════════════════════════════════════════════ */
function Counter({ to, suffix = '', dur = 1.8 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const num = parseFloat(to);
    const start = Date.now();
    const ms = dur * 1000;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / ms, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * num));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, to, dur]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════
   AQI ORB — breathing, glowing orb with rings
   ═══════════════════════════════════════════════════════ */
function AqiOrb({ data }) {
  const color = aqiColor(data?.aqi);
  const band = aqiBand(data?.aqi);
  return (
    <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.1, type: 'spring', stiffness: 100 }}
      style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {[1.5, 1.3, 1.1].map((s, i) => (
        <motion.div key={i}
          animate={{ scale: [s, s + 0.08, s], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${color}` }} />
      ))}
      <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 130, height: 130, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${color}44, ${color}11)`,
          border: `2px solid ${color}66`, boxShadow: `0 0 60px ${color}33, inset 0 0 40px ${color}11`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
        <span style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: 'var(--font-display)', color }}>{data?.aqi || '—'}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: `${color}cc`, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{band}</span>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   FEATURE ROW — expandable on hover
   ═══════════════════════════════════════════════════════ */
function FeatureRow({ feat, navigate }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div ref={ref} initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.1 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(feat.path)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 24, padding: '32px 28px', cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: hovered ? 'rgba(16,185,129,0.03)' : 'transparent', transition: 'background 0.3s',
      }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700,
        color: hovered ? '#10b981' : '#374151', transition: 'color 0.3s', flexShrink: 0, width: 32 }}>{feat.num}</span>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: hovered ? `${feat.color}18` : 'rgba(255,255,255,0.03)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s',
        border: `1px solid ${hovered ? `${feat.color}33` : 'rgba(255,255,255,0.04)'}`,
      }}>
        <feat.icon size={20} color={hovered ? feat.color : '#6b7280'} style={{ transition: 'color 0.3s' }} />
      </div>
      <div style={{ flex: '1 1 auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', fontWeight: 800,
          letterSpacing: '-0.02em', color: hovered ? '#f0fdf4' : '#9ca3af', transition: 'color 0.3s' }}>{feat.title}</div>
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.88rem', color: 'rgba(167,243,208,0.6)', lineHeight: 1.65, margin: '10px 0 8px', maxWidth: 500 }}>{feat.body}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {feat.tags.map(t => (
                  <span key={t} style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em',
                    color: feat.color, background: `${feat.color}12`, border: `1px solid ${feat.color}22`,
                    borderRadius: 20, padding: '3px 10px', textTransform: 'uppercase' }}>{t}</span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.div animate={{ x: hovered ? 6 : 0, opacity: hovered ? 1 : 0.2 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0 }}>
        <ArrowUpRight size={22} color={hovered ? '#10b981' : '#6b7280'} />
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════ */
const FEATURES = [
  { icon: Activity, color: '#10b981', num: '01', title: 'Real-Time Monitoring',
    body: 'Live AQI, PM2.5, CO, NO₂, TVOC data streamed from IoT sensors via ThingSpeak — refreshed every 15 seconds with WebSocket push.',
    tags: ['ThingSpeak', 'WebSocket', 'IoT'], path: '/' },
  { icon: Brain, color: '#8b5cf6', num: '02', title: 'Machine Learning Core',
    body: 'XGBoost AQI forecaster, neural-network pollution source classifier, and Isolation Forest anomaly detection — all running in real time.',
    tags: ['XGBoost', 'scikit-learn', 'Classification'], path: '/ml' },
  { icon: Map, color: '#0ea5e9', num: '03', title: 'Zone Intelligence',
    body: 'Interactive Leaflet map of all 12 MCD Delhi zones with real-time colour-coded AQI overlays and zone-specific analytics.',
    tags: ['Leaflet', 'GeoJSON', '12 Zones'], path: '/map' },
  { icon: Bell, color: '#ef4444', num: '04', title: 'Smart Alert Engine',
    body: 'Configurable threshold rules with severity levels, debounce logic, and real-time WebSocket push notifications.',
    tags: ['Rules Engine', 'WebSocket', 'Real-time'], path: '/alerts' },
  { icon: Shield, color: '#f97316', num: '05', title: 'Health Advisories',
    body: 'Personalised guidance for 6 population profiles — general public, children, elderly, athletes, asthma patients, and pregnant women.',
    tags: ['6 Profiles', 'CPCB Scale', 'Activity Safety'], path: '/advisory' },
  { icon: FileText, color: '#b45309', num: '06', title: 'Policy Automation',
    body: 'Source-specific mitigation actions recommended to city administrators with dispatch tracking and authority chain.',
    tags: ['Policy Engine', 'Dispatch', 'MCD'], path: '/admin' },
];

const TECH = [
  { label: 'React 19', cat: 'Frontend' }, { label: 'Vite 7', cat: 'Frontend' },
  { label: 'Framer Motion', cat: 'Frontend' }, { label: 'Chart.js', cat: 'Frontend' },
  { label: 'Leaflet', cat: 'Frontend' }, { label: 'FastAPI', cat: 'Backend' },
  { label: 'Python 3.9', cat: 'Backend' }, { label: 'WebSocket', cat: 'Backend' },
  { label: 'XGBoost', cat: 'ML' }, { label: 'scikit-learn', cat: 'ML' },
  { label: 'Joblib', cat: 'ML' }, { label: 'ThingSpeak', cat: 'IoT' },
];

const MARQUEE_1 = ['Real-Time Air Quality', 'Machine Learning', '12 MCD Zones', 'Policy Engine',
  'Smart Alerts', 'Health Advisory', 'Source Classification', 'Anomaly Detection',
  'IoT Sensors', 'WebSocket Push', 'Delhi NCR', 'CPCB Standards'];
const MARQUEE_2 = ['PM2.5', 'CO', 'NO₂', 'TVOC', 'Temperature', 'Humidity',
  'AQI Forecasting', 'XGBoost', 'Isolation Forest', 'Neural Network',
  'ThingSpeak API', 'FastAPI', 'React 19', 'Vite 7'];

/* ═══════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate();
  const { data } = useLiveData();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -120]);
  const heroOp = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden', background: '#050a08', color: '#e2e8f0', fontFamily: 'var(--font-body, system-ui, sans-serif)' }}>
      <Grain />
      <ScrollProgress />

      {/* ─── NAV ──────────────────────────────────────── */}
      <motion.nav initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 36px',
          background: 'rgba(5,10,8,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Leaf size={18} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#d1fae5', letterSpacing: '-0.02em' }}>AQMS</span>
          <span style={{ fontSize: '0.65rem', color: '#6ee7b7', fontWeight: 600, opacity: 0.6,
            border: '1px solid rgba(110,231,183,0.2)', borderRadius: 6, padding: '2px 8px', marginLeft: 4 }}>v2.0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace', marginRight: 12 }}>
            {time.toLocaleTimeString('en-IN', { hour12: false })} IST
          </span>
          <MagneticButton onClick={() => navigate('/')}>Dashboard</MagneticButton>
          <MagneticButton onClick={() => navigate('/')} accent>Launch App <ArrowUpRight size={16} /></MagneticButton>
        </div>
      </motion.nav>

      {/* ─── HERO ─────────────────────────────────────── */}
      <motion.section style={{ y: heroY, opacity: heroOp, position: 'relative', minHeight: '100vh',
        display: 'flex', alignItems: 'center', padding: '140px 36px 80px', overflow: 'hidden' }}>
        {/* Background gradient blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <motion.div animate={{ x: [0, 40, 0], y: [0, -30, 0] }} transition={{ duration: 20, repeat: Infinity }}
            style={{ position: 'absolute', top: '10%', left: '10%', width: 500, height: 500, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <motion.div animate={{ x: [0, -30, 0], y: [0, 40, 0] }} transition={{ duration: 25, repeat: Infinity }}
            style={{ position: 'absolute', bottom: '5%', right: '5%', width: 600, height: 600, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(6,95,70,0.08) 0%, transparent 70%)', filter: 'blur(100px)' }} />
        </div>

        <div style={{ maxWidth: 1300, width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 60, flexWrap: 'wrap', zIndex: 1 }}>
          {/* Left text */}
          <div style={{ flex: '1 1 500px', maxWidth: 680 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: 40, padding: '6px 16px' }}>
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 600, letterSpacing: '0.04em' }}>
                LIVE — DELHI AIR QUALITY MONITORING
              </span>
            </motion.div>
            <h1 style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)', fontWeight: 900, lineHeight: 0.95,
              fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', marginBottom: 32, overflow: 'hidden' }}>
              <RevealText style={{ color: '#f0fdf4' }}>Breathe</RevealText><br />
              <RevealText delay={0.15} style={{ background: 'linear-gradient(135deg, #10b981, #34d399)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Smart.</RevealText><br />
              <RevealText delay={0.3} style={{ color: '#f0fdf4' }}>Act Faster.</RevealText>
            </h1>
            <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              style={{ fontSize: '1.15rem', color: 'rgba(167,243,208,0.7)', lineHeight: 1.8, maxWidth: 520, marginBottom: 40 }}>
              AI-powered air quality intelligence across all 12 MCD Delhi zones —
              real-time sensors, ML forecasting, smart alerts and automated policy
              recommendations in one platform.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
              style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <MagneticButton onClick={() => navigate('/')} accent>Open Dashboard <ArrowRight size={18} /></MagneticButton>
              <MagneticButton onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore Features <ChevronDown size={16} />
              </MagneticButton>
            </motion.div>
          </div>
          {/* Right AQI orb */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <AqiOrb data={data} />
            {data && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
                style={{ display: 'flex', gap: 20, fontSize: '0.78rem', color: '#6ee7b7' }}>
                {[{ l: 'PM2.5', v: data.pm25, u: 'µg/m³' }, { l: 'CO', v: data.co, u: 'mg/m³' }, { l: 'NO₂', v: data.no2, u: 'ppm' }].map(({ l, v, u }) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#d1fae5', fontFamily: 'var(--font-display)' }}>{v}</div>
                    <div style={{ opacity: 0.5, fontSize: '0.68rem' }}>{l} ({u})</div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200,
          background: 'linear-gradient(to bottom, transparent, #050a08)', pointerEvents: 'none' }} />
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}
          style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', color: '#34d39966' }}>
          <ChevronDown size={20} />
        </motion.div>
      </motion.section>

      {/* ─── MARQUEE ──────────────────────────────────── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)',
        padding: '8px 0', background: 'rgba(16,185,129,0.02)' }}>
        <Marquee items={MARQUEE_1} speed={40} />
        <Marquee items={MARQUEE_2} speed={36} reverse />
      </section>

      {/* ─── STATS ────────────────────────────────────── */}
      <section style={{ padding: '100px 36px', maxWidth: 1200, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1,
            background: 'rgba(255,255,255,0.03)', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
          {[
            { val: 12, suffix: '', label: 'MCD Zones' }, { val: 7, suffix: '', label: 'Sensor Params' },
            { val: 3, suffix: '', label: 'ML Models' }, { val: 15, suffix: 's', label: 'Refresh Rate' },
            { val: 6, suffix: '', label: 'Health Profiles' }, { val: 24, suffix: '/7', label: 'Monitoring' },
          ].map(({ val, suffix, label }) => (
            <div key={label} style={{ padding: '36px 24px', textAlign: 'center', background: 'rgba(5,10,8,0.8)', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 900, lineHeight: 1,
                marginBottom: 8, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #d1fae5, #10b981)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <Counter to={val} suffix={suffix} />
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────── */}
      <section id="features" style={{ padding: '40px 36px 120px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 80, maxWidth: 600 }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Minus size={14} /> Platform Capabilities
          </motion.div>
          <h2 style={{ margin: 0, overflow: 'hidden' }}>
            <RevealText style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4.5vw, 3.2rem)',
              fontWeight: 900, letterSpacing: '-0.035em', color: '#f0fdf4', lineHeight: 1.1 }}>
              Everything in one intelligent platform
            </RevealText>
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {FEATURES.map((feat, i) => <FeatureRow key={feat.num} feat={feat} navigate={navigate} />)}
        </div>
      </section>

      {/* ─── LIVE DATA SHOWCASE ───────────────────────── */}
      {data && (
        <section style={{ padding: '80px 36px', background: 'rgba(16,185,129,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              style={{ marginBottom: 48 }}>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                Live Sensor Feed
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800,
                color: '#f0fdf4', letterSpacing: '-0.03em', margin: 0 }}>Streaming right now from Delhi</h3>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1,
              background: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
              {[
                { label: 'AQI', val: data.aqi, color: aqiColor(data.aqi), unit: '' },
                { label: 'PM 2.5', val: data.pm25, color: '#f97316', unit: 'µg/m³' },
                { label: 'CO', val: data.co, color: '#8b5cf6', unit: 'mg/m³' },
                { label: 'NO₂', val: data.no2, color: '#0ea5e9', unit: 'ppm' },
                { label: 'TVOC', val: data.tvoc, color: '#b45309', unit: 'ppm' },
                { label: 'Temp', val: data.temperature, color: '#ef4444', unit: '°C' },
                { label: 'Humidity', val: data.humidity, color: '#38bdf8', unit: '%' },
              ].map(({ label, val, color, unit }) => (
                <motion.div key={label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  style={{ padding: '28px 20px', background: 'rgba(5,10,8,0.9)', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color, lineHeight: 1,
                    marginBottom: 6, letterSpacing: '-0.02em' }}>{val}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>{label} {unit && <span style={{ opacity: 0.5 }}>({unit})</span>}</div>
                </motion.div>
              ))}
            </div>
            <div style={{ marginTop: 18, fontSize: '0.75rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wifi size={12} color="#10b981" />
              Category: <span style={{ color: aqiColor(data.aqi), fontWeight: 700 }}>{data.aqi_category}</span>
              &nbsp;·&nbsp; Source: <span style={{ color: '#6ee7b7', fontWeight: 600 }}>{data.source_detected || 'Detecting...'}</span>
              &nbsp;·&nbsp; {new Date(data.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </section>
      )}

      {/* ─── TECH STACK ───────────────────────────────── */}
      <section style={{ padding: '100px 36px', maxWidth: 1200, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: 48 }}>
          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Minus size={14} /> Technology
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800,
            color: '#f0fdf4', letterSpacing: '-0.03em', margin: 0 }}>Built with modern stack</h3>
        </motion.div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TECH.map(({ label, cat }, i) => (
            <motion.div key={label} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }} transition={{ delay: i * 0.03 }}
              whileHover={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', scale: 1.04 }}
              style={{ padding: '10px 20px', borderRadius: 40, border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.03)', fontSize: '0.85rem', fontWeight: 600, color: '#d1fae5',
                cursor: 'default', transition: 'all 0.3s' }}>
              <span style={{ opacity: 0.4, fontSize: '0.7rem', marginRight: 8, fontWeight: 500 }}>{cat}</span>{label}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────── */}
      <section style={{ padding: '120px 36px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 28px',
            background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 80px rgba(16,185,129,0.25)' }}>
            <Leaf size={32} color="#fff" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900,
            letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 20,
            background: 'linear-gradient(135deg, #f0fdf4, #6ee7b7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Ready to monitor<br />Delhi's air?
          </h2>
          <p style={{ color: 'rgba(167,243,208,0.6)', fontSize: '1.05rem', maxWidth: 420, margin: '0 auto 40px', lineHeight: 1.7 }}>
            Live sensor data is streaming right now. Jump into the dashboard and see what Delhi is breathing.
          </p>
          <MagneticButton onClick={() => navigate('/')} accent style={{ fontSize: '1.05rem', padding: '18px 48px' }}>
            <Activity size={20} /> Launch Dashboard
          </MagneticButton>
        </motion.div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────── */}
      <footer style={{ padding: '28px 36px', borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Leaf size={14} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#6ee7b7', fontSize: '0.9rem' }}>AQMS</span>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'rgba(107,114,128,0.6)' }}>Air Quality Monitoring System · Delhi MCD · 2026</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Dashboard', '/'], ['Analytics', '/analytics'], ['ML Insights', '/ml'], ['Health', '/advisory'], ['Alerts', '/alerts']].map(([label, path]) => (
            <span key={label} onClick={() => navigate(path)} style={{ fontSize: '0.75rem', color: '#4b5563', cursor: 'pointer', fontWeight: 600, transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = '#10b981'}
              onMouseLeave={e => e.target.style.color = '#4b5563'}>{label}</span>
          ))}
        </div>
      </footer>

      <style>{`
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        *, *::before, *::after { box-sizing: border-box; }
        ::selection { background: rgba(16,185,129,0.3); color: #fff; }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
