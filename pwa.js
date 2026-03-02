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

// ─── Écran d'accueil ───
(function() {
    var overlay = document.getElementById('welcomeOverlay');
    if (!overlay) return;

    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
    });

    // Bouton retour au menu : toujours actif sauf en mode standalone (app installée)
    var homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (isStandalone) {
            homeBtn.style.display = 'none';
        } else {
            homeBtn.addEventListener('click', function() {
                overlay.classList.remove('welcome-out');
                overlay.style.display = 'flex';
            });
        }
    }

    // Toujours afficher l'overlay au chargement (sauf en mode standalone)
    var isStandaloneLoad = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (!isStandaloneLoad) {
        overlay.style.display = 'flex';
    }

    function closeOverlay() {
        overlay.classList.add('welcome-out');
        setTimeout(function() { overlay.style.display = 'none'; overlay.classList.remove('welcome-out'); }, 400);
    }

    document.getElementById('welcomeUse').addEventListener('click', closeOverlay);

    document.getElementById('welcomeInstall').addEventListener('click', function() {
        var note = document.getElementById('welcomeNote');
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(result) {
                if (result.outcome === 'accepted') {
                    closeOverlay();
                }
                deferredPrompt = null;
            });
        } else {
            note.textContent = 'Sur Chrome : Menu ⋮ → « Installer l\'application ». Sur iOS : Partager → Sur l\'écran d\'accueil.';
        }
    });
})();
