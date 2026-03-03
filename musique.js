// ─── Lecteur YouTube custom ─────────────────────────────────────────────────
// Ce fichier gère entièrement le lecteur de musique intégré (style SoundCloud).
// Il dépend de l'API IFrame YouTube chargée dans index.html.

var ytPlayer      = null;
var ytPlayerReady = false;
var currentTrackIndex = 0;

// Chargement des pistes depuis localStorage (ou valeurs par défaut)
var _defaultTracks = [
    { id: 'XSXEaikz0Bc', title: 'Lofi Hip Hop Radio' },
    { id: 'blAFxjhg62k', title: 'Seconde chaîne YouTube' }
];
var tracks = (function() {
    try {
        var saved = localStorage.getItem('scribouillart_tracks');
        return saved ? JSON.parse(saved) : _defaultTracks;
    } catch(e) { return _defaultTracks; }
})();

function _saveTracks() {
    try { localStorage.setItem('scribouillart_tracks', JSON.stringify(tracks)); } catch(e) {}
}

function _extractYouTubeId(url) {
    // Supporte : youtu.be/ID, ?v=ID, /embed/ID, /live/ID, playlists → list=ID
    var patterns = [
        /[?&]v=([^&#]{11})/,
        /youtu\.be\/([^?&#]{11})/,
        /\/embed\/([^?&#]{11})/,
        /\/live\/([^?&#]{11})/,
        /\/shorts\/([^?&#]{11})/
    ];
    for (var i = 0; i < patterns.length; i++) {
        var m = url.match(patterns[i]);
        if (m) return m[1];
    }
    // Si c'est déjà un ID brut de 11 caractères
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    return null;
}

function _showManageTracksModal() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#1e1e1e;border:1px solid #444;border-radius:10px;padding:24px 28px;min-width:340px;max-width:90vw;color:#f1f1f1;font-family:inherit;max-height:80vh;display:flex;flex-direction:column';

    var close = function() { document.body.removeChild(overlay); };

    function render() {
        modal.innerHTML = [
            '<p style="margin:0 0 16px;font-size:15px;font-weight:600">Pistes (' + tracks.length + ')</p>',
            '<div id="_trackListContainer" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px;margin-bottom:16px">',
            tracks.map(function(t, i) {
                var isCurrent = i === currentTrackIndex;
                return [
                    '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;background:' + (isCurrent ? '#2a3f55' : '#2a2a2a') + ';border:1px solid ' + (isCurrent ? '#4a8ec2' : '#444') + '">',
                    '<span style="font-size:11px;color:#888;min-width:16px;text-align:right">' + (i + 1) + '</span>',
                    '<span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + t.title + '">' + t.title + '</span>',
                    '<button data-idx="' + i + '" class="_playTrackBtn" title="Lire" style="background:none;border:none;color:#aaa;cursor:pointer;padding:2px 4px;font-size:14px">&#9654;</button>',
                    '<button data-idx="' + i + '" class="_delTrackBtn" title="Supprimer" style="background:none;border:none;color:#d63638;cursor:pointer;padding:2px 4px;font-size:15px">&times;</button>',
                    '</div>'
                ].join('');
            }).join(''),
            '</div>',
            '<div style="text-align:right"><button id="_manageClose" style="background:#2a2a2a;border:1px solid #555;border-radius:6px;color:#f1f1f1;cursor:pointer;font-size:13px;padding:6px 16px">Fermer</button></div>'
        ].join('');

        modal.querySelector('#_manageClose').addEventListener('click', close);

        modal.querySelectorAll('._delTrackBtn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var idx = parseInt(btn.dataset.idx);
                tracks.splice(idx, 1);
                _saveTracks();
                if (tracks.length === 0) {
                    tracks = _defaultTracks.slice();
                    _saveTracks();
                }
                if (currentTrackIndex >= tracks.length) currentTrackIndex = 0;
                updateTrackTitle();
                render();
            });
        });

        modal.querySelectorAll('._playTrackBtn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var idx = parseInt(btn.dataset.idx);
                currentTrackIndex = idx;
                updateTrackTitle();
                if (ytPlayer && ytPlayerReady) {
                    ytPlayer.loadVideoById({ videoId: tracks[idx].id, startSeconds: 0 });
                    ytPlayer.playVideo();
                    updateMusicUI(true);
                }
                render();
            });
        });
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    render();
}

function _showAddTrackModal() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#1e1e1e;border:1px solid #444;border-radius:10px;padding:24px 28px;min-width:320px;color:#f1f1f1;font-family:inherit';
    modal.innerHTML = [
        '<p style="margin:0 0 16px;font-size:15px;font-weight:600">Ajouter une piste</p>',
        '<label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px">Lien YouTube (vidéo, live, radio…) ou ID</label>',
        '<input id="_addUrl" type="text" placeholder="https://www.youtube.com/watch?v=..." style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #555;background:#2a2a2a;color:#f1f1f1;font-size:13px;box-sizing:border-box;margin-bottom:12px">',
        '<label style="font-size:12px;color:#aaa;display:block;margin-bottom:4px">Titre affiché</label>',
        '<input id="_addTitle" type="text" placeholder="Ma radio, ma playlist…" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #555;background:#2a2a2a;color:#f1f1f1;font-size:13px;box-sizing:border-box;margin-bottom:18px">',
        '<div style="display:flex;gap:10px;justify-content:flex-end">',
        '<button id="_addCancel" style="background:none;border:none;color:#888;cursor:pointer;font-size:13px;padding:6px 12px">Annuler</button>',
        '<button id="_addConfirm" style="background:#4a8ec2;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;padding:6px 16px">Ajouter</button>',
        '</div>'
    ].join('');

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var urlInput   = modal.querySelector('#_addUrl');
    var titleInput = modal.querySelector('#_addTitle');
    var close = function() { document.body.removeChild(overlay); };

    setTimeout(function() { urlInput.focus(); }, 50);

    modal.querySelector('#_addCancel').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

    modal.querySelector('#_addConfirm').addEventListener('click', function() {
        var url   = urlInput.value.trim();
        var title = titleInput.value.trim() || url;
        var id    = _extractYouTubeId(url);

        if (!id) {
            urlInput.style.borderColor = '#d63638';
            urlInput.placeholder = 'Lien YouTube non reconnu…';
            return;
        }

        tracks.push({ id: id, title: title });
        _saveTracks();
        close();

        // Aller directement sur la piste ajoutée
        currentTrackIndex = tracks.length - 1;
        updateTrackTitle();
        if (ytPlayer && ytPlayerReady) {
            ytPlayer.loadVideoById({ videoId: id, startSeconds: 0 });
            ytPlayer.playVideo();
            updateMusicUI(true);
        }
    });
}

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
    var track = tracks[currentTrackIndex];
    var titleEl = document.querySelector('.sc-title');
    if (titleEl) {
        titleEl.textContent = track.title;
        titleEl.title = track.title;
    }
    var thumb = document.getElementById('scThumb');
    if (thumb) thumb.src = 'https://img.youtube.com/vi/' + track.id + '/default.jpg';
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
    var addBtn      = document.getElementById('youtubeAddBtn');
    var manageBtn   = document.getElementById('youtubeManageBtn');

    if (!playBtn) return;

    if (addBtn) addBtn.addEventListener('click', _showAddTrackModal);
    if (manageBtn) manageBtn.addEventListener('click', _showManageTracksModal);

    // Titre et miniature au chargement initial
    updateTrackTitle();

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
