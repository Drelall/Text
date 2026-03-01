// (Anciennement) restriction "local uniquement".
// Pour une PWA / publication, on initialise l’éditeur quel que soit l’hôte.
function isLocalHost() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname === '' ||
           hostname.startsWith('192.168.') ||
           hostname.startsWith('10.') ||
           hostname.endsWith('.local');
}

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
    // Ancien système de conversion / sortie (peut être absent du DOM)
    const convertBtn = document.getElementById('convertBtn');
    const copyBtn = document.getElementById('copyBtn');
    const output = document.getElementById('output');
    const formatSelector = document.getElementById('formatSelector');

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

    // Bouton Publier
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

    // Conversion
    if (convertBtn && formatSelector && output) {
        convertBtn.addEventListener('click', () => {
            const format = formatSelector.value;
            const content = editor.innerHTML;

            if (format === 'html') {
                output.textContent = cleanHTML(content);
            } else if (format === 'javascript') {
                output.textContent = convertToJavaScript(content);
            }

            hideStatus();
        });
    }

    // Copie dans le presse-papiers
    if (copyBtn && output) {
    copyBtn.addEventListener('click', async () => {
        const text = output.textContent;
        
        if (!text) {
            showStatus('Aucun contenu à copier', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            showStatus('✓ Copié dans le presse-papiers !', 'success');
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                showStatus('✓ Copié dans le presse-papiers !', 'success');
            } catch (e) {
                showStatus('Erreur lors de la copie', 'error');
            }
            
            document.body.removeChild(textarea);
        }
    });
    }

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
            saveBtn.textContent = 'Publier *';
            saveBtn.title = 'Des modifications non enregistrées';
        }
    }

    /**
     * Marque l'article comme sauvegardé
     */
    function markAsSaved() {
        hasUnsavedChanges = false;
        saveBtn.textContent = 'Publier';
        saveBtn.title = 'Publier l\'article';
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
     * Publie l'article
     */
    function publishArticle() {
        const subject = articleSubject.value.trim();
        const content = editor.innerHTML;
        
        if (!subject) {
            showStatus('⚠️ Veuillez saisir un objet pour l\'article', 'error');
            return;
        }
        
        downloadTextFile(subject, content);
        saveArticleToList(subject, content);
        markAsSaved();
    }

    /**
     * Télécharge le contenu en fichier TXT
     */
    async function downloadTextFile(subject, htmlContent) {
        const timestamp = new Date().toISOString().slice(0, 10);
        
        const cleanSubject = subject
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
        const filename = `${cleanSubject}-${timestamp}.txt`;
        
        const textContent = htmlToText(htmlContent);
        
        const fullContent = `TITRE: ${subject}
DATE: ${new Date().toLocaleDateString('fr-FR')}
-------------------------------------------

${textContent}`;
        
        // Diagnostic : vérifier la disponibilité de l'API
        console.log('Navigateur:', navigator.userAgent);
        console.log('API showSaveFilePicker disponible:', 'showSaveFilePicker' in window);
        
        // Vérifier si l'API File System Access est disponible
        if ('showSaveFilePicker' in window) {
            try {
                console.log('Tentative d\'ouverture du dialogue de sauvegarde...');
                
                // Ouvrir le dialogue de sauvegarde
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'Fichier texte',
                        accept: { 'text/plain': ['.txt'] }
                    }],
                    excludeAcceptAllOption: false
                });
                
                console.log('Dialogue accepté, écriture du fichier...');
                
                // Créer un flux d'écriture
                const writable = await handle.createWritable();
                
                // Écrire le contenu
                await writable.write(fullContent);
                
                // Fermer le fichier
                await writable.close();
                
                console.log('Fichier enregistré avec succès');
                showStatus(`✓ Fichier "${filename}" enregistré avec succès !`, 'success');
            } catch (err) {
                // L'utilisateur a annulé ou une erreur s'est produite
                if (err.name === 'AbortError') {
                    console.log('Sauvegarde annulée par l\'utilisateur');
                    showStatus('Sauvegarde annulée', 'error');
                } else {
                    console.error('Erreur lors de la sauvegarde:', err);
                    showStatus(`❌ Erreur: ${err.message}`, 'error');
                }
            }
        } else {
            // Fallback : téléchargement classique
            console.warn('API showSaveFilePicker non disponible, utilisation du téléchargement classique');
            alert('⚠️ Votre navigateur ne supporte pas le choix d\'emplacement.\n\nRecommandation :\n- Utilisez Chrome ou Edge (version récente)\n- Ou le fichier sera téléchargé dans votre dossier Téléchargements');
            
            const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
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
     * Convertit le HTML en texte brut
     */
    function htmlToText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        let text = '';
        
        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                
                switch(tagName) {
                    case 'h1':
                        text += '\n\n========== ';
                        processChildren(node);
                        text += ' ==========\n\n';
                        break;
                    case 'h2':
                        text += '\n\n---------- ';
                        processChildren(node);
                        text += ' ----------\n\n';
                        break;
                    case 'h3':
                        text += '\n\n### ';
                        processChildren(node);
                        text += ' ###\n\n';
                        break;
                    case 'p':
                        text += '\n';
                        processChildren(node);
                        text += '\n';
                        break;
                    case 'br':
                        text += '\n';
                        break;
                    case 'strong':
                    case 'b':
                        text += '**';
                        processChildren(node);
                        text += '**';
                        break;
                    case 'em':
                    case 'i':
                        text += '_';
                        processChildren(node);
                        text += '_';
                        break;
                    case 'a':
                        processChildren(node);
                        const href = node.getAttribute('href');
                        if (href) {
                            text += ` (${href})`;
                        }
                        break;
                    case 'ul':
                    case 'ol':
                        text += '\n';
                        processChildren(node);
                        text += '\n';
                        break;
                    case 'li':
                        text += '  • ';
                        processChildren(node);
                        text += '\n';
                        break;
                    case 'blockquote':
                        text += '\n> ';
                        processChildren(node);
                        text += '\n';
                        break;
                    default:
                        processChildren(node);
                }
            }
        }
        
        function processChildren(node) {
            for (let child of node.childNodes) {
                processNode(child);
            }
        }
        
        processNode(temp);
        
        return text
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
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
        output.textContent = '';
        
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
     * Nettoie le HTML
     */
    function cleanHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        temp.querySelectorAll('[style]').forEach(el => {
            el.removeAttribute('style');
        });

        temp.querySelectorAll('font, span').forEach(el => {
            const parent = el.parentNode;
            while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
        });

        return formatHTML(temp.innerHTML);
    }

    /**
     * Formate le HTML
     */
    function formatHTML(html) {
        let formatted = '';
        let indent = 0;
        const tab = '    ';

        html = html.replace(/\s+/g, ' ');

        const tokens = html.split(/(<\/?[^>]+>)/g).filter(token => token.trim());

        tokens.forEach(token => {
            if (token.match(/^<\/\w/)) {
                indent = Math.max(0, indent - 1);
                formatted += tab.repeat(indent) + token.trim() + '\n';
            } else if (token.match(/^<\w[^>]*[^\/]>$/)) {
                formatted += tab.repeat(indent) + token.trim() + '\n';
                indent++;
            } else if (token.match(/^<\w[^>]*\/>$/)) {
                formatted += tab.repeat(indent) + token.trim() + '\n';
            } else {
                const text = token.trim();
                if (text) {
                    formatted += tab.repeat(indent) + text + '\n';
                }
            }
        });

        return formatted.trim();
    }

    /**
     * Convertit en JavaScript
     */
    function convertToJavaScript(html) {
        const cleanedHTML = cleanHTML(html);

        const escaped = cleanedHTML
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');

        return `const articleContent = \`
${escaped}
\`;

export default articleContent;`;
    }

    /**
     * Sauvegarde dans le localStorage
     */
    function saveToLocalStorage(isAutoSave = false) {
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
document.addEventListener('DOMContentLoaded', function () {
    var sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', function () {
            var sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('open');
        });
    }
});

