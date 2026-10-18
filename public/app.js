// Step Free Chicago Transit. Stations and outer track geometry come from public/cta-data.js (scripts/build_data.py);
// downtown (Loop, West Loop, River North) is hand-maintained below and overrides the generated data.
const COLOR = {red:'#C60C30',blue:'#00A1DE',brown:'#62361B',green:'#009B3A',orange:'#F9461C',pink:'#E27EA6',purple:'#522398',yellow:'#F9E300'};
const LINE_NAME = {red:'Red',blue:'Blue',brown:'Brown',green:'Green',orange:'Orange',pink:'Pink',purple:'Purple',yellow:'Yellow'};
const LIGHT_CHIP = new Set(['pink','yellow']);  // chips that need dark text

// k: y = elevator, n = stairs only, c = closed. id = CTA station (map) ID used by the alerts feed.
// match = station name as the alerts feed spells it, only where the name is unique systemwide.
// alt = nearest stations with elevators as [name, detail]; bus = accessible bus options as [route, detail], detail
// "<direction> to <station>, <distance>" (generated outside downtown by scripts/build_data.py).
// alt means "use this station instead", which works in either direction. Loop lines run one way, so Loop entries
// give which lines stop there, never "next stop"; that wording is only used on two-way track (Red, Blue,
// Green/Pink west of the Loop, Brown/Purple north), and at multi-line stations it names the line(s): "next stop
// west" on Green and on Pink are different stations. Sorted by distance. Every entry starts with an approximate distance: along the
// street grid, or straight line +15% where the Blue Line follows diagonal Milwaukee Ave.
// Shown always for stairs-only stations, and for elevator stations while an elevator alert is active.
// Downtown stations: hand-placed on the hand-drawn tracks, with labels, notes and Loop-aware alternatives.
const DOWNTOWN = [
  {id:40380,name:'Clark/Lake',match:'Clark/Lake',ll:[41.8857,-87.6309],k:'y',lines:['blue','brown','green','orange','pink','purple'],side:'right',note:'Elevated platforms and Blue Line subway both have elevators.',alt:[['Washington/Wells', '0.3 mi · Brown, Orange, Pink, Purple'], ['Washington/Wabash', '0.4 mi · all elevated lines here'], ['Jackson (Blue)', '0.6 mi · 3 stops toward Forest Park'], ['Western (Blue, O’Hare branch)', '4.1 mi · 5 stops toward O’Hare']]},
  {id:40260,name:'State/Lake',match:'State/Lake',ll:[41.8858,-87.6278],k:'c',lines:['brown','green','orange','pink','purple'],side:'right',note:'Closed since Jan. 5, 2026 for full rebuild; reopening expected 2029. Trains bypass it. Use Washington/Wabash or Clark/Lake.'},
  {id:41660,name:'Lake (Red)',match:'Lake',ll:[41.8846,-87.6278],k:'y',lines:['red'],side:'right',note:'To transfer to the elevated lines while State/Lake is closed, CTA says to use Washington/Wabash.',alt:[['Grand (Red)', '0.5 mi · next stop north'], ['Jackson (Red)', '0.5 mi · 2 stops south']]},
  {id:41700,name:'Washington/Wabash',match:'Washington/Wabash',ll:[41.8831,-87.6261],k:'y',lines:['brown','green','orange','pink','purple'],side:'right',alt:[['Clark/Lake', '0.4 mi · same lines'], ['Harold Washington Library', '0.5 mi · all but Green']]},
  {id:40680,name:'Adams/Wabash',match:'Adams/Wabash',ll:[41.8794,-87.6261],k:'n',lines:['brown','green','orange','pink','purple'],side:'right',alt:[['Washington/Wabash', '0.3 mi · same lines'], ['Harold Washington Library', '0.3 mi · all but Green']]},
  {id:40850,name:'Harold Washington Library',match:'Harold Washington Library-State/Van Buren',ll:[41.8768,-87.6281],k:'y',lines:['brown','orange','pink','purple'],side:'bottom',alt:[['Quincy', '0.4 mi · same lines'], ['Washington/Wabash', '0.5 mi · same lines']]},
  {id:40160,name:'LaSalle/Van Buren',match:'LaSalle/Van Buren',ll:[41.8768,-87.6318],k:'n',lines:['brown','orange','pink','purple'],side:'top',alt:[['Harold Washington Library', '0.2 mi · same lines'], ['Quincy', '0.2 mi · same lines']]},
  {id:40040,name:'Quincy',match:'Quincy/Wells',ll:[41.8786,-87.6338],k:'y',lines:['brown','orange','pink','purple'],side:'left',alt:[['Washington/Wells', '0.3 mi · same lines'], ['Harold Washington Library', '0.4 mi · same lines']]},
  {id:40730,name:'Washington/Wells',match:'Washington/Wells',ll:[41.8829,-87.6338],k:'y',lines:['brown','orange','pink','purple'],side:'left',alt:[['Quincy', '0.3 mi · same lines'], ['Clark/Lake', '0.3 mi · same lines']]},
  {id:40560,name:'Jackson (Red)',ll:[41.8783,-87.6277],k:'y',lines:['red'],side:'right',alt:[['Lake (Red)', '0.5 mi · 2 stops north'], ['Roosevelt', '0.8 mi · 2 stops south']]},
  {id:41090,name:'Monroe (Red)',ll:[41.8807,-87.6277],k:'n',lines:['red'],side:'right',alt:[['Jackson (Red)', '0.2 mi · south']]},
  {id:40370,name:'Washington (Blue)',ll:[41.8833,-87.6294],k:'n',lines:['blue'],side:'left',alt:[['Clark/Lake', '0.3 mi · north']]},
  {id:40790,name:'Monroe (Blue)',ll:[41.8806,-87.6294],k:'n',lines:['blue'],side:'left',alt:[['Jackson (Blue)', '0.2 mi · south']]},
  {id:40070,name:'Jackson (Blue)',ll:[41.8782,-87.6294],k:'y',lines:['blue'],side:'left',alt:[['Clark/Lake', '0.6 mi · 3 stops toward O’Hare'], ['UIC-Halsted', '1.2 mi · 3 stops toward Forest Park']]},
  {id:41340,name:'LaSalle (Blue)',ll:[41.8757,-87.6317],k:'n',lines:['blue'],side:'bottom',alt:[['Jackson (Blue)', '0.3 mi · next stop toward O’Hare']]},
  {id:40430,name:'Clinton (Blue)',ll:[41.8756,-87.6407],k:'n',lines:['blue'],side:'bottom',note:'Steep stairs. For step-free access to Union Station, use Clinton (Green/Pink).',alt:[['UIC-Halsted', '0.5 mi · next stop toward Forest Park'], ['Jackson (Blue)', '0.8 mi · 2 stops toward O’Hare']]},
  {id:41160,name:'Clinton (Green/Pink)',ll:[41.8856,-87.6416],k:'y',lines:['green','pink'],side:'top',alt:[['Morgan', '0.5 mi · Green and Pink Lines, next stop west'], ['Clark/Lake', '0.6 mi · Green, Pink']]},
  {id:41510,name:'Morgan',match:'Morgan',ll:[41.8856,-87.6524],k:'y',lines:['green','pink'],side:'top',alt:[['Clinton (Green/Pink)', '0.5 mi · Green and Pink Lines, next stop east'], ['Ashland (Green/Pink)', '0.8 mi · Green and Pink Lines, next stop west']]},
  {id:40170,name:'Ashland (Green/Pink)',ll:[41.8853,-87.6667],k:'y',lines:['green','pink'],side:'top',alt:[['Damen (Green)', '0.5 mi · Green Line, next stop west'], ['Morgan', '0.8 mi · Green and Pink Lines, next stop east'], ['Polk', '1.1 mi · Pink Line, next stop south']]},
  {id:40350,name:'UIC-Halsted',match:'UIC-Halsted',ll:[41.8757,-87.6492],k:'y',lines:['blue'],side:'bottom',alt:[['Jackson (Blue)', '1.2 mi · 3 stops toward O’Hare'], ['Illinois Medical District', '1.3 mi · 2 stops toward Forest Park']]},
  // North of the river. No match names: Grand and Chicago each exist on several lines.
  {id:40460,name:'Merchandise Mart',match:'Merchandise Mart',ll:[41.8890,-87.6339],k:'y',lines:['brown','purple'],side:'left',alt:[['Clark/Lake', '0.4 mi · Brown, Purple'], ['Chicago (Brown/Purple)', '0.6 mi · Brown and Purple Lines, next stop north']]},
  {id:40710,name:'Chicago (Brown/Purple)',ll:[41.8968,-87.6359],k:'y',lines:['brown','purple'],side:'left',alt:[['Merchandise Mart', '0.6 mi · Brown and Purple Lines, next stop south'], ['Sedgwick', '1.1 mi · Brown and Purple Lines, next stop north']],bus:[['#66 Chicago', 'east to Chicago (Red), 0.4 mi']]},
  {id:40330,name:'Grand (Red)',ll:[41.8917,-87.6280],k:'y',lines:['red'],side:'right',alt:[['Chicago (Red)', '0.4 mi · next stop north'], ['Lake (Red)', '0.5 mi · next stop south']]},
  {id:41450,name:'Chicago (Red)',ll:[41.8967,-87.6281],k:'y',lines:['red'],side:'right',alt:[['Grand (Red)', '0.4 mi · next stop south'], ['Clark/Division', '0.7 mi · next stop north']],bus:[['#66 Chicago', 'west to Chicago (Brown/Purple), 0.4 mi']]},
  {id:40490,name:'Grand (Blue)',ll:[41.8912,-87.6476],k:'n',lines:['blue'],side:'right',alt:[['Clark/Lake', '1.1 mi · next stop toward Forest Park'], ['Western (Blue, O’Hare branch)', '3.1 mi · 4 stops toward O’Hare']],bus:[['#56 Milwaukee', 'along Milwaukee Ave. to the Loop'], ['#65 Grand', 'east to Grand (Red), 1.0 mi']]},
  {id:41410,name:'Chicago (Blue)',ll:[41.8961,-87.6552],k:'n',lines:['blue'],side:'right',alt:[['Clark/Lake', '1.7 mi · 2 stops toward Forest Park'], ['Western (Blue, O’Hare branch)', '2.5 mi · 3 stops toward O’Hare']],bus:[['#56 Milwaukee', 'along Milwaukee Ave. to the Loop'], ['#66 Chicago', 'east to Chicago (Brown/Purple), 1.0 mi, and Chicago (Red), 1.4 mi']]},
];

