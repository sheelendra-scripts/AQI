import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Wind, Compass, Activity, Gauge, RefreshCw } from 'lucide-react';
import { fetchWindCurrent, fetchCityAttribution, fetchWindHistory } from '../services/api';

const SOURCE_COLORS = {
  vehicular: '#0ea5e9',
  industrial: '#8b5cf6',
  biomass: '#f97316',
  construction: '#b45309',
  dust: '#7c2d12',
  regional: '#64748b',
};

function cardinalFromDegrees(deg = 0) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return dirs[idx];
}

function SpeedSparkline({ values = [] }) {
  if (!values.length) {
    return <div style={{ fontSize: '0.78rem', color: 'var(--earth-400)' }}>No trend data</div>;
  }

  const w = 320;
  const h = 80;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);

  const points = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * (w - 8) + 4;
    const y = h - ((v - min) / span) * (h - 16) - 8;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="88" role="img" aria-label="Wind speed trend">
      <defs>
        <linearGradient id="windSpark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#windSpark)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function WindPage() {
  const [wind, setWind] = useState(null);
  const [city, setCity] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [w, c, h] = await Promise.all([
          fetchWindCurrent(),
          fetchCityAttribution(),
          fetchWindHistory(6),
        ]);
        if (!cancelled) {
          setWind(w);
          setCity(c);
          setHistory(h?.history || []);
        }
      } catch {
        if (!cancelled) {
          setWind(null);
          setCity(null);
          setHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const topStations = useMemo(
    () => [...(wind?.stations || [])].sort((a, b) => (b.wind_speed || 0) - (a.wind_speed || 0)).slice(0, 8),
    [wind]
  );

  const cityScores = city?.scores ? Object.entries(city.scores).sort((a, b) => b[1] - a[1]) : [];
  const dominantStation = topStations[0];
  const dominantDir = dominantStation?.wind_direction ?? wind?.dominant_direction ?? 0;
  const avgSpeed = topStations.length
    ? (topStations.reduce((s, st) => s + (st.wind_speed || 0), 0) / topStations.length).toFixed(1)
    : '0.0';

  const speedSeries = useMemo(() => {
    const snapshots = history.slice(-24);
    return snapshots.map((snap) => {
      const stations = snap.stations || [];
      if (!stations.length) return 0;
      return stations.reduce((s, st) => s + (st.wind_speed || 0), 0) / stations.length;
    });
  }, [history]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2>Wind Analysis</h2>
            <p>Live wind context, station snapshots and city-level source attribution</p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(16,185,129,0.2)',
            background: 'rgba(16,185,129,0.06)',
            color: 'var(--forest-700)', fontSize: '0.8rem', fontWeight: 600,
          }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {wind?.timestamp ? `Updated ${new Date(wind.timestamp).toLocaleTimeString()}` : 'Updating...'}
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--earth-400)', marginBottom: 4 }}>Dominant Wind</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--forest-800)' }}>
            <Compass size={16} />
            {wind?.dominant_label || '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--earth-500)', marginTop: 4 }}>
            {cardinalFromDegrees(dominantDir)} · {Math.round(dominantDir)}°
          </div>
        </div>

        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--earth-400)', marginBottom: 4 }}>Average Speed</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--forest-800)' }}>
            <Gauge size={16} />
            {avgSpeed} m/s
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--earth-500)', marginTop: 4 }}>
            Across {wind?.station_count ?? 0} stations
          </div>
        </div>

        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--earth-400)', marginBottom: 4 }}>City Dominant Source</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--forest-800)' }}>
            <Activity size={16} />
            {city?.dominant_source || '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--earth-500)', marginTop: 4 }}>
            Confidence: {city?.confidence_score ? `${Math.round(city.confidence_score * 100)}%` : '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ padding: 18, minHeight: 260 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: 'var(--forest-800)' }}>Dominant Wind Compass</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--earth-500)' }}>
              {cardinalFromDegrees(dominantDir)} · {Math.round(dominantDir)}°
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <div style={{
                width: 180,
                height: 180,
                borderRadius: '50%',
                border: '2px solid rgba(16,185,129,0.2)',
                background: 'radial-gradient(circle at 50% 35%, rgba(236,253,245,0.85), rgba(255,255,255,0.95))',
                position: 'relative',
                boxShadow: 'inset 0 0 20px rgba(16,185,129,0.08)',
              }}>
                <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', color: 'var(--earth-600)' }}>N</div>
                <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', color: 'var(--earth-600)' }}>S</div>
                <div style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--earth-600)' }}>W</div>
                <div style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--earth-600)' }}>E</div>
                <motion.div
                  animate={{ rotate: dominantDir + 180 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 4,
                    height: 66,
                    background: 'linear-gradient(180deg, var(--forest-500), var(--forest-800))',
                    transformOrigin: '50% 90%',
                    borderRadius: 999,
                    translate: '-50% -90%',
                    boxShadow: '0 0 10px rgba(16,185,129,0.28)',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#0f172a',
                  border: '2px solid #e2e8f0',
                }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(90px,1fr))', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(16,185,129,0.08)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--earth-500)' }}>Avg Speed</div>
                <div style={{ fontSize: '1.28rem', fontWeight: 800, color: 'var(--forest-700)' }}>{avgSpeed}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--earth-500)' }}>m/s</div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(16,185,129,0.1)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--earth-500)' }}>Stations</div>
                <div style={{ fontSize: '1.28rem', fontWeight: 800, color: '#047857' }}>{wind?.station_count ?? 0}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--earth-500)' }}>active</div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(120,113,108,0.12)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--earth-500)' }}>Dominant</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--earth-700)' }}>{wind?.dominant_label || '—'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--earth-500)' }}>{cardinalFromDegrees(dominantDir)}</div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ padding: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Activity size={16} color="#0f766e" />
            <div style={{ fontWeight: 700, color: 'var(--forest-800)' }}>City Source Attribution</div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--earth-500)', marginBottom: 12 }}>
            Dominant: <b style={{ color: 'var(--earth-700)' }}>{city?.dominant_source || '—'}</b>
            {' · '}
            Confidence: <b style={{ color: 'var(--earth-700)' }}>{city?.confidence_score ? `${Math.round(city.confidence_score * 100)}%` : '—'}</b>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cityScores.map(([k, v]) => (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span style={{ textTransform: 'capitalize' }}>{k}</span>
                  <span>{Math.round(v * 100)}%</span>
                </div>
                <div style={{ height: 10, background: 'rgba(148,163,184,0.2)', borderRadius: 999, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(v * 100)}%` }}
                    transition={{ duration: 0.6 }}
                    style={{
                      height: '100%',
                      borderRadius: 999,
                      background: SOURCE_COLORS[k] || '#0ea5e9',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ padding: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Gauge size={16} color="#0ea5e9" />
            <div style={{ fontWeight: 700, color: 'var(--forest-800)' }}>Wind Speed Trend (Last 6h)</div>
          </div>
          <SpeedSparkline values={speedSeries} />
          <div style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--earth-400)' }}>
            Gradient path shows station-average wind speed movement across recent snapshots.
          </div>
        </motion.div>

        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ padding: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Wind size={16} color="var(--forest-700)" />
            <div style={{ fontWeight: 700, color: 'var(--forest-800)' }}>Top Station Snapshot</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 290, overflow: 'auto', paddingRight: 4 }}>
            {topStations.map((s) => (
              <div
                key={s.station}
                style={{
                  border: '1px solid rgba(16,185,129,0.14)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.72)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--earth-700)' }}>{s.station}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--earth-500)' }}>{cardinalFromDegrees(s.wind_direction)} {Math.round(s.wind_direction)}°</div>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--forest-700)' }}>{s.wind_speed} m/s</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
