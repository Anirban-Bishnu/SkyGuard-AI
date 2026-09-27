const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'live';

async function request(path, options={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 7000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type':'application/json', ...(options.headers||{}) }});
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.status === 204 ? null : await res.json();
  } finally { clearTimeout(timer); }
}

export const api = {
  baseUrl: API_BASE_URL,
  async health(){
    try { await request('/api/v1/stations/status'); return {ok:true}; }
    catch(e){ return {ok:false,error:e.message}; }
  },
  stations:()=>request('/api/v1/stations/status'),
  observations:()=>request('/api/v1/observations'),
  history:()=>request('/api/v1/observations'),
  alerts:()=>request('/api/v1/alerts'),
  createObservation:(payload)=>request('/api/v1/observations',{method:'POST',body:JSON.stringify(payload)}),
  alertAction:(id,payload)=>request('/api/v1/alerts/'+id+'/action',{method:'POST',body:JSON.stringify(payload)}),
  replayTick:()=>request('/api/v1/replay/tick',{method:'POST'})
};

export function unwrapRows(payload){
  if (Array.isArray(payload)) return payload;
  for (const key of ['data','items','results','observations','stations','alerts','history']) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

export function normalizeStation(s){
  return {
    id:s.station_id ?? s.stationId ?? s.id ?? 'UNKNOWN',
    name:s.name ?? s.station_name ?? s.stationName ?? s.station_id ?? 'AWS Station',
    wmo:s.wmo ?? s.wmo_id ?? s.wmoId ?? '—',
    lat:Number(s.lat ?? s.latitude ?? 0), lng:Number(s.lng ?? s.longitude ?? 0),
    status:String(s.status ?? s.health_status ?? 'NORMAL').toUpperCase(),
    temp:Number(s.temperature ?? s.temp ?? s.current_temperature ?? s.observation?.temperature ?? 0),
    pressure:Number(s.pressure ?? s.atmospheric_pressure ?? s.observation?.pressure ?? 1007),
    humidity:Number(s.humidity ?? s.relative_humidity ?? s.observation?.humidity ?? 90),
    health:Number(s.health ?? s.health_percent ?? 100),
    lastUpdate:s.last_update ?? s.lastUpdate ?? s.timestamp ?? s.observation?.timestamp ?? null,
  };
}

export function normalizeObservation(o,i=0){
  return {id:o.id ?? `OBS-${i}`, stationId:o.station_id ?? o.stationId ?? o.station ?? 'UNKNOWN', timestamp:o.timestamp ?? o.time ?? null, temp:Number(o.temperature ?? o.temp ?? 0), pressure:Number(o.pressure ?? 0), humidity:Number(o.humidity ?? 0), status:String(o.status ?? o.state ?? 'NOMINAL').toUpperCase(), score:o.score ?? o.anomaly_score ?? null, source:o.source ?? 'AWS'};
}

export function normalizeAlert(a,i=0){
  return {id:a.id ?? a.alert_id ?? `INC-${i+1}`, stationId:a.station_id ?? a.stationId ?? a.station ?? 'UNKNOWN', sensor:a.sensor ?? a.parameter ?? 'Sensor', severity:String(a.severity ?? a.level ?? 'MEDIUM').toUpperCase(), status:String(a.status ?? 'OPEN').toUpperCase(), timestamp:a.timestamp ?? a.created_at ?? null, message:a.message ?? a.details ?? a.description ?? 'Anomaly detected', score:a.score ?? a.anomaly_score ?? null, confidence:a.confidence ?? null, value:a.value ?? null, expected:a.expected ?? null};
}