// All stations: generated data, with downtown entries replacing their generated counterparts field by field.
const OVERRIDE = Object.fromEntries(DOWNTOWN.map(s=>[s.id, s]));
// Roosevelt's dataset point is the Red Line subway entrance on State; the marker sits between it and the
// elevated Green/Orange platforms a block east.
OVERRIDE[41400] = {ll:[41.8674,-87.6268]};
const STATIONS = CTA_DATA.stations.map(s=>({...s, ...OVERRIDE[s.id]}));

// Metra stations: all of them from scripts/build_metra.py (METRA_DATA, Metra static GTFS), k = 'y' elevator (Metra's
// published elevator list, metra.com/elevatorsites), 'a' accessible platform (GTFS wheelchair_boarding 1), 'u' not
// marked accessible (GTFS 0, "no information"); fix = elevator although GTFS doesn't mark the station accessible.
// The elevator list and our corrections are our reading of Metra's site, not licensed feed data, labeled as such.
// METRA below: hand-maintained downtown entries, overriding generated ones by GTFS stop_id, field by field.
// Millennium is 'n' while its only elevator is closed. LaSalle Street's GTFS point sits on top of the CTA LaSalle
// stations, so it's moved south onto the platforms. The three terminals with elevators get no alternatives (alt:[]):
// "next stop" down each line is no help for an alert like Union Station's Great Hall closures.
const METRA_COLOR = {BNSF:['#29C233','#000'],HC:['#550E0C','#fff'],'MD-N':['#CC5500','#fff'],'MD-W':['#F1AD0E','#000'],
  ME:['#EB5C00','#fff'],NCS:['#9785BC','#fff'],RI:['#E02400','#fff'],SWS:['#0042A8','#fff'],
  'UP-N':['#008000','#fff'],'UP-NW':['#FFE600','#000'],'UP-W':['#FE8D81','#000']};
