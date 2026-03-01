
// Initialiser l'éditeur
initEditor();

function initEditor() {
    const editor = document.getElementById('editor');
    const articleSubject = document.getElementById('articleSubject');
    const statusMessage = document.getElementById('statusMessage');
    const linkBtn = document.getElementById('linkBtn');
    const unlinkBtn = document.getElementById('unlinkBtn');
    const imageBtn = document.getElementById('imageBtn');
    const sourceBtn = document.getElementById('sourceBtn');
    const saveBtn = document.getElementById('saveBtn');
    const loadBtn = document.getElementById('loadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const newArticleBtn = document.getElementById('newArticleBtn');
    const articlesList = document.getElementById('articlesList');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const formatSelect = document.getElementById('formatSelect');
    const textColor = document.getElementById('textColor');
    const bgColor = document.getElementById('bgColor');
    const youtubeToggle = document.getElementById('youtubeToggle');
    const youtubeContent = document.getElementById('youtubeContent');

    let currentArticleId = null;
    let isSourceMode = false;
    let hasUnsavedChanges = false;

    // Charger le contenu sauvegardé au démarrage
    loadFromLocalStorage();
    
    // Afficher la liste des articles
    refreshArticlesList();

    // Charger la préférence du mode nuit
    loadDarkModePreference();

    // Détecter les modifications
    editor.addEventListener('input', () => {
        hasUnsavedChanges = true;
        markAsModified();
    });

    articleSubject.addEventListener('input', () => {
        hasUnsavedChanges = true;
        markAsModified();
    });

    // Bouton Mode Nuit
    darkModeToggle.addEventListener('click', () => {
        toggleDarkMode();
    });

    // Sélecteur de format de paragraphe
    formatSelect.addEventListener('change', (e) => {
        const format = e.target.value;
        document.execCommand('formatBlock', false, format);
        editor.focus();
    });

    // Couleur du texte
    if (textColor) {
        textColor.addEventListener('change', (e) => {
            document.execCommand('foreColor', false, e.target.value);
            editor.focus();
        });
    }

    // Couleur de fond
    if (bgColor) {
        bgColor.addEventListener('change', (e) => {
            document.execCommand('backColor', false, e.target.value);
            editor.focus();
        });
    }

    // Gestion des boutons de la barre d'outils
    document.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const command = btn.dataset.command;
            const value = btn.dataset.value || null;
            
            document.execCommand(command, false, value);
            updateToolbarState();
            editor.focus();
        });
    });

    // Bouton lien amélioré
    if (linkBtn) {
        linkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const selection = window.getSelection().toString();
            const url = prompt('Entrez l\'URL du lien :', selection ? '' : 'https://');
            const text = selection || prompt('Texte du lien :');
            
            if (url && text) {
                if (selection) {
                    document.execCommand('createLink', false, url);
                } else {
                    document.execCommand('insertHTML', false, `<a href="${url}">${text}</a>`);
                }
            }
            editor.focus();
        });
    }

    // Bouton supprimer le lien
    if (unlinkBtn) {
        unlinkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand('unlink', false, null);
            editor.focus();
        });
    }

    // Bouton image
    if (imageBtn) {
        imageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const url = prompt('Entrez l\'URL de l\'image :');
            const alt = prompt('Texte alternatif (description) :');
            
            if (url) {
                const imgHTML = `<img src="${url}" alt="${alt || ''}" style="max-width: 100%; height: auto;">`;
                document.execCommand('insertHTML', false, imgHTML);
            }
            editor.focus();
        });
    }

    // Bouton code source
    if (sourceBtn) {
        sourceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSourceMode();
        });
    }

    // Mettre à jour l'état de la barre d'outils
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('keyup', updateToolbarState);

    // Bouton Enregistrer
    saveBtn.addEventListener('click', () => {
        publishArticle();
    });

    // Bouton Nouvel Article
    newArticleBtn.addEventListener('click', () => {
        createNewArticle();
    });

    // Bouton Charger
    loadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.txt';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target.result;
                    
                    const subjectMatch = content.match(/<!-- Objet: (.+?) -->/);
                    if (subjectMatch) {
                        articleSubject.value = subjectMatch[1];
                        editor.innerHTML = content.replace(/<!-- .+? -->\n*/g, '').trim();
                    } else {
                        editor.innerHTML = content;
                    }
                    
                    showStatus('✓ Fichier chargé !', 'success');
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    });

    // Bouton Effacer
    clearBtn.addEventListener('click', () => {
        if (confirm('Êtes-vous sûr de vouloir effacer tout le contenu ? Cette action est irréversible.')) {
            articleSubject.value = '';
            editor.innerHTML = '<p>Commencez à écrire ou tapez / pour choisir un bloc</p>';
            if (output) {
                output.textContent = '';
            }
            hasUnsavedChanges = false;
            markAsSaved();
            showStatus('✓ Contenu effacé !', 'success');
        }
    });

    // Raccourcis clavier
    editor.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    document.execCommand('bold');
                    updateToolbarState();
                    break;
                case 'i':
                    e.preventDefault();
                    document.execCommand('italic');
                    updateToolbarState();
                    break;
                case 'u':
                    e.preventDefault();
                    document.execCommand('underline');
                    updateToolbarState();
                    break;
                case 'z':
                    e.preventDefault();
                    document.execCommand('undo');
                    break;
                case 'y':
                    e.preventDefault();
                    document.execCommand('redo');
                    break;
            }
        }
    });

    // Avertir avant de quitter si des modifications ne sont pas enregistrées
    window.addEventListener('beforeunload', (e) => {
        saveToLocalStorage(true);
        
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?';
            return e.returnValue;
        }
    });

    // Toggle YouTube player
    if (youtubeToggle && youtubeContent) {
        youtubeToggle.addEventListener('click', () => {
            youtubeContent.classList.toggle('collapsed');
            youtubeToggle.textContent = youtubeContent.classList.contains('collapsed') ? '+' : '−';
        });
    }

    /**
     * Marque l'article comme modifié
     */
    function markAsModified() {
        if (!saveBtn.textContent.includes('*')) {
            saveBtn.textContent = 'Enregistrer *';
            saveBtn.title = 'Des modifications non enregistrées';
        }
    }

    /**
     * Marque l'article comme sauvegardé
     */
    function markAsSaved() {
        hasUnsavedChanges = false;
        saveBtn.textContent = 'Enregistrer';
        saveBtn.title = 'Enregistrer l\'article';
    }

    /**
     * Bascule entre le mode clair et le mode nuit
     */
    function toggleDarkMode() {
        const body = document.body;
        const isDarkMode = body.classList.toggle('dark-mode');
        
        const moonIcon = darkModeToggle.querySelector('.moon-icon');
        const sunIcon = darkModeToggle.querySelector('.sun-icon');
        
        if (isDarkMode) {
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        } else {
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        }
        
        localStorage.setItem('scribouillart_dark_mode', isDarkMode ? 'true' : 'false');
    }

    /**
     * Charge la préférence du mode nuit
     */
    function loadDarkModePreference() {
        const isDarkMode = localStorage.getItem('scribouillart_dark_mode') === 'true';
        
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            const moonIcon = darkModeToggle.querySelector('.moon-icon');
            const sunIcon = darkModeToggle.querySelector('.sun-icon');
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        }
    }

    /**
     * Met à jour l'état actif des boutons de la barre d'outils
     */
    function updateToolbarState() {
        document.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
            const command = btn.dataset.command;
            if (document.queryCommandState(command)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const parentElement = window.getSelection().anchorNode?.parentElement;
        if (parentElement) {
            const tagName = parentElement.tagName?.toLowerCase();
            if (formatSelect.querySelector(`option[value="${tagName}"]`)) {
                formatSelect.value = tagName;
            }
        }
    }

    /**
     * Bascule entre le mode visuel et le mode code source
     */
    function toggleSourceMode() {
        isSourceMode = !isSourceMode;
        
        if (isSourceMode) {
            const html = editor.innerHTML;
            editor.contentEditable = 'false';
            editor.style.fontFamily = 'monospace';
            editor.style.whiteSpace = 'pre-wrap';
            editor.textContent = formatHTMLForDisplay(html);
            sourceBtn.classList.add('active');
        } else {
            const html = editor.textContent;
            editor.innerHTML = html;
            editor.contentEditable = 'true';
            editor.style.fontFamily = 'Georgia, "Times New Roman", serif';
            editor.style.whiteSpace = 'normal';
            sourceBtn.classList.remove('active');
        }
        editor.focus();
    }

    /**
     * Formate le HTML pour l'affichage dans le mode source
     */
    function formatHTMLForDisplay(html) {
        return html
            .replace(/></g, '>\n<')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .join('\n');
    }

    /**
     * Affiche un dialogue de choix de format puis lance le téléchargement
     */
    function publishArticle() {
        const subject = articleSubject.value.trim();
        const htmlContent = editor.innerHTML;
        const plainText = editor.innerText;

        if (!subject) {
            showStatus('\u26a0\ufe0f Veuillez saisir un objet pour l\'article', 'error');
            return;
        }

        // Création du dialogue de choix
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1e1e1e;border:1px solid #444;border-radius:10px;padding:28px 32px;min-width:280px;text-align:center;color:#f1f1f1;font-family:inherit';
        modal.innerHTML = `
          <p style="margin:0 0 6px;font-size:13px;color:#aaa;">Choisir le format d'export</p>
          <p style="margin:0 0 22px;font-size:16px;font-weight:600;">Enregistrer en :</p>
          <div style="display:flex;gap:12px;justify-content:center;margin-bottom:16px">
            <button id="_dlTxt" style="padding:10px 22px;border-radius:6px;border:1px solid #555;background:#2a2a2a;color:#f1f1f1;cursor:pointer;font-size:14px;">Texte brut (.txt)</button>
            <button id=\"_dlDoc\" style=\"padding:10px 22px;border-radius:6px;border:1px solid #555;background:#2a2a2a;color:#f1f1f1;cursor:pointer;font-size:14px;\">Word (.rtf)</button>
          </div>
          <button id="_dlCancel" style="background:none;border:none;color:#888;cursor:pointer;font-size:13px;">Annuler</button>`;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = () => document.body.removeChild(overlay);

        modal.querySelector('#_dlTxt').addEventListener('click', () => {
            close();
            downloadTextFile(subject, plainText);
            saveArticleToList(subject, htmlContent);
            markAsSaved();
        });
        modal.querySelector('#_dlDoc').addEventListener('click', () => {
            close();
            downloadWordFile(subject, htmlContent);
            saveArticleToList(subject, htmlContent);
            markAsSaved();
        });
        modal.querySelector('#_dlCancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    /**
     * Télécharge le contenu en texte brut (.txt) — sans balises
     */
    async function downloadTextFile(subject, plainText) {
        const timestamp = new Date().toISOString().slice(0, 10);
        const cleanSubject = subject
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
        const filename = `${cleanSubject}-${timestamp}.txt`;
        const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'Fichier texte', accept: { 'text/plain': ['.txt'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                showStatus(`\u2713 Fichier "${filename}" enregistr\u00e9 avec succ\u00e8s !`, 'success');
            } catch (err) {
                if (err.name === 'AbortError') {
                    showStatus('Sauvegarde annul\u00e9e', 'error');
                } else {
                    showStatus(`\u274c Erreur : ${err.message}`, 'error');
                }
            }
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            showStatus(`\u2713 Fichier t\u00e9l\u00e9charg\u00e9 dans T\u00e9l\u00e9chargements`, 'success');
        }
    }

    /**
     * Télécharge le contenu en fichier RTF — reconnu nativement par Word sans alerte
     */
    async function downloadWordFile(subject, htmlContent) {
        const timestamp = new Date().toISOString().slice(0, 10);
        const cleanSubject = subject
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
        const filename = `${cleanSubject}-${timestamp}.rtf`;

        const rtf = htmlToRtf(subject, htmlContent);
        const blob = new Blob([rtf], { type: 'application/rtf;charset=ascii' });

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'Document Word / RTF',
                        accept: { 'application/rtf': ['.rtf'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                showStatus(`✓ Fichier "${filename}" enregistré avec succès !`, 'success');
            } catch (err) {
                if (err.name === 'AbortError') {
                    showStatus('Sauvegarde annulée', 'error');
                } else {
                    showStatus(`❌ Erreur : ${err.message}`, 'error');
                }
            }
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            showStatus(`✓ Fichier téléchargé dans Téléchargements`, 'success');
        }
    }

    /**
     * Convertit le HTML de l'éditeur en RTF — format natif Word (aucune library externe)
     */
    function htmlToRtf(subject, htmlContent) {
        const temp = document.createElement('div');
        temp.innerHTML = htmlContent;

        // Table des couleurs (index 1-based)
        const colors = ['000000', 'ffffff', '0563C1', '555555'];

        function colorToHex(cssColor) {
            if (!cssColor) return null;
            if (cssColor.startsWith('#')) return cssColor.slice(1).toLowerCase();
            const m = cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (m) return [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
            return null;
        }
        function getColorIdx(cssColor) {
            const hex = colorToHex(cssColor);
            if (!hex) return 1;
            let idx = colors.indexOf(hex);
            if (idx === -1) { colors.push(hex); idx = colors.length - 1; }
            return idx + 1;
        }

        // Échappement RTF : backslash, accolades, et caractères non-ASCII → \uN?
        function esc(text) {
            let out = '';
            for (const c of text) {
                const code = c.charCodeAt(0);
                if (c === '\\') out += '\\\\';
                else if (c === '{') out += '\\{';
                else if (c === '}') out += '\\}';
                else if (code > 127) {
                    const n = code > 32767 ? code - 65536 : code;
                    out += `\\u${n}?`;
                } else {
                    out += c;
                }
            }
            return out;
        }

        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent);
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            const tag = node.tagName.toLowerCase();
            const kids = Array.from(node.childNodes).map(processNode).join('');

            switch (tag) {
                case 'h1': return `\\pard\\sb240\\sa120\\b\\fs48 ${kids}\\b0\\fs24\\par\n`;
                case 'h2': return `\\pard\\sb200\\sa80\\b\\fs36 ${kids}\\b0\\fs24\\par\n`;
                case 'h3': return `\\pard\\sb160\\sa60\\b\\fs28 ${kids}\\b0\\fs24\\par\n`;
                case 'p':  return `\\pard\\sb0\\sa120 ${kids}\\par\n`;
                case 'br': return `\\line `;
                case 'b': case 'strong': return `{\\b ${kids}}`;
                case 'em': case 'i':    return `{\\i ${kids}}`;
                case 'u':               return `{\\ul ${kids}}`;
                case 'span': {
                    let open = '', close = '';
                    if (node.style.color) {
                        open += `\\cf${getColorIdx(node.style.color)} `;
                        close = `\\cf1 ` + close;
                    }
                    if (node.style.backgroundColor) {
                        open += `\\highlight${getColorIdx(node.style.backgroundColor)} `;
                        close = `\\highlight0 ` + close;
                    }
                    return `{${open}${kids}${close}}`;
                }
                case 'li': return `\\pard\\fi-360\\li720 \\bullet\\tab ${kids}\\par\n`;
                case 'ul': case 'ol': return kids;
                case 'blockquote': return `\\pard\\li720\\ri720\\sb60\\sa60\\cf4 ${kids}\\cf1\\par\n`;
                case 'a': {
                    const href = esc(node.getAttribute('href') || '');
                    return `{\\field{\\*\\fldinst HYPERLINK "${href}"}{\\fldrslt\\ul\\cf3 ${kids}\\ul0}}`;
                }
                case 'div': return kids ? kids + '\\par\n' : '';
                default: return kids;
            }
        }

        const body = Array.from(temp.childNodes).map(processNode).join('');
        const titleRtf = `\\pard\\sb0\\sa200\\b\\fs52 ${esc(subject)}\\b0\\fs24\\par\n`;

        // Construction de la table des couleurs (après avoir parcouru le contenu)
        const colorTable = '{\\colortbl ;' + colors.map(h => {
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            return `\\red${r}\\green${g}\\blue${b};`;
        }).join('') + '}';

        return `{\\rtf1\\ansi\\ansicpg1252\\deff0\n` +
            `{\\fonttbl{\\f0\\froman\\fcharset0 Calibri;}}\n` +
            `${colorTable}\n` +
            `\\widowctrl\\hyphauto\\f0\\fs24\\cf1\n` +
            titleRtf +
            body +
            `}`;
    }

    /**
     * Crée un nouvel article vierge
     */
    function createNewArticle() {
        if (hasUnsavedChanges && !confirm('Voulez-vous créer un nouvel article ? Les modifications non enregistrées seront perdues.')) {
            return;
        }
        
        currentArticleId = null;
        articleSubject.value = '';
        editor.innerHTML = '<p>Commencez à écrire ou tapez / pour choisir un bloc</p>';
        hasUnsavedChanges = false;
        markAsSaved();
        refreshArticlesList();
        showStatus('✓ Nouvel article créé !', 'success');
    }

    /**
     * Sauvegarde l'article dans la liste
     */
    function saveArticleToList(subject, content) {
        const articles = getArticlesList();
        
        const article = {
            id: currentArticleId || Date.now(),
            subject: subject,
            content: content,
            preview: getTextPreview(content),
            date: new Date().toLocaleString('fr-FR')
        };
        
        const existingIndex = articles.findIndex(a => a.id === article.id);
        
        if (existingIndex >= 0) {
            articles[existingIndex] = article;
        } else {
            articles.unshift(article);
        }
        
        localStorage.setItem('scribouillart_articles', JSON.stringify(articles));
        
        currentArticleId = article.id;
        refreshArticlesList();
    }

    /**
     * Récupère la liste des articles
     */
    function getArticlesList() {
        const stored = localStorage.getItem('scribouillart_articles');
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Extrait un aperçu textuel
     */
    function getTextPreview(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const text = temp.textContent || temp.innerText || '';
        return text.substring(0, 100);
    }

    /**
     * Rafraîchit l'affichage de la liste
     */
    function refreshArticlesList() {
        const articles = getArticlesList();
        
        if (articles.length === 0) {
            articlesList.innerHTML = '<div class="no-articles">Aucun article sauvegardé</div>';
            return;
        }
        
        articlesList.innerHTML = articles.map(article => `
            <div class="article-card-item ${article.id === currentArticleId ? 'active' : ''}" data-id="${article.id}">
                <div class="article-card-subject">${escapeHtml(article.subject)}</div>
                <div class="article-card-preview">${escapeHtml(article.preview)}</div>
                <div class="article-card-date">${article.date}</div>
                <button class="article-card-delete" data-id="${article.id}" onclick="event.stopPropagation()">
                    🗑️ Supprimer
                </button>
            </div>
        `).join('');
        
        articlesList.querySelectorAll('.article-card-item').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                loadArticleFromList(id);
            });
        });
        
        articlesList.querySelectorAll('.article-card-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                deleteArticleFromList(id);
            });
        });
    }

    /**
     * Charge un article depuis la liste
     */
    function loadArticleFromList(id) {
        if (hasUnsavedChanges && !confirm('Charger cet article ? Les modifications non enregistrées seront perdues.')) {
            return;
        }
        
        const articles = getArticlesList();
        const article = articles.find(a => a.id === id);
        
        if (article) {
            articleSubject.value = article.subject;
            editor.innerHTML = article.content;
            currentArticleId = article.id;
            
            hasUnsavedChanges = false;
            markAsSaved();
            refreshArticlesList();
            showStatus(`✓ Article "${article.subject}" chargé !`, 'success');
        }
    }

    /**
     * Supprime un article de la liste
     */
    function deleteArticleFromList(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
            return;
        }
        
        const articles = getArticlesList();
        const filteredArticles = articles.filter(a => a.id !== id);
        
        localStorage.setItem('scribouillart_articles', JSON.stringify(filteredArticles));
        
        if (currentArticleId === id) {
            currentArticleId = null;
        }
        
        refreshArticlesList();
        showStatus('✓ Article supprimé !', 'success');
    }

    /**
     * Échappe le HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Sauvegarde dans le localStorage
     */
    function saveToLocalStorage() {
        const content = editor.innerHTML;
        const subject = articleSubject.value;
        const timestamp = new Date().toLocaleString('fr-FR');
        
        try {
            localStorage.setItem('scribouillart_editor_content', content);
            localStorage.setItem('scribouillart_editor_subject', subject);
            localStorage.setItem('scribouillart_editor_timestamp', timestamp);
        } catch (e) {
            console.error('Erreur sauvegarde automatique');
        }
    }

    /**
     * Charge depuis le localStorage
     */
    function loadFromLocalStorage() {
        const savedContent = localStorage.getItem('scribouillart_editor_content');
        const savedSubject = localStorage.getItem('scribouillart_editor_subject');
        
        if (savedContent) {
            editor.innerHTML = savedContent;
        }
        
        if (savedSubject) {
            articleSubject.value = savedSubject;
        }
    }

        /**
         * Affiche un message de statut
         */
        function showStatus(message, type) {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`;
            
            if (type === 'success') {
                setTimeout(() => {
                    hideStatus();
                }, 3000);
            }
        }
    
        /**
         * Cache le message de statut
         */
        function hideStatus() {
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }
    }

// ─── Sidebar toggle (mobile) ────────────────────────────────────────────────
(function () {
    var sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', function () {
            document.querySelector('.sidebar').classList.toggle('open');
        });
    }
})();


