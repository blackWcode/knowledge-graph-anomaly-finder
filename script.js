/* Knowledge Graph Anomaly Finder — static browser recreation of graph_monitor.ipynb.
   The dataset is simulated. This is deterministic rule validation, not ML inference. */
(() => {
  'use strict';
  const GRAPH = Object.freeze({
    Sensor_A: {type:'sensor',connected_to:['Valve_1']},
    Valve_1: {type:'valve',connected_to:['Tank_B']},
    Tank_B: {type:'tank',connected_to:['Outlet_C']},
    Outlet_C: {type:'outlet',connected_to:[]}
  });
  const EVENTS = [
    {timestamp:'10:00',node:'Sensor_A',target:'Valve_1',status:'active'},
    {timestamp:'10:01',node:'Valve_1',target:'Tank_B',status:'active'},
    {timestamp:'10:02',node:'Sensor_A',target:'Tank_B',status:'active'},
    {timestamp:'10:03',node:'Tank_B',target:'Outlet_C',status:'active'}
  ];
  const LINKS = [{from:'Sensor_A',to:'Valve_1',el:'demo-link-0'}, {from:'Valve_1',to:'Tank_B',el:'demo-link-1'}, {from:'Tank_B',to:'Outlet_C',el:'demo-link-2'}];
  const NODE_IDS = {Sensor_A:'node-sensor',Valve_1:'node-valve',Tank_B:'node-tank',Outlet_C:'node-outlet'};
  const el = id => document.getElementById(id);
  const motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menu = el('nav-links'), menuToggle = el('menu-toggle');
  menuToggle.addEventListener('click',()=>{const open=menu.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
  menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('open')){menu.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');menuToggle.focus();}});
  el('year').textContent=String(new Date().getFullYear());

  /** Same decision order as the main working code in the uploaded notebook. */
  function auditEvent(event){
    const source=event.node, target=event.target;
    if(!source || !target) return {result:'MALFORMED',reason:'A source and target are both required. This event is missing '+(!source&&!target?'both fields':!source?'its source':'its target')+'.',allowed:[]};
    if(!(source in GRAPH)) return {result:'ANOMALY',reason:`Source ${source} is not defined in the system graph.`,allowed:[]};
    const allowed=GRAPH[source].connected_to;
    if(allowed.includes(target)) return {result:'NORMAL',reason:`${source} → ${target} is explicitly listed among the permitted connections for ${source}.`,allowed};
    return {result:'ANOMALY',reason:`${source} cannot connect directly to ${target}. Allowed targets for ${source}: ${allowed.length?allowed.join(', '):'none'}.`,allowed};
  }

  const eventList=el('event-list'),run=el('run-audit'),reset=el('reset-audit'),status=el('audit-indicator'),total=el('audit-total');
  let generation=0, busy=false;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderEvents(done = [], scanning=-1){
    eventList.innerHTML=EVENTS.map((ev,i)=>{
      const outcome=done[i];
      const cls=i===scanning?'scanning':outcome?(outcome.result==='NORMAL'?'pass':'fail'):'';
      const label=i===scanning?'SCANNING':!outcome?'PENDING':outcome.result==='NORMAL'?'✓ NORMAL':'! '+outcome.result;
      return `<div class="event-item ${cls}" data-event="${i}"><span class="event-time">${esc(ev.timestamp)}</span><span class="event-route">${esc(ev.node)} → ${esc(ev.target)}</span><span class="event-status">${label}</span>${outcome?`<div class="event-sub">${esc(outcome.reason)}</div>`:''}</div>`;
    }).join('');
  }
  function clearGraph(){
    Object.values(NODE_IDS).forEach(id=>el(id).classList.remove('is-active','is-invalid'));
    LINKS.forEach(link=>el(link.el).classList.remove('active'));
    el('anomaly-link').setAttribute('visibility','hidden');
    el('demo-edge-label').textContent='';
  }
  function highlightEvent(ev,result){
    clearGraph();
    [ev.node,ev.target].forEach(n=>{if(NODE_IDS[n])el(NODE_IDS[n]).classList.add(result.result==='NORMAL'?'is-active':'is-invalid');});
    if(result.result==='NORMAL'){
      const link=LINKS.find(x=>x.from===ev.node&&x.to===ev.target);
      if(link)el(link.el).classList.add('active');
    } else if(ev.node==='Sensor_A'&&ev.target==='Tank_B'){
      el('anomaly-link').setAttribute('visibility','visible');
      el('demo-edge-label').textContent='NOT IN ALLOWED CONNECTIONS';
    } else {
      el('demo-edge-label').textContent=result.result==='MALFORMED'?'MISSING EVENT FIELD':result.result==='ANOMALY'?'INVALID CONNECTION':'';
    }
  }
  function resetAudit(){
    generation++;busy=false;run.disabled=false;reset.disabled=false;
    run.innerHTML='<span aria-hidden="true">▶</span> Run sample audit';
    status.className='audit-indicator';status.textContent='● NOT RUN';
    total.innerHTML='<span>Awaiting audit</span><strong>—</strong>';
    clearGraph();renderEvents();
  }
  async function runAudit(){
    if(busy)return;
    const mine=++generation;busy=true;run.disabled=true;reset.disabled=false;
    status.className='audit-indicator running';status.textContent='● CHECKING RULES';
    run.textContent='Auditing…';
    const results=[];renderEvents(results,0);
    for(let i=0;i<EVENTS.length;i++){
      if(mine!==generation)return;
      renderEvents(results,i);
      highlightEvent(EVENTS[i],auditEvent(EVENTS[i]));
      await wait(motionReduced?110:460);
      if(mine!==generation)return;
      results.push(auditEvent(EVENTS[i]));
      renderEvents(results);
      await wait(motionReduced?60:240);
    }
    if(mine!==generation)return;
    const failures=results.filter(x=>x.result!=='NORMAL').length;
    total.innerHTML=`<span>Audit complete · ${EVENTS.length} events checked</span><strong class="${failures?'warn-count':''}">${failures} flagged</strong>`;
    status.className='audit-indicator complete';status.textContent='● AUDIT COMPLETE';
    run.disabled=false;run.innerHTML='<span aria-hidden="true">↻</span> Replay audit';busy=false;
  }
  run.addEventListener('click',runAudit);
  reset.addEventListener('click',resetAudit);
  resetAudit();
  const form=el('event-form');
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const event={timestamp:'custom',node:el('source-select').value,target:el('target-select').value,status:'active'};
    const result=auditEvent(event);
    highlightEvent(event,result);
    const box=el('custom-result');box.className='custom-result '+(result.result==='NORMAL'?'pass':'fail');
    const label=result.result==='NORMAL'?'✓ NORMAL — RULE SATISFIED':result.result==='MALFORMED'?'! MALFORMED EVENT':'! ANOMALY — RULE VIOLATION';
    const safeRoute=`${event.node||'(missing source)'} → ${event.target||'(missing target)'}`;
    box.innerHTML=`<span class="result-label">${label}</span><p><strong>${esc(safeRoute)}</strong><br>${esc(result.reason)}</p>`;
  });
})();
