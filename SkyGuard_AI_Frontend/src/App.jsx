import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Activity,AlertTriangle,BarChart3,Bell,BellOff,Check,CheckCircle2,ChevronRight,Clock,CloudSun,Database,Download,FlaskConical,Gauge,Info,LayoutDashboard,Menu,Moon,Radio,RefreshCw,Search,Server,Shield,ShieldAlert,Sun, Thermometer,Wifi, X, Zap, Droplets, Wind, CircleHelp} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip as ChartTooltip,XAxis,YAxis} from 'recharts';
import {MapContainer,TileLayer,Marker,Popup,Tooltip as LeafletTooltip,useMap} from 'react-leaflet';
import L from 'leaflet';
import {api,DATA_MODE,normalizeAlert,normalizeObservation,normalizeStation,unwrapRows} from './api.js';
import {demoAlerts,demoHistory,demoObservations,demoStations} from './demo.js';

const icon=(status,number)=>L.divIcon({className:'sg-marker-wrap',html:`<div class="sg-marker ${status==='CRITICAL'?'critical':status==='WARNING'||status==='STALE'?'warning':'normal'}"><span>${number}</span></div>`,iconSize:[32,32],iconAnchor:[16,16]});
const fmtTime=(v)=>v?new Date(v).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
const fmtDate=(v)=>v?new Date(v).toLocaleString([],{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

class ErrorBoundary extends React.Component{state={error:null};static getDerivedStateFromError(error){return{error}}render(){if(this.state.error)return <div className="fatal"><ShieldAlert size={42}/><h2>Command Center recovered from a display error</h2><p>The monitoring workspace is still safe. Reload the dashboard to restore the view.</p><button className="primary" onClick={()=>location.reload()}>Reload dashboard</button></div>;return this.props.children}}
function MapView({stations,dark,onSelect}){const center=[22.49,88.39];return <div className="map-shell"><MapContainer center={center} zoom={10} scrollWheelZoom zoomControl={false} className={"map "+(dark?"map-dark":"")}><TileLayer attribution='&copy; OpenStreetMap contributors' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'/>{stations.map((s,i)=><Marker key={s.id} position={[s.lat,s.lng]} icon={icon(s.status,i+1)} eventHandlers={{click:()=>onSelect(s.id)}}><LeafletTooltip permanent direction="top" offset={[0,-18]} className="station-label"><strong>{i+1}. {s.name}</strong></LeafletTooltip><Popup><div className="popup"><strong>{s.name}</strong><span>{s.id}</span><b>{s.temp.toFixed(1)} °C</b><small>{s.status} · Health {s.health.toFixed(0)}%</small></div></Popup></Marker>)}</MapContainer><div className="map-legend"><span><i className="dot normal"/>Normal</span><span><i className="dot warning"/>Attention / stale</span><span><i className="dot critical"/>Critical</span></div></div>}

const NAV=[['overview','Overview',LayoutDashboard],['network','Network',Radio],['incidents','Incidents',ShieldAlert],['stations','Stations',Database],['observations','Observations',Activity],['analytics','Analytics',BarChart3],['system','System',Server]];

function App(){
 const [page,setPage]=useState('overview'),[dark,setDark]=useState(true),[mobile,setMobile]=useState(false),[muted,setMuted]=useState(false),[now,setNow]=useState(new Date()),[stations,setStations]=useState([]),[observations,setObservations]=useState([]),[history,setHistory]=useState([]),[alerts,setAlerts]=useState([]),[connected,setConnected]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selectedStation,setSelectedStation]=useState(''),[selectedAlert,setSelectedAlert]=useState(null),[search,setSearch]=useState(''),[severity,setSeverity]=useState('ALL'),[injectOpen,setInjectOpen]=useState(false),[toast,setToast]=useState(null),[refreshing,setRefreshing]=useState(false);
 const audioRef=useRef(null);
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t)},[]);
 const beep=()=>{if(muted)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=audioRef.current||new C();audioRef.current=c;const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(760,c.currentTime);o.frequency.exponentialRampToValueAtTime(420,c.currentTime+.28);g.gain.setValueAtTime(.001,c.currentTime);g.gain.exponentialRampToValueAtTime(.12,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.34);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.36)}catch{}}
 const load=async(silent=false)=>{if(!silent)setLoading(true);setError('');setRefreshing(true);try{if(DATA_MODE==='demo'){setStations(demoStations());setObservations(demoObservations());setHistory(demoHistory());setAlerts(demoAlerts());setConnected(false);return}const h=await api.health();setConnected(h.ok);if(!h.ok)throw new Error('FastAPI is not reachable');const [st,ob,hi,al]=await Promise.all([api.stations(),api.observations(),api.history(),api.alerts()]);setStations(unwrapRows(st).map(normalizeStation));setObservations(unwrapRows(ob).map(normalizeObservation));setHistory(unwrapRows(hi).map((x,i)=>({time:x.timestamp??x.time??new Date(Date.now()-(47-i)*1800000).toISOString(),temp:Number(x.temperature??x.temp??0),pressure:Number(x.pressure??0),humidity:Number(x.humidity??0)})));setAlerts(unwrapRows(al).map(normalizeAlert))}catch(e){setError(e.message);setConnected(false);if(DATA_MODE!=='live'){setStations(demoStations());setObservations(demoObservations());setHistory(demoHistory());setAlerts(demoAlerts())}}finally{setLoading(false);setRefreshing(false)}};
 useEffect(()=>{if(stations.length&&!stations.some(s=>s.id===selectedStation))setSelectedStation(stations[0].id)},[stations,selectedStation]);
 useEffect(()=>{load();const t=setInterval(async()=>{if(DATA_MODE==='live'){try{await api.replayTick?.()}catch{}}await load(true)},15000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(alerts.some(a=>a.severity==='HIGH'||a.severity==='CRITICAL'))beep()},[alerts]);
 const activeAlerts=alerts.filter(a=>!['RESOLVED','CLOSED'].includes(a.status));
 const critical=activeAlerts.filter(a=>a.severity==='CRITICAL'||a.severity==='HIGH').length;
 const healthy=stations.length?Math.round(stations.reduce((a,s)=>a+s.health,0)/stations.length):0;
 const current=stations.find(s=>s.id===selectedStation)||stations[0];
 const filteredStations=stations.filter(s=>(s.id+' '+s.name+' '+s.wmo).toLowerCase().includes(search.toLowerCase()));
 const filteredAlerts=alerts.filter(a=>severity==='ALL'||a.severity===severity);
 const inject=async(type,value,stationId)=>{const st=stations.find(s=>s.id===stationId)||current||stations[0];if(!st){setToast({kind:'bad',text:'Select a station before generating an event.'});return}const numeric=Number(value);if(type!=='frozen'&&!Number.isFinite(numeric)){setToast({kind:'bad',text:'Enter a numeric sensor value.'});return}let payload={station_id:st.id,timestamp:new Date().toISOString(),temperature:st.temp,pressure:st.pressure,humidity:st.humidity,data_source:'SIMULATED_REPLAY',anomaly_type:type==='frozen'?'FROZEN_SENSOR':type==='temperature'?'TEMPERATURE_SPIKE':type==='pressure'?'PRESSURE_ANOMALY':'HUMIDITY_ANOMALY',anomaly_class:'SENSOR_ANOMALY',is_injected_anomaly:true};if(type==='temperature')payload.temperature=numeric;if(type==='pressure')payload.pressure=numeric;if(type==='humidity')payload.humidity=numeric;try{if(DATA_MODE==='live'){const created=await api.createObservation(payload);const fresh=unwrapRows(await api.alerts()).map(normalizeAlert);setAlerts(fresh);const createdId=created?.data?.id?`alert-${created.data.id}`:fresh[0]?.id;setSelectedAlert(createdId||fresh[0]?.id||null)}else{const local={id:`INC-TEST-${Date.now()}`,stationId:st.id,sensor:type==='temperature'?'Temperature':type==='pressure'?'Pressure':type==='humidity'?'Humidity':'Sensor',severity:'HIGH',status:'INVESTIGATING',timestamp:new Date().toISOString(),message:type==='frozen'?'Controlled frozen-sensor test event generated.':`Controlled ${type} excursion submitted to the observation pipeline.`,score:.9,confidence:.95,value:type==='temperature'?payload.temperature:type==='pressure'?payload.pressure:type==='humidity'?payload.humidity:'Repeated value',expected:'Baseline envelope'};setAlerts(a=>[local,...a]);setSelectedAlert(local.id)}setToast({kind:'ok',text:`${type==='frozen'?'Frozen sensor':type==='temperature'?'Temperature':type==='pressure'?'Pressure':'Humidity'} test event generated for ${st.name}.`});beep();setInjectOpen(false);setPage('incidents')}catch(e){setToast({kind:'bad',text:'Event submission failed: '+e.message})}};
 const acknowledge=async id=>{try{if(DATA_MODE==='live')await api.alertAction?.(id,{state:'ACKNOWLEDGED',note:'Operator acknowledged the alarm.'});setAlerts(a=>a.map(x=>x.id===id?{...x,status:'ACKNOWLEDGED'}:x));await load(true);setSelectedAlert(id);setToast({kind:'ok',text:'Incident acknowledged.'})}catch(e){setToast({kind:'bad',text:'Acknowledge failed: '+e.message})}};
 const resolve=async id=>{try{if(DATA_MODE==='live')await api.alertAction?.(id,{state:'CLOSED',note:'Operator resolved the incident after recovery.'});setAlerts(a=>a.map(x=>x.id===id?{...x,status:'RESOLVED'}:x));await load(true);setSelectedAlert(id);setToast({kind:'ok',text:'Incident resolved. Monitoring continues.'})}catch(e){setToast({kind:'bad',text:'Resolve failed: '+e.message})}};
 const exportCsv=()=>{const rows=observations.map(o=>[o.timestamp,o.stationId,o.temp,o.pressure,o.humidity,o.status,o.score??'']);const csv=[['timestamp','station_id','temperature','pressure','humidity','status','score'],...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='skyguard-observations.csv';a.click();URL.revokeObjectURL(a.href)};
 return <ErrorBoundary><div className={dark?'app dark':'app'}><aside className={mobile?'sidebar mobile-open':'sidebar'}><div className="brand"><div className="brand-mark"><Shield size={21}/></div><div><strong>SKYGUARD</strong><small>ENVIRONMENTAL INTELLIGENCE</small></div><button className="icon-btn mobile-close" onClick={()=>setMobile(false)}><X size={18}/></button></div><div className="network-pill"><span className={connected?'pulse online':'pulse'}></span><div><b>{connected?'Live network':'Demo workspace'}</b><small>{connected?'FastAPI connected':'Deterministic presentation data'}</small></div></div><nav>{NAV.map(([id,label,Icon])=><button key={id} className={page===id?'nav active':'nav'} onClick={()=>{setPage(id);setMobile(false)}}><Icon size={18}/><span>{label}</span>{id==='incidents'&&critical>0?<em>{critical}</em>:null}</button>)}</nav><div className="side-bottom"><button className="inject-nav" onClick={()=>setInjectOpen(true)}><Zap size={17}/><span>Event Injection</span></button><div className="side-meta"><span>PS 26073</span><span>SkyGuard AI</span></div></div></aside>
 <main className="main"><header className="topbar"><button className="icon-btn menu-btn" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb"><span>Command Center</span><ChevronRight size={15}/><b>{NAV.find(x=>x[0]===page)?.[1]}</b></div><div className="top-actions"><div className="clock"><Clock size={15}/><span>{now.toLocaleTimeString()}</span></div><button className="icon-btn" title="Mute alarm" onClick={()=>setMuted(!muted)}>{muted?<BellOff size={18}/>:<Bell size={18}/>}</button><button className="icon-btn" onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="icon-btn" onClick={()=>load()} disabled={refreshing}><RefreshCw size={17} className={refreshing?'spin':''}/></button></div></header><div className="content">{toast&&<div className={'toast '+toast.kind}><CheckCircle2 size={17}/>{toast.text}<button onClick={()=>setToast(null)}><X size={14}/></button></div>}{error&&<div className="api-banner"><Wifi size={17}/><div><b>Live API unavailable</b><span>{error}. Start FastAPI or switch VITE_DATA_MODE to demo.</span></div></div>}{page==='overview'&&<Overview stations={stations} observations={observations} current={current} alerts={activeAlerts} history={history} healthy={healthy} critical={critical} onStation={setSelectedStation} onPage={setPage} dark={dark}/>} {page==='network'&&<Network stations={stations} selected={selectedStation} onSelect={setSelectedStation} dark={dark}/>} {page==='incidents'&&<Incidents alerts={filteredAlerts} stations={stations} selected={selectedAlert} onSelect={setSelectedAlert} onAck={acknowledge} onResolve={resolve} severity={severity} setSeverity={setSeverity}/>} {page==='stations'&&<Stations stations={filteredStations} search={search} setSearch={setSearch} selected={selectedStation} onSelect={setSelectedStation} onExport={()=>{const csv=[['id','name','wmo','latitude','longitude','status','health'],...filteredStations.map(s=>[s.id,s.name,s.wmo,s.lat,s.lng,s.status,s.health])].map(r=>r.join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='skyguard-stations.csv';a.click()}}/>}{page==='observations'&&<Observations rows={observations} onExport={exportCsv}/>} {page==='analytics'&&<Analytics history={history} observations={observations} alerts={alerts}/>} {page==='system'&&<System connected={connected} mode={DATA_MODE} api={api.baseUrl} stations={stations.length} observations={observations.length}/>}</div></main>{injectOpen&&<Injection stations={stations} current={current} selectedStation={selectedStation} onClose={()=>setInjectOpen(false)} onInject={inject}/>}</div></ErrorBoundary>
}

function SectionHead({eyebrow,title,sub,action}){return <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{sub&&<p>{sub}</p>}</div>{action}</div>}
function Stat({icon:Icon,label,value,detail,tone='normal'}){return <div className="stat"><div className={'stat-icon '+tone}><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>}
function Overview({
  stations,
  observations,
  current,
  alerts,
  history,
  healthy,
  critical,
  onStation,
  onPage,
  dark
}){
  const chart=history.slice(-24).map((x,i)=>({
    rawTime:x.time,
    displayTime:fmtTime(x.time),
    sample:i+1,
    temp:Number(x.temp??0),
    pressure:Number(x.pressure??0),
    humidity:Number(x.humidity??0)
  }));

  const latest=chart.at(-1);

  return <>
    <SectionHead
      eyebrow="OPERATIONS / REAL-TIME"
      title="Environmental command center"
      sub="A focused view of AWS health, anomalies and sensor integrity across the Kolkata network."
      action={
        <button className="primary" onClick={()=>onPage('incidents')}>
          <ShieldAlert size={16}/>
          Review incidents
        </button>
      }
    />

    <div className="stat-grid">
      <Stat
        icon={Radio}
        label="Network health"
        value={stations.length?healthy+'%':'—'}
        detail={`${stations.length} stations reporting`}
        tone={healthy<95?'warn':'normal'}
      />
      <Stat
        icon={ShieldAlert}
        label="Active incidents"
        value={critical}
        detail={critical?'Operator attention required':'No critical incidents'}
        tone={critical?'danger':'normal'}
      />
      <Stat
        icon={Activity}
        label="Observations"
        value={observations.length}
        detail="Loaded observation window"
      />
      <Stat
        icon={CloudSun}
        label="Data freshness"
        value={current?.lastUpdate?'LIVE':'—'}
        detail={current?.lastUpdate?fmtTime(current.lastUpdate):'Awaiting telemetry'}
        tone="live"
      />
    </div>

    <div className="overview-grid">
      <div className="panel map-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">SPATIAL MONITOR</span>
            <h3>Kolkata AWS network</h3>
          </div>
          <span className="live-chip"><i/>LIVE</span>
        </div>
        <MapView stations={stations} dark={dark} onSelect={onStation}/>
      </div>

      <div className="panel network-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">STATION HEALTH</span>
            <h3>Network pulse</h3>
          </div>
          <button className="text-btn" onClick={()=>onPage('stations')}>
            View all <ChevronRight size={14}/>
          </button>
        </div>

        <div className="station-list">
          {stations.slice(0,4).map(s=>
            <button className="station-row" key={s.id} onClick={()=>onStation(s.id)}>
              <div className={'status-orb '+(s.status==='WARNING'||s.status==='STALE'?'warn':s.status==='CRITICAL'?'danger':'')}>
                <Radio size={15}/>
              </div>
              <div className="station-main">
                <b>{s.name}</b>
                <span>{s.id}</span>
              </div>
              <div className="station-metric">
                <b>{s.temp.toFixed(1)}°</b>
                <span>{s.health.toFixed(0)}% health</span>
              </div>
              <ChevronRight size={15}/>
            </button>
          )}
        </div>
      </div>
    </div>

    <div className="bottom-grid">

      <div className="panel chart-panel telemetry-fx">

        <div className="telemetry-header">
          <div>
            <span className="eyebrow">LIVE TELEMETRY MATRIX</span>
            <h3>Environmental signal spectrum</h3>
            <p className="telemetry-sub">
              Temperature, pressure and humidity across the latest replay window.
            </p>
          </div>

          <div className="signal-status">
            <span className="signal-live"><i/>LIVE STREAM</span>
            <span className="signal-time">{chart.length} samples</span>
          </div>
        </div>

        <div className="telemetry-chips">
          <div className="telemetry-chip temperature-chip">
            <i/>
            <span>Temperature</span>
            <b>{latest?.temp!=null?latest.temp.toFixed(1)+' °C':'—'}</b>
          </div>

          <div className="telemetry-chip pressure-chip">
            <i/>
            <span>Pressure</span>
            <b>{latest?.pressure!=null?latest.pressure.toFixed(1)+' hPa':'—'}</b>
          </div>

          <div className="telemetry-chip humidity-chip">
            <i/>
            <span>Humidity</span>
            <b>{latest?.humidity!=null?latest.humidity.toFixed(0)+'%':'—'}</b>
          </div>
        </div>

        <div className="chart futuristic-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chart}
              margin={{top:18,right:20,left:12,bottom:10}}
            >
              <defs>
                <linearGradient id="humidityGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--green)" stopOpacity=".20"/>
                  <stop offset="100%" stopColor="var(--green)" stopOpacity="0"/>
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="2 7"
                vertical
                horizontal
                className="telemetry-grid"
              />

              <XAxis
                dataKey="displayTime"
                tick={{fontSize:9}}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />

              <YAxis yAxisId="t" hide domain={['dataMin - 5','dataMax + 5']}/>
              <YAxis yAxisId="p" orientation="right" hide domain={['dataMin - 5','dataMax + 5']}/>
              <YAxis yAxisId="h" hide domain={[0,100]}/>

              <ChartTooltip
                cursor={{
                  stroke:'var(--cyan)',
                  strokeWidth:1,
                  strokeDasharray:'4 5'
                }}
                contentStyle={{
                  background:'rgba(7,17,31,.97)',
                  border:'1px solid rgba(90,205,255,.32)',
                  borderRadius:12,
                  boxShadow:'0 10px 35px rgba(0,0,0,.32)'
                }}
                labelStyle={{
                  color:'#dcefff',
                  fontWeight:700,
                  marginBottom:6
                }}
              />

              <Area
                yAxisId="h"
                type="monotone"
                dataKey="humidity"
                stroke="var(--green)"
                fill="url(#humidityGlow)"
                strokeWidth={2}
                fillOpacity={1}
                dot={false}
                activeDot={{r:5,strokeWidth:2}}
                connectNulls
              />

              <Line
                yAxisId="h"
                type="monotone"
                dataKey="humidity"
                name="Humidity"
                stroke="var(--green)"
                strokeWidth={3}
                dot={false}
                activeDot={{r:5,strokeWidth:2}}
                connectNulls
              />

              <Line
                yAxisId="t"
                type="monotone"
                dataKey="temp"
                name="Temperature"
                stroke="var(--cyan)"
                strokeWidth={3}
                dot={false}
                activeDot={{r:5,strokeWidth:2}}
                connectNulls
              />

              <Line
                yAxisId="p"
                type="monotone"
                dataKey="pressure"
                name="Pressure"
                stroke="var(--violet)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{r:5,strokeWidth:2}}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="futuristic-legend">
          <span><i className="legend-line temp-line"/>Temperature</span>
          <span><i className="legend-line pressure-line"/>Pressure</span>
          <span><i className="legend-line humidity-line"/>Humidity</span>
        </div>

      </div>

      <div className="panel incident-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">ATTENTION QUEUE</span>
            <h3>Recent incidents</h3>
          </div>
          <button className="text-btn" onClick={()=>onPage('incidents')}>
            Open queue
          </button>
        </div>

        {alerts.slice(0,3).map(a=>
          <div className="incident-mini" key={a.id}>
            <div className={'severity '+a.severity.toLowerCase()}>
              {a.severity[0]}
            </div>
            <div>
              <b>{a.sensor} anomaly</b>
              <span>{a.stationId} · {fmtDate(a.timestamp)}</span>
            </div>
            <ChevronRight size={15}/>
          </div>
        )}

        {!alerts.length&&
          <div className="empty">
            <CheckCircle2/> Network nominal
          </div>
        }
      </div>

    </div>
  </>;
}

function Network({stations,selected,onSelect,dark}){return <><SectionHead eyebrow="NETWORK / SPATIAL" title="Live AWS network" sub="Station geography, current telemetry and communication health."/><div className="network-layout"><div className="panel full-map"><MapView stations={stations} dark={dark} onSelect={onSelect}/></div><div className="panel detail-panel"><span className="eyebrow">SELECTED STATION</span>{stations.filter(s=>s.id===selected).map(s=><React.Fragment key={s.id}><h2>{s.name}</h2><p className="mono">{s.id}</p><div className="metric-big"><span>Health</span><strong>{s.health.toFixed(1)}%</strong></div><div className="sensor-grid"><Sensor icon={Thermometer} label="Temperature" value={`${s.temp.toFixed(1)} °C`}/><Sensor icon={Gauge} label="Pressure" value={`${s.pressure.toFixed(1)} hPa`}/><Sensor icon={Droplets} label="Humidity" value={`${s.humidity.toFixed(0)} %`}/><Sensor icon={Wifi} label="Link" value="Connected"/></div><div className="station-meta"><span>WMO {s.wmo}</span><span>Updated {fmtTime(s.lastUpdate)}</span></div></React.Fragment>)}</div></div></>}
function Sensor({icon:Icon,label,value}){return <div className="sensor"><Icon size={17}/><span>{label}</span><b>{value}</b></div>}
function Incidents({alerts,stations,selected,onSelect,onAck,onResolve,severity,setSeverity}){
 const current=alerts.find(a=>a.id===selected)||alerts[0];
 const stationById=useMemo(()=>Object.fromEntries(stations.map(s=>[s.id,s])),[stations]);
 const stationName=(id)=>stationById[id]?.name||id||'Unknown station';
 const station=stationById[current?.stationId];
 return <><SectionHead eyebrow="INCIDENT MANAGEMENT" title="Incidents & response" sub="Every incident shows the station, sensor, detection time, measured value and operator response in one place." action={<div className="incident-toolbar-actions"><div className="filter-label">Severity</div><select className="select" value={severity} onChange={e=>setSeverity(e.target.value)}><option>ALL</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></div>}/>
 <div className="incident-layout">
  <div className="panel incident-table incident-table-redesign">
   <div className="incident-table-title"><div><span className="eyebrow">ACTIVE QUEUE</span><h3>{alerts.length} incident{alerts.length===1?'':'s'}</h3></div><span className="muted">Select a row for full evidence</span></div>
   <div className="incident-table-head"><span>INCIDENT</span><span>STATION / SENSOR</span><span>DETECTED</span><span>VALUE</span><span>STATUS</span></div>
   {alerts.map(a=><button className={'incident-row incident-row-rich '+(current?.id===a.id?'selected':'')} key={a.id} onClick={()=>onSelect(a.id)}>
    <div className="incident-primary"><span className={'severity-dot '+a.severity.toLowerCase()}></span><div><b>{a.sensor||'Sensor'} anomaly</b><span>{a.id}</span></div></div>
    <div><b>{stationName(a.stationId)}</b><span>{a.sensor||'Sensor'} · {a.stationId}</span></div>
    <div><b>{fmtDate(a.timestamp)}</b><span>{fmtTime(a.timestamp)}</span></div>
    <div><b>{a.value??'—'}</b><span>{a.expected??'Expected baseline'}</span></div>
    <div><span className={'badge '+a.severity.toLowerCase()}>{a.severity}</span><span className={'status-badge '+String(a.status||'OPEN').toLowerCase()}>{a.status}</span></div>
   </button>)}
   {!alerts.length&&<div className="empty incident-empty"><CheckCircle2/><b>No incidents match this filter.</b><span>The queue is clear for the selected severity.</span></div>}
  </div>
  <div className="panel incident-detail incident-detail-redesign">
   {current?<><div className="detail-top incident-detail-header"><div><span className={'badge '+current.severity.toLowerCase()}>{current.severity} priority</span><h2>{current.sensor||'Sensor'} anomaly</h2><p className="detail-subtitle">{stationName(current.stationId)}</p></div><div className="incident-header-icon"><ShieldAlert size={28}/></div></div>
    <div className="incident-meta-grid">
      <div><span>STATION</span><b>{stationName(current.stationId)}</b><small>{current.stationId}</small></div>
      <div><span>SENSOR</span><b>{current.sensor||'Sensor'}</b><small>Environmental telemetry</small></div>
      <div><span>DETECTED</span><b>{fmtDate(current.timestamp)}</b><small>{fmtTime(current.timestamp)}</small></div>
      <div><span>STATUS</span><b className="incident-status-text">{current.status}</b><small>Operator workflow</small></div>
    </div>
    <div className="why why-rich"><div className="why-icon"><CircleHelp/></div><div><span className="eyebrow">DETECTION REASON</span><p>{current.message||'The monitoring model flagged this observation for operator review.'}</p></div></div>
    <div className="evidence-section"><div className="evidence-section-head"><div><span className="eyebrow">MEASUREMENT EVIDENCE</span><h3>What the system observed</h3></div></div><div className="evidence-grid evidence-grid-rich">
      <div><span>Observed</span><b>{current.value??'—'}</b></div>
      <div><span>Expected</span><b>{current.expected??'Baseline envelope'}</b></div>
      <div><span>Anomaly score</span><b>{current.score!=null?Number(current.score).toFixed(2):'—'}</b></div>
      <div><span>Confidence</span><b>{current.confidence!=null?Math.round(Number(current.confidence)*100)+'%':'—'}</b></div>
    </div></div>
    {station&&<div className="current-telemetry"><div className="evidence-section-head"><div><span className="eyebrow">LATEST STATION TELEMETRY</span><h3>Current station state</h3></div><span className={'status-badge '+String(station.status).toLowerCase()}>{station.status}</span></div><div className="telemetry-mini-grid">
      <div><span>Temperature</span><b>{station.temp.toFixed(1)} °C</b></div><div><span>Pressure</span><b>{station.pressure.toFixed(1)} hPa</b></div><div><span>Humidity</span><b>{station.humidity.toFixed(0)}%</b></div><div><span>Health</span><b>{station.health.toFixed(0)}%</b></div>
    </div></div>}
    <div className="timeline timeline-rich"><div className="timeline-line"/><TimelineItem title="Sensor reading received" time={fmtTime(current.timestamp)} done/><TimelineItem title="Abnormal deviation detected" time={fmtTime(current.timestamp)} done/><TimelineItem title="Operator workflow initiated" time={current.status==='OPEN'?'Pending':fmtTime(current.timestamp)} done={current.status!=='OPEN'}/><TimelineItem title={current.status==='RESOLVED'?'Incident resolved':current.status==='ACKNOWLEDGED'?'Acknowledged — monitoring recovery':'Awaiting operator response'} time="Current" done={current.status==='RESOLVED'||current.status==='ACKNOWLEDGED'}/></div>
    <div className="detail-actions detail-actions-rich">{current.status!=='ACKNOWLEDGED'&&current.status!=='RESOLVED'&&<button className="secondary action-btn" onClick={()=>onAck(current.id)}><Check size={16}/>Acknowledge</button>}{current.status!=='RESOLVED'&&<button className="primary action-btn" onClick={()=>onResolve(current.id)}><CheckCircle2 size={16}/>Resolve incident</button>}</div>
   </>:<div className="empty large"><Shield/><b>Select an incident</b><span>Station, sensor, timing, measurements and response controls will appear here.</span></div>}
  </div>
 </div></>
}
function TimelineItem({title,time,done}){return <div className={'timeline-item '+(done?'done':'')}><div className="timeline-dot"/><div><b>{title}</b><span>{time}</span></div></div>}
function Stations({stations,search,setSearch,selected,onSelect,onExport}){return <><SectionHead eyebrow="NETWORK / STATIONS" title="Station registry" sub="Current AWS nodes, sensor health and communication state." action={<button className="secondary" onClick={onExport}><Download size={16}/>Export CSV</button>}/><div className="panel"><div className="toolbar"><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search station, WMO or ID…"/></div><span className="muted">{stations.length} stations</span></div><div className="station-table"><div className="table-head"><span>STATION</span><span>LOCATION</span><span>TELEMETRY</span><span>HEALTH</span><span>STATE</span></div>{stations.map(s=><button className={'station-row wide '+(selected===s.id?'selected':'')} key={s.id} onClick={()=>onSelect(s.id)}><div className="station-main"><b>{s.name}</b><span>{s.id}</span></div><span className="mono">WMO {s.wmo}</span><span>{s.temp.toFixed(1)}°C · {s.humidity.toFixed(0)}%</span><div className="health"><div><i style={{width:`${clamp(s.health,0,100)}%`}}/></div><b>{s.health.toFixed(0)}%</b></div><span className={'status-badge '+s.status.toLowerCase()}>{s.status}</span></button>)}</div></div></>}
function Observations({rows,onExport}){const recent=[...rows].reverse().slice(0,40);return <><SectionHead eyebrow="DATA / OBSERVATIONS" title="Observation stream" sub="Raw sensor observations received by the command center." action={<button className="secondary" onClick={onExport}><Download size={16}/>Export CSV</button>}/><div className="panel"><div className="toolbar"><span className="muted">Latest {recent.length} observations</span><span className="live-chip"><i/>STREAM</span></div><div className="obs-table"><div className="table-head"><span>TIME</span><span>STATION</span><span>TEMP</span><span>PRESSURE</span><span>HUMIDITY</span><span>STATE</span></div>{recent.map(o=><div className="obs-row" key={o.id}><span>{fmtDate(o.timestamp)}</span><span className="mono">{o.stationId}</span><b>{o.temp.toFixed(1)} °C</b><span>{o.pressure.toFixed(1)} hPa</span><span>{o.humidity.toFixed(0)}%</span><span className={'status-badge '+o.status.toLowerCase()}>{o.status}</span></div>)}</div></div></>}
function Analytics({history,observations,alerts}){const data=history.map(x=>({time:fmtTime(x.time),temperature:x.temp,pressure:x.pressure,humidity:x.humidity}));const anomalies=observations.filter(x=>x.status==='ANOMALY').length;return <><SectionHead eyebrow="ANALYTICS / SIGNAL QUALITY" title="Telemetry analytics" sub="Trend views for environmental variables and anomaly activity."/><div className="stat-grid"><Stat icon={Activity} label="Samples" value={observations.length} detail="Loaded observation window"/><Stat icon={AlertTriangle} label="Flagged" value={anomalies} detail="Observation-level anomalies" tone={anomalies?'warn':'normal'}/><Stat icon={Shield} label="Incidents" value={alerts.length} detail="Current incident records"/></div><div className="analytics-grid"><div className="panel chart-panel tall"><div className="panel-head"><div><span className="eyebrow">ENVIRONMENTAL SIGNAL</span><h3>Temperature trend</h3></div></div><div className="chart tall-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cyan)" stopOpacity=".35"/><stop offset="100%" stopColor="var(--cyan)" stopOpacity="0"/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" hide/><YAxis hide/><ChartTooltip contentStyle={{background:'var(--panel2)',border:'1px solid var(--border)',borderRadius:12}}/><Area type="monotone" dataKey="temperature" stroke="var(--cyan)" fill="url(#tempFill)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div></div><div className="panel"><div className="panel-head"><div><span className="eyebrow">SIGNAL QUALITY</span><h3>Current variables</h3></div></div><div className="quality"><Quality label="Temperature" value={observations.at(-1)?.temp??0} unit="°C" icon={Thermometer}/><Quality label="Pressure" value={observations.at(-1)?.pressure??0} unit="hPa" icon={Gauge}/><Quality label="Humidity" value={observations.at(-1)?.humidity??0} unit="%" icon={Droplets}/></div></div></div></>}
function Quality({label,value,unit,icon:Icon}){return <div className="quality-row"><div className="quality-icon"><Icon size={17}/></div><div><span>{label}</span><b>{Number(value).toFixed(1)} {unit}</b></div><div className="quality-bar"><i style={{width:'72%'}}/></div></div>}
function System({connected,mode,api:apiUrl,stations,observations}){return <><SectionHead eyebrow="SYSTEM / OBSERVABILITY" title="System status" sub="Runtime connectivity and data-source transparency."/><div className="system-grid"><div className="panel"><span className="eyebrow">BACKEND CONNECTION</span><div className="system-status"><div className={'big-status '+(connected?'ok':'bad')}>{connected?<CheckCircle2/>:<Wifi/>}</div><div><h2>{connected?'Connected':'Not connected'}</h2><p>{apiUrl}</p></div></div><div className="system-list"><Row label="FastAPI" value={connected?'Reachable':'Unavailable'} ok={connected}/><Row label="Data mode" value={mode==='live'?'LIVE API':'DEMO'} ok={mode==='live'?connected:true}/><Row label="Stations loaded" value={stations}/><Row label="Observations loaded" value={observations}/></div></div><div className="panel"><span className="eyebrow">ENGINEERING NOTES</span><div className="notes"><div><Shield size={18}/><b>Evidence-first alerts</b><p>Incidents are displayed with the available observation context instead of hiding the reason behind a single score.</p></div><div><Database size={18}/><b>Backend compatible</b><p>The dashboard is isolated behind a small API adapter so the visual layer does not depend on mock object shapes.</p></div><div><FlaskConical size={18}/><b>Controlled test events</b><p>Event Injection is clearly marked as a test workflow and can submit observations through the configured API.</p></div></div></div></div></>}
function Row({label,value,ok}){return <div className="sys-row"><span>{label}</span><b>{value}</b>{ok!=null&&<i className={ok?'ok':'bad'}>{ok?'●':'●'}</i>}</div>}
function Injection({
  stations=[],
  current,
  selectedStation,
  onClose,
  onInject
}){
  const stationList=Array.isArray(stations)?stations:[];

  const [stationId,setStationId]=useState(
    selectedStation||current?.id||stationList[0]?.id||''
  );

  const [type,setType]=useState('temperature');

  const station=
    stationList.find(s=>s.id===stationId)||
    current||
    stationList[0];

  const [value,setValue]=useState('');

  useEffect(()=>{
    if(station&&!stationId){
      setStationId(station.id);
    }
  },[station,stationId]);

  useEffect(()=>{
    if(type==='temperature'){
      setValue(
        station
          ?(Number(station.temp)+7).toFixed(1)
          :''
      );
    }else if(type==='pressure'){
      setValue(
        station
          ?(Number(station.pressure)+12).toFixed(1)
          :''
      );
    }else if(type==='humidity'){
      setValue(
        station
          ?Math.min(100,Number(station.humidity)+8).toFixed(1)
          :''
      );
    }else{
      setValue('');
    }
  },[type,station?.id]);

  const submit=()=>{
    if(!station){
      return;
    }

    if(type!=='frozen'&&!Number.isFinite(Number(value))){
      return;
    }

    onInject(type,value,stationId);
  };

  return (
    <div className="modal-backdrop">

      <div className="modal modal-injection">

        <div className="modal-head">

          <div>
            <span className="eyebrow">
              CONTROLLED TEST WORKFLOW
            </span>

            <h2>Event Injection</h2>

            <p>
              Select a specific station and generate a controlled
              temperature, pressure, humidity, or frozen-sensor event.
            </p>
          </div>

          <button
            className="icon-btn"
            onClick={onClose}
          >
            <X/>
          </button>

        </div>

        <div className="inject-section">

          <label className="field field-block">

            <span className="field-title">
              TARGET STATION
            </span>

            <div className="select-wrap">

              <select
                value={stationId||''}
                onChange={e=>setStationId(e.target.value)}
              >

                <option value="" disabled>
                  Select a station
                </option>

                {stationList.map(s=>(
                  <option
                    key={s.id}
                    value={s.id}
                  >
                    {s.name} — {s.id}
                  </option>
                ))}

              </select>

              <ChevronRight size={16}/>

            </div>

          </label>

          {station&&(
            <div className="target-summary">

              <div>
                <span>STATION</span>
                <b>{station.name}</b>
                <small>
                  {station.id} · WMO {station.wmo}
                </small>
              </div>

              <div>
                <span>TEMP</span>
                <b>
                  {Number(station.temp).toFixed(1)} °C
                </b>
              </div>

              <div>
                <span>PRESSURE</span>
                <b>
                  {Number(station.pressure).toFixed(1)} hPa
                </b>
              </div>

              <div>
                <span>HUMIDITY</span>
                <b>
                  {Number(station.humidity).toFixed(0)}%
                </b>
              </div>

            </div>
          )}

        </div>

        <div className="inject-section">

          <span className="field-title">
            EVENT TYPE
          </span>

          <div className="type-grid type-grid-rich">

            <button
              type="button"
              className={
                type==='temperature'
                  ?'type-card type-card-rich active'
                  :'type-card type-card-rich'
              }
              onClick={()=>setType('temperature')}
            >
              <div className="type-card-icon">
                <Thermometer size={20}/>
              </div>
              <b>Temperature anomaly</b>
              <span>
                Create a sudden temperature excursion
              </span>
            </button>

            <button
              type="button"
              className={
                type==='pressure'
                  ?'type-card type-card-rich active'
                  :'type-card type-card-rich'
              }
              onClick={()=>setType('pressure')}
            >
              <div className="type-card-icon">
                <Gauge size={20}/>
              </div>
              <b>Pressure anomaly</b>
              <span>
                Create a pressure excursion
              </span>
            </button>

            <button
              type="button"
              className={
                type==='humidity'
                  ?'type-card type-card-rich active'
                  :'type-card type-card-rich'
              }
              onClick={()=>setType('humidity')}
            >
              <div className="type-card-icon">
                <Droplets size={20}/>
              </div>
              <b>Humidity anomaly</b>
              <span>
                Create a sudden humidity excursion
              </span>
            </button>

            <button
              type="button"
              className={
                type==='frozen'
                  ?'type-card type-card-rich active'
                  :'type-card type-card-rich'
              }
              onClick={()=>setType('frozen')}
            >
              <div className="type-card-icon">
                <Database size={20}/>
              </div>
              <b>Frozen sensor</b>
              <span>
                Repeat current readings to simulate a stuck sensor
              </span>
            </button>

          </div>

        </div>

        <div className="inject-section">

          {type!=='frozen' ? (

            <label className="field field-block">

              <span className="field-title">
                INJECTED {type.toUpperCase()} VALUE
              </span>

              <div className="input-wrap input-wrap-large">

                <input
                  autoFocus
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={e=>setValue(e.target.value)}
                />

                <span>
                  {type==='temperature'
                    ?'°C'
                    :type==='pressure'
                      ?'hPa'
                      :'%'}
                </span>

              </div>

              <small className="field-help">
                Enter an abnormal value to exercise the
                detection and incident workflow.
              </small>

            </label>

          ):(
            <div className="frozen-note frozen-note-rich">

              <Database size={20}/>

              <div>

                <b>Frozen sensor test</b>

                <span>
                  Current temperature, pressure and humidity
                  will be submitted unchanged for
                  {' '}
                  {station?.name||'the selected station'}.
                </span>

              </div>

            </div>
          )}

        </div>

        {station&&(
          <div className="injection-review">

            <div>
              <span>Target</span>
              <b>{station.name}</b>
            </div>

            <div>
              <span>Sensor</span>
              <b>
                {type==='temperature'
                  ?'Temperature'
                  :type==='pressure'
                    ?'Pressure'
                    :type==='humidity'
                      ?'Humidity'
                      :'All values'}
              </b>
            </div>

            <div>
              <span>Value</span>
              <b>
                {type==='frozen'
                  ?'Repeated current value'
                  :`${value} ${
                    type==='temperature'
                      ?'°C'
                      :type==='pressure'
                        ?'hPa'
                        :'%'
                  }`}
              </b>
            </div>

          </div>
        )}

        <div className="modal-footer modal-footer-rich">

          <button
            className="secondary"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="danger-btn generate-btn"
            disabled={
              !station||
              (
                type!=='frozen'&&
                !Number.isFinite(Number(value))
              )
            }
            onClick={submit}
          >
            <Zap size={17}/>
            Generate test event
          </button>

        </div>

      </div>

    </div>
  );
}

export default App;
