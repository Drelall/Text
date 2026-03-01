// ─── Lecteur YouTube custom ─────────────────────────────────────────────────
// Ce fichier gère entièrement le lecteur de musique intégré (style SoundCloud).
// Il dépend de l'API IFrame YouTube chargée dans index.html.

var ytPlayer      = null;
var ytPlayerReady = false;
var currentTrackIndex = 0;
var tracks = [
    { id: 'XSXEaikz0Bc', title: 'Lofi Hip Hop Radio' },
    { id: 'blAFxjhg62k', title: 'Seconde chaîne YouTube' }
];

function updateMusicUI(playing) {
    var iconPlay  = document.querySelector('.sc-icon-play');
    var iconPause = document.querySelector('.sc-icon-pause');
    var bars      = document.getElementById('scBars');
    if (iconPlay && iconPause) {
        iconPlay.style.display  = playing ? 'none'  : 'block';
        iconPause.style.display = playing ? 'block' : 'none';
    }
    if (bars) bars.classList.toggle('playing', playing);
}

function updateTrackTitle() {
    var titleEl = document.querySelector('.sc-title');
    if (titleEl) titleEl.textContent = tracks[currentTrackIndex].title;
}

// Appelée automatiquement par l'API YouTube quand elle est prête
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('ytApiContainer', {
        height: '1',
        width: '1',
        videoId: tracks[currentTrackIndex].id,
        playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
        events: {
            onReady: function (e) {
                ytPlayerReady = true;
                var vol = document.getElementById('scVolume');
                if (vol) e.target.setVolume(parseInt(vol.value, 10) || 80);
            },
            onStateChange: function (e) {
                var playing = (e.data === YT.PlayerState.PLAYING);
                updateMusicUI(playing);
            }
        }
    });
}

(function initCustomMusicControls() {
    var playBtn     = document.getElementById('scPlayBtn');
    var prevBtn     = document.getElementById('scPrevBtn');
    var nextBtn     = document.getElementById('scNextBtn');
    var volumeInput = document.getElementById('scVolume');

    if (!playBtn) return;

    playBtn.addEventListener('click', function () {
        if (!ytPlayerReady || !ytPlayer) return;

        var state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
            ytPlayer.pauseVideo();
        } else {
            if (state === YT.PlayerState.UNSTARTED || state === -1) {
                ytPlayer.loadVideoById({ videoId: tracks[currentTrackIndex].id, startSeconds: 0 });
            }
            ytPlayer.playVideo();
        }
    });

    if (volumeInput) {
        volumeInput.addEventListener('input', function () {
            if (ytPlayer && ytPlayerReady) {
                ytPlayer.setVolume(parseInt(this.value, 10) || 0);
            }
        });
    }

    function changeTrack(direction) {
        if (!ytPlayerReady || !ytPlayer) return;
        currentTrackIndex = (currentTrackIndex + direction + tracks.length) % tracks.length;
        updateTrackTitle();
        ytPlayer.loadVideoById({ videoId: tracks[currentTrackIndex].id, startSeconds: 0 });
        ytPlayer.playVideo();
        updateMusicUI(true);
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { changeTrack(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { changeTrack(1);  });
})();
