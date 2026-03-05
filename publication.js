
// ─── IndexedDB ─────────────────────────────────────────────────────────────
const _DB_NAME = 'scribouillart_db';
const _DB_VERSION = 1;
const _DB_STORE = 'articles';
let _db = null;

function _openDB() {
    return new Promise((resolve, reject) => {
        if (_db) { resolve(_db); return; }
        const req = indexedDB.open(_DB_NAME, _DB_VERSION);
        req.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(_DB_STORE)) {
                database.createObjectStore(_DB_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
        req.onerror = () => reject(req.error);
    });
}

function _dbGetAll() {
    return _openDB().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(_DB_STORE, 'readonly').objectStore(_DB_STORE).getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.id - a.id));
        req.onerror = () => reject(req.error);
    }));
}

function _dbPut(article) {
    return _openDB().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(_DB_STORE, 'readwrite').objectStore(_DB_STORE).put(article);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    }));
}

function _dbDelete(id) {
    return _openDB().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(_DB_STORE, 'readwrite').objectStore(_DB_STORE).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    }));
}

async function _migrateFromLocalStorage() {
    try {
        const stored = localStorage.getItem('scribouillart_articles');
        if (!stored) return;
        const articles = JSON.parse(stored);
        if (!articles || articles.length === 0) return;
        for (const article of articles) { await _dbPut(article); }
        localStorage.removeItem('scribouillart_articles');
        console.log(`Migration : ${articles.length} article(s) migré(s) vers IndexedDB`);
    } catch (e) {
        console.warn('Migration localStorage → IndexedDB échouée', e);
    }
}

// Initialiser l'éditeur
initEditor();

