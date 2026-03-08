import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import {
  Brain, Zap, AlertTriangle, TrendingUp, Clock, Eye, Activity,
  RefreshCw, Shield, Flame, Wind, CloudRain, Atom
} from 'lucide-react';
import { fetchMLSource, fetchMLForecast, fetchMLAnomaly } from '../services/api';

const SOURCE_META = {
  vehicle:      { icon: '🚗', label: 'Vehicle Emissions', color: '#f97316', desc: 'Traffic exhaust & brake dust' },
  industrial:   { icon: '🏭', label: 'Industrial Activity', color: '#ef4444', desc: 'Factory emissions & chemical processing' },
  construction: { icon: '🏗️', label: 'Construction Dust', color: '#eab308', desc: 'Excavation, demolition & cement work' },
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
    if (aqi <= 200) return '#eab308';
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
          <ReferenceLine y={100} strokeDasharray="4 4" stroke="#eab308" label={{ value: 'Moderate', position: 'right', fontSize: 10, fill: '#eab308' }} />
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
              background: score > 0.6 ? '#ef4444' : score > 0.4 ? '#eab308' : '#22c55e',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '0.65rem', color: '#22c55e' }}>Normal</span>
          <span style={{ fontSize: '0.65rem', color: '#eab308' }}>Suspicious</span>
          <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>Anomalous</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── ML Insights Page ─────────────────────────────── */
export default function MLInsights() {
  const [sourceData, setSourceData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  const [loading, setLoading] = useState({ source: true, forecast: true, anomaly: true });
  const [horizon, setHorizon] = useState(24);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading({ source: true, forecast: true, anomaly: true });
    try {
      const [src, fc, an] = await Promise.all([
        fetchMLSource().catch(() => null),
        fetchMLForecast(horizon).catch(() => null),
        fetchMLAnomaly().catch(() => null),
      ]);
      setSourceData(src);
      setForecastData(fc);
      setAnomalyData(an);
      setLastUpdated(new Date());
    } catch (e) { /* swallow */ }
    setLoading({ source: false, forecast: false, anomaly: false });
  }, [horizon]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refresh forecast when horizon changes
  useEffect(() => {
    setLoading(l => ({ ...l, forecast: true }));
    fetchMLForecast(horizon).then(d => {
      setForecastData(d);
      setLoading(l => ({ ...l, forecast: false }));
    }).catch(() => setLoading(l => ({ ...l, forecast: false })));
  }, [horizon]);

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
    </div>
  );
}
