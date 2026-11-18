// This tutorial never imports the application, opens its database, or receives account data.
// Its sandbox has an opaque origin and no network access; examples live only in its memory.
let activeTutorial = null;

export function isTutorialRunning() { return activeTutorial !== null; }

// Authentication changes may close the demo without recording an onboarding decision.
export function closeTutorial() { return activeTutorial?.close(); }

const steps = [
  ['Willkommen in deiner Arbeitszeit-App', 'Probiere die wichtigsten Funktionen mit Beispieldaten aus. Deine echten Zeiten bleiben unverändert. Du kannst die Einführung jederzeit überspringen.'],
  ['Eine Arbeitszeit speichern', 'Speichere die vorausgefüllte Beispielschicht von 07:00 bis 15:30 Uhr mit 30 Minuten Pause. Daraus entstehen 8 Stunden Nettoarbeitszeit.'],
  ['Den Kalendereintrag öffnen', 'Tippe im Beispielkalender auf den hervorgehobenen Tag. Dort findest du die gerade gespeicherte Zeit wieder.'],
  ['Deine Monatswerte verstehen', 'Öffne „Berechnung ansehen“. Gearbeitete Zeit enthält auch angerechneten Urlaub, Krankheit und Feiertage.'],
  ['Eine Schicht planen', 'Speichere eine Beispielschicht für den nächsten Arbeitstag. Eine Planung wird erst nach dem tatsächlichen Arbeiten als Zeit gebucht.'],
  ['Die Jahresanalyse ansehen', 'Tippe auf den hervorgehobenen Monatsbalken. Die Analyse zeigt Arbeitszeit inklusive Gutschriften und die Entwicklung des Zeitkontos.'],
  ['Die Einführung wiederfinden', 'Öffne „Hilfe & Einführung“. In den echten Einstellungen kannst du dieses Tutorial jederzeit neu starten. Danach wechselst du zu deinen eigenen Daten.']
];

