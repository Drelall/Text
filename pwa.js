(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    } catch (err) {
      // Silently ignore to avoid breaking the app
    }
  });
})();
