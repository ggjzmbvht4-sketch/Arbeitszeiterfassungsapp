import { runTutorial, closeTutorial, isTutorialRunning } from './tutorial.js';

export const LEGAL_VERSION = '2026-11-18';
const TUTORIAL_VERSION = 1;
const $ = id => document.getElementById(id);
const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Online access still works without a local cache. */ } };
const remove = key => { try { localStorage.removeItem(key); } catch {} };
const timeout = promise => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Die Verbindung dauert zu lange. Bitte erneut versuchen.')), 15000);
  Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});

export function createAccessController({ getClient, onReady, onLock, storageKey, projectUrl }) {
  let client, session = null, readyOwner = null, granted = false, busy = false, epoch = 0, initDone = false;
  let needsPassword = false, legalOwner = null, tutorialPending = false, autoTourTimer;
  const entryParams = new URLSearchParams(location.hash.slice(1));
  let entryType = entryParams.get('type');
  const host = new URL(projectUrl).hostname;
  const accessKey = id => `arbeitszeit-access:${host}:${id}`;
  const tourKey = id => `arbeitszeit-tutorial:${host}:${id}`;
  const passwordKey = id => `arbeitszeit-password-pending:${host}:${id}`;
  const workspace = $('appWorkspace');
  const gate = $('accessGate');
  gate.innerHTML = `
    <div class="access-brand">Arbeitszeit<span>Deine Zeit. Dein Überblick.</span></div>
    <div class="access-card">
      <p class="access-eyebrow">PRIVATER EINLADUNGSBEREICH</p>
      <h1 id="accessTitle" tabindex="-1">Anmeldung wird geprüft …</h1>
      <p id="accessIntro">Deine gespeicherten Daten bleiben erhalten.</p>
      <form id="accessLogin" hidden>
        <label for="accessEmail">E-Mail-Adresse</label><input id="accessEmail" type="email" required autocomplete="username" autocapitalize="none" spellcheck="false">
        <label for="accessPassword">Passwort</label><div class="access-password"><input id="accessPassword" type="password" required minlength="8" maxlength="128" autocomplete="current-password"><button id="accessTogglePassword" type="button" class="secondary" aria-label="Passwort anzeigen">Anzeigen</button></div>
        <button id="accessLoginSubmit" type="submit">Anmelden</button>
        <button id="accessPasskey" type="button" class="secondary">Mit Passkey anmelden</button>
        <button id="accessForgot" type="button" class="quiet">Passwort vergessen?</button>
        <p class="hint">Neue Konten können nur über eine persönliche E-Mail-Einladung aktiviert werden.</p>
      </form>
      <form id="accessSetPassword" hidden>
        <label for="accessNewPassword">Neues Passwort</label><input id="accessNewPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password">
        <label for="accessConfirmPassword">Passwort wiederholen</label><input id="accessConfirmPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password">
        <button type="submit">Passwort speichern und weiter</button>
      </form>
      <form id="accessLegal" hidden>
        <p class="hint">Bitte lies die verlinkten Texte. Optionale KI-, Sprach- und Push-Funktionen werden damit nicht eingeschaltet.</p>
        <label class="access-check"><input id="accessTerms" type="checkbox" required><span>Ich akzeptiere die <a href="./nutzungsbedingungen.html" target="_blank" rel="noopener">Nutzungsbedingungen</a>.</span></label>
        <label class="access-check"><input id="accessPrivacy" type="checkbox" required><span>Ich habe die <a href="./datenschutz.html" target="_blank" rel="noopener">Datenschutzhinweise</a> zur Kenntnis genommen.</span></label>
        <p class="hint">Stand der Texte: 18. November 2026</p>
        <button type="submit">Bestätigen und App öffnen</button>
      </form>
      <p id="accessStatus" role="status" aria-live="polite"></p>
      <button id="accessRetry" type="button" class="secondary" hidden>Erneut prüfen</button>
      <button id="accessSignOut" type="button" class="quiet" hidden>Abmelden</button>
    </div>
    <nav class="access-legal" aria-label="Rechtliche Informationen"><a href="./nutzungsbedingungen.html">Nutzungsbedingungen</a><a href="./datenschutz.html">Datenschutz</a><a href="./impressum.html">Anbieterhinweise</a></nav>`;

  function status(text) { $('accessStatus').textContent = text; }
  function show(stage, message = '') {
    gate.hidden = stage === 'ready';
    workspace.hidden = stage !== 'ready';
    workspace.inert = stage !== 'ready';
    for (const [id, name] of [['accessLogin','login'],['accessLegal','legal'],['accessSetPassword','password']]) $(id).hidden = stage !== name;
    $('accessTitle').textContent = ({login:'Willkommen zurück',legal:'Bevor du loslegst',password:entryType==='recovery'?'Neues Passwort festlegen':'Konto aktivieren',checking:'Anmeldung wird geprüft …',error:'Verbindung gerade nicht möglich'})[stage] || '';
    $('accessIntro').textContent = stage === 'login' ? 'Melde dich an, um deine Zeiten zu sehen und zu erfassen.' : stage === 'legal' ? 'Nur noch deine Bestätigung, dann ist dein Konto bereit.' : stage === 'password' ? 'Lege dein persönliches Passwort fest. Deine Daten bleiben erhalten.' : 'Deine gespeicherten Daten bleiben erhalten.';
    $('accessRetry').hidden = !['error','checking'].includes(stage);
    $('accessSignOut').hidden = !session;
    status(message);
    if (stage !== 'ready' && !document.body.inert) $('accessTitle').focus({preventScroll:true});
  }
  function suspend() {
    granted = false; readyOwner = null;
    clearTimeout(autoTourTimer);
    workspace.hidden = true; workspace.inert = true;
    closeTutorial();
    onLock();
  }
  function lock(message = '', revoke = false) {
    epoch++;
    clearTimeout(autoTourTimer);
    if (revoke && session?.user?.id) remove(accessKey(session.user.id));
    suspend();
    session = null;
    needsPassword = false; entryType = null; legalOwner = null;
    $('accessLegal').reset(); $('accessLogin').reset(); $('accessSetPassword').reset();
    show('login', message);
  }
  function cachedSession() {
    const value = read(storageKey);
    const candidate = value?.currentSession || value;
    return candidate?.user?.id && candidate?.refresh_token ? candidate : null;
  }
  function offlineAllowed(candidate) {
    const cached = candidate?.user?.id && read(accessKey(candidate.user.id));
    return candidate?.refresh_token && cached?.user_id === candidate.user.id && cached?.verified === true && cached?.terms_version === LEGAL_VERSION && cached?.privacy_version === LEGAL_VERSION && !read(passwordKey(candidate.user.id));
  }
  async function saveTutorial(statusValue, owner) {
    const value = {user_id:owner,tutorial_version:TUTORIAL_VERSION,status:statusValue,finished_at:new Date().toISOString(),pendingSync:true};
    write(tourKey(owner),value);
    if (!navigator.onLine || !session || session.user.id !== owner) return;
    try {
      const {error} = await timeout(client.from('account_onboarding').upsert({user_id:owner,tutorial_version:TUTORIAL_VERSION,status:statusValue,finished_at:value.finished_at},{onConflict:'user_id'}));
      if (!error) write(tourKey(owner),{...value,pendingSync:false});
    } catch { /* The account-scoped decision will sync when the connection returns. */ }
  }
  async function startTutorial() {
    if (!granted || isTutorialRunning()) return;
    const owner = session.user.id;
    tutorialPending = false;
    await runTutorial({onFinish: async result => {
      if (!granted || session?.user.id !== owner) return;
      await saveTutorial(result,owner);
    }});
  }
  async function loadTutorialState(owner, offline) {
    const cached = read(tourKey(owner));
    if (!offline) {
      if (cached?.pendingSync && cached.tutorial_version === TUTORIAL_VERSION && ['completed','skipped'].includes(cached.status)) {
        await saveTutorial(cached.status,owner);
        return false;
      }
      let response;
      try { response = await timeout(client.from('account_onboarding').select('user_id,tutorial_version,status,finished_at').eq('user_id',owner).maybeSingle()); }
      catch { response = {error:true}; }
      const {data,error} = response;
      if (error) return !cached || cached.tutorial_version !== TUTORIAL_VERSION || !['completed','skipped'].includes(cached.status);
      if (data && data.tutorial_version === TUTORIAL_VERSION && ['completed','skipped'].includes(data.status)) {
        write(tourKey(owner),data); return false;
      }
    }
    return !cached || cached.tutorial_version !== TUTORIAL_VERSION || !['completed','skipped'].includes(cached.status);
  }
  async function unlock(candidate, offline, version) {
    const owner = candidate.user.id;
    if (version !== epoch) return;
    const wasReady = granted && readyOwner === owner;
    session = candidate;
    granted = true; readyOwner = owner;
    try {
      await onReady(candidate,{offline,alreadyReady:wasReady,isCurrent:()=>epoch===version && session?.user.id===owner});
      if (epoch !== version || session?.user.id !== owner) return;
      show('ready');
      if (!wasReady) {
        tutorialPending = await loadTutorialState(owner,offline);
        if (epoch === version && tutorialPending) autoTourTimer = setTimeout(() => void startTutorial(),0);
      } else if (!offline) await loadTutorialState(owner,false);
    } catch (error) {
      if (version !== epoch || session?.user.id !== owner) return;
      lock('Deine Kontodaten konnten nicht geöffnet werden. Bitte erneut anmelden.');
    }
  }
  async function checkSession(candidate = null) {
    const version = ++epoch;
    if (!granted) show('checking');
    try {
      if (!navigator.onLine) {
        candidate ||= cachedSession();
        if (!offlineAllowed(candidate)) { lock('Bitte melde dich zuerst mit Internetverbindung an und bestätige die Hinweise.'); return; }
        session = candidate;
        await unlock(candidate,true,version);
        return;
      }
      if (!candidate) {
        const result = await timeout(client.auth.getSession());
        if (version !== epoch) return;
        if (result.error) throw result.error;
        candidate = result.data?.session;
      }
      if (!candidate?.user?.id) { lock(); return; }
      if (granted && readyOwner !== candidate.user.id) suspend();
      session = candidate;
      const {data,error} = await timeout(client.auth.getUser());
      if (version !== epoch) return;
      if (error) throw error;
      if (!data?.user?.id || data.user.id !== candidate.user.id || data.user.is_anonymous) throw Object.assign(new Error('Bitte melde dich erneut an.'),{status:401});
      session = {...candidate,user:data.user};
      if (needsPassword || entryType === 'invite' || entryType === 'recovery' || read(passwordKey(data.user.id))) {
        if (granted) suspend();
        write(passwordKey(data.user.id),true);
        show('password');
        return;
      }
      const legal = await timeout(client.from('account_legal_acceptances').select('user_id,terms_version,privacy_version,accepted_at').eq('user_id',data.user.id).eq('terms_version',LEGAL_VERSION).eq('privacy_version',LEGAL_VERSION).maybeSingle());
      if (version !== epoch) return;
      if (legal.error) throw legal.error;
      if (!legal.data) {
        if (granted) suspend();
        remove(accessKey(data.user.id));
        if (legalOwner !== data.user.id) $('accessLegal').reset();
        legalOwner = data.user.id;
        show('legal');
        return;
      }
      write(accessKey(data.user.id),{...legal.data,verified:true});
      await unlock(session,false,version);
    } catch (error) {
      if (version !== epoch) return;
      const unauthorized = [400,401,403].includes(error.status) || ['session_not_found','refresh_token_not_found','user_not_found','refresh_token_already_used'].includes(error.code);
      if (!unauthorized && offlineAllowed(candidate || session)) {
        await unlock(candidate || session,true,version);
      } else if (unauthorized) lock('Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.',true);
      else {
        suspend();
        show('error','Die Anmeldung konnte nicht geprüft werden. Bitte prüfe deine Verbindung und versuche es erneut.');
      }
    }
  }
  async function perform(task) {
    if (busy) return;
    busy = true;
    const buttons = [...gate.querySelectorAll('button')]; buttons.forEach(button => {button.disabled = true;});
    status('Bitte warten …');
    try { await task(); }
    catch (error) { status(error.message || 'Das hat nicht geklappt. Bitte versuche es erneut.'); }
    finally { busy = false; buttons.forEach(button => {button.disabled = false;}); }
  }
  $('accessLogin').addEventListener('submit', event => {
    event.preventDefault();
    void perform(async () => {
      if (!navigator.onLine) throw new Error('Für eine neue Anmeldung benötigst du eine Internetverbindung.');
      const {data,error} = await client.auth.signInWithPassword({email:$('accessEmail').value.trim(),password:$('accessPassword').value});
      if (error) throw new Error('Anmeldung fehlgeschlagen. Bitte prüfe E-Mail und Passwort.');
      $('accessPassword').value = '';
      await checkSession(data.session);
    });
  });
  $('accessTogglePassword').addEventListener('click', () => {
    const showPassword = $('accessPassword').type === 'password';
    $('accessPassword').type = showPassword ? 'text' : 'password';
    $('accessTogglePassword').textContent = showPassword ? 'Verbergen' : 'Anzeigen';
    $('accessTogglePassword').setAttribute('aria-label',showPassword?'Passwort verbergen':'Passwort anzeigen');
  });
  $('accessSetPassword').addEventListener('submit', event => {
    event.preventDefault();
    void perform(async () => {
      if ($('accessNewPassword').value !== $('accessConfirmPassword').value) throw new Error('Die beiden Passwörter stimmen nicht überein.');
      const owner=session?.user.id, version=epoch;
      const {error} = await client.auth.updateUser({password:$('accessNewPassword').value});
      if (error) throw error;
      if (!session || session.user.id!==owner || epoch!==version) return;
      remove(passwordKey(owner));
      needsPassword = false; entryType = null;
      $('accessNewPassword').value = ''; $('accessConfirmPassword').value = '';
      await checkSession(session);
    });
  });
  $('accessLegal').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('accessTerms').checked || !$('accessPrivacy').checked) return;
    void perform(async () => {
      if (!navigator.onLine) throw new Error('Die erstmalige Bestätigung benötigt eine Internetverbindung.');
      const owner = session.user.id, version = epoch;
      const auth = await client.auth.getSession();
      if (epoch !== version || !session || session.user.id !== owner) return;
      if (auth.error || auth.data?.session?.user.id !== owner || !auth.data.session.access_token) throw new Error('Bitte melde dich erneut an.');
      const {data,error} = await client.rpc('accept_current_legal',{
        p_terms_version:LEGAL_VERSION,p_privacy_version:LEGAL_VERSION
      }).setHeader('Authorization','Bearer '+auth.data.session.access_token);
      if (error) throw new Error('Deine Bestätigung konnte nicht gespeichert werden. Bitte erneut versuchen.');
      if (!session || session.user.id !== owner || epoch !== version) return;
      if (data?.user_id !== owner || data.terms_version !== LEGAL_VERSION || data.privacy_version !== LEGAL_VERSION) throw new Error('Die Bestätigung konnte nicht geprüft werden. Bitte erneut versuchen.');
      write(accessKey(owner),{...data,verified:true});
      await checkSession(session);
    });
  });
  $('accessForgot').addEventListener('click', () => void perform(async () => {
    if (!$('accessEmail').value || !$('accessEmail').checkValidity()) throw new Error('Bitte zuerst eine gültige E-Mail-Adresse eingeben.');
    const {error} = await client.auth.resetPasswordForEmail($('accessEmail').value.trim(),{redirectTo:location.origin+location.pathname});
    if (error) throw new Error('Die E-Mail konnte gerade nicht angefordert werden. Bitte später erneut versuchen.');
    status('Falls ein Konto für diese Adresse besteht, erhältst du eine E-Mail zum Zurücksetzen.');
  }));
  $('accessPasskey').addEventListener('click', () => void perform(async () => {
    if (!client.auth.signInWithPasskey) throw new Error('Passkeys werden auf diesem Gerät nicht unterstützt.');
    const {data,error} = await client.auth.signInWithPasskey();
    if (error) throw error;
    await checkSession(data?.session);
  }));
  async function signOut() {
    const oldId = session?.user.id;
    if (oldId) remove(accessKey(oldId));
    lock('Du bist abgemeldet. Deine gespeicherten Zeiten bleiben in deinem Konto erhalten.');
    remove(storageKey);
    if (client) { try { await client.auth.signOut({scope:'local'}); } catch { /* Local logout is already complete. */ } }
  }
  $('accessSignOut').addEventListener('click', () => void perform(signOut));
  $('accessRetry').addEventListener('click', () => void perform(async () => {
    if (!client) await init(); else await checkSession();
  }));
  window.addEventListener('online', () => { if (client && !busy && !needsPassword) void checkSession(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && client && granted && navigator.onLine && !busy && !isTutorialRunning()) void checkSession();
  });
  window.addEventListener('storage', event => {
    if (session && event.key === accessKey(session.user.id) && !event.newValue) lock('Du wurdest auf diesem Gerät abgemeldet.');
  });
  async function init() {
    show('checking');
    try {
      client = await getClient();
      if (!initDone) {
        client.auth.onAuthStateChange((event, candidate) => {
          if (event === 'SIGNED_OUT') { lock('Bitte melde dich an.',true); return; }
          if (candidate?.user?.id && granted && candidate.user.id !== readyOwner) { epoch++; suspend(); }
          if (event === 'PASSWORD_RECOVERY') { needsPassword = true; if (granted) { epoch++; suspend(); } }
          if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && !busy && initDone) setTimeout(() => void checkSession(candidate),0);
        });
        initDone = true;
      }
      const errorDescription = entryParams.get('error_description');
      if (errorDescription) { lock('Der Link ist abgelaufen oder bereits verwendet. Bitte fordere einen neuen Link an.'); return; }
      await checkSession();
    } catch {
      show('error','Die Anmeldung ist gerade nicht erreichbar. Bitte verbinde dich mit dem Internet und versuche es erneut.');
    }
  }
  return {init,signOut,startTutorial,checkSession,lock,isReady:()=>granted,isOffline:()=>Boolean(session && offlineAllowed(session) && !navigator.onLine)};
}
