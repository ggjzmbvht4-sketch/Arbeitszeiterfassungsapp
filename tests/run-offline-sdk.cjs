// Real bundled Supabase SDK and service worker; only local, synthetic session data.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const APP_URL=process.env.APP_URL||'http://localhost:8020';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(APP_URL);await page.waitForFunction(()=>!document.body.inert);await page.waitForFunction(()=>navigator.serviceWorker.controller);
await page.evaluate(async()=>{const owner='6d68682d-0b5b-4f5d-82cf-871faed1054b',host='qiquwspmgxcldtoevjxw.supabase.co';
localStorage.setItem(`arbeitszeit-supabase-auth-${host}`,JSON.stringify({user:{id:owner,email:'offline@example.test',aud:'authenticated',role:'authenticated'},refresh_token:'synthetic-refresh',access_token:'synthetic-access',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600}));
localStorage.setItem(`arbeitszeit-access:${host}:${owner}`,JSON.stringify({user_id:owner,terms_version:'2026-11-18',privacy_version:'2026-11-18',verified:true}));localStorage.setItem(`arbeitszeit-tutorial:${host}:${owner}`,JSON.stringify({user_id:owner,tutorial_version:1,status:'completed',finished_at:new Date().toISOString()}));
const now=new Date(),day=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const db=await new Promise(r=>{const q=indexedDB.open('arbeitszeit-app');q.onsuccess=()=>r(q.result);});const tx=db.transaction('state','readwrite');tx.objectStore('state').put({settings:{monthlyTarget:160,holidayHours:0},records:[{id:'offline-record',date:day,type:'work',mode:'duration',hours:3,breakMinutes:0}],plans:[]},`account:${owner}`);await new Promise(r=>tx.oncomplete=r);db.close();});
await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!document.body.inert);await page.locator('#appWorkspace').waitFor({state:'visible'});assert.equal(await page.locator('#todayWorked').innerText(),'3:00 Std.');
await page.locator('#headerSettings').click();await page.locator('[data-open="help"]').click();await page.locator('#tutorialRestart').click();await page.locator('.tutorial-dialog').waitFor({state:'visible'});await page.locator('.tutorial-skip').click();
await page.goto(APP_URL+'/nutzungsbedingungen.html');assert.match(await page.title(),/Nutzungsbedingungen/);await page.goto(APP_URL+'/datenschutz.html');assert.match(await page.title(),/Datenschutz/);
assert.deepEqual(errors,[]);console.log('PASS real SDK, real service worker, cached account data, tutorial and legal pages work offline.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
