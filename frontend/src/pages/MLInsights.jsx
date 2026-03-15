import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import {
  Brain, Zap, AlertTriangle, TrendingUp, Clock, Eye, Activity,
  RefreshCw, Shield, Flame, Wind, CloudRain, Atom, Factory,
  MapPin, Gauge, ChevronDown
} from 'lucide-react';
import { fetchMLSource, fetchMLForecast, fetchMLAnomaly, fetchIndustrialSource, detectSourceLocal } from '../services/api';
import { useLiveData } from '../hooks/useData';

const SOURCE_META = {
  vehicle:      { icon: '🚗', label: 'Vehicle Emissions', color: '#f97316', desc: 'Traffic exhaust & brake dust' },
  industrial:   { icon: '🏭', label: 'Industrial Activity', color: '#ef4444', desc: 'Factory emissions & chemical processing' },
  construction: { icon: '🏗️', label: 'Construction Dust', color: '#b45309', desc: 'Excavation, demolition & cement work' },
  biomass:      { icon: '🔥', label: 'Biomass Burning', color: '#a855f7', desc: 'Crop stubble, waste & cooking fuel fires' },
  mixed:        { icon: '🌫️', label: 'Mixed Sources', color: '#6366f1', desc: 'Multiple overlapping pollution drivers' },
  unknown:      { icon: '❓', label: 'Unknown', color: '#78716c', desc: 'Insufficient data for classification' },
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(16,185,129,0.12)', borderRadius: 12,
      padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} />
          <span style={{ fontSize: '0.8rem', color: '#78716c' }}>{p.name}:</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Source Detection Card ────────────────────────── */
