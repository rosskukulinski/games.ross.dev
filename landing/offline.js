/**
 * Registers the service worker, kicks off the offline download of the whole
 * arcade, and reports progress in the header.
 */
(function () {
  const statusEl = document.getElementById('offline-status');
  const textEl = statusEl && statusEl.querySelector('.offline-status-text');
  const barEl = statusEl && statusEl.querySelector('.offline-progress-bar');
  const tipEl = document.getElementById('install-tip');

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

  function showTip(html) {
    if (!tipEl || localStorage.getItem('arcade-install-tip-dismissed')) return;
    tipEl.querySelector('.install-tip-text').innerHTML = html;
    tipEl.hidden = false;
  }

  if (tipEl) {
    tipEl.querySelector('.install-tip-dismiss').addEventListener('click', () => {
      tipEl.hidden = true;
      localStorage.setItem('arcade-install-tip-dismissed', '1');
    });
  }

  if (isIos && !isStandalone) {
    // Safari evicts site data for tabs that go unused for a week; a home screen
    // web app keeps its cache, so this step is what makes offline stick.
    showTip(
      'To play offline, tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.'
    );
  }

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if (!tipEl) return;
    showTip('Install the arcade to play offline.');
    const button = tipEl.querySelector('.install-tip-action');
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.hidden = true;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      tipEl.hidden = true;
    });
  });

  window.addEventListener('appinstalled', () => {
    if (tipEl) tipEl.hidden = true;
  });

  // --- Service worker ---

  if (!('serviceWorker' in navigator)) {
    setStatus('This browser can’t save the arcade for offline play.');
    return;
  }

  let hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};

    if (data.type === 'precache-progress') {
      if (data.done >= data.total) {
        setStatus('Ready to play offline', { done: true });
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
        setStatus('Ready to play offline', { done: true });
      }
    }
  });

  // A new build activated. Reload so the page matches the assets now cached.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
    hadController = true;
  });

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js');
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active;
      if (!worker) return;
      worker.postMessage('status');
      worker.postMessage('precache');
    } catch (err) {
      setStatus('Couldn’t set up offline play.');
    }
  });

  window.addEventListener('offline', () => {
    setStatus('Offline — playing from this device', { done: true });
  });
})();