const METRA = [
  {id:'OTC',name:'Ogilvie (OTC)',ll:[41.8822,-87.6406],lines:['UP-N','UP-NW','UP-W'],side:'left',k:'y',alt:[]},
  {id:'CUS',name:'Union Station',ll:[41.8789,-87.6389],lines:['BNSF','HC','MD-N','MD-W','NCS','SWS'],side:'left',k:'y',alt:[]},
  {id:'LSS',name:'LaSalle Street',ll:[41.8745,-87.6322],lines:['RI'],side:'left',k:'y',alt:[]},
  {id:'MILLENNIUM',name:'Millennium',ll:[41.8842,-87.6231],lines:['ME'],side:'right',k:'n',temp:true,
    note:'The only elevator (South Water St. entrance) is closed for replacement until winter 2026–27. Metra says to use Van Buren Street for elevator access.'},
  {id:'VANBUREN',name:'Van Buren Street',ll:[41.8769,-87.6231],lines:['ME'],side:'right',k:'y'},
  {id:'MUSEUM',name:'Museum Campus/11th St.',ll:[41.8686,-87.6214],lines:['ME'],side:'right',k:'y'},
];
const METRA_STATIONS = METRA_DATA.stations.map(s=>({...s, ...(METRA.find(h=>h.id===s.id) || {})}));
if(METRA_DATA.published) document.getElementById('metra-pub').textContent =
  `, published ${new Date(METRA_DATA.published+'T12:00').toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})}`;

// Track geometry. d = pixel offset to the right of the direction of travel (a number, or one per point);
// a = draw direction arrows.
const NW=[41.8857,-87.6338], NE=[41.8857,-87.6261], SE=[41.8768,-87.6261], SW=[41.8768,-87.6338];
// Seams with the generated geometry (WEST, ROOSEVELT, the north ends) use GTFS positions so the lines meet.
const ROOSEVELT=[41.8674,-87.6266], WEST=[41.8851,-87.6720], TOWER18W=[41.8857,-87.6356];
// Brown/Purple north branch, south to the NW corner: Franklin from past Chicago Ave to Kinzie, then Wells across the river.
const N_BRANCH=[[41.9005,-87.6366],[41.8975,-87.6366],[41.8965,-87.6357],[41.8903,-87.6355],[41.8894,-87.6340],NW];
const CW=[NW,NE,SE,SW,NW], CCW=[NW,SW,SE,NE,NW];
const TRACKS = [
  {c:'red', p:[[41.9005,-87.6283],[41.8917,-87.6280],[41.8673,-87.6274]], dash:true},
  // Congress portal west of Clinton at -87.6466 (OpenStreetMap).
  {c:'blue', p:[[41.8756,-87.6720],[41.8756,-87.6466]]},
  {c:'blue', p:[[41.8756,-87.6466],[41.8757,-87.6294],[41.8857,-87.6294],[41.8857,-87.6390],[41.8890,-87.6440],[41.8912,-87.6476],[41.8961,-87.6552],[41.9000,-87.6613]], dash:true},
  {c:'brown', p:N_BRANCH, d:4},
  {c:'purple', p:N_BRANCH, d:-14},
  {c:'pink', p:[[41.8852,-87.6701],NW], d:4},  // west end meets the generated Pink branch at Paulina
  {c:'orange', p:[SE,ROOSEVELT], d:9},
  // West of Tower 18, Green and Pink share the Lake St. tracks, so Green sits beside Pink (where Brown sits
  // in the Loop) and jogs out to its Loop position just west of Wells.
  {c:'green', p:[WEST,TOWER18W,NW,NE,SE,ROOSEVELT], d:[-4,-4,-12,-12,-12,-12]},
  {c:'brown', p:CCW, d:4, a:true},
  {c:'pink', p:CW, d:4, a:true},
  {c:'orange', p:CW, d:9, a:true},
  {c:'purple', p:CW, d:14, a:true},
  // Beyond downtown: generated from CTA GTFS shapes, offsets chosen to meet the pieces above.
  ...CTA_DATA.lines.map(l=>({c:l.c, p:l.p, d:l.d, dash:!!l.dash})),
];

const dark = matchMedia('(prefers-color-scheme: dark)').matches;
// Zoom control top-right so the key panel doesn't cover it.
const map = L.map('map',{zoomControl:false});
L.control.zoom({position:'topright'}).addTo(map);
// Leave room for the key panel (expanded on desktop, collapsed under 600px).
// Opens on downtown. On phones, fit the Loop plus the stations just west of the river.
const wide = innerWidth >= 600;
// CTA stations only: the Metra Electric stations east of Wabash would drop a 1400px desktop from zoom 15 to 14.
map.fitBounds(L.latLngBounds(DOWNTOWN.filter(s=>wide || s.ll[1] > -87.645).map(s=>s.ll)),
  wide ? {paddingTopLeft:[400,40], paddingBottomRight:[40,40]} : {paddingTopLeft:[20,80], paddingBottomRight:[20,20]});
