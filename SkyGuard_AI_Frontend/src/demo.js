const STATIONS=[
{id:'AWS-KOL-DUM-01',name:'Dum Dum',wmo:'42809',lat:22.65,lng:88.45,temp:32.4,pressure:1004.2,humidity:68,health:99.8,status:'NORMAL'},
{id:'AWS-KOL-ALP-01',name:'Alipore',wmo:'42807',lat:22.53,lng:88.33,temp:33.1,pressure:1003.8,humidity:65,health:100,status:'NORMAL'},
{id:'AWS-KOL-CAN-01',name:'Canning',wmo:'42812',lat:22.31,lng:88.66,temp:34.2,pressure:1002.1,humidity:72,health:94.2,status:'WARNING'},
{id:'AWS-KOL-ULB-01',name:'Uluberia',wmo:'42805',lat:22.47,lng:88.11,temp:31.8,pressure:1005,humidity:62,health:98.5,status:'NORMAL'}
];
function seeded(n){const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x)}
export function demoStations(){return STATIONS.map((s,i)=>({...s,lastUpdate:new Date(Date.now()-i*18000).toISOString()}))}
export function demoObservations(){const out=[]; for(let i=0;i<72;i++){const st=STATIONS[i%4];const n=seeded(i+1);out.push({id:`OBS-DEMO-${i+1}`,stationId:st.id,timestamp:new Date(Date.now()-(71-i)*600000).toISOString(),temp:Number((st.temp+(n-.5)*1.6).toFixed(1)),pressure:Number((st.pressure+(seeded(i+7)-.5)*1.8).toFixed(1)),humidity:Number((st.humidity+(seeded(i+13)-.5)*7).toFixed(1)),status:i===55?'ANOMALY':'NOMINAL',score:i===55?.88:.05+(seeded(i+19)*.15),source:'SkyGuard demo stream'});} return out}
export function demoHistory(){const rows=[];for(let i=0;i<48;i++){const n=seeded(i+3);rows.push({time:new Date(Date.now()-(47-i)*30*60000).toISOString(),temp:Number((31+n*4).toFixed(1)),pressure:Number((1002+n*4).toFixed(1)),humidity:Number((61+n*15).toFixed(1))})}return rows}
export function demoAlerts(){return [{id:'INC-DEMO-001',stationId:'AWS-KOL-CAN-01',sensor:'Temperature',severity:'HIGH',status:'INVESTIGATING',timestamp:new Date(Date.now()-48*60000).toISOString(),message:'Sudden temperature excursion detected at Canning.',score:.88,confidence:.92,value:38.5,expected:'32–34 °C'}]}
