import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import wardGeoJson from '../data/wards.json';

/* ── AQI color mapping ───────────────────── */
function getAqiColor(aqi) {
  if (aqi <= 50)  return '#22c55e';
  if (aqi <= 100) return '#84cc16';
  if (aqi <= 200) return '#eab308';
  if (aqi <= 300) return '#f97316';
  if (aqi <= 400) return '#ef4444';
  return '#991b1b';
}

function getAqiOpacity(aqi) {
  if (aqi <= 50) return 0.35;
  if (aqi <= 200) return 0.5;
  if (aqi <= 300) return 0.6;
  return 0.7;
}

/* ── Fly to ward on selection ──────────── */
function FlyToWard({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 14, { duration: 0.8 });
  }, [center, map]);
  return null;
}

/* ── Legend component ──────────────────── */
function MapLegend() {
  const items = [
    { label: 'Good (0-50)', color: '#22c55e' },
    { label: 'Satisfactory (51-100)', color: '#84cc16' },
    { label: 'Moderate (101-200)', color: '#eab308' },
    { label: 'Poor (201-300)', color: '#f97316' },
    { label: 'Very Poor (301-400)', color: '#ef4444' },
    { label: 'Severe (401+)', color: '#991b1b' },
  ];

  return (
    <div className="map-legend">
      <div className="map-legend-title">AQI Scale</div>
      {items.map(({ label, color }) => (
        <div key={label} className="map-legend-item">
          <span className="map-legend-swatch" style={{ background: color }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function WardMap({ wardData = [], selectedWard, onSelectWard }) {
  const [flyCenter, setFlyCenter] = useState(null);

  // Build a lookup map: ward_id -> ward data
  const wardLookup = useMemo(() => {
    const map = {};
    wardData.forEach(w => { map[w.ward_id] = w; });
    return map;
  }, [wardData]);

  // Merge GeoJSON with live data
  const enrichedGeoJson = useMemo(() => ({
    ...wardGeoJson,
    features: wardGeoJson.features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        ...wardLookup[feature.properties.ward_id],
      },
    })),
  }), [wardLookup]);

  // Style each ward polygon by AQI
  const getStyle = (feature) => {
    const wd = wardLookup[feature.properties.ward_id];
    const aqi = wd?.aqi || 0;
    const isSelected = feature.properties.ward_id === selectedWard;

    return {
      fillColor: getAqiColor(aqi),
      fillOpacity: isSelected ? 0.75 : getAqiOpacity(aqi),
      color: isSelected ? '#064e3b' : 'rgba(255,255,255,0.8)',
      weight: isSelected ? 3 : 1.5,
      dashArray: isSelected ? '' : '3',
    };
  };

  // Per-feature event handlers
  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    const wd = wardLookup[props.ward_id];

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 3, color: '#064e3b', fillOpacity: 0.7 });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        if (props.ward_id !== selectedWard) {
          e.target.setStyle(getStyle(feature));
        }
      },
      click: () => {
        onSelectWard?.(props.ward_id);
        // Compute center of polygon
        const coords = feature.geometry.coordinates[0];
        const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
        const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
        setFlyCenter([lat, lng]);
      },
    });

    // Tooltip with ward name and AQI
    if (wd) {
      layer.bindTooltip(
        `<div style="font-weight:600;font-size:13px">${props.name}</div>
         <div style="font-size:12px;color:#666">AQI: <b style="color:${getAqiColor(wd.aqi)}">${wd.aqi}</b> · ${wd.aqi_category}</div>`,
        { sticky: true, className: 'ward-tooltip' }
      );
    }
  };

  // Delhi center — adjusted for full MCD zone coverage
  const center = [28.65, 77.15];

  return (
    <div className="ward-map-wrapper">
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom={true}
        zoomControl={false}
        className="ward-map"
        style={{ height: '100%', width: '100%', borderRadius: 'var(--radius-lg)' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <GeoJSON
          key={JSON.stringify(wardData.map(w => w.aqi))}
          data={enrichedGeoJson}
          style={getStyle}
          onEachFeature={onEachFeature}
        />
        <FlyToWard center={flyCenter} />
      </MapContainer>
      <MapLegend />
    </div>
  );
}
