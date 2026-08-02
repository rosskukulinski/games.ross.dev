/**
 * Registers the service worker and, when asked, downloads the whole arcade for
 * offline play.
 *
 * The download is opt-in: it is tens of megabytes, so nothing is fetched until
 * the button in the header is clicked. The choice is remembered per device, so
 * later visits quietly top the cache back up — a new build invalidates it —
 * without asking again.
 */
(function () {
  const OPT_IN_KEY = 'arcade-offline-enabled';

  const buttonEl = document.getElementById('offline-save');
  const statusEl = document.getElementById('offline-status');
  const textEl = statusEl && statusEl.querySelector('.offline-status-text');
  const barEl = statusEl && statusEl.querySelector('.offline-progress-bar');
  const tipEl = document.getElementById('install-tip');

  // True once the user has asked for the download, on this visit or a past one.
  // Until then nothing is fetched and the header stays quiet.
  let enabled = false;

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  function setStatus(text, { percent = null, done = false } = {}) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.classList.toggle('is-done', done);
    textEl.textContent = text;
    if (percent === null) {
      barEl.parentElement.hidden = true;
    } else {
      barEl.parentElement.hidden = false;
      barEl.style.width = `${percent}%`;
    }
  }

  // --- Add to Home Screen / Install ---

  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  // iPadOS reports itself as a Mac, so fall back to touch support to spot it.
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let installPrompt = null;

  function showTip(html) {
    if (!tipEl || localStorage.getItem('arcade-install-tip-dismissed')) return;
    tipEl.querySelector('.install-tip-text').innerHTML = html;
    tipEl.hidden = false;
  }

  // Installing is only ever about making offline play stick, so the tip waits
  // until the user has asked to save the games.
  function showInstallTip() {
    if (installPrompt) {
      showTip('Install the arcade to keep the games handy.');
      tipEl.querySelector('.install-tip-action').hidden = false;
    } else if (isIos && !isStandalone) {
      // Safari evicts site data for tabs that go unused for a week; a home
      // screen web app keeps its cache, so this step is what makes it stick.
      showTip(
        'To keep the games, tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.'
      );
    }
  }

  if (tipEl) {
    tipEl.querySelector('.install-tip-dismiss').addEventListener('click', () => {
      tipEl.hidden = true;
      localStorage.setItem('arcade-install-tip-dismissed', '1');
    });
    tipEl.querySelector('.install-tip-action').addEventListener('click', async () => {
      if (!installPrompt) return;
      tipEl.querySelector('.install-tip-action').hidden = true;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      tipEl.hidden = true;
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if (enabled) showInstallTip();
  });

  window.addEventListener('appinstalled', () => {
    if (tipEl) tipEl.hidden = true;
  });

  // --- Service worker ---

  // Nothing to offer without one: leave the button hidden rather than explain.
  if (!('serviceWorker' in navigator)) return;

  const optedIn = () => localStorage.getItem(OPT_IN_KEY) === '1';

  let hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};
    if (!enabled) return;

    if (data.type === 'precache-progress') {
      if (data.done >= data.total) {
        setStatus('Saved for offline play', { done: true });
        return;
      }
      const percent = data.totalBytes ? Math.round((data.bytes / data.totalBytes) * 100) : 0;
      setStatus(
        `Saving games to this device — ${formatBytes(data.bytes)} of ${formatBytes(data.totalBytes)}`,
        { percent }
      );
    } else if (data.type === 'precache-complete') {
      if (data.failed > 0) {
        setStatus(`Saved for offline — ${data.failed} file(s) couldn’t be downloaded`, {
          done: true,
        });
      } else {
        setStatus('Saved for offline play', { done: true });
      }
    }
  });

  // A new build activated. Reload so the page matches the assets now cached.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
    hadController = true;
  });

  /**
   * Registering the worker is itself part of switching offline play on — it
   * caches the shell and puts the worker in front of every request — so it
   * waits for the opt-in along with the download.
   *
   * A worker registered on an earlier visit is deliberately left alone: the
   * page in front of the user may be coming from its cache right now, and
   * tearing it out would take the arcade away mid-flight. It stops carrying
   * the whole library on its own, since the next build's worker only installs
   * the shell unless this device has opted in.
   */
  async function enable({ announce = true } = {}) {
    enabled = true;
    if (buttonEl) buttonEl.hidden = true;
    showInstallTip();
    // Answer the click right away; on a later visit the worker reports where
    // it actually stands within a moment, so say nothing until it does.
    if (announce) setStatus('Saving games to this device…');

    await navigator.serviceWorker.register('./sw.js');
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker) return;
    worker.postMessage('status');
    worker.postMessage('precache');
  }

  function start(options) {
    enable(options).catch(() => setStatus('Couldn’t save the games to this device.'));
  }

  if (buttonEl) {
    buttonEl.hidden = optedIn();
    buttonEl.addEventListener('click', () => {
      localStorage.setItem(OPT_IN_KEY, '1');
      start();
    });
  }

  // Already opted in on this device: top the cache back up — a new build
  // invalidates it — without asking again. Waits for load so the download
  // never competes with the page itself.
  if (optedIn()) window.addEventListener('load', () => start({ announce: false }));

  window.addEventListener('offline', () => {
    if (enabled) setStatus('Offline — playing from this device', { done: true });
  });
})();