async function initEditor() {
    const editor = document.getElementById('editor');
    const articleSubject = document.getElementById('articleSubject');
    const linkBtn = document.getElementById('linkBtn');
    const unlinkBtn = document.getElementById('unlinkBtn');
    const imageBtn = document.getElementById('imageBtn');
    const sourceBtn = document.getElementById('sourceBtn');
    const saveBtn = document.getElementById('saveBtn');
    const addBtn = document.getElementById('addBtn');
    const loadBtn = document.getElementById('loadBtn');
    const newArticleBtn = document.getElementById('newArticleBtn');
    const articlesList = document.getElementById('articlesList');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const formatSelect = document.getElementById('formatSelect');
    const textColor = document.getElementById('textColor');
    const bgColor = document.getElementById('bgColor');
    const youtubeToggle = document.getElementById('youtubeToggle');

    let currentArticleId = null;
    let isSourceMode = false;
    let hasUnsavedChanges = false;

    // Charger le contenu sauvegardé au démarrage
    loadFromLocalStorage();

    // Ouvrir IndexedDB et migrer les données existantes
    await _openDB();
    await _migrateFromLocalStorage();

    // Afficher la liste des articles
    await refreshArticlesList();

    // Charger la préférence du mode nuit
    loadDarkModePreference();

    // ─── Utilitaires pour l'import de fichiers texte ──────────────────────
    function escapeHtml(text) {
        return (text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Convertir le XML d'un fichier .odt en HTML simple (paragraphes / titres)
    function convertOdtXmlToHtml(xmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

            const officeNs = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
            const textNs   = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';

            const officeText = xmlDoc.getElementsByTagNameNS(officeNs, 'text')[0] || xmlDoc.documentElement;
            if (!officeText) return '<p>(Aucun contenu lisible dans ce fichier .odt)</p>';

            const parts = [];

            function handleElement(el) {
                const local = el.localName;
                const rawText = (el.textContent || '').trim();
                if (!rawText) return;
                const safeText = escapeHtml(rawText);

                if (local === 'h') {
                    const lvlAttr = el.getAttribute('text:outline-level') || el.getAttribute('outline-level') || '1';
                    let level = parseInt(lvlAttr, 10);
                    if (!level || level < 1) level = 1;
                    if (level > 6) level = 6;
                    parts.push(`<h${level}>${safeText}</h${level}>`);
                } else if (local === 'p') {
                    parts.push(`<p>${safeText}</p>`);
                }
            }

            officeText.childNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && (node.localName === 'p' || node.localName === 'h') &&
                    (node.namespaceURI === textNs || !node.namespaceURI)) {
                    handleElement(node);
                }
            });

            if (!parts.length) {
                return '<p>(Aucun contenu texte trouvé dans ce fichier .odt)</p>';
            }
            return parts.join('\n');
        } catch (e) {
            console.error('Erreur conversion XML .odt → HTML', e);
            return '<p>(Erreur lors de la lecture du contenu .odt)</p>';
        }
    }

        // Extraire le HTML d'un fichier MHT (afchunk.mht généré par html-docx-js)
        function extractHtmlFromMht(mhtString) {
            try {
                if (!mhtString) return '';

                const lower = mhtString.toLowerCase();
                const idxHtml = lower.indexOf('content-type: text/html');
                if (idxHtml === -1) return '';

                // Fin des en-têtes de la partie HTML : double saut de ligne
                const sepCRLF = mhtString.indexOf('\r\n\r\n', idxHtml);
                const sepLF = mhtString.indexOf('\n\n', idxHtml);
                let start;
                if (sepCRLF !== -1 && (sepLF === -1 || sepCRLF < sepLF)) {
                    start = sepCRLF + 4;
                } else if (sepLF !== -1) {
                    start = sepLF + 2;
                } else {
                    return '';
                }

                // Limite : prochaine ligne de séparation de partie MHT
                let end = mhtString.indexOf('\n------=', start);
                const altEnd = mhtString.indexOf('\r\n------=', start);
                if (end === -1 || (altEnd !== -1 && altEnd < end)) {
                    end = altEnd;
                }
                if (end === -1) {
                    end = mhtString.length;
                }

                let qp = mhtString.substring(start, end);

                // Décodage minimal quoted-printable utilisé par html-docx-js
                qp = qp.replace(/=\r\n/g, '').replace(/=\n/g, ''); // retours à la ligne doux
                qp = qp.replace(/=3D/g, '='); // '=' encodé

                return qp.trim();
            } catch (e) {
                console.error('Erreur extraction HTML depuis MHT', e);
                return '';
            }
        }

    // Compteur de mots et de signes
    function updateWordCounter() {
        const text = editor.innerText || '';
        const trimmed = text.trim();
        const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
        const chars = trimmed.replace(/\s/g, '').length;
        document.getElementById('statWords').textContent =
            words.toLocaleString('fr-FR') + (words <= 1 ? '\u00a0mot' : '\u00a0mots');
        document.getElementById('statChars').textContent =
            chars.toLocaleString('fr-FR') + (chars <= 1 ? '\u00a0signe' : '\u00a0signes');
    }
    updateWordCounter();

    // Détecter les modifications
    editor.addEventListener('input', () => {
        hasUnsavedChanges = true;
        markAsModified();
        updateWordCounter();
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
            const bar = document.getElementById('textColorBar');
            if (bar) bar.style.background = e.target.value;
            editor.focus();
        });
    }

    // Couleur de fond
    if (bgColor) {
        bgColor.addEventListener('change', (e) => {
            document.execCommand('backColor', false, e.target.value);
            const bar = document.getElementById('bgColorBar');
            if (bar) bar.style.background = e.target.value;
            editor.focus();
        });
    }

    // Police de caractères
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', (e) => {
            if (e.target.value) {
                document.execCommand('fontName', false, e.target.value);
            }
            editor.focus();
        });
    }

    // Taille de police
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', (e) => {
            document.execCommand('fontSize', false, e.target.value);
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

    // Bouton image — ouvre un sélecteur de fichier local
    if (imageBtn) {
        imageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';

            input.onchange = (ev) => {
                const file = ev.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = () => {
                    const img = document.createElement('img');
                    img.src = reader.result;
                    img.alt = file.name;
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';

                    editor.focus();
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(img);
                        range.setStartAfter(img);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else {
                        editor.appendChild(img);
                    }
                };
                reader.readAsDataURL(file);
            };

            input.click();
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

    // Bouton Ajouter (sauvegarde dans la liste sans exporter)
    addBtn.addEventListener('click', async () => {
        const subject = articleSubject.value.trim();
        if (!subject) {
            alert('Veuillez saisir un objet avant d\'ajouter l\'article.');
            return;
        }
        await saveArticleToList(subject, editor.innerHTML);
        markAsSaved();
    });

    // Bouton Nouvel Article
    newArticleBtn.addEventListener('click', async () => {
        await createNewArticle();
    });

    // Bouton Importer
    loadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        // Formats proposés :
        // - .docx (Word moderne) via mammoth.js
        // - .odt  (OpenOffice/LibreOffice) via JSZip + parsing XML
        // - .html / .htm (exports HTML)
        // - .txt, .md (texte brut / Markdown)
        input.accept = '.html,.htm,.txt,.md,.docx,.odt';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const ext = file.name.split('.').pop().toLowerCase();

            // Nom du fichier comme sujet par défaut
            const defaultSubject = file.name.replace(/\.[^.]+$/, '');

            const applyContent = (html) => {
                editor.innerHTML = html || '<p></p>';
                updateWordCounter();
                if (!articleSubject.value.trim()) {
                    articleSubject.value = defaultSubject;
                }
                hasUnsavedChanges = true;
                markAsModified();
                saveToLocalStorage();
                editor.focus();
            };

            // Fichier Word .docx → priorité à mammoth.js, puis fallback JSZip
            if (ext === 'docx') {
                const reader = new FileReader();

                reader.onload = (event) => {
                    const arrayBuffer = event.target.result;

                    const tryJsZipFallback = () => {
                        if (typeof JSZip === 'undefined') {
                            return Promise.resolve(false);
                        }
                        return JSZip.loadAsync(arrayBuffer)
                            .then(zip => {
                                // Cas html-docx-js : HTML embarqué dans word/afchunk.mht
                                const afchunk = zip.file('word/afchunk.mht');
                                if (afchunk) {
                                    return afchunk.async('string').then(mht => {
                                        const html = extractHtmlFromMht(mht);
                                        if (html && html.trim()) {
                                            applyContent(html);
                                            return true;
                                        }
                                        return false;
                                    });
                                }

                                // Cas html-docx-js : HTML embarqué dans un fichier .html du dossier word/
                                const htmlEntries = zip.file(/word\/.*\.html$/i);
                                if (htmlEntries && htmlEntries.length > 0) {
                                    return htmlEntries[0].async('string').then(html => {
                                        applyContent(html);
                                        return true;
                                    });
                                }

                                // Fallback générique : on essaie de lire word/document.xml
                                const docFile = zip.file('word/document.xml');
                                if (!docFile) return false;
                                return docFile.async('string').then(xml => {
                                    // Extraction très simple du texte des balises <w:t>
                                    try {
                                        const matches = xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
                                        const paragraphs = matches
                                            .map(m => m.replace(/<\/?w:t[^>]*>/g, ''))
                                            .map(t => t.replace(/\s+/g, ' ').trim())
                                            .filter(t => t.length > 0);

                                        if (!paragraphs.length) return false;

                                        const safe = paragraphs
                                            .map(p => p
                                                .replace(/&/g, '&amp;')
                                                .replace(/</g, '&lt;')
                                                .replace(/>/g, '&gt;'))
                                            .map(p => `<p>${p}</p>`)
                                            .join('\n');
                                        applyContent(safe);
                                        return true;
                                    } catch (e) {
                                        console.error('Erreur parsing XML .docx', e);
                                        return false;
                                    }
                                });
                            })
                            .catch(err => {
                                console.error('Erreur import .docx (JSZip)', err);
                                return false;
                            });
                    };

                    const finishWithError = () => {
                        alert('Impossible de lire ce fichier Word (.docx).');
                    };

                    if (typeof mammoth === 'undefined') {
                        // Pas de mammoth : on tente directement le fallback JSZip
                        tryJsZipFallback().then(ok => { if (!ok) finishWithError(); });
                        return;
                    }

                    // Tentative avec mammoth (cas des vrais .docx issus de Word)
                    mammoth.convertToHtml({ arrayBuffer })
                        .then(result => {
                            const html = (result && result.value) ? result.value.trim() : '';
                            if (html) {
                                applyContent(html);
                                return true;
                            }
                            return false;
                        })
                        .catch(err => {
                            console.error('Erreur import .docx (mammoth)', err);
                            return false;
                        })
                        .then(ok => ok ? true : tryJsZipFallback())
                        .then(okFinal => { if (!okFinal) finishWithError(); });
                };

                reader.readAsArrayBuffer(file);
                return;
            }

            // Fichier OpenDocument .odt → JSZip + parsing du XML content.xml
            if (ext === 'odt') {
                if (typeof JSZip === 'undefined') {
                    alert('Import OpenOffice/LibreOffice (.odt) indisponible : la librairie JSZip n\'est pas chargée.\nVérifiez que vous êtes connecté à Internet.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    JSZip.loadAsync(event.target.result)
                        .then(zip => zip.file('content.xml').async('string'))
                        .then(xmlString => {
                            const html = convertOdtXmlToHtml(xmlString);
                            applyContent(html);
                        })
                        .catch((err) => {
                            console.error('Erreur import .odt', err);
                            alert('Impossible de lire ce fichier .odt. Essayez de l\'enregistrer en .docx ou .txt.');
                        });
                };
                reader.readAsArrayBuffer(file);
                return;
            }

            // Tous les autres formats → lecture texte
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                let html = '';

                if (ext === 'html' || ext === 'htm') {
                    const subjectMatch = content.match(/<!-- Objet: (.+?) -->/);
                    if (subjectMatch) {
                        articleSubject.value = subjectMatch[1];
                        html = content.replace(/<!-- .+? -->\n*/g, '').trim();
                    } else {
                        html = content;
                    }
                } else if (ext === 'md') {
                    html = content
                        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                        .replace(/^- (.+)$/gm, '<li>$1</li>')
                        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
                        .replace(/\n{2,}/g, '</p><p>')
                        .replace(/^(?!<[hHuUpP])(.+)$/gm, '<p>$1</p>');
                } else {
                    const escaped = content
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    html = escaped
                        .split(/\n{2,}/)
                        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                        .join('');
                }

                applyContent(html);
            };
            reader.readAsText(file);
        };

        input.click();
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
    if (youtubeToggle) {
        const scPlayer = document.getElementById('scPlayer');
        youtubeToggle.addEventListener('click', () => {
            scPlayer.classList.toggle('minimized');
            youtubeToggle.textContent = scPlayer.classList.contains('minimized') ? '+' : '−';
        });
    }

    /**
     * Marque l'article comme modifié
     */
    function markAsModified() {
        // indicateur visuel désactivé
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
            updateWordCounter();
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
            <button id="_dlDoc" style="padding:10px 22px;border-radius:6px;border:1px solid #555;background:#2a2a2a;color:#f1f1f1;cursor:pointer;font-size:14px;">Word (.docx)</button>
          </div>
          <button id="_dlCancel" style="background:none;border:none;color:#888;cursor:pointer;font-size:13px;">Annuler</button>`;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = () => document.body.removeChild(overlay);

        modal.querySelector('#_dlTxt').addEventListener('click', async () => {
            close();
            await downloadTextFile(subject, plainText);
            await saveArticleToList(subject, htmlContent);
            markAsSaved();
        });
        modal.querySelector('#_dlDoc').addEventListener('click', async () => {
            close();
            await downloadWordFile(subject, htmlContent);
            await saveArticleToList(subject, htmlContent);
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
     * Télécharge le contenu en vrai fichier .docx — icône Word immédiate, zéro alerte
     */
    async function downloadWordFile(subject, htmlContent) {
        if (typeof htmlDocx === 'undefined') {
            showStatus('❌ Export Word indisponible hors connexion.', 'error');
            return;
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        const cleanSubject = subject
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
        const filename = `${cleanSubject}-${timestamp}.docx`;

        const fullHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
  body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.6;}
  h1{font-size:22pt;font-weight:bold;margin-top:24pt;}
  h2{font-size:16pt;font-weight:bold;margin-top:18pt;}
  h3{font-size:13pt;font-weight:bold;margin-top:14pt;}
  p{margin:4pt 0 8pt;} blockquote{margin-left:30pt;padding-left:10pt;color:#555;}
  ul,ol{margin-left:18pt;} strong,b{font-weight:bold;} em,i{font-style:italic;}
  u{text-decoration:underline;} a{color:#0563C1;}
</style></head><body>${htmlContent}</body></html>`;

        const blob = htmlDocx.asBlob(fullHtml);

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'Document Word',
                        accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
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
     * Crée un nouvel article vierge
     */
    async function createNewArticle() {
        if (hasUnsavedChanges && !confirm('Voulez-vous créer un nouvel article ? Les modifications non enregistrées seront perdues.')) {
            return;
        }
        
        currentArticleId = null;
        articleSubject.value = '';
        editor.innerHTML = '<p>Hello !</p>';
        updateWordCounter();
        hasUnsavedChanges = false;
        markAsSaved();
        await refreshArticlesList();
        showStatus('✓ Nouvel article créé !', 'success');
    }

    /**
     * Sauvegarde l'article dans la liste (IndexedDB)
     */
    async function saveArticleToList(subject, content) {
        const article = {
            // Toujours un nouvel identifiant pour ne pas écraser un article existant
            id: Date.now(),
            subject: subject,
            content: content,
            preview: getTextPreview(content),
            date: new Date().toLocaleString('fr-FR')
        };
        await _dbPut(article);
        currentArticleId = article.id;
        await refreshArticlesList();
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
     * Rafraîchit l'affichage de la liste (IndexedDB)
     */
    async function refreshArticlesList() {
        const articles = await _dbGetAll();
        
        if (articles.length === 0) {
            articlesList.innerHTML = '<div class="no-articles">Aucun article sauvegardé</div>';
            return;
        }
        
        articlesList.innerHTML = articles.map(article => `
            <div class="article-card-item ${article.id === currentArticleId ? 'active' : ''}" data-id="${article.id}">
                <div class="article-card-subject">${escapeHtml(article.subject)}</div>
                <div class="article-card-preview">${escapeHtml(article.preview)}</div>
                <div class="article-card-date">${article.date}</div>
                <button class="article-card-delete" data-id="${article.id}" onclick="event.stopPropagation()" title="Supprimer l'article" aria-label="Supprimer l'article">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
            </div>
        `).join('');
        
        articlesList.querySelectorAll('.article-card-item').forEach(card => {
            card.addEventListener('click', async () => {
                const id = parseInt(card.dataset.id);
                await loadArticleFromList(id);
            });
        });
        
        articlesList.querySelectorAll('.article-card-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                await deleteArticleFromList(id);
            });
        });
    }

    /**
     * Charge un article depuis la liste (IndexedDB)
     */
    async function loadArticleFromList(id) {
        if (hasUnsavedChanges && !confirm('Charger cet article ? Les modifications non enregistrées seront perdues.')) {
            return;
        }
        
        const articles = await _dbGetAll();
        const article = articles.find(a => a.id === id);
        
        if (article) {
            articleSubject.value = article.subject;
            editor.innerHTML = article.content;
            updateWordCounter();
            currentArticleId = article.id;
            
            hasUnsavedChanges = false;
            markAsSaved();
            await refreshArticlesList();
            showStatus(`✓ Article "${article.subject}" chargé !`, 'success');
        }
    }

    /**
     * Supprime un article de la liste (IndexedDB)
     */
    async function deleteArticleFromList(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
            return;
        }
        
        await _dbDelete(id);
        
        if (currentArticleId === id) {
            currentArticleId = null;
        }
        
        await refreshArticlesList();
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
            updateWordCounter();
        }
        
        if (savedSubject) {
            articleSubject.value = savedSubject;
        }
    }

    /**
     * Affiche un message de statut (stub — notifications désactivées)
     */
    function showStatus(message, type) {
        // Notifications désactivées
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


