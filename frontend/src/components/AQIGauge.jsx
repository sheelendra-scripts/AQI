import React, { useMemo } from 'react';

/**
 * AQI Gauge — Circular ring gauge with animated fill
 * Inspired by Awwwards-style data visualization
 */
export default function AQIGauge({ aqi = 0, category = '', color = '#22c55e' }) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(aqi / 500, 1);
  const offset = circumference * (1 - percent);

  const bgColor = useMemo(() => {
    if (aqi <= 50) return 'rgba(34,197,94,0.08)';
    if (aqi <= 100) return 'rgba(163,230,53,0.08)';
    if (aqi <= 200) return 'rgba(250,204,21,0.08)';
    if (aqi <= 300) return 'rgba(249,115,22,0.08)';
    if (aqi <= 400) return 'rgba(239,68,68,0.08)';
    return 'rgba(153,27,27,0.08)';
  }, [aqi]);

  return (
    <div className="aqi-gauge-container" style={{ background: bgColor, borderRadius: 'var(--radius-lg)' }}>
      <div className="aqi-gauge-ring">
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={radius} className="gauge-bg" />
          <circle
            cx="100" cy="100" r={radius}
            className="gauge-fill"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div className="aqi-value" style={{ color }}>{aqi}</div>
          <div className="aqi-label" style={{ color: 'var(--earth-500)' }}>AQI</div>
        </div>
      </div>

      <div
        className="aqi-category"
        style={{
          background: `${color}18`,
          color,
          border: `1px solid ${color}30`,
        }}
      >
        {category}
      </div>
    </div>
  );
}