function sandboxDocument(nonce) {
  // Kept self-contained intentionally: the iframe cannot access parent storage or APIs.
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>
*{box-sizing:border-box}html{color-scheme:light;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#203331;background:#edf8f5;font-size:15px}body{margin:0;padding:14px;line-height:1.45}button,input{font:inherit}button{cursor:pointer;min-height:44px;border:1px solid #badbd5;border-radius:12px;background:#fff;color:#176c65;padding:10px 14px;font-weight:700}button:focus-visible,input:focus-visible{outline:3px solid #177d73;outline-offset:3px}h2{font-size:1.35rem;letter-spacing:-.03em;margin:0 0 10px}h3{font-size:1rem;margin:0 0 8px}p{margin:8px 0}.demo-brand{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-weight:800;color:#176c65}.demo-brand small{font-weight:600;font-size:.71rem}.card{padding:16px;background:white;border:1px solid #d8e9e5;border-radius:18px;margin-bottom:12px}.hero{background:#d5f1ea}.muted{color:#5b7771;font-size:.85rem}.big{display:block;font-size:2.2rem;font-weight:800;letter-spacing:-.04em;margin:8px 0}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}.metric{padding:12px;background:#f4faf8;border-radius:12px}.metric span{display:block;font-size:.75rem;color:#5b7771}.metric strong{display:block;font-size:1.15rem;margin-top:4px}label{display:grid;gap:5px;font-size:.82rem;font-weight:650}input{width:100%;min-width:0;min-height:44px;border:1px solid #b7d8d0;border-radius:10px;padding:8px;background:#fff;color:#203331}.fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fields label:last-child{grid-column:1/-1}.primary{background:#248179;color:#fff;border-color:#248179;width:100%;margin-top:12px}.target{outline:3px solid #248179;outline-offset:3px;box-shadow:0 0 0 7px #24817915}.success{color:#176c65;font-weight:700}.status{min-height:1.5em;font-size:.85rem}.calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:14px}.calendar button{min-width:0;padding:8px 2px;min-height:64px;display:grid;place-items:center}.calendar small{font-size:.62rem;font-weight:600}.calendar .empty{opacity:.45}.calendar-head{display:grid;grid-template-columns:repeat(7,1fr);font-size:.7rem;text-align:center;color:#5b7771;gap:6px}.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #e1ece9;font-size:.9rem}.tabs{display:flex;gap:7px;overflow-x:auto;margin-top:12px;padding:4px}.tabs span{font-size:.72rem;white-space:nowrap;padding:8px 9px;background:#fff;border-radius:10px;color:#5b7771}.tabs .selected{background:#d2eee6;color:#176c65;font-weight:800}.bars{height:190px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:end;gap:14px;padding:12px 10px 0;border-bottom:1px solid #badbd5}.bar-item{height:100%;display:flex;flex-direction:column;justify-content:end;align-items:center;gap:8px}.bar-item button{width:100%;background:#8acbbd;border:0;min-height:44px;border-radius:8px 8px 0 0;color:#174b43}.bar-item:last-child button{background:#248179;color:white}.bar-item small{font-size:.75rem;color:#5b7771}.notice{background:#e8f6f1;padding:10px 12px;border-radius:10px;font-size:.8rem}.icon{font-size:2rem;color:#248179}details{font-size:.9rem}details summary{cursor:pointer}.hidden{display:none!important}@media(max-width:350px){body{padding:10px}.card{padding:12px}.calendar{gap:4px}.calendar button{min-height:58px}.bar-item small{font-size:.65rem}.bars{gap:8px}}@media(prefers-reduced-motion:no-preference){.target{transition:box-shadow .15s}}
</style></head><body><main id="demo"></main><script nonce="${nonce}">
const token=${JSON.stringify(nonce)};
const send=(type,extra={})=>parent.postMessage({tutorial:token,type,...extra},'*');
const model={step:0,saved:false,planned:false};
const base=new Date();base.setHours(12,0,0,0);
const month=base.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
const day=base.getDate();
const planDate=new Date(base);do{planDate.setDate(planDate.getDate()+1)}while([0,6].includes(planDate.getDay()));
const titleDate=d=>d.toLocaleDateString('de-DE',{day:'numeric',month:'long'});
const work=()=>138+(model.saved?8:0),credit=()=>work()+24;
const hours=n=>n.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' Std.';
const markup=(content,tab)=>'<div class="demo-brand"><span>Arbeitszeit</span><small>BEISPIEL · DEMO</small></div>'+content+'<div class="tabs" aria-hidden="true">'+['Heute','Kalender','Monate','Planung','Analyse','Einstellungen'].map(x=>'<span class="'+(x===tab?'selected':'')+'">'+x+'</span>').join('')+'</div>';
function done(){send('done',{step:model.step})}
function bind(id,fn){document.getElementById(id)?.addEventListener('click',fn)}
function timeFields(prefix){return '<div class="fields"><label>Beginn<input id="'+prefix+'Start" type="time" value="07:00" required></label><label>Ende<input id="'+prefix+'End" type="time" value="15:30" required></label><label>Pause in Minuten<input id="'+prefix+'Pause" type="number" min="0" max="1439" value="30" required></label></div>'}
function checkTime(prefix){return document.getElementById(prefix+'Start').value==='07:00'&&document.getElementById(prefix+'End').value==='15:30'&&Number(document.getElementById(prefix+'Pause').value)===30}
function render(step){
model.step=step;let content='',tab='Heute';
if(step===0){content='<section class="card hero"><span class="icon" aria-hidden="true">◷</span><h2>Alles im Blick.</h2><p>Arbeitszeiten, Urlaub, Überstunden und Schichten an einem Ort.</p><div class="notice">Hier übst du ausschließlich mit Beispielen. Deine echten Daten werden weder gelesen noch verändert.</div></section><section class="card"><h3>Einfach ausprobieren</h3><p class="muted">Die hervorgehobenen Elemente führen dich durch die App. Du entscheidest, wann es weitergeht.</p></section>'}
if(step===1){content='<section class="card"><h2>Arbeitszeit erfassen</h2><p class="muted">Beispieltag: '+titleDate(base)+'</p><div id="demoTimeForm" role="group" aria-label="Beispielzeit erfassen">'+timeFields('time')+'<button id="demoSaveTime" class="primary target" type="button">Arbeitszeit speichern</button></div><p id="demoTimeStatus" class="status" role="status">'+(model.saved?'✓ 8:00 Std. als Beispiel gespeichert.':'')+'</p></section>'}
if(step===2){tab='Kalender';let cells='';const first=new Date(base.getFullYear(),base.getMonth(),1),offset=(first.getDay()+6)%7,days=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();for(let i=0;i<offset;i++)cells+='<span></span>';for(let i=1;i<=days;i++)cells+='<button type="button" '+(i===day?'id="demoCalendarDay" class="target" aria-label="Beispieltag öffnen"':'class="empty" tabindex="-1" disabled')+'><span>'+i+'</span>'+(i===day?'<small>8:00 h</small>':'')+'</button>';content='<section class="card"><h2>'+month+'</h2><div class="calendar-head" aria-hidden="true">'+['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="calendar">'+cells+'</div></section><section id="demoCalendarEntry" class="card hidden" role="status"><h3>'+titleDate(base)+'</h3><p>07:00–15:30 Uhr · Pause 30 Min.</p><strong>8:00 Std. gespeichert</strong></section>'}
if(step===3){tab='Monate';content='<section class="card hero"><h2>'+month+'</h2><p class="muted">Gearbeitet inkl. Gutschriften</p><strong class="big">'+hours(credit())+'</strong><div class="metrics"><div class="metric"><span>Monatssoll</span><strong>160,00 Std.</strong></div><div class="metric"><span>Monatsdifferenz</span><strong>+'+(credit()-160).toFixed(2).replace('.',',')+' Std.</strong></div></div></section><section class="card"><button class="target" id="demoCalculation" type="button">Berechnung ansehen</button><div id="demoCalculationDetails" class="hidden"><div class="row"><span>Arbeitszeiten</span><strong>'+hours(work())+'</strong></div><div class="row"><span>Urlaub</span><strong>8,00 Std.</strong></div><div class="row"><span>Krankheit</span><strong>8,00 Std.</strong></div><div class="row"><span>Feiertag</span><strong>8,00 Std.</strong></div><p class="notice">'+hours(credit())+' − 160,00 Std. Soll = +'+(credit()-160)+',00 Std. im Monat. Mit +3,00 Std. Übertrag ergibt das +'+(credit()-157)+',00 Std. Zeitkonto.</p><p class="muted">Dieses Beispiel zeigt einen abgeschlossenen Monat. Der aktuelle Monat bleibt bis Monatsende offen.</p></div></section>'}
if(step===4){tab='Planung';content='<section class="card"><h2>Eine Schicht planen</h2><p class="muted">Für '+titleDate(planDate)+'</p><div id="demoPlanForm" role="group" aria-label="Beispielschicht planen">'+timeFields('plan')+'<button class="primary target" id="demoSavePlan" type="button">Planung speichern</button></div><p id="demoPlanStatus" class="status" role="status">'+(model.planned?'✓ Schicht geplant. Noch keine Arbeitszeit gebucht.':'')+'</p><p class="notice">Planungen zählen erst dann zu deinen Stunden, wenn du die tatsächliche Arbeitszeit speicherst.</p></section>'}
if(step===5){tab='Analyse';const labels=[-3,-2,-1,0].map(n=>new Date(base.getFullYear(),base.getMonth()+n,1).toLocaleDateString('de-DE',{month:'short'}));content='<section class="card"><h2>Deine Jahresanalyse</h2><p class="muted">Gearbeitete Stunden inkl. Gutschriften · Beispiel</p><div class="bars">'+[152,164,160,credit()].map((n,i)=>'<div class="bar-item"><button type="button" style="height:'+Math.round(n/190*100)+'%" '+(i===3?'id="demoMonthBar" class="target" aria-label="Beispielmonat mit '+n+' Stunden öffnen"':'disabled tabindex="-1"')+'>'+n+'</button><small>'+labels[i]+'</small></div>').join('')+'</div><div id="demoAnalysisDetails" class="hidden" role="status"><p class="success">'+month+': '+hours(credit())+'</p><p class="muted">Davon 24,00 Std. aus Urlaub, Krankheit und Feiertagen. Monatsdifferenz +'+(credit()-160)+',00 Std.</p></div></section>'}
if(step===6){tab='Einstellungen';content='<section class="card"><h2>Einstellungen</h2><p class="muted">Deine Arbeitszeit, Darstellung und Daten an einem Ort.</p><button class="target" id="demoHelp" type="button">Hilfe & Einführung öffnen</button><div id="demoHelpDetails" class="hidden" role="status"><h3 style="margin-top:18px">Hilfe & Einführung</h3><p><strong>Tutorial erneut starten</strong></p><p class="muted">Diesen Button findest du in den echten Einstellungen. Jeder Neustart verwendet wieder frische Beispieldaten.</p><p class="notice">Du bist bereit. „Mit eigenen Daten starten“ beendet die Demo.</p></div></section>'}
document.getElementById('demo').innerHTML=markup(content,tab);
document.getElementById('demoSaveTime')?.addEventListener('click',e=>{e.preventDefault();const out=document.getElementById('demoTimeStatus');if(!checkTime('time')){out.textContent='Nutze für dieses Beispiel 07:00–15:30 Uhr und 30 Minuten Pause.';return}model.saved=true;out.textContent='✓ 8:00 Std. als Beispiel gespeichert.';out.className='status success';done()});
bind('demoCalendarDay',()=>{document.getElementById('demoCalendarEntry').classList.remove('hidden');document.getElementById('demoCalendarEntry').scrollIntoView({block:'nearest'});done()});
bind('demoCalculation',()=>{document.getElementById('demoCalculationDetails').classList.remove('hidden');document.getElementById('demoCalculationDetails').scrollIntoView({block:'nearest'});done()});
document.getElementById('demoSavePlan')?.addEventListener('click',e=>{e.preventDefault();const out=document.getElementById('demoPlanStatus');if(!checkTime('plan')){out.textContent='Nutze für dieses Beispiel 07:00–15:30 Uhr und 30 Minuten Pause.';return}model.planned=true;out.textContent='✓ Schicht geplant. Noch keine Arbeitszeit gebucht.';out.className='status success';done()});
bind('demoMonthBar',()=>{document.getElementById('demoAnalysisDetails').classList.remove('hidden');done()});
bind('demoHelp',()=>{document.getElementById('demoHelpDetails').classList.remove('hidden');done()});
if(step===1&&model.saved||step===4&&model.planned)done();
window.scrollTo(0,0);document.querySelector('.target')?.focus({preventScroll:true});
}
window.addEventListener('message',event=>{if(event.source===parent&&event.data?.tutorial===token&&event.data.type==='step'&&Number.isInteger(event.data.step)&&event.data.step>=0&&event.data.step<7)render(event.data.step)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();send('skip')}if(event.key==='Enter'&&event.target.matches('input')){const group=event.target.closest('#demoTimeForm,#demoPlanForm');if(group){event.preventDefault();group.querySelector('button').click()}}});
send('ready');
<\/script></body></html>`;
}

export async function runTutorial({onFinish} = {}) {
  if (activeTutorial) return activeTutorial.promise;
  if (!document.querySelector('link[data-tutorial-styles]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./tutorial.css', import.meta.url).href;
    link.dataset.tutorialStyles = '';
    document.head.append(link);
  }
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  const surfaces = [...document.querySelectorAll('#appWorkspace')].map(element => ({element, inert:element.inert}));
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(20)), n => n.toString(16).padStart(2, '0')).join('');
  const dialog = document.createElement('dialog');
  dialog.className = 'tutorial-dialog';
  dialog.setAttribute('aria-labelledby', 'tutorialTitle');
  dialog.innerHTML = `<header class="tutorial-header"><span class="tutorial-badge">TUTORIAL · NUR BEISPIELDATEN</span><button class="tutorial-skip" type="button">Überspringen</button></header><progress class="tutorial-progress" max="7" value="1" aria-label="Fortschritt der Einführung"></progress><div class="tutorial-instruction"><div class="tutorial-counter"></div><h2 id="tutorialTitle"></h2><p id="tutorialInstruction"></p></div><iframe class="tutorial-frame" title="Isolierte Beispiel-App zum Ausprobieren" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><footer class="tutorial-footer"><button class="tutorial-back" type="button">Zurück</button><p class="tutorial-task-status" role="status" aria-live="polite"></p><button class="tutorial-next" type="button">Weiter</button></footer>`;
  const frame = dialog.querySelector('iframe');
  const next = dialog.querySelector('.tutorial-next');
  const back = dialog.querySelector('.tutorial-back');
  const taskStatus = dialog.querySelector('.tutorial-task-status');
  const completed = new Set([0]);
  let step = 0, ready = false, finishing = false;
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  activeTutorial = {promise, close:() => finish('skipped', true)};
  const update = () => {
    dialog.querySelector('#tutorialTitle').textContent = steps[step][0];
    dialog.querySelector('#tutorialInstruction').textContent = steps[step][1];
    dialog.querySelector('.tutorial-counter').textContent = `Schritt ${step + 1} von ${steps.length}`;
    dialog.querySelector('progress').value = step + 1;
    back.disabled = step === 0;
    next.disabled = !completed.has(step);
    next.textContent = step === steps.length - 1 ? 'Mit eigenen Daten starten' : 'Weiter';
    taskStatus.textContent = completed.has(step) ? (step === 0 ? 'Deine echten Daten bleiben unberührt.' : '✓ Schritt erledigt') : 'Probiere das hervorgehobene Element aus.';
    if (ready) frame.contentWindow.postMessage({tutorial:nonce,type:'step',step}, '*');
  };
  const finish = async (status, silent = false) => {
    if (finishing) return;
    finishing = true;
    window.removeEventListener('message', receive);
    dialog.close();
    dialog.remove();
    document.body.style.overflow = previousOverflow;
    for (const {element, inert} of surfaces) {
      if (element.isConnected && !element.hidden) element.inert = inert;
    }
    activeTutorial = null;
    if (!silent && previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    try { if (!silent) await onFinish?.(status); resolve(status); }
    catch (error) { reject(error); }
  };
  const receive = event => {
    if (event.source !== frame.contentWindow || event.data?.tutorial !== nonce) return;
    if (event.data.type === 'ready') { ready = true; update(); }
    else if (event.data.type === 'skip') void finish('skipped');
    else if (event.data.type === 'done' && event.data.step === step) {
      completed.add(step);
      next.disabled = false;
      taskStatus.textContent = '✓ Schritt erledigt';
    }
  };
  window.addEventListener('message', receive);
  dialog.querySelector('.tutorial-skip').addEventListener('click', () => void finish('skipped'));
  dialog.addEventListener('cancel', event => { event.preventDefault(); void finish('skipped'); });
  back.addEventListener('click', () => { if (step > 0) { step--; update(); } });
  next.addEventListener('click', () => {
    if (!completed.has(step)) return;
    if (step === steps.length - 1) void finish('completed');
    else { step++; update(); }
  });
  frame.srcdoc = sandboxDocument(nonce);
  document.body.append(dialog);
  for (const {element} of surfaces) element.inert = true;
  document.body.style.overflow = 'hidden';
  dialog.showModal();
  update();
  dialog.querySelector('.tutorial-skip').focus();
  return promise;
}
