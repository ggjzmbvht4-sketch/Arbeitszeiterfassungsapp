/* Real service-worker cache check. Auth is isolated with the same SDK fixture;
 * offline asset delivery uses Chromium's actual network-offline mode, not a
 * navigator.onLine override. No production requests are allowed.
 */
const assert = require('node:assert/strict');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const {fixture,expectReady,seedStore,readStore,OLD_STATE,USER,APP_URL}=require('./run-access.cjs');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const {page,context,errors}=await fixture(browser,{session:true,legal:true,onboarding:'completed'});
    await expectReady(page);await seedStore(page,`account:${USER}`,OLD_STATE);
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    const cached=await page.evaluate(async()=>{
      const cacheName=(await caches.keys()).find(name=>name.startsWith('arbeitszeit-shell-'));
      const cache=await caches.open(cacheName);return (await cache.keys()).map(request=>new URL(request.url).pathname);
    });
    for(const path of ['/index.html','/access.js','/access.css','/tutorial.js','/tutorial.css','/vendor/supabase.js','/nutzungsbedingungen.html','/datenschutz.html','/impressum.html'])assert(cached.includes(path),`Missing offline asset ${path}`);
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});await expectReady(page);
    assert.equal(await page.evaluate(()=>navigator.onLine),false);assert.equal(await page.evaluate(()=>fixture.pageRequests.filter(request=>request.name==='getUser').length),0);
    assert.equal(await page.locator('#todayWorked').innerText(),'5:00 Std.');assert.deepEqual(await readStore(page,`account:${USER}`),OLD_STATE);
    await page.locator('#headerSettings').click();await page.locator('[data-open="help"]').click();await page.locator('#tutorialRestart').click();await page.locator('.tutorial-dialog').waitFor({state:'visible'});await page.locator('.tutorial-skip').click();
    await page.goto(new URL('/datenschutz.html',APP_URL).href,{waitUntil:'domcontentloaded'});assert.match(await page.title(),/Datenschutz/);
    assert.deepEqual(errors,[]);await context.close();console.log('PASS real service-worker offline reload, all core assets/legal text cached, local account data retained and offline tutorial restart');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