// ─── Lecteur YouTube custom ──────────────────────────────────────────────────
var ytPlayer = null;
var currentTrackIndex = 0;
var pendingPlay = false;
var tracks = [
    { id: 'XSXEaikz0Bc', title: 'Lofi Hip Hop Radio' },
    { id: 'blAFxjhg62k', title: 'Seconde chaîne YouTube' }
];

function updateMusicUI(playing) {
    var iconPlay = document.querySelector('.sc-icon-play');
    var iconPause = document.querySelector('.sc-icon-pause');
    var bars = document.getElementById('scBars');
    if (iconPlay && iconPause) {
        iconPlay.style.display = playing ? 'none' : 'block';
        iconPause.style.display = playing ? 'block' : 'none';
    }
    if (bars) {
        bars.classList.toggle('playing', playing);
    }
}

function loadCurrentTrack(autoplay) {
    if (!ytPlayer || typeof ytPlayer.loadVideoById !== 'function') return;
    var track = tracks[currentTrackIndex];
    if (!track) return;
    ytPlayer.loadVideoById({ videoId: track.id, startSeconds: 0 });
    if (!autoplay) {
        ytPlayer.pauseVideo();
    }
    var titleEl = document.querySelector('.sc-title');
    if (titleEl) {
        titleEl.textContent = track.title;
    }
}