// Stadia Maps: works on localhost without a key; production needs the domain registered in the Stadia dashboard.
L.tileLayer(`https://tiles.stadiamaps.com/tiles/${dark?'alidade_smooth_dark':'alidade_smooth'}/{z}/{x}/{y}{r}.png`,{
  maxZoom:20,
  attribution:'&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Offset a path by d screen pixels (miter joins), at the current zoom.
function offsetPath(latlngs, d){
  if(!d) return latlngs.map(p=>L.latLng(p));
  const dAt = Array.isArray(d) ? i=>d[i] : ()=>d;
  const pts = latlngs.map(p=>map.latLngToLayerPoint(L.latLng(p)));
  const n = pts.length, closed = pts[0].equals(pts[n-1]);
  const nrm = (a,b)=>{const dx=b.x-a.x, dy=b.y-a.y, L2=Math.hypot(dx,dy)||1; return [-dy/L2, dx/L2];};
  return pts.map((pt,i)=>{
    let pr = pts[i-1], nx = pts[i+1];
    if(closed){ if(i===0) pr = pts[n-2]; if(i===n-1) nx = pts[1]; }
    let a = pr ? nrm(pr,pt) : null, b = nx ? nrm(pt,nx) : null;
    a = a || b; b = b || a;
    let mx = a[0]+b[0], my = a[1]+b[1]; const ml = Math.hypot(mx,my)||1; mx/=ml; my/=ml;
    const k = dAt(i) / ((mx*a[0]+my*a[1]) || 1);
    return map.layerPointToLatLng(L.point(pt.x+mx*k, pt.y+my*k));
  });
}

// Brown and Purple are too dark to read on the dark basemap, so they get a light casing there.
const CASED = new Set(dark ? ['brown','purple'] : []);
const trackLayer = L.layerGroup().addTo(map);
// Metra draws under CTA as a double line (a thin stripe of the basemap color down the middle), so it doesn't read
// as a CTA line of a similar color (UP-N and Green, Rock Island and Red). Side-by-side offsets come from the build.
const STRIPE = dark ? '#2b2b2b' : '#f4f3f0';
function drawTracks(){
  trackLayer.clearLayers();
  METRA_DATA.lines.forEach(t=>{
    const ll = offsetPath(t.p, t.d||0);
    trackLayer.addLayer(L.polyline(ll,{color:METRA_COLOR[t.c][0], weight:4, opacity:0.9, lineJoin:'round', interactive:false}));
    trackLayer.addLayer(L.polyline(ll,{color:STRIPE, weight:1.2, opacity:0.9, lineJoin:'round', interactive:false}));
  });
  // Subways first so the elevated lines draw on top; casings before all lines so they never cover a neighbor.
  const order = [...TRACKS].sort((x,y)=>(y.dash?1:0)-(x.dash?1:0)).map(t=>({t, ll:offsetPath(t.p, t.d||0)}));
  order.filter(({t})=>CASED.has(t.c)).forEach(({t,ll})=>
    trackLayer.addLayer(L.polyline(ll,{color:'#d8d8d8', weight:7, opacity:0.85, lineJoin:'round', interactive:false})));
  order.forEach(({t,ll})=>{
    const line = L.polyline(ll,{color:COLOR[t.c], weight:4, opacity:t.dash?0.8:0.95, dashArray:t.dash?'8 6':null, lineJoin:'round', interactive:false});
    trackLayer.addLayer(line);
    if(t.a && L.polylineDecorator){
      trackLayer.addLayer(L.polylineDecorator(line,{patterns:[{offset:30, repeat:70,
        symbol:L.Symbol.arrowHead({pixelSize:8, polygon:true, pathOptions:{color:COLOR[t.c], fillColor:COLOR[t.c], fillOpacity:1, weight:1, stroke:true}})}]}));
    }
  });
}
map.on('zoomend', drawTracks);
drawTracks();

const ICON = {y:'ti-elevator', n:'ti-stairs', c:'ti-barrier-block'};
const STATUS = {y:'Elevator access', n:'No elevator: stairs only', c:'Closed for reconstruction', out:'Elevator out of service', alert:'Accessibility alert'};
// Alerts like "The Howard-bound platform elevator..." cover one direction only.
const ONE_PLATFORM = /-bound\b[^.]*platform elevator/i;
// Escalator-only alerts are shown in popups but don't affect step-free status (marker, nearby card, status line).
const escalatorOnly = a => { const t = `${a.headline} ${a.short}`; return /escalator/i.test(t) && !/elevator/i.test(t); };
let ALERTS = [];
const markers = [];

function alertsFor(s){
  const norm = x => String(x||'').toLowerCase().replace(/\s+/g,'');
  return ALERTS.filter(a => a.stations.some(x => String(x.id)===String(s.id) || (s.match && norm(x.name)===norm(s.match))));
}
const stepFreeAlerts = s => alertsFor(s).filter(a => !escalatorOnly(a));

function iconFor(s){
  const out = s.k==='y' && stepFreeAlerts(s).length > 0;
  return L.divIcon({className:'stn', iconSize:[24,24], iconAnchor:[12,12],
    html:`<span class="dot ${s.k}${out?' alert':''}"><i class="ti ${ICON[s.k]}"></i></span>`});
}

// Approximate walking distance in miles: along the street grid, or straight line +25% where that's shorter
// (same rule as scripts/build_data.py).
function walkMiles(a,b){
  const dy = Math.abs(a[0]-b[0])*69.05, dx = Math.abs(a[1]-b[1])*51.45;
  return Math.min(dy+dx, Math.hypot(dy,dx)*1.25);
}
const miOf = d => parseFloat(d);  // every alt detail starts with its distance ("0.8 mi · ...")
// Outage-aware alternatives: alt and bus entries are generated ahead of time, so the station they point to may have
// an elevator alert now. Such entries stay listed (a one-platform outage may not matter for the trip) but are
// flagged, and they don't count when deciding whether other-line stations are worth adding.
const normName = n => n.replace(/’/g, "'");   // hand entries spell O’Hare with a curly apostrophe
const BY_NAME = new Map(STATIONS.map(s=>[normName(s.name), s]));
// An alert counts for a rider using `lines` at a station unless it's a non-elevator alert (a service suspension) whose
// routes are all other lines: the Loop elevated suspension lists Clark/Lake but not its Blue Line subway. Elevator
// alerts always count, since their route lists can be incomplete (Washington/Wabash's omits Brown).
const ROUTE_LINE = {Red:'red', Blue:'blue', Brn:'brown', G:'green', Org:'orange', P:'purple', Pexp:'purple', Pink:'pink', Y:'yellow'};
const alertsOn = (o, lines) => stepFreeAlerts(o).filter(a=>
  /elevator/i.test(`${a.headline} ${a.short}`) || !(a.routes||[]).length || a.routes.some(r=>lines.includes(ROUTE_LINE[r])));
// Lines a rider would use at alternative o, coming from station s: shared lines, or all of o's if none are shared.
const linesVia = (s, o) => { const shared = o.lines.filter(l=>s.lines.includes(l)); return shared.length ? shared : o.lines; };
const isOut = (o, lines) => !!o && o.k==='y' && alertsOn(o, lines || o.lines).length > 0;
// Same wording rule as the popup status: "elevator" only when an alert names one (the feed also carries things like
// service suspensions).
function outNote(o, lines){
  const texts = alertsOn(o, lines || o.lines).map(a=>`${a.headline} ${a.short}`);
  if(!texts.some(t=>/elevator/i.test(t))) return 'accessibility alert';
  return texts.every(t=>ONE_PLATFORM.test(t)) ? 'elevator alert (one platform)' : 'elevator alert';
}
// Stations a bus detail names ("north to Pulaski (Green), 0.8 mi; south to Pulaski (Pink), 1.5 mi"): a station name
// ending at a comma, semicolon or the end, not inside a longer name.
function namedIn(text){
  const t = normName(text);
  return STATIONS.filter(o=>{
    const n = normName(o.name), i = t.indexOf(n);
    return i >= 0 && !/[A-Za-z/]/.test(t[i-1] || ' ') && /^([,;]|$)/.test(t.slice(i + n.length, i + n.length + 1));
  });
}
// Alternatives plus up to two stations with elevators on other lines that are closer than every usable listed option
// and within walking/rolling range (1.5 mi), e.g. Pulaski (Green) for Pulaski (Blue); stations with an alert aren't
// added. Sorted by distance. Rows are [name, detail, flag], flag = outage note or ''.
function alternatives(s){
  const alt = (s.alt || []).map(([n,d])=>{
    const o = BY_NAME.get(normName(n)), ls = o && linesVia(s, o);
    return [n, d, isOut(o, ls) ? outNote(o, ls) : ''];
  });
  if(!alt.length) return alt;
  const best = Math.min(...alt.filter(r=>!r[2]).map(([,d])=>miOf(d)).filter(x=>!isNaN(x)));
  const listed = new Set(alt.map(([n])=>normName(n)));
  const other = STATIONS
    .filter(o=>o!==s && o.k==='y' && !isOut(o) && !listed.has(normName(o.name)) && !o.lines.some(l=>s.lines.includes(l)))
    .map(o=>[walkMiles(s.ll,o.ll), o]).filter(([d])=>d < best && d <= 1.5).sort((x,y)=>x[0]-y[0]).slice(0,2)
    .map(([d,o])=>[o.name, `${d.toFixed(1)} mi · ${o.lines.map(l=>LINE_NAME[l]).join(', ')}`, '']);
  return [...alt, ...other].sort((x,y)=>(miOf(x[1])||0)-(miOf(y[1])||0));
}
// Bus rows with a flag naming any target station that has an elevator alert.
const busRows = bus => (bus || []).map(([r,d])=>{
  const out = namedIn(d).filter(isOut);
  return [r, d, out.length ? out.map(o=>`${outNote(o)} at ${o.name}`).join('; ') : ''];
});
// One alternatives list (popups): name, detail, and an amber outage flag.
const altList = (title, rows) => rows && rows.length ? `<div class="sec">${title}</div><ul>${rows.map(([n,d,f])=>
  `<li><b>${esc(n)}</b> <span class="d">${esc(d)}</span>${f ? ` <span class="flag"><i class="ti ti-alert-triangle"></i> ${esc(f)}</span>` : ''}</li>`).join('')}</ul>` : '';

function popupFor(s){
  const chips = s.lines.map(l=>`<span class="chip${LIGHT_CHIP.has(l)?' lt':''}" style="--c:${COLOR[l]}">${LINE_NAME[l]}</span>`).join('');
  const alerts = alertsFor(s), blocking = stepFreeAlerts(s), out = s.k==='y' && blocking.length > 0;
  // The accessibility feed also carries alerts like "trains will not stop at 43rd"; only say elevator when it is one.
  const st = !out ? s.k : blocking.some(a=>/elevator/i.test(`${a.headline} ${a.short}`)) ? 'out' : 'alert';
  const oneSide = out && alerts.some(a=>ONE_PLATFORM.test(`${a.headline} ${a.short}`));
  // The alert description already names the station and the elevator; the headline only repeats it.
  const al = alerts.map(a=>`<div class="al">${esc(a.short || a.headline)}</div>`).join('');
  // Just the fact: "use the other platform" isn't an option for one-way Loop lines.
  const tip = oneSide ? `<div class="tip">Only one platform is affected.</div>` : '';
  const show = s.k==='n' || out;
  return `<div class="pop"><h3>${esc(s.name)}</h3><div class="chips">${chips}</div>
    <div class="st ${st}">${STATUS[st]}</div>${al}${tip}
    ${s.note?`<div class="note-p">${esc(s.note)}</div>`:''}
    ${show ? altList('Nearest stations with elevators', alternatives(s)) + altList('Accessible buses', busRows(s.bus)) : ''}</div>`;
}
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// Metra accessibility alerts (/api/metra-alerts). Metra's feed has no stop IDs and no effect codes (Oct 2026), so
// alerts are picked by keyword and tied to the downtown stations by name in the HEADLINE only (descriptions also
// name alternate stations, e.g. "use Van Buren Station"). Text is shown verbatim, per Metra's license; the same
// alert posted once per line is merged with its lines combined.
const METRA_ACCESS = /elevator|escalator|\bramps?\b|\bADA\b|accessib|wheelchair/i;
// Names an alert headline may use: hand aliases downtown; elsewhere the station name, and its part before " (" or
// " - " ("75th St. (Grand Crossing)" -> "75th St."). Matched as whole words, ignoring punctuation, and only on
// alerts for one of the station's lines (two Lake Forests, two Western Avenues).
const METRA_NAMES = {OTC:['Ogilvie','OTC'], CUS:['Union Station','CUS'], LSS:['LaSalle Street','LaSalle St.'],
  MILLENNIUM:['Millennium','South Water'], VANBUREN:['Van Buren'], MUSEUM:['Museum Campus','11th St']};
const words = t => ` ${t.toLowerCase().replace(/[.,']/g,'').replace(/[^a-z0-9]+/g,' ').trim()} `;
function metraAliases(s){
  if(METRA_NAMES[s.id]) return METRA_NAMES[s.id].map(words);
  const n = s.name.replace(/ \([A-Z/-]+\)$/,'');   // repeated names carry their line: "Lake Forest (MD-N)"
  return [...new Set([n, n.split(' (')[0], n.split(' - ')[0]].map(words))];
}
let METRA_ALERTS = [], metraUpdated = null, metraState = 'loading';
const metraChips = ls => ls.filter(l=>METRA_COLOR[l]).map(l=>`<span class="chip" style="--c:${METRA_COLOR[l][0]};color:${METRA_COLOR[l][1]}">${l}</span>`).join('');
document.querySelector('#metra-lines .row').innerHTML = Object.entries(METRA_DATA.routes)
  .map(([id,name])=>`<span class="k">${metraChips([id])}${esc(name)}</span>`).join('');
function metraAlertsFor(s){
  const names = metraAliases(s);
  return METRA_ALERTS.filter(a=>a.routes.some(r=>s.lines.includes(r)) && a.headers.some(h=>names.some(n=>words(h).includes(n))));
}
const METRA_STATUS = {y:'Elevator access', a:'Accessible platform', u:'Not marked accessible', n:'Not accessible'};
const METRA_ICON = {y:'ti-elevator', a:'ti-wheelchair', u:'ti-help', n:'ti-stairs'};
// Where each status comes from. Elevators: our reading of Metra's site; the rest: Metra's GTFS as published.
const METRA_SOURCE = {
  y: s => s.fix ? "Elevator per Metra's published elevator list. Metra's schedule data doesn't mark this station accessible; that's our correction."
    : "Elevator per Metra's published elevator list.",
  a: () => "Marked accessible in Metra's schedule data: no elevator, usually a level or ramped platform. Board at the accessible car.",
  u: () => "Metra's schedule data doesn't mark this station accessible.",
  n: () => '',
};
function metraPopup(s){
  const alerts = metraAlertsFor(s);
  const al = alerts.map(a=>`<div class="al">${esc(a.description || a.headers[0])}</div>`).join('');
  const st = s.k === 'n' && s.temp ? 'Temporarily not accessible' : METRA_STATUS[s.k];
  const show = (s.k === 'u' || s.k === 'n' || alerts.length) && s.alt && s.alt.length;
  // Flag alternatives that have an accessibility alert in Metra's feed themselves.
  const alt = show ? altList('Nearest accessible Metra stations', s.alt.map(([n,d])=>{
    const o = METRA_STATIONS.find(m=>m.name===n);
    return [n, d, o && metraAlertsFor(o).length ? "alert in Metra's feed" : ''];
  })) : '';
  return `<div class="pop"><h3>${esc(s.name)}</h3><div class="chips">${metraChips(s.lines)}</div>
    <div class="st ${s.k}">${st}</div>${s.note ? `<div class="note-p">${esc(s.note)}</div>` : ''}
    ${alerts.length ? `${al}<div class="tip">Alert from Metra's feed, updated ${fmtTime(metraUpdated)}.</div>` : ''}
    ${alt}<div class="tip">Metra station. ${METRA_SOURCE[s.k](s)} Check metra.com before you travel.</div></div>`;
}
const metraIcon = (s, alert) => L.divIcon({className:'stn', iconSize:[24,24], iconAnchor:[12,12],
  html:`<span class="dot m ${s.k}${alert?' alert':''}"><i class="ti ${METRA_ICON[s.k]}"></i></span>`});

// Station markers with name labels (labels shown at zoom 16+).
const labeled = [];
function addStation(s, icon, popup, z){
  const m = L.marker(s.ll,{icon, title:s.name, zIndexOffset:z}).addTo(map);
  m.bindPopup(popup);
  const dir = s.side||'right';
  m.bindTooltip(s.name,{permanent:true, direction:dir, className:'lbl', offset: dir==='left'?[-12,0]:dir==='right'?[12,0]:dir==='top'?[0,-12]:[0,12]});
  labeled.push(m);
  return m;
}
STATIONS.forEach(s=> markers.push({s, m:addStation(s, iconFor(s), ()=>popupFor(s), 1000)}));
const metraMarkers = METRA_STATIONS.map(s=>({s, m:addStation(s, metraIcon(s, false), ()=>metraPopup(s), 900)}));

// Metra line labels (scripts/build_metra.py): on stretches where a line runs alone, clear of stations. One per line
// at every zoom (mid-line), the rest (about every 8 miles, branches included) from zoom 11.
const metraLabels = METRA_DATA.labels.map(l=>({l, t:L.tooltip({permanent:true, direction:'center', className:'mline', interactive:false})
  .setLatLng(l.ll).setContent(`<span style="--c:${METRA_COLOR[l.c][0]};color:${METRA_COLOR[l.c][1]}">${l.c}</span>`)}));

function updateLabels(){
  const z = map.getZoom(), show = z >= 16;
  labeled.forEach(m=> show ? m.openTooltip() : m.closeTooltip());
  metraLabels.forEach(({l,t})=>{ const on = z >= l.z; if(on !== map.hasLayer(t)) on ? t.addTo(map) : t.remove(); });
  // Shrink station markers when zoomed out to the whole system, so they don't pile up.
  const c = map.getContainer().classList;
  c.toggle('z-far', z <= 12); c.toggle('z-mid', z === 13); c.toggle('z-region', z <= 10);
}
map.on('zoomend', updateLabels);
updateLabels();

// Alerts poll every 5 minutes. They count as stale after 15 minutes without a successful load (failed polls,
// or a phone that slept with the tab open); the last good alerts stay on the map, flagged in the panel header.
const POLL_MS = 5*60*1000, STALE_MS = 15*60*1000;
let lastOk = 0, checked = false;
const fmtTime = t => new Date(t).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
function showStatus(){
  if(!checked) return;
  const el = document.getElementById('status'), badge = document.getElementById('stale');
  const stale = Date.now() - lastOk > STALE_MS;
  const hits = markers.filter(({s})=>s.k==='y' && stepFreeAlerts(s).length).map(({s})=>s.name);
  el.textContent = !lastOk ? 'Live elevator alerts unavailable. Check transitchicago.com before you travel.'
    : stale ? `Elevator alerts haven't updated since ${fmtTime(lastOk)} and may be out of date. Check transitchicago.com before you travel.`
    : hits.length ? `Elevator alerts at ${fmtTime(lastOk)}: ${hits.join(', ')}.` : `No elevator alerts on this map as of ${fmtTime(lastOk)}.`;
  el.classList.toggle('warn', stale);
  badge.hidden = !stale;
}
// Metra's systemwide accessibility alerts, listed in the panel (most name stations not on this map).
function showMetra(){
  const el = document.getElementById('metra');
  if(metraState === 'off'){ el.hidden = true; return; }   // endpoint not configured (no key)
  el.hidden = false;
  if(metraState !== 'ok'){ el.innerHTML = metraState === 'loading' ? '' : 'Metra accessibility alerts unavailable. Check metra.com before you travel.'; return; }
  const when = fmtTime(metraUpdated);
  // The Worker refreshes Metra every 5 minutes with retries; a copy older than 30 minutes means Metra has been
  // unreachable or blocking us for a while.
  const old = Date.now() - Date.parse(metraUpdated) > 30*60*1000;
  el.classList.toggle('warn', old);
  const note = old ? ' (may be out of date; check metra.com)' : '';
  if(!METRA_ALERTS.length){ el.textContent = `No accessibility alerts in Metra's feed as of ${when}${note}.`; return; }
  el.innerHTML = `<details><summary>Metra accessibility alerts: ${METRA_ALERTS.length}, from Metra's feed as of ${esc(when)}${esc(note)}</summary><ul>${
    METRA_ALERTS.map(a=>`<li><span class="chips">${metraChips(a.routes)}</span>${esc(a.description || a.headers[0])}</li>`).join('')}</ul></details>`;
}
async function loadMetra(){
  try{
    const r = await fetch('/api/metra-alerts',{cache:'no-store'});
    if(r.status === 503){ metraState = 'off'; return; }
    if(!r.ok) throw new Error(r.status);
    const j = await r.json();
    const merged = new Map();
    for(const a of (j.alerts||[]).filter(a=>METRA_ACCESS.test(`${a.header} ${a.description}`))){
      const key = a.description || a.header;
      const m = merged.get(key) || {description:a.description, headers:[], routes:[]};
      m.headers.push(a.header); a.routes.forEach(r=>m.routes.includes(r) || m.routes.push(r));
      merged.set(key, m);
    }
    METRA_ALERTS = [...merged.values()];
    metraUpdated = j.updated;
    metraState = 'ok';
    metraMarkers.forEach(({s,m})=> m.setIcon(metraIcon(s, metraAlertsFor(s).length > 0)));
    nearbyKey = ''; renderNearby();
  }catch(e){
    // Keep the last good list if there is one. Metra's firewall refuses some requests in ~30 s runs, so if the
    // first load fails, try again shortly instead of showing "unavailable" until the next 5-minute poll.
    if(!METRA_ALERTS.length){ metraState = 'error'; setTimeout(loadMetra, 30*1000); }
  }
  finally{ showMetra(); }
}

// Version: the deploy this page was loaded from, from the first alerts response (same deploy as the static files
// if the page loaded then). A later response from a different deploy means the open page is out of date.
let pageVersion = null;
// The version tag is the commit it was deployed from (scripts/deploy.sh): "1a2b3c4d5e6f", or "...-dirty" for a local
// deploy with uncommitted changes, which gets no link.
const REPO = 'https://github.com/aconaway1/step-free-chicago-transit';
function commitLink(tag){
  const m = /^([0-9a-f]{7,40})(-dirty)?$/.exec(tag || '');
  if(!m) return '';
  return m[2] ? ` (commit ${m[1].slice(0,7)}, modified)` : ` (commit <a href="${REPO}/commit/${m[1]}">${m[1].slice(0,7)}</a>)`;
}
function showVersion(v){
  if(!v || !v.id) return;
  pageVersion = pageVersion || v;
  const day = pageVersion.at ? `, ${new Date(pageVersion.at).toLocaleDateString([], {month:'short', day:'numeric'})}` : '';
  const el = document.getElementById('version');
  el.innerHTML = ` · Version ${esc(pageVersion.id.slice(0,8))}${commitLink(pageVersion.tag)}${esc(day)}`;
  if(v.id !== pageVersion.id) el.innerHTML += ' · <a href="">New version available, reload</a>';
}

async function loadAlerts(){
  loadMetra();
  try{
    const r = await fetch('/api/elevators',{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    const j = await r.json();
    ALERTS = j.alerts || [];
    lastOk = Date.now();
    showVersion(j.version);
    markers.forEach(({s,m})=> m.setIcon(iconFor(s)));
    nearbyKey = ''; renderNearby();  // outages change which nearby stations are usable
  }catch(e){ /* keep the last good alerts; showStatus flags them once stale */ }
  checked = true;
  showStatus();
}
loadAlerts();
setInterval(loadAlerts, POLL_MS);
setInterval(showStatus, 60*1000);
// Background tabs throttle timers; refresh as soon as the page is visible again if a poll is overdue.
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && Date.now() - lastOk > POLL_MS) loadAlerts(); });

// Locate me: browser geolocation (HTTPS or localhost only). The position never leaves the browser.
// Own pane above the tracks (overlayPane 400, redrawn on every zoom) and below station markers (600).
map.createPane('me').style.zIndex = 450;
const me = L.layerGroup().addTo(map);
let locating = false, centered = false, hasFix = false;
const Locate = L.Control.extend({
  options:{position:'topright'},
  onAdd(){
    const box = L.DomUtil.create('div','leaflet-bar leaflet-control');
    const a = L.DomUtil.create('a','locate',box);
    a.href = '#'; a.title = 'Show my location'; a.setAttribute('role','button'); a.setAttribute('aria-label','Show my location');
    a.setAttribute('aria-pressed','false');
    a.innerHTML = '<i class="ti ti-current-location"></i>';
    L.DomEvent.disableClickPropagation(box);
    L.DomEvent.on(a,'click',e=>{ L.DomEvent.preventDefault(e); setLocating(!locating); });
    this._a = a;
    return box;
  }
});
const locate = new Locate().addTo(map);
function setLocating(on){
  locating = on;
  locate._a.classList.toggle('on', on);
  locate._a.setAttribute('aria-pressed', String(on));
  if(on){ centered = false; hasFix = false; map.locate({watch:true, enableHighAccuracy:true, maximumAge:15000}); }
  else { map.stopLocate(); me.clearLayers(); lastFix = null; }
  renderNearby();
}

// Closest station with an elevator on each line to the user's position, skipping any with an active alert for that
// line (isOut: elevator alerts always, other alerts only when they name the line).
// A station that's closest for several lines (Clark/Lake downtown) gets one row tagged with those lines.
// Metra gets its own list: the closest step-free station (elevator or accessible platform) on each Metra line within
// METRA_NEAR miles, skipping stations with an accessibility alert in Metra's feed (Metra lines reach 60 miles out,
// so an uncapped list would mostly be far-off stations).
// Computed here from station coordinates; the position never leaves the browser. Distances are estimates
// (walkMiles), not routed walking or wheelchair paths.
const METRA_NEAR = 3;
const nearbyEl = document.getElementById('nearby');
let lastFix = null, nearbyKey = '', nearbyCollapsed = false;
function closestByLine(here, stations, lines, out, max = Infinity){
  const cands = stations.map(s=>({s, d:walkMiles(here, s.ll)})).filter(x=>x.d <= max);
  const rows = new Map(), skipped = new Set();
  for(const line of lines){
    const onLine = cands.filter(x=>x.s.lines.includes(line)).map(x=>({...x, out:out(x.s, line)})).sort((x,y)=>x.d-y.d);
    const pick = onLine.find(x=>!x.out);
    if(!pick) continue;
    onLine.filter(x=>x.out && x.d < pick.d).forEach(x=>skipped.add(x.s.name));
    if(!rows.has(pick.s.id)) rows.set(pick.s.id, {...pick, lines:[]});
    rows.get(pick.s.id).lines.push(line);
  }
  return {shown:[...rows.values()].sort((x,y)=>x.d-y.d), skipped};
}
function renderNearby(){
  if(!locating || !lastFix){ nearbyEl.hidden = true; nearbyKey = ''; return; }
  const here = [lastFix.latlng.lat, lastFix.latlng.lng];
  const cta = closestByLine(here, STATIONS.filter(s=>s.k==='y'), Object.keys(LINE_NAME), (s, line)=>isOut(s, [line]));
  const metra = closestByLine(here, METRA_STATIONS.filter(s=>s.k==='y' || s.k==='a'), Object.keys(METRA_DATA.routes),
    s=>metraAlertsFor(s).length > 0, METRA_NEAR);
  const rough = lastFix.accuracy > 500;
  // Redraw only when what's shown changes, so the card doesn't flicker while walking.
  const key = [cta, metra].flatMap(r=>[r.shown.map(x=>`${x.s.id}:${x.d.toFixed(1)}:${x.lines}`), [...r.skipped]])
    .concat([rough, nearbyCollapsed]).join('|');
  if(key === nearbyKey) return;
  nearbyKey = key;
  const fmt = d => d < 0.1 ? 'under 0.1 mi' : `${d.toFixed(1)} mi`;
  const chips = ls => ls.map(l=>`<span class="chip${LIGHT_CHIP.has(l)?' lt':''}" style="--c:${COLOR[l]}">${LINE_NAME[l]}</span>`).join('');
  const row = (x, kind, ch, extra = '') =>
    `<li><button type="button" data-${kind}="${esc(x.s.id)}"><span class="r1"><b>${esc(x.s.name)}</b> <span class="d">${fmt(x.d)}${extra}</span></span><span class="chips">${ch(x.lines)}</span></button></li>`;
  const skip = (set, why) => set.size ? `<div class="tip">Skipped (${why}): ${[...set].map(esc).join(', ')}</div>` : '';
  nearbyEl.classList.toggle('collapsed', nearbyCollapsed);
  nearbyEl.innerHTML = `<div class="head"><div class="sec">Closest station with an elevator, by line</div>
      <button type="button" class="tog" aria-expanded="${!nearbyCollapsed}" aria-label="${nearbyCollapsed?'Expand':'Collapse'} nearest stations"><i class="ti ti-chevron-down"></i></button></div>
    <div class="body"><ul>${cta.shown.map(x=>row(x, 'id', chips)).join('')}</ul>`
    + skip(cta.skipped, 'alert on that line')
    + (metra.shown.length || metra.skipped.size ? `<div class="sec sub">Metra, closest step-free station by line (within ${METRA_NEAR} mi)</div>
      <ul>${metra.shown.map(x=>row(x, 'metra', metraChips, x.s.k==='y' ? ' · elevator' : ' · accessible platform')).join('')}</ul>`
      + skip(metra.skipped, "alert in Metra's feed") : '')
    + `<div class="tip">${rough ? `Your location is only accurate to about ${Math.round(lastFix.accuracy)} m, so these are rough. ` : ''}Distances are estimates, not routes.</div></div>`;
  nearbyEl.hidden = false;
}
nearbyEl.addEventListener('click', e=>{
  if(e.target.closest('.tog')){ nearbyCollapsed = !nearbyCollapsed; renderNearby(); return; }
  const b = e.target.closest('button[data-id], button[data-metra]');
  if(!b) return;
  const hit = b.dataset.id ? markers.find(({s})=>String(s.id)===b.dataset.id) : metraMarkers.find(({s})=>s.id===b.dataset.metra);
  if(hit){ map.setView(hit.s.ll, Math.max(map.getZoom(), 15)); hit.m.openPopup(); }
});

map.on('locationfound', e=>{
  hasFix = true;
  lastFix = e;
  renderNearby();
  me.clearLayers();
  me.addLayer(L.circle(e.latlng,{radius:e.accuracy, className:'me-acc', interactive:false, pane:'me'}));
  me.addLayer(L.circleMarker(e.latlng,{radius:7, className:'me-dot', interactive:false, pane:'me'}));
  // Center once per activation, then let the user pan freely while the dot follows.
  if(!centered){ map.setView(e.latlng, Math.max(map.getZoom(),16)); centered = true; }
});
map.on('locationerror', e=>{
  // GPS drops out briefly on phones; after a good fix, keep watching and mark the dot stale instead of giving up.
  if(hasFix && e.code !== 1){ me.eachLayer(l=>l.getElement()?.classList.add('stale')); return; }
  setLocating(false);
  const why = e.code===1 ? 'Location permission was denied.' : e.code===3 ? 'Timed out finding your location.' : 'Your location is unavailable.';
  L.popup({className:'loc-err'}).setLatLng(map.getCenter()).setContent(esc(why)).openOn(map);
});

const panel = document.getElementById('panel');
document.getElementById('toggle').addEventListener('click', e=>{
  const c = panel.classList.toggle('collapsed');
  e.currentTarget.setAttribute('aria-expanded', String(!c));
});
if(innerWidth < 600) panel.classList.add('collapsed');
