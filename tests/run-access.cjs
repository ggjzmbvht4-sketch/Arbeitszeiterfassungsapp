/* Run with a local static server: APP_URL=http://localhost:8020 node tests/run-access.cjs
 * Tests use an isolated SDK fixture and block all external requests. No real accounts,
 * emails or production data are created or modified. Install playwright in the runtime.
 */
const assert = require('node:assert/strict');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const APP_URL = process.env.APP_URL || 'http://localhost:8020';
const USER = '9a4b0772-b865-48a7-b8e7-1b8becfb36bc';
const OTHER_USER = 'aa9c5f75-fcc2-4a14-b33a-04a881d63b65';
const HOST = 'qiquwspmgxcldtoevjxw.supabase.co';
const SESSION_KEY = `arbeitszeit-supabase-auth-${HOST}`;
const ACCESS_KEY = `arbeitszeit-access:${HOST}:${USER}`;
const TUTORIAL_KEY = `arbeitszeit-tutorial:${HOST}:${USER}`;
const SESSION = {user:{id:USER,email:'isolated@example.test'},refresh_token:'mock-refresh-token',access_token:'mock-access-token',expires_at:Math.floor(Date.now()/1000)+3600};

async function fixture(browser, options={}) {
  const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(APP_URL).origin) return route.abort();
    return route.continue();
  });
  await context.addInitScript(({options,USER,HOST,SESSION_KEY,SESSION}) => {
    if (window !== window.top) return; // The tutorial iframe intentionally has an opaque origin and no storage.
    const read = (key,fallback=null) => {try {return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
    const write = (key,value) => localStorage.setItem(key,JSON.stringify(value));
    if (!localStorage.getItem('fixture:initialized')) {
      localStorage.setItem('fixture:initialized','1');
      write('fixture:server',{legal:options.legal??false,onboarding:options.onboarding===undefined?'completed':options.onboarding,accounts:{},snapshots:{},delays:{},writes:[],requests:[],unauthorized:false});
      if (options.session) write(SESSION_KEY,SESSION);
      if (options.lastUserOnly) write('arbeitszeit-supabase-last-user-v1',SESSION.user);
      if (options.accessCache) write(`arbeitszeit-access:${HOST}:${USER}`,{user_id:USER,verified:true,terms_version:'2026-11-18',privacy_version:'2026-11-18',accepted_at:'2026-11-18T10:00:00Z'});
      if (options.onboarding==='completed') write(`arbeitszeit-tutorial:${HOST}:${USER}`,{user_id:USER,tutorial_version:1,status:'completed',finished_at:'2026-11-18T10:00:00Z'});
    }
    if (options.offline) Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});
    const getServer = () => read('fixture:server');
    const mutate = fn => {const value=getServer();fn(value);write('fixture:server',value);};
    const waits=new Map();
    const delay = key => getServer().delays?.[key] ? new Promise(resolve=>waits.set(key,resolve)) : Promise.resolve();
    const account = owner => getServer().accounts?.[owner] || (owner===USER?{legal:getServer().legal,onboarding:getServer().onboarding}:{legal:false,onboarding:null});
    const listeners=[];
    const event = (name,session) => {for(const cb of listeners)cb(name,session);};
    const pageRequests=[];
    const log = (name,args) => {pageRequests.push({name,args});mutate(s=>s.requests.push({name,args}));};
    const current = () => read(SESSION_KEY);
    const response = data => ({data,error:null});
    const consent = (owner=current()?.user.id||USER) => ({user_id:owner,terms_version:'2026-11-18',privacy_version:'2026-11-18',accepted_at:'2026-11-18T12:34:56Z'});
    const client={auth:{
      onAuthStateChange(cb){listeners.push(cb);return {data:{subscription:{unsubscribe(){}}}};},
      async getSession(){log('getSession');return response({session:current()});},
      async getUser(){log('getUser');return getServer().unauthorized ? {data:{user:null},error:{status:401,message:'revoked'}}:response({user:current()?.user||null});},
      async signInWithPassword(args){log('signInWithPassword',{email:args.email});if(args.password!=='correct-password')return {data:null,error:{message:'wrong password'}};write(SESSION_KEY,SESSION);event('SIGNED_IN',SESSION);return response({session:SESSION,user:SESSION.user});},
      async signInWithPasskey(){write(SESSION_KEY,SESSION);event('SIGNED_IN',SESSION);return response({session:SESSION,user:SESSION.user});},
      async signOut(){localStorage.removeItem(SESSION_KEY);event('SIGNED_OUT',null);return response(null);},
      async updateUser(){log('updateUser');event('USER_UPDATED',current());return response({user:current()?.user});},
      async resetPasswordForEmail(){log('resetPasswordForEmail');return response({});},
    },
    from(table){
      const filters={};
      const query={
        select(){return query;},eq(k,v){filters[k]=v;return query;},order(){return query;},limit(){return query;},
        async maybeSingle(){
          log(`select:${table}`,filters);
          if(table==='account_legal_acceptances'){const owner=filters.user_id;const data=account(owner).legal?consent(owner):null;await delay(`select:${table}:${owner}`);return response(data);}
          if(table==='account_onboarding'){const owner=filters.user_id,status=account(owner).onboarding;await delay(`select:${table}:${owner}`);return response(status?{user_id:owner,tutorial_version:1,status,finished_at:status==='pending'?null:'2026-11-18T10:00:00Z'}:null);}
          if(table==='user_snapshots'){const owner=filters.user_id,value=getServer().snapshots?.[owner]||null;await delay(`select:${table}:${owner}`);return response(value);}
          return response(null);
        },
        async upsert(value){log(`upsert:${table}`,value);mutate(s=>{s.writes.push({table,value});if(table==='account_onboarding'){if(value.user_id===USER)s.onboarding=value.status;else {s.accounts[value.user_id]??={legal:false};s.accounts[value.user_id].onboarding=value.status;}}});return response(value);},
        delete(){return query;},
        then(resolve,reject){return query.maybeSingle().then(resolve,reject);},
      };return query;
    },
    rpc(name,args){
      const headers={};
      const execute=async()=>{
        log(`rpc:${name}`,args);
        if(name==='accept_current_legal'){const owner=current()?.user.id;mutate(s=>{if(owner===USER)s.legal=true;else {s.accounts[owner]??={onboarding:null};s.accounts[owner].legal=true;}s.writes.push({rpc:name,args,owner});});return response(consent(owner));}
        if(name==='save_snapshot'){
          mutate(s=>s.writes.push({rpc:name,args,authorization:headers.Authorization}));
          await delay(`rpc:${name}`);
          return response(1);
        }
        return response(null);
      };
      const builder={setHeader(name,value){headers[name]=value;return builder;},then(resolve,reject){return execute().then(resolve,reject);}};
      return builder;
    }};
    window.supabase={createClient:(_url,_key,config)=>config?.global?.headers?.Authorization ? {rpc:async(name,args)=>{
      const authorization=config.global.headers.Authorization;
      log(`scoped:${name}`,{authorization,args});
      mutate(s=>s.writes.push({rpc:name,args,authorization}));
      await delay(`rpc:${name}`);
      return response(1);
    }} : client};
    window.fixture={event,server:getServer,mutate,pageRequests,pendingKeys:()=>[...waits.keys()],release:key=>{const done=waits.get(key);waits.delete(key);done?.();},switchUser:candidate=>{write(SESSION_KEY,candidate);event('SIGNED_IN',candidate);}};
  },{options,USER,HOST,SESSION_KEY,SESSION});
  const page = await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(APP_URL+(options.hash||''));
  await page.waitForFunction(()=>!document.body.inert);
  return {context,page,errors};
}
async function expectLocked(page,form='#accessLogin') {
  await page.locator(form).waitFor({state:'visible'});
  assert(await page.locator('#appWorkspace').isHidden());
  assert(await page.locator('#appWorkspace').evaluate(node=>node.inert));
}
async function expectReady(page) {
  await page.locator('#appWorkspace').waitFor({state:'visible'});
  assert(await page.locator('#accessGate').isHidden());
}
async function readStore(page,key) {
  return page.evaluate(async key=>{
    const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('arbeitszeit-app');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    const value=await new Promise((resolve,reject)=>{const q=db.transaction('state').objectStore('state').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});db.close();return value;
  },key);
}
async function seedStore(page,key,state) {
  await page.evaluate(async({key,state})=>{
    const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('arbeitszeit-app');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(state,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  },{key,state});
}
const OLD_STATE={settings:{monthlyTarget:160,holidayHours:8,holidayWeekdays:[1,2,3,4,5],vacationEntitlement:30,vacationHours:8,sickHours:8,vacationStartYear:2026,accountStartMonth:'2026-01',openingBalance:12.5,appTheme:'turquoise'},records:[{id:'real-sentinel',type:'work',mode:'duration',date:'2026-11-18',hours:5,breakMinutes:0}],plans:[]};

async function run(){
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    {
      const {page,context,errors}=await fixture(browser);
      await expectLocked(page);await seedStore(page,'main',OLD_STATE);await page.reload();await expectLocked(page);
      assert.equal(await page.locator('#accessTerms').isChecked(),false);assert.equal(await page.locator('#accessPrivacy').isChecked(),false);
      assert.deepEqual(await readStore(page,'main'),OLD_STATE);
      assert.equal((await page.evaluate(()=>fixture.server().requests)).some(x=>x.name==='select:user_snapshots'),false);
      for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
      assert.deepEqual(errors,[]);await context.close();console.log('PASS logged-out gate, hidden legacy data and responsive login');
    }
    {
      const {page,context,errors}=await fixture(browser);
      await expectLocked(page);await page.locator('#accessEmail').fill('isolated@example.test');await page.locator('#accessPassword').fill('wrong-password');await page.locator('#accessLoginSubmit').click();await expectLocked(page);assert.match(await page.locator('#accessStatus').innerText(),/fehlgeschlagen/);
      await page.locator('#accessPassword').fill('correct-password');await page.locator('#accessLoginSubmit').click();await expectLocked(page,'#accessLegal');
      await page.locator('#accessTerms').check();await page.locator('#accessLegal button[type=submit]').click();assert.equal((await page.evaluate(()=>fixture.server().writes)).length,0);
      await page.locator('#accessPrivacy').check();await page.locator('#accessLegal button[type=submit]').click();await expectReady(page);
      assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).accepted_at,ACCESS_KEY),'2026-11-18T12:34:56Z');
      assert.equal((await page.evaluate(()=>fixture.server().writes)).filter(x=>x.rpc==='accept_current_legal').length,1);
      assert.deepEqual(errors,[]);await context.close();console.log('PASS login errors, mandatory legal checkboxes and server-stamped acceptance');
    }
    {
      const {page,context,errors}=await fixture(browser,{session:true,legal:false,onboarding:'completed',hash:'#type=invite'});
      await expectLocked(page,'#accessSetPassword');
      await page.locator('#accessNewPassword').fill('correct-password');await page.locator('#accessConfirmPassword').fill('different-password');await page.locator('#accessSetPassword button').click();assert.match(await page.locator('#accessStatus').innerText(),/nicht überein/);
      await page.locator('#accessConfirmPassword').fill('correct-password');await page.locator('#accessSetPassword button').click();await expectLocked(page,'#accessLegal');assert.equal((await page.evaluate(()=>fixture.server().requests)).filter(x=>x.name==='updateUser').length,1);
      await page.locator('#accessTerms').check();await page.locator('#accessPrivacy').check();await page.locator('#accessLegal button[type=submit]').click();await expectReady(page);
      assert.deepEqual(errors,[]);await context.close();console.log('PASS invitation password setup and mandatory legal gate');
    }
    {
      const {page,context,errors}=await fixture(browser,{hash:'#error=access_denied&error_description=expired'});await expectLocked(page);assert.match(await page.locator('#accessStatus').innerText(),/abgelaufen/);assert.deepEqual(errors,[]);await context.close();console.log('PASS expired invitation links stay locked');
    }
    {
      const {page,context,errors}=await fixture(browser,{session:true,legal:true,onboarding:'completed'});
      await expectReady(page);await seedStore(page,`account:${USER}`,OLD_STATE);await page.reload();await expectReady(page);
      await page.locator('#headerSettings').click();await page.locator('[data-open="data"]').click();await page.locator('#cloudLogout').evaluate(node=>{for(let p=node.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await page.locator('#cloudLogout').click();await expectLocked(page);
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),ACCESS_KEY),null);assert.deepEqual(await readStore(page,`account:${USER}`),OLD_STATE);
      await page.reload();await expectLocked(page);assert.deepEqual(errors,[]);await context.close();console.log('PASS explicit logout removes offline grant and preserves account data');
    }
    {
      const {page,context,errors}=await fixture(browser,{session:true,legal:true,accessCache:true,onboarding:'completed',offline:true});
      await expectReady(page);assert.equal((await page.evaluate(()=>fixture.server().requests)).some(x=>x.name==='getUser'),false);
      assert.deepEqual(errors,[]);await context.close();console.log('PASS previously verified account works offline');
    }
    {
      const {page,context,errors}=await fixture(browser,{lastUserOnly:true,offline:true});await expectLocked(page);assert.match(await page.locator('#accessStatus').innerText(),/Internetverbindung/);assert.deepEqual(errors,[]);await context.close();console.log('PASS last-user-only offline bypass is rejected');
    }
    {
      const {page,context,errors}=await fixture(browser,{session:true,legal:true,onboarding:'completed'});await expectReady(page);
      await page.evaluate(()=>{fixture.mutate(s=>s.unauthorized=true);document.dispatchEvent(new Event('visibilitychange'));});await expectLocked(page);assert.equal(await page.evaluate(key=>localStorage.getItem(key),ACCESS_KEY),null);assert.deepEqual(errors,[]);await context.close();console.log('PASS revoked online session locks the workspace');
    }
    {
      const {page,context,errors}=await fixture(browser,{session:true,legal:true,onboarding:null});await expectReady(page);await page.locator('.tutorial-dialog').waitFor({state:'visible'});
      const before=await readStore(page,`account:${USER}`);const beforeWrites=await page.evaluate(()=>fixture.server().writes.filter(x=>x.rpc==='save_snapshot'));
      await page.locator('.tutorial-skip').click();await page.locator('.tutorial-dialog').waitFor({state:'detached'});
      await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.status==='skipped',TUTORIAL_KEY);
      assert.deepEqual(await readStore(page,`account:${USER}`),before);assert.deepEqual(await page.evaluate(()=>fixture.server().writes.filter(x=>x.rpc==='save_snapshot')),beforeWrites);
      await page.reload();await expectReady(page);assert.equal(await page.locator('.tutorial-dialog').count(),0);
      await page.locator('#headerSettings').click();await page.locator('[data-open="help"]').click();await page.locator('#tutorialRestart').click();await page.locator('.tutorial-dialog').waitFor({state:'visible'});await page.locator('.tutorial-skip').click();
      assert.deepEqual(errors,[]);await context.close();console.log('PASS demo auto-start, safe skip, durable status and settings restart');
    }
    {
      const {page,context,errors}=await fixture(browser,{session:true,legal:true,onboarding:'completed'});await expectReady(page);
      const otherState={...OLD_STATE,settings:{...OLD_STATE.settings,openingBalance:77},records:[{...OLD_STATE.records[0],id:'other-real-sentinel',hours:3}]};
      const lateState={...OLD_STATE,records:[{...OLD_STATE.records[0],id:'old-account-late-response',hours:19}]};
      await seedStore(page,`account:${USER}`,OLD_STATE);await seedStore(page,`account:${OTHER_USER}`,otherState);
      await page.evaluate(({USER,OTHER_USER,lateState})=>fixture.mutate(s=>{s.accounts[OTHER_USER]={legal:false,onboarding:null};s.snapshots[USER]={state:lateState,version:9};s.delays[`select:user_snapshots:${USER}`]=true;}),{USER,OTHER_USER,lateState});
      await page.reload();await expectReady(page);await page.waitForFunction(key=>fixture.pendingKeys().includes(key),`select:user_snapshots:${USER}`);
      const synchronousLock=await page.evaluate(({OTHER_USER,SESSION})=>{fixture.switchUser({...SESSION,user:{id:OTHER_USER,email:'other@example.test'},access_token:'mock-token-other'});const view=document.getElementById('appWorkspace');return {hidden:view.hidden,inert:view.inert};},{OTHER_USER,SESSION});
      assert.deepEqual(synchronousLock,{hidden:true,inert:true});await expectLocked(page,'#accessLegal');
      assert.equal(await page.evaluate(({HOST,OTHER_USER})=>localStorage.getItem(`arbeitszeit-access:${HOST}:${OTHER_USER}`),{HOST,OTHER_USER}),null);
      await page.locator('#accessTerms').check();await page.locator('#accessPrivacy').check();await page.locator('#accessLegal button[type=submit]').click();await expectReady(page);await page.locator('.tutorial-dialog').waitFor({state:'visible'});
      assert((await page.evaluate(()=>fixture.server().requests)).some(x=>x.name==='select:account_onboarding'&&x.args.user_id===OTHER_USER));
      await page.evaluate(key=>fixture.release(key),`select:user_snapshots:${USER}`);
      await page.waitForFunction(()=>!fixture.pendingKeys().length);
      assert.deepEqual(await readStore(page,`account:${OTHER_USER}`),otherState);assert.deepEqual(await readStore(page,`account:${USER}`),OLD_STATE);
      await page.locator('.tutorial-skip').click();await page.locator('.tutorial-dialog').waitFor({state:'detached'});
      assert.equal(await page.locator('#todayWorked').innerText(),'3:00 Std.');
      assert.deepEqual(errors,[]);await context.close();console.log('PASS synchronous account-switch lock, separate consent/tutorial and stale old-account response isolation');
    }
    {
      const {page,context,errors}=await fixture(browser,{session:true,legal:true,onboarding:'completed'});await expectReady(page);
      const otherState={...OLD_STATE,settings:{...OLD_STATE.settings,openingBalance:77},records:[{...OLD_STATE.records[0],id:'other-write-sentinel',hours:3}]};
      await seedStore(page,`account:${USER}`,OLD_STATE);await seedStore(page,`account:${OTHER_USER}`,otherState);
      await page.evaluate(({OTHER_USER})=>fixture.mutate(s=>{s.accounts[OTHER_USER]={legal:true,onboarding:'completed'};s.delays['rpc:save_snapshot']=true;}),{OTHER_USER});
      await page.reload();await expectReady(page);
      await page.locator('#manualStart').fill('07:00');await page.locator('#manualEnd').fill('08:00');await page.locator('#manualPause').fill('0');
      page.on('dialog',dialog=>dialog.accept());await page.locator('#manualForm button[type=submit]').click();
      await page.waitForFunction(()=>fixture.pendingKeys().includes('rpc:save_snapshot'));
      const outgoing=await page.evaluate(()=>fixture.server().writes.find(x=>x.rpc==='save_snapshot'));
      assert.equal(outgoing.authorization,'Bearer mock-access-token');assert(outgoing.args.p_state.records.some(record=>record.id==='real-sentinel'));
      await page.evaluate(()=>{document.getElementById('accessTerms').checked=true;document.getElementById('accessPrivacy').checked=true;});
      const synchronousLock=await page.evaluate(({OTHER_USER,SESSION})=>{fixture.switchUser({...SESSION,user:{id:OTHER_USER,email:'other@example.test'},access_token:'mock-token-other'});return document.getElementById('appWorkspace').hidden;},{OTHER_USER,SESSION});assert.equal(synchronousLock,true);
      await expectReady(page);await page.evaluate(()=>fixture.release('rpc:save_snapshot'));await page.waitForFunction(()=>!fixture.pendingKeys().length);
      assert.equal(await page.locator('#cloudEmail').innerText(),'other@example.test');assert.deepEqual(await readStore(page,`account:${OTHER_USER}`),otherState);
      const writes=await page.evaluate(()=>fixture.server().writes.filter(x=>x.rpc==='save_snapshot'));assert.equal(writes.length,1);assert.equal(writes[0].authorization,'Bearer mock-access-token');assert.deepEqual(errors,[]);await context.close();console.log('PASS in-flight snapshot writes stay bound to the old account token and cannot overwrite the new account');
    }
    console.log('All access tests passed. No production requests were permitted.');
  } finally {await browser.close();}
}
module.exports={fixture,expectReady,expectLocked,seedStore,readStore,OLD_STATE,USER,OTHER_USER,SESSION,SESSION_KEY,ACCESS_KEY,TUTORIAL_KEY,HOST,APP_URL};
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
