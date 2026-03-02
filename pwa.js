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

    // Ne plus montrer si déjà choisi
    if (localStorage.getItem('scribouillart_welcomed')) return;

    overlay.style.display = 'flex';

    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
    });

    document.getElementById('welcomeUse').addEventListener('click', function() {
        localStorage.setItem('scribouillart_welcomed', '1');
        overlay.classList.add('welcome-out');
        setTimeout(function() { overlay.style.display = 'none'; overlay.classList.remove('welcome-out'); }, 400);
    });

    // Bouton retour au menu : masqué si l'app est installée (mode standalone)
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

    document.getElementById('welcomeInstall').addEventListener('click', function() {
        var note = document.getElementById('welcomeNote');
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(result) {
                if (result.outcome === 'accepted') {
                    localStorage.setItem('scribouillart_welcomed', '1');
                    overlay.classList.add('welcome-out');
                    setTimeout(function() { overlay.style.display = 'none'; }, 400);
                }
                deferredPrompt = null;
            });
        } else {
            // Navigateur non compatible ou déjà installé
            note.textContent = 'Sur Chrome : Menu ⋮ → « Installer l\'application ». Sur iOS : Partager → Sur l\'écran d\'accueil.';
        }
    });
})();