function SourceDetectionCard({ data, loading }) {
  if (loading) return <div className="glass-card" style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--earth-400)' }}>Analyzing sources...</div>;
  if (!data) return null;

  const meta = SOURCE_META[data.source] || SOURCE_META.unknown;
  const probs = data.probabilities || {};
  const sortedProbs = Object.entries(probs).sort((a, b) => b[1] - a[1]);

  return (
    <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <div className="section-title"><Brain size={16} /> ML Source Detection</div>
      <p style={{ fontSize: '0.78rem', color: 'var(--earth-400)', marginBottom: 16 }}>
        Random Forest classifier analyzing pollutant signatures
      </p>

      {/* Detected source hero */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
        background: `${meta.color}08`, borderRadius: 16, border: `1.5px solid ${meta.color}20`,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: '2.5rem' }}>{meta.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', color: meta.color }}>{meta.label}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--earth-500)', marginTop: 2 }}>{meta.desc}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--earth-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, color: meta.color }}>
            {(data.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Probability breakdown */}
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--earth-500)', marginBottom: 10 }}>Probability Breakdown</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedProbs.map(([src, prob]) => {
          const m = SOURCE_META[src] || SOURCE_META.unknown;
          return (
            <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1rem', width: 24, textAlign: 'center' }}>{m.icon}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--earth-600)', width: 100 }}>{m.label}</span>
              <div style={{ flex: 1, height: 8, background: 'var(--earth-100)', borderRadius: 4, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${prob * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  style={{ height: '100%', background: m.color, borderRadius: 4 }}
                />
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--earth-700)', width: 45, textAlign: 'right' }}>
                {(prob * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Input readings */}
      {data.reading && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--earth-50)', borderRadius: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'PM2.5', value: data.reading.pm25, unit: 'µg/m³', icon: Wind },
            { label: 'CO', value: data.reading.co, unit: 'ppm', icon: Flame },
            { label: 'NO₂', value: data.reading.no2, unit: 'ppm', icon: CloudRain },
            { label: 'TVOC', value: data.reading.tvoc, unit: 'ppm', icon: Atom },
          ].map(({ label, value, unit, icon: Icon }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={12} style={{ color: 'var(--earth-400)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--earth-500)' }}>{label}:</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{value}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--earth-400)' }}>{unit}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Forecast Chart Card ──────────────────────────── */
function ForecastCard({ data, loading, horizon, setHorizon }) {
  if (loading) return <div className="glass-card" style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--earth-400)' }}>Computing forecast...</div>;
  if (!data) return null;

  const forecasts = data.forecasts || [];
  const chartData = forecasts.map(f => ({
    time: new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    aqi: f.predicted_aqi,
    category: f.category,
    color: f.color,
  }));

  const getBarColor = (aqi) => {
    if (aqi <= 50) return '#22c55e';
    if (aqi <= 100) return '#84cc16';
    if (aqi <= 200) return '#b45309';
    if (aqi <= 300) return '#f97316';
    return '#ef4444';
  };

  // Find peak
  const peak = forecasts.reduce((max, f) => f.predicted_aqi > max.predicted_aqi ? f : max, forecasts[0] || { predicted_aqi: 0 });
  const minF = forecasts.reduce((min, f) => f.predicted_aqi < min.predicted_aqi ? f : min, forecasts[0] || { predicted_aqi: 0 });

  return (
    <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 2 }}><TrendingUp size={16} /> AQI Forecast</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--earth-400)', margin: 0 }}>
            XGBoost model • next {horizon}h prediction
          </p>
        </div>
        <div className="chart-tabs">
          {[6, 12, 24, 48].map(h => (
            <button key={h} className={`chart-tab ${horizon === h ? 'active' : ''}`} onClick={() => setHorizon(h)}>
              {h}h
            </button>
          ))}
        </div>
      </div>

      {/* Mini stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ padding: '8px 14px', background: 'var(--earth-50)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--earth-400)', textTransform: 'uppercase' }}>Current</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--forest-600)' }}>{data.current_aqi}</div>
        </div>
        <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--earth-400)', textTransform: 'uppercase' }}>Peak</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>{peak.predicted_aqi}</div>
        </div>
        <div style={{ padding: '8px 14px', background: 'rgba(34,197,94,0.05)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--earth-400)', textTransform: 'uppercase' }}>Low</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#22c55e' }}>{minF.predicted_aqi}</div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
          <defs>
            <linearGradient id="forecast-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: '#a8a29e', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#a8a29e', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={100} strokeDasharray="4 4" stroke="#b45309" label={{ value: 'Moderate', position: 'right', fontSize: 10, fill: '#b45309' }} />
          <ReferenceLine y={200} strokeDasharray="4 4" stroke="#f97316" label={{ value: 'Poor', position: 'right', fontSize: 10, fill: '#f97316' }} />
          <Area
            type="monotone" dataKey="aqi" name="Predicted AQI"
            stroke="#10b981" strokeWidth={2.5} fill="url(#forecast-grad)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#10b981' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

/* ── Anomaly Detection Card ───────────────────────── */
function AnomalyCard({ data, loading }) {
  if (loading) return <div className="glass-card" style={{ minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--earth-400)' }}>Scanning anomalies...</div>;
  if (!data) return null;

  const isAnomaly = data.is_anomaly;
  const score = data.anomaly_score || 0;
  const scorePercent = Math.min(100, score * 100);

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      style={{ borderColor: isAnomaly ? 'rgba(239,68,68,0.3)' : undefined }}
    >
      <div className="section-title"><AlertTriangle size={16} /> Anomaly Detection</div>
      <p style={{ fontSize: '0.78rem', color: 'var(--earth-400)', marginBottom: 16 }}>
        Isolation Forest scanning for irregular sensor patterns
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
        background: isAnomaly ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
        borderRadius: 16, border: `1.5px solid ${isAnomaly ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isAnomaly ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          border: `2px solid ${isAnomaly ? '#ef4444' : '#22c55e'}`,
        }}>
          {isAnomaly ? <AlertTriangle size={24} color="#ef4444" /> : <Shield size={24} color="#22c55e" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem',
            color: isAnomaly ? '#ef4444' : '#22c55e',
          }}>
            {isAnomaly ? 'Anomaly Detected!' : 'Normal Reading'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--earth-500)', marginTop: 2 }}>
            {isAnomaly ? 'Sensor values deviate significantly from expected patterns' : 'All sensor values within expected parameters'}
          </div>
        </div>
      </div>

      {/* Anomaly score bar */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--earth-500)' }}>Anomaly Score</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{score.toFixed(3)}</span>
        </div>
        <div style={{ height: 8, background: 'var(--earth-100)', borderRadius: 4, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${scorePercent}%` }}
            transition={{ duration: 0.8 }}
            style={{
              height: '100%', borderRadius: 4,
              background: score > 0.6 ? '#ef4444' : score > 0.4 ? '#b45309' : '#22c55e',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '0.65rem', color: '#22c55e' }}>Normal</span>
          <span style={{ fontSize: '0.65rem', color: '#b45309' }}>Suspicious</span>
          <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>Anomalous</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Industrial Source Attribution Card ──────────── */
const SEVERITY_META = {
  extreme: { color: '#dc2626', label: 'Extreme Spike', bg: 'rgba(220,38,38,0.07)' },
  high:    { color: '#f97316', label: 'High Spike',    bg: 'rgba(249,115,22,0.07)' },
  medium:  { color: '#b45309', label: 'Medium Spike',  bg: 'rgba(180,83,9,0.06)'  },
  low:     { color: '#ca8a04', label: 'Low Spike',     bg: 'rgba(202,138,4,0.06)' },
  normal:  { color: '#22c55e', label: 'Normal',        bg: 'rgba(34,197,94,0.06)' },
  unknown: { color: '#78716c', label: 'Unknown',       bg: 'rgba(120,113,108,0.05)' },
};

function IndustrialSourceCard({ data, loading, wardId, setWardId }) {
  if (loading) return (
    <div className="glass-card" style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--earth-400)' }}>
      Tracing industrial sources...
    </div>
  );
  if (!data) return null;

  const spike = data.spike || {};
  const sev = SEVERITY_META[spike.severity] || SEVERITY_META.unknown;
  const sources = data.industrial_source_matches || [];
  const srcCoords = data.estimated_source_location || {};
  const wind = data.wind || {};

  const WARD_EXAMPLES = [
    'ward_01','ward_10','ward_25','ward_50','ward_100','ward_150','ward_200',
  ];

  return (
    <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="section-title" style={{ margin: 0 }}><Factory size={16} /> Industrial Source Attribution</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--earth-400)' }}>Ward:</span>
          <select
            value={wardId}
            onChange={e => setWardId(e.target.value)}
            style={{
              fontSize: '0.78rem', padding: '4px 8px', borderRadius: 8,
              border: '1px solid var(--earth-200)', background: 'var(--earth-50)',
              color: 'var(--earth-700)', cursor: 'pointer',
            }}
          >
            {WARD_EXAMPLES.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--earth-400)', marginBottom: 16 }}>
        Hackdata pipeline · Z-score spike detection → Zenodo industrial DB → Gaussian plume
      </p>

      {/* Spike status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
        background: sev.bg, borderRadius: 14,
        border: `1.5px solid ${sev.color}25`, marginBottom: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${sev.color}15`, border: `2px solid ${sev.color}40`, flexShrink: 0,
        }}>
          {spike.is_spike ? <AlertTriangle size={20} color={sev.color} /> : <Shield size={20} color={sev.color} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: sev.color }}>
            {spike.is_spike ? `Pollution Spike Detected — ${sev.label}` : 'No Spike — Normal Reading'}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--earth-500)', marginTop: 2 }}>
            Z-score: <strong>{spike.z_score ?? '—'}</strong> &nbsp;·&nbsp;
            PM2.5 baseline: <strong>{spike.mean ?? '—'} ± {spike.std ?? '—'} µg/m³</strong>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--earth-400)', textTransform: 'uppercase' }}>Ward PM2.5</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: sev.color }}>
            {data.ward?.pm25 ?? '—'}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--earth-400)' }}>µg/m³</div>
        </div>
      </div>

      {/* Wind + estimated source coords */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', background: 'rgba(14,165,233,0.05)', borderRadius: 12, border: '1px solid rgba(14,165,233,0.15)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--earth-400)', textTransform: 'uppercase', marginBottom: 4 }}>Wind</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0369a1' }}>
            {wind.wind_speed ?? '—'} m/s · {wind.wind_direction ?? '—'}°
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--earth-500)', marginTop: 2 }}>{wind.wind_label || ''}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', background: 'rgba(139,92,246,0.05)', borderRadius: 12, border: '1px solid rgba(139,92,246,0.15)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--earth-400)', textTransform: 'uppercase', marginBottom: 4 }}>Est. Source Location</div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#7c3aed' }}>
            {srcCoords.source_lat ?? '—'}°N, {srcCoords.source_lon ?? '—'}°E
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--earth-500)', marginTop: 2 }}>
            {srcCoords.travel_distance_km ?? '—'} km upwind · {srcCoords.transport_hours ?? '—'}h transport
          </div>
        </div>
      </div>

      {/* Industrial source matches */}
      {sources.length > 0 && (
        <>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--earth-500)', marginBottom: 8 }}>
            Nearest Industrial Sources (Zenodo Delhi 2020)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sources.map((src, i) => (
              <div key={i} style={{
                padding: '10px 14px', borderRadius: 12,
                background: i === 0 ? 'rgba(239,68,68,0.05)' : 'var(--earth-50)',
                border: `1px solid ${i === 0 ? 'rgba(239,68,68,0.15)' : 'var(--earth-150)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800,
                      background: i === 0 ? '#ef4444' : 'var(--earth-200)', color: i === 0 ? 'white' : 'var(--earth-600)',
                    }}>{i + 1}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--earth-700)' }}>
                      {src.lat}°N, {src.lon}°E
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--earth-500)' }}>
                    {(src.distance_m / 1000).toFixed(2)} km away
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'PM2.5', value: src.pm25_emission, unit: 't/d' },
                    { label: 'NOx', value: src.nox_emission, unit: 't/d' },
                    { label: 'SO₂', value: src.so2_emission, unit: 't/d' },
                    { label: 'CO', value: src.co_emission, unit: 't/d' },
                  ].map(({ label, value, unit }) => (
                    <div key={label} style={{ fontSize: '0.7rem', color: 'var(--earth-500)' }}>
                      <span style={{ fontWeight: 600 }}>{label}:</span> {value} {unit}
                    </div>
                  ))}
                </div>
                {src.plume_conc_ug_m3 != null && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--earth-400)' }}>Plume conc. at ward (Gaussian PG-{src.stability_class})</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444' }}>
                        {src.plume_conc_ug_m3.toExponential(3)} g/m³
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'var(--earth-100)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: i === 0 ? '#ef4444' : '#f97316',
                        width: `${Math.min(100, (i === 0 ? 100 : (sources[0].plume_conc_ug_m3 > 0 ? (src.plume_conc_ug_m3 / sources[0].plume_conc_ug_m3) * 100 : 0)))}%`,
                      }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 12, fontSize: '0.68rem', color: 'var(--earth-400)', textAlign: 'right' }}>
        Dataset: Zenodo Delhi Domain 2020 · Model: Pasquill-Gifford Gaussian Plume
      </div>
    </motion.div>
  );
}

/* ── ML Insights Page ─────────────────────────────── */
export default function MLInsights() {
  const [sourceData, setSourceData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  const [industrialData, setIndustrialData] = useState(null);
  const [industrialWardId, setIndustrialWardId] = useState('ward_01');
  const [loading, setLoading] = useState({ source: true, forecast: true, anomaly: true, industrial: true });
  const [horizon, setHorizon] = useState(24);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { data: liveData } = useLiveData();

  const fetchAll = useCallback(async () => {
    setLoading({ source: true, forecast: true, anomaly: true, industrial: true });
    try {
      const [src, fc, an, ind] = await Promise.all([
        fetchMLSource().catch(() => null),
        fetchMLForecast(horizon).catch(() => null),
        fetchMLAnomaly().catch(() => null),
        fetchIndustrialSource(industrialWardId).catch(() => null),
      ]);
      // Use API result or client-side fallback for source
      if (src && src.source && src.source !== 'unknown') {
        setSourceData(src);
      } else if (liveData) {
        setSourceData(detectSourceLocal(liveData.pm25 || 0, liveData.co || 0, liveData.no2 || 0, liveData.tvoc || 0));
      }
      setForecastData(fc);
      setAnomalyData(an);
      setIndustrialData(ind);
      setLastUpdated(new Date());
    } catch (e) { /* swallow */ }
    setLoading({ source: false, forecast: false, anomaly: false, industrial: false });
  }, [horizon, liveData, industrialWardId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refresh forecast when horizon changes
  useEffect(() => {
    setLoading(l => ({ ...l, forecast: true }));
    fetchMLForecast(horizon).then(d => {
      setForecastData(d);
      setLoading(l => ({ ...l, forecast: false }));
    }).catch(() => setLoading(l => ({ ...l, forecast: false })));
  }, [horizon]);

  // Re-fetch industrial data when ward changes
  useEffect(() => {
    setLoading(l => ({ ...l, industrial: true }));
    fetchIndustrialSource(industrialWardId).then(d => {
      setIndustrialData(d);
      setLoading(l => ({ ...l, industrial: false }));
    }).catch(() => setLoading(l => ({ ...l, industrial: false })));
  }, [industrialWardId]);

  // Auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}
      >
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={22} /> ML Insights
          </h2>
          <p>Real-time machine learning analysis of pollution patterns</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.72rem', color: 'var(--earth-400)' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'var(--forest-600)', color: 'white', border: 'none',
              borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Model info badges */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Source Classifier', model: 'Random Forest', icon: Brain, color: '#8b5cf6' },
          { label: 'AQI Forecaster', model: 'XGBoost', icon: TrendingUp, color: '#10b981' },
          { label: 'Anomaly Detector', model: 'Isolation Forest', icon: Eye, color: '#f97316' },
          { label: 'Industrial Plume', model: 'Gaussian PG', icon: Factory, color: '#ef4444' },
        ].map(({ label, model, icon: Icon, color }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
            background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 999,
          }}>
            <Icon size={13} style={{ color }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{label}</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--earth-400)' }}>({model})</span>
          </div>
        ))}
      </div>

      {/* Source + Anomaly side-by-side */}
      <div className="comparison-grid">
        <SourceDetectionCard data={sourceData} loading={loading.source} />
        <AnomalyCard data={anomalyData} loading={loading.anomaly} />
      </div>

      {/* Forecast full-width */}
      <ForecastCard data={forecastData} loading={loading.forecast} horizon={horizon} setHorizon={setHorizon} />

      {/* Industrial Source Attribution full-width */}
      <IndustrialSourceCard
        data={industrialData}
        loading={loading.industrial}
        wardId={industrialWardId}
        setWardId={setIndustrialWardId}
      />
    </div>
  );
}
