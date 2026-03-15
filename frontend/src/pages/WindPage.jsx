import React, { useEffect, useState } from 'react';
import { Wind, Compass, Activity } from 'lucide-react';
import { fetchWindCurrent, fetchCityAttribution } from '../services/api';

export default function WindPage() {
  const [wind, setWind] = useState(null);
  const [city, setCity] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [w, c] = await Promise.all([fetchWindCurrent(), fetchCityAttribution()]);
        if (!cancelled) {
          setWind(w);
          setCity(c);
        }
      } catch {
        if (!cancelled) {
          setWind(null);
          setCity(null);
        }
      }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const topStations = (wind?.stations || []).slice(0, 6);
  const cityScores = city?.scores ? Object.entries(city.scores).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="page-header">
        <h2>Wind Analysis</h2>
        <p>Live wind context + city-level source attribution</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--earth-400)', marginBottom: 4 }}>Dominant Wind</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--forest-800)' }}>
            <Compass size={16} />
            {wind?.dominant_label || '—'}
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: 6, color: 'var(--earth-500)' }}>
            Direction: {wind?.dominant_direction ?? '—'}°
          </div>
        </div>

        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--earth-400)', marginBottom: 4 }}>Wind Stations</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--forest-800)' }}>
            <Wind size={16} />
            {wind?.station_count ?? 0} active
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: 6, color: 'var(--earth-500)' }}>
            Updated: {wind?.timestamp ? new Date(wind.timestamp).toLocaleTimeString() : '—'}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--earth-400)', marginBottom: 4 }}>City Dominant Source</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--forest-800)' }}>
            <Activity size={16} />
            {city?.dominant_source || '—'}
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: 6, color: 'var(--earth-500)' }}>
            Confidence: {city?.confidence_score ? `${Math.round(city.confidence_score * 100)}%` : '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--forest-800)' }}>Station Wind Snapshot</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
            {topStations.map(s => (
              <div key={s.station} style={{ border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--earth-400)' }}>{s.station}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--earth-800)' }}>{s.wind_speed} m/s · {s.wind_direction}°</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--forest-800)' }}>City Attribution Mix</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cityScores.map(([k, v]) => (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span>{k}</span>
                  <span>{Math.round(v * 100)}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(148,163,184,0.2)', borderRadius: 999 }}>
                  <div style={{ height: '100%', width: `${Math.round(v * 100)}%`, borderRadius: 999, background: '#0ea5e9' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