function onYouTubeIframeAPIReady() {
    var container = document.getElementById('ytApiContainer');
    if (!container) return;

    ytPlayer = new YT.Player('ytApiContainer', {
        height: '1',
        width: '1',
        videoId: tracks[0].id,
        playerVars: { autoplay: 0, controls: 0 },
        events: {
            onReady: function (e) {
                var volumeInput = document.getElementById('scVolume');
                if (volumeInput && typeof e.target.setVolume === 'function') {
                    e.target.setVolume(parseInt(volumeInput.value, 10) || 80);
                }
                loadCurrentTrack(false);
                if (pendingPlay) {
                    ytPlayer.playVideo();
                    updateMusicUI(true);
                    pendingPlay = false;
                }
            },
            onStateChange: function (e) {
                var playing = e.data === YT.PlayerState.PLAYING;
                updateMusicUI(playing);
            }
        }
    });
}

(function initCustomMusicControls() {
    var playBtn = document.getElementById('scPlayBtn');
    var prevBtn = document.getElementById('scPrevBtn');
    var nextBtn = document.getElementById('scNextBtn');
    var volumeInput = document.getElementById('scVolume');

    if (!playBtn) return;

    playBtn.addEventListener('click', function () {
        if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') {
            pendingPlay = true;
            updateMusicUI(true);
            return;
        }
        var state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
            ytPlayer.pauseVideo();
            updateMusicUI(false);
        } else {
            ytPlayer.playVideo();
            updateMusicUI(true);
        }
    });

    if (volumeInput) {
        volumeInput.addEventListener('input', function () {
            var value = parseInt(this.value, 10);
            if (ytPlayer && typeof ytPlayer.setVolume === 'function' && !isNaN(value)) {
                ytPlayer.setVolume(value);
            }
        });
    }

    function changeTrack(direction) {
        if (!ytPlayer) return;
        var count = tracks.length;
        if (!count) return;
        currentTrackIndex = (currentTrackIndex + direction + count) % count;
        loadCurrentTrack(true);
        updateMusicUI(true);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function () {
            if (!ytPlayer) return;
            changeTrack(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            if (!ytPlayer) return;
            changeTrack(1);
        });
    }
})();
