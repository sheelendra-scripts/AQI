import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import wardGeoJson from '../data/wards.json';
import {
  Factory, Wind, AlertTriangle, Shield,
  Play, Pause, RefreshCw, MapPin,
} from 'lucide-react';
import { fetchIndustrialSource, fetchWards } from '../services/api';

/* ── Precompute ward polygon centroids from GeoJSON ───────── */
const WARD_CENTERS = {};
wardGeoJson.features.forEach(f => {
  try {
    const ring =
      f.geometry.type === 'MultiPolygon'
        ? f.geometry.coordinates[0][0]
        : f.geometry.coordinates[0];
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    WARD_CENTERS[f.properties.ward_id] = { lat, lng };
  } catch { /* malformed feature */ }
});

/* ── Plume cone edge helper ────────────────────────────────── */
function plumeConeLine(src, ward, sign) {
  const dLat = ward.lat - src.source_lat;
  const dLng = ward.lng - src.source_lon;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
  const spread = dist * 0.22;
  const perpLat = -dLng / dist;
  const perpLng = dLat / dist;
  return [
    [src.source_lat, src.source_lon],
    [ward.lat + perpLat * spread * sign, ward.lng + perpLng * spread * sign],
  ];
}

/* ── Canvas plume particle simulation ─────────────────────── */
function PlumeSimOverlay({ source, ward, windSpeed, active }) {
  const map = useMap();
  const stateRef = useRef({ source, ward, windSpeed, active });
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const ptsRef = useRef([]);

  // Keep latest props in ref so animation loop doesn't need to restart
  useEffect(() => { stateRef.current = { source, ward, windSpeed, active }; });

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:400;';
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    };
    resize();
    map.on('resize', resize);

    // Initialise 350 particles spread randomly along the route
    ptsRef.current = Array.from({ length: 350 }, () => ({
      progress: Math.random(),
      speed: 0.0014 + Math.random() * 0.0022,
      spread: (Math.random() - 0.5) * 0.55,
      size: 1.8 + Math.random() * 2.4,
      alpha: 0.45 + Math.random() * 0.55,
    }));

    const draw = () => {
      const { source: src, ward: wrd, windSpeed: ws, active: act } = stateRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (act && src && wrd) {
        const srcPt = map.latLngToContainerPoint([src.lat, src.lon]);
        const wrdPt = map.latLngToContainerPoint([wrd.lat, wrd.lng]);

        const dx = wrdPt.x - srcPt.x;
        const dy = wrdPt.y - srcPt.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len; // crosswind unit vector
        const ny = dx / len;

        ptsRef.current.forEach(p => {
          p.progress += p.speed * Math.max(0.4, (ws || 2) / 3);
          if (p.progress >= 1) {
            p.progress = 0;
            p.spread = (Math.random() - 0.5) * 0.55;
          }

          // Gaussian spread grows with travel distance
          const spreadPx = p.spread * len * 0.38 * p.progress;
          const x = srcPt.x + dx * p.progress + nx * spreadPx;
          const y = srcPt.y + dy * p.progress + ny * spreadPx;

          const t = p.progress;
          const fade = p.alpha * (1 - t * 0.72);
          const g = Math.round(68 + t * 90);

          ctx.beginPath();
          ctx.arc(x, y, p.size * (1 - t * 0.28), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239,${g},68,${fade})`;
          ctx.fill();
        });
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.remove();
      map.off('resize', resize);
    };
  }, [map]); // intentionally only runs once per map mount

  return null;
}

/* ── Auto-fly to ward ─────────────────────────────────────── */
function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 13, { duration: 1.0 });
  }, [center, map]);
  return null;
}

/* ── Severity colour map ─────────────────────────────────── */
const SEV = {
  extreme: '#dc2626',
  high:    '#f97316',
  medium:  '#b45309',
  low:     '#ca8a04',
  normal:  '#22c55e',
  unknown: '#78716c',
};

/* ── PlumeMapPage ─────────────────────────────────────────── */
export default function PlumeMapPage() {
  const [wardId, setWardId]               = useState('ward_1');
  const [wardOptions, setWardOptions]     = useState([]);
  const [transportHours, setTransportHours] = useState(1);
  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(false);
  const [simulating, setSimulating]       = useState(false);
  const [flyCenter, setFlyCenter]         = useState([28.6139, 77.209]);

  useEffect(() => {
    fetchWards().then(res => {
      const wards = (res?.wards || [])
        .filter(w => w.feature_type === 'ward')
        .map(w => ({ id: w.ward_id, name: w.name }))
        .sort((a, b) => Number(a.id.split('_')[1] || 0) - Number(b.id.split('_')[1] || 0));
      setWardOptions(wards);
      if (wards.length > 0 && !wards.some(w => w.id === wardId)) {
        setWardId(wards[0].id);
      }
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!wardId) return;
    setLoading(true);
    setSimulating(false);
    try {
      const res = await fetchIndustrialSource(wardId, transportHours, 3);
      setData(res);
      if (res?.ward?.lat) {
        setFlyCenter([res.ward.lat, res.ward.lng]);
      } else {
        const c = WARD_CENTERS[wardId];
        if (c) setFlyCenter([c.lat, c.lng]);
      }
    } catch { setData(null); }
    setLoading(false);
  }, [wardId, transportHours]);

  useEffect(() => { load(); }, [load]);

  const spike      = data?.spike || {};
  const wind       = data?.wind  || {};
  const srcCoords  = data?.estimated_source_location;
  const industrial = data?.industrial_source_matches || [];
  const sevColor   = SEV[spike.severity] || SEV.unknown;

  const wardCenter = data?.ward?.lat
    ? { lat: data.ward.lat, lng: data.ward.lng }
    : WARD_CENTERS[wardId];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

      {/* ── Page header ─────────────────────────── */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}
      >
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Factory size={22} /> Industrial Plume Map
          </h2>
          <p>Visualise pollution transport from upwind industrial sources · Gaussian plume simulation</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Ward selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--earth-500)' }}>Ward</span>
            <select
              value={wardId}
              onChange={e => setWardId(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--earth-200)', background: 'white', cursor: 'pointer' }}
            >
              {wardOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* Transport hours */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--earth-500)' }}>Transport</span>
            <select
              value={transportHours}
              onChange={e => setTransportHours(Number(e.target.value))}
              style={{ fontSize: '0.82rem', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--earth-200)', background: 'white', cursor: 'pointer' }}
            >
              {[0.5, 1, 2, 3, 4, 6].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>

          {/* Simulate toggle */}
          <button
            onClick={() => setSimulating(s => !s)}
            disabled={!data || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: simulating ? '#ef4444' : 'var(--forest-600)',
              color: 'white', fontSize: '0.82rem', fontWeight: 600,
              opacity: !data || loading ? 0.5 : 1,
            }}
          >
            {simulating ? <><Pause size={14} /> Stop</> : <><Play size={14} /> Simulate Plume</>}
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid var(--earth-200)', background: 'white', cursor: 'pointer', fontSize: '0.82rem',
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </motion.div>

      {/* ── Map + data panel ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, flex: 1, minHeight: 540 }}>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            borderRadius: 16, overflow: 'hidden',
            border: '1px solid var(--earth-150)',
            position: 'relative', minHeight: 540,
          }}
        >
          <MapContainer
            center={[28.6139, 77.209]}
            zoom={12}
            style={{ width: '100%', height: '100%', minHeight: 540 }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
              opacity={0.65}
            />

            <FlyTo center={flyCenter} />

            {/* ── Plume cone edges ─── */}
            {srcCoords && wardCenter && (
              <>
                <Polyline
                  positions={[
                    [srcCoords.source_lat, srcCoords.source_lon],
                    [wardCenter.lat, wardCenter.lng],
                  ]}
                  pathOptions={{ color: '#ef4444', weight: 2.5, dashArray: '9 5', opacity: 0.75 }}
                />
                <Polyline
                  positions={plumeConeLine(srcCoords, wardCenter, -1)}
                  pathOptions={{ color: '#ef444445', weight: 1.5, dashArray: '5 7', opacity: 0.6 }}
                />
                <Polyline
                  positions={plumeConeLine(srcCoords, wardCenter,  1)}
                  pathOptions={{ color: '#ef444445', weight: 1.5, dashArray: '5 7', opacity: 0.6 }}
                />
              </>
            )}

            {/* ── Ward (receptor) marker ─── */}
            {wardCenter && (
              <CircleMarker
                center={[wardCenter.lat, wardCenter.lng]}
                radius={13}
                pathOptions={{ fillColor: '#0ea5e9', color: 'white', weight: 3, fillOpacity: 0.92 }}
              >
                <Popup>
                  <strong>{data?.ward?.name || wardId}</strong><br />
                  AQI: <strong>{data?.ward?.aqi ?? '—'}</strong><br />
                  PM2.5: <strong>{data?.ward?.pm25 ?? '—'}</strong> µg/m³<br />
                  Source: {data?.ward?.source_detected ?? '—'}
                </Popup>
              </CircleMarker>
            )}

            {/* ── Estimated source marker ─── */}
            {srcCoords && (
              <CircleMarker
                center={[srcCoords.source_lat, srcCoords.source_lon]}
                radius={14}
                pathOptions={{ fillColor: '#ef4444', color: 'white', weight: 3, fillOpacity: 0.88 }}
              >
                <Popup>
                  <strong>Estimated Source Origin</strong><br />
                  {srcCoords.source_lat}°N, {srcCoords.source_lon}°E<br />
                  {srcCoords.travel_distance_km} km upwind<br />
                  Transport: {srcCoords.transport_hours}h @ {srcCoords.wind_speed} m/s
                </Popup>
              </CircleMarker>
            )}

            {/* ── Industrial source markers (sized by PM2.5 emission) ─── */}
            {industrial.map((src, i) => (
              <CircleMarker
                key={i}
                center={[src.lat, src.lon]}
                radius={7 + Math.min(10, src.pm25_emission * 1.8)}
                pathOptions={{
                  fillColor: i === 0 ? '#8b5cf6' : '#a78bfa',
                  color: 'white', weight: 2, fillOpacity: 0.78,
                }}
              >
                <Popup>
                  <strong>Industrial Source #{i + 1}</strong><br />
                  {src.lat}°N, {src.lon}°E<br />
                  {(src.distance_m / 1000).toFixed(2)} km from estimated origin<br />
                  PM2.5: {src.pm25_emission} t/day<br />
                  NOx: {src.nox_emission} t/day<br />
                  Plume conc: {src.plume_conc_ug_m3?.toExponential(3)} g/m³
                </Popup>
              </CircleMarker>
            ))}

            {/* ── Canvas plume particle animation ─── */}
            {srcCoords && wardCenter && (
              <PlumeSimOverlay
                source={{ lat: srcCoords.source_lat, lon: srcCoords.source_lon }}
                ward={wardCenter}
                windSpeed={wind.wind_speed || 2}
                active={simulating}
              />
            )}
          </MapContainer>

          {/* Map legend */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
            background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)',
            borderRadius: 12, padding: '10px 14px', fontSize: '0.72rem',
            border: '1px solid var(--earth-150)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--earth-700)' }}>Legend</div>
            {[
              { color: '#0ea5e9', label: 'Ward / receptor', shape: 'circle' },
              { color: '#ef4444', label: 'Estimated source origin', shape: 'circle' },
              { color: '#8b5cf6', label: 'Industrial grid cell', shape: 'circle' },
              { color: '#ef4444', label: 'Plume transport path', shape: 'line' },
            ].map(({ color, label, shape }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                {shape === 'circle'
                  ? <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  : <div style={{ width: 16, height: 2.5, background: color, borderRadius: 2, flexShrink: 0 }} />
                }
                <span style={{ color: 'var(--earth-600)' }}>{label}</span>
              </div>
            ))}
            {simulating && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontWeight: 600 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                Simulation active
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Data panel ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Spike card */}
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            style={{ padding: '14px 16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${sevColor}15`, border: `2px solid ${sevColor}40`, flexShrink: 0,
              }}>
                {spike.is_spike
                  ? <AlertTriangle size={18} color={sevColor} />
                  : <Shield size={18} color={sevColor} />
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: sevColor, fontSize: '0.9rem' }}>
                  {spike.is_spike
                    ? `Spike · ${(spike.severity || '').toUpperCase()}`
                    : 'Normal Reading'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--earth-500)', marginTop: 1 }}>
                  Z‑score: {spike.z_score ?? '—'} · threshold: {spike.threshold_used ?? 2.0}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, color: sevColor }}>
                  {data?.ward?.pm25 ?? '—'}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--earth-400)' }}>µg/m³</div>
              </div>
            </div>
            <div style={{
              marginTop: 10, padding: '6px 10px',
              background: 'var(--earth-50)', borderRadius: 8,
              fontSize: '0.71rem', color: 'var(--earth-500)',
            }}>
              Baseline {spike.mean ?? '—'} ± {spike.std ?? '—'} µg/m³ &nbsp;·&nbsp; {data?.ward?.name || wardId}
            </div>
          </motion.div>

          {/* Wind card */}
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            style={{ padding: '14px 16px' }}
          >
            <div className="section-title" style={{ marginBottom: 10, fontSize: '0.8rem' }}>
              <Wind size={13} /> Wind & Transport
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {[
                { label: 'Speed',      value: `${wind.wind_speed ?? '—'} m/s` },
                { label: 'Direction',  value: `${wind.wind_direction ?? '—'}°` },
                { label: 'Pattern',    value: wind.wind_label || '—' },
                { label: 'Distance',   value: `${srcCoords?.travel_distance_km ?? '—'} km` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--earth-50)', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: '0.63rem', color: 'var(--earth-400)', textTransform: 'uppercase', marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: '0.81rem', fontWeight: 600, color: 'var(--earth-700)' }}>{value}</div>
                </div>
              ))}
            </div>
            {srcCoords && (
              <div style={{
                marginTop: 8, padding: '6px 10px',
                background: 'rgba(139,92,246,0.06)', borderRadius: 8,
                fontSize: '0.71rem', color: '#7c3aed',
              }}>
                <MapPin size={11} style={{ display: 'inline', marginRight: 4 }} />
                Estimated origin: {srcCoords.source_lat}°N, {srcCoords.source_lon}°E
              </div>
            )}
          </motion.div>

          {/* Industrial sources */}
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            style={{ padding: '14px 16px', flex: 1 }}
          >
            <div className="section-title" style={{ marginBottom: 6, fontSize: '0.8rem' }}>
              <Factory size={13} /> Industrial Sources
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--earth-400)', marginBottom: 10 }}>
              Zenodo Delhi 2020 · Stability {data?.model_notes?.stability_class || '—'} · Gaussian PG
            </div>

            {industrial.length === 0 && (
              <div style={{ color: 'var(--earth-400)', fontSize: '0.78rem' }}>
                {loading ? 'Loading…' : 'No data yet — select a ward and click Refresh.'}
              </div>
            )}

            {industrial.map((src, i) => {
              const maxConc = industrial[0]?.plume_conc_ug_m3 || 1;
              const pct = Math.round((src.plume_conc_ug_m3 / maxConc) * 100);
              return (
                <div key={i} style={{
                  marginBottom: 10, padding: '10px 12px', borderRadius: 12,
                  background: i === 0 ? 'rgba(139,92,246,0.06)' : 'var(--earth-50)',
                  border: `1px solid ${i === 0 ? 'rgba(139,92,246,0.2)' : 'transparent'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: i === 0 ? '#7c3aed' : 'var(--earth-700)' }}>
                      #{i + 1} — {src.lat}°N, {src.lon}°E
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--earth-400)' }}>
                      {(src.distance_m / 1000).toFixed(2)} km
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                    {[
                      ['PM2.5', src.pm25_emission],
                      ['NOx',   src.nox_emission],
                      ['SO₂',   src.so2_emission],
                      ['CO',    src.co_emission],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{
                        fontSize: '0.67rem', padding: '2px 7px', borderRadius: 5,
                        background: 'rgba(0,0,0,0.05)', color: 'var(--earth-600)',
                      }}>
                        {lbl}: <strong>{val}</strong>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--earth-400)' }}>
                      Plume conc. (PG-{src.stability_class})
                    </span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ef4444' }}>
                      {src.plume_conc_ug_m3?.toExponential(3)} g/m³
                    </span>
                  </div>

                  {/* Relative bar */}
                  <div style={{ height: 4, background: 'var(--earth-100)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: i === 0 ? '#8b5cf6' : '#c4b5fd',
                      width: `${pct}%`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
