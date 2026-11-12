// Core UI, local storage, and Supabase integration
lucide.createIcons();

let perfectFreehand = window.perfectFreehand || null;
const perfectFreehandReady = import('https://unpkg.com/perfect-freehand@1.2.2/dist/esm/index.mjs')
    .then(module => {
        perfectFreehand = module;
        window.perfectFreehand = module;
    })
    .catch(error => {
        console.error('perfect-freehand konnte nicht geladen werden:', error);
    });

const toggleMenuBtn = document.getElementById('toggleMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const newBtn = document.getElementById('newBtn');
const newDropdown = document.getElementById('newDropdown');
const mobileNewBtn = document.getElementById('mobileNewBtn');
const mobileNewDropdown = document.getElementById('mobileNewDropdown');
const notebookModal = document.getElementById('notebookModal');

const newMenuItems = `
    <button class="new-dropdown-item" data-new-action="notebook">
        <i data-lucide="book"></i><span>Notizbuch</span>
    </button>
    <button class="new-dropdown-item" data-new-action="text-document">
        <i data-lucide="file-text"></i><span>Text Document</span><span class="new-dropdown-badge">BETA</span>
    </button>
    <button class="new-dropdown-item" data-new-action="whiteboard">
        <i data-lucide="grid-3x3"></i><span>Whiteboard</span><span class="new-dropdown-badge new-dropdown-badge-new">NEW</span>
    </button>
    <button class="new-dropdown-item" data-new-action="quick-note">
        <i data-lucide="square-pen"></i><span>Schnellnotiz</span>
    </button>
    <button class="new-dropdown-item" data-new-action="image">
        <i data-lucide="image"></i><span>Bild</span>
    </button>
    <button class="new-dropdown-item" data-new-action="folder">
        <i data-lucide="folder"></i><span>Ordner</span>
    </button>
    <div class="new-dropdown-divider"></div>
    <button class="new-dropdown-item" data-new-action="import">
        <i data-lucide="download"></i><span>Import</span>
    </button>
    <button class="new-dropdown-item" data-new-action="backup-export">
        <i data-lucide="archive"></i><span>JSON-Backup exportieren</span>
    </button>
    <button class="new-dropdown-item" data-new-action="backup-import">
        <i data-lucide="archive-restore"></i><span>JSON-Backup wiederherstellen</span>
    </button>
    <div class="new-dropdown-divider"></div>
    <button class="new-dropdown-item new-dropdown-connect" data-new-action="Google Drive freischalten">
        <i data-lucide="hard-drive" class="text-emerald-600"></i><span>Google Drive</span><span class="new-dropdown-badge">BETA</span><span class="connect-label">Freischalten</span>
    </button>
    <button class="new-dropdown-item new-dropdown-connect" data-new-action="OneDrive freischalten">
        <i data-lucide="cloud" class="text-sky-600"></i><span>OneDrive (Persönlich)</span><span class="connect-label">Freischalten</span>
    </button>
    <button class="new-dropdown-item new-dropdown-connect" data-new-action="Dropbox freischalten">
        <i data-lucide="boxes" class="text-blue-600"></i><span>Dropbox</span><span class="connect-label">Freischalten</span>
    </button>
    <button class="new-dropdown-item new-dropdown-connect" data-new-action="Box freischalten">
        <i data-lucide="box" class="text-blue-700"></i><span>Box</span><span class="connect-label">Freischalten</span>
    </button>
`;

document.querySelectorAll('.new-dropdown-items').forEach(menu => {
    menu.innerHTML = newMenuItems;
});
lucide.createIcons();

function toggleMobileSidebar() {
    sidebar.classList.toggle('-translate-x-full');
    sidebarBackdrop.classList.toggle('hidden');
}

function closeMobileSidebar() {
    sidebar.classList.add('-translate-x-full');
    sidebarBackdrop.classList.add('hidden');
}

if (toggleMenuBtn) toggleMenuBtn.addEventListener('click', toggleMobileSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', toggleMobileSidebar);

function showMainView(view) {
    const showTrash = view === 'trash';
    activeDashboardFilter = view === 'favorites' || view === 'folder' ? view : 'documents';
    if (view !== 'folder') activeDashboardFolder = '';
    document.getElementById('dashboardView')?.classList.toggle('hidden', showTrash);
    document.getElementById('trashView')?.classList.toggle('hidden', !showTrash);
    const title = view === 'trash' ? 'Papierkorb'
        : view === 'favorites' ? 'Favoriten'
            : view === 'folder' ? activeDashboardFolder
                : 'Dokumente';
    const titleElement = document.getElementById('mainPageTitle');
    if (titleElement) titleElement.textContent = title;
    const setNavigationActive = (element, active) => {
        element?.classList.toggle('bg-slate-200/70', active);
        element?.classList.toggle('text-slate-900', active);
        element?.classList.toggle('text-slate-600', !active);
        if (active) element?.setAttribute('aria-current', 'page');
        else element?.removeAttribute('aria-current');
    };
    setNavigationActive(document.getElementById('documentsNav'), view === 'documents');
    setNavigationActive(document.getElementById('favoritesNav'), view === 'favorites');
    setNavigationActive(document.getElementById('trashNav'), showTrash);
    renderFolderNavigation();
    closeMobileSidebar();
    if (showTrash) renderTrash();
    else loadNotebooksToDashboard();
}

document.getElementById('documentsNav')?.addEventListener('click', event => {
    event.preventDefault();
    showMainView('documents');
});
document.getElementById('favoritesNav')?.addEventListener('click', event => {
    event.preventDefault();
    showMainView('favorites');
});
document.getElementById('trashNav')?.addEventListener('click', event => {
    event.preventDefault();
    showMainView('trash');
});

function closeNewMenus() {
    [newDropdown, mobileNewDropdown].forEach(menu => {
        if (menu) menu.classList.add('hidden');
    });
    [newBtn, mobileNewBtn].forEach(button => {
        if (button) button.setAttribute('aria-expanded', 'false');
    });
}

function toggleNewMenu(button, menu) {
    const shouldOpen = menu.classList.contains('hidden');
    closeNewMenus();
    if (shouldOpen) {
        menu.classList.remove('hidden');
        button.setAttribute('aria-expanded', 'true');
    }
}

function handleNewButtonClick(event, button, menu) {
    event.stopPropagation();
    toggleNewMenu(button, menu);
}

function handleNewButtonDoubleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    createQuickNote();
}

if (newBtn) {
    newBtn.addEventListener('click', event => handleNewButtonClick(event, newBtn, newDropdown));
    newBtn.addEventListener('dblclick', handleNewButtonDoubleClick);
}
if (mobileNewBtn) {
    mobileNewBtn.addEventListener('click', event => handleNewButtonClick(event, mobileNewBtn, mobileNewDropdown));
    mobileNewBtn.addEventListener('dblclick', handleNewButtonDoubleClick);
}

document.querySelectorAll('.new-dropdown').forEach(menu => {
    menu.addEventListener('click', event => {
        const actionButton = event.target.closest('[data-new-action]');
        if (actionButton) handleNewAction(actionButton.dataset.newAction);
        event.stopPropagation();
    });
});
function handleNewAction(action) {
    closeNewMenus();
    if (action === 'notebook') {
        openNotebookModal();
    } else if (action === 'quick-note') {
        createQuickNote();
    } else if (action === 'folder') {
        createNotebookFolder();
    } else if (action === 'import') {
        document.getElementById('documentImportInput')?.click();
    } else if (action === 'backup-export') {
        void exportLocalBackup();
    } else if (action === 'backup-import') {
        document.getElementById('backupImportInput')?.click();
    } else {
        alert(`${action[0].toUpperCase()}${action.slice(1)} ist in MyNotes noch nicht verfügbar.`);
    }
}

document.getElementById('documentImportInput')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        await importDocumentFile(file);
    } catch (error) {
        console.error('Dokument konnte nicht importiert werden:', error);
        alert(error instanceof Error ? error.message : 'Das Dokument konnte nicht importiert werden.');
    } finally {
        event.target.value = '';
    }
});

async function exportLocalBackup() {
    try {
        await ensureNotebookStorage();
        const { downloadBackup } = await import('./backupManager.js');
        await downloadBackup({
            db: notebookDb,
            notebooks,
            folders: notebookFolders,
            preferences: {
                inputMode: currentToolState.inputMode,
                notebookSort: notebookSortMode
            }
        });
    } catch (error) {
        console.error('JSON-Backup konnte nicht erstellt werden:', error);
        alert(`JSON-Backup konnte nicht erstellt werden: ${error.message || error}`);
    }
}

async function importLocalBackup(file) {
    try {
        await ensureNotebookStorage();
        const { restoreBackup } = await import('./backupManager.js');
        const result = await restoreBackup(file, {
            db: notebookDb,
            existingNotebooks: notebooks,
            confirmImport(summary) {
                return confirm(
                    `Backup wiederherstellen?\n\n` +
                    `Neue Notizbücher: ${summary.notebooks}\n` +
                    `Seiten: ${summary.pages}\n` +
                    `Original-PDFs: ${summary.originalPdfs}\n` +
                    `Lernstapel: ${summary.decks}\n` +
                    `Audioaufnahmen: ${summary.recordings}\n\n` +
                    `Vorhandene Notizbücher werden nicht überschrieben; IDs mit Konflikten werden übersprungen.`
                );
            },
            async onImported({ notebooks: importedNotebooks, folders, preferences }) {
                notebooks = [...notebooks, ...importedNotebooks];
                notebookFolders = [...new Set([...notebookFolders, ...folders])];
                localStorage.setItem('mynotes_folders', JSON.stringify(notebookFolders));
                if (preferences && inputModes.has(preferences.inputMode)) {
                    currentToolState.inputMode = preferences.inputMode;
                    localStorage.setItem('mynotes_input_mode', preferences.inputMode);
                    const inputModeSelect = document.getElementById('inputModeSelect');
                    if (inputModeSelect) inputModeSelect.value = preferences.inputMode;
                }
                if (preferences && validNotebookSortModes.has(preferences.notebookSort)) {
                    notebookSortMode = preferences.notebookSort;
                    localStorage.setItem('mynotes_notebook_sort', notebookSortMode);
                    const sortSelect = document.getElementById('notebookSortSelect');
                    if (sortSelect) sortSelect.value = notebookSortMode;
                }
                saveNotebookMetadata();
                loadNotebooksToDashboard();
            }
        });
        if (result.cancelled) return;
        alert(
            `Wiederherstellung abgeschlossen.\n` +
            `Notizbücher: ${result.notebooks}, Seiten: ${result.pages}, Lernstapel: ${result.decks}, ` +
            `Karten: ${result.cards}, Audioaufnahmen: ${result.recordings}.` +
            (result.skippedNotebooks ? `\nÜbersprungene Notizbücher mit vorhandener ID: ${result.skippedNotebooks}.` : '')
        );
    } catch (error) {
        console.error('JSON-Backup konnte nicht wiederhergestellt werden:', error);
        alert(`JSON-Backup konnte nicht wiederhergestellt werden: ${error.message || error}`);
    }
}

document.getElementById('backupImportInput')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        await importLocalBackup(file);
    } finally {
        event.target.value = '';
    }
});

function createQuickNote() {
    closeNewMenus();
    const quickNote = {
        id: Date.now(),
        title: 'Schnellnotiz',
        template: 'Leer',
        date: new Date().toLocaleDateString('de-DE'),
        content: '',
        folderName: activeDashboardFilter === 'folder' ? activeDashboardFolder : '',
        createdAt: new Date().toISOString()
    };
    notebooks.push(quickNote);
    saveNotebookMetadata(quickNote.id);
    loadNotebooksToDashboard();
    openNotebook(quickNote.id);
}

// Globaler Klick-Handler zum Schließen von Dropdowns
window.addEventListener('click', (e) => {
    if (![newBtn, mobileNewBtn, newDropdown, mobileNewDropdown].some(element => element && element.contains(e.target))) {
        closeNewMenus();
    }
    
    const nbMenu = document.getElementById('notebookOptionsMenu');
    const menuBtn = document.getElementById('menuTriggerBtn');
    if (nbMenu && menuBtn && !nbMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        closeMenu();
    }

    const infoPopover = document.getElementById('notebookInfoPopover');
    const infoButton = document.querySelector('[data-editor-action="toggle-info"]');
    if (infoPopover && infoButton && !infoPopover.contains(e.target) && !infoButton.contains(e.target)) {
        closeNotebookInfo();
    }
});

window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeNotebookInfo();
        closeGlobalSearch();
    }
});

function openNotebookModal() {
    closeNewMenus();
    notebookModal.classList.remove('hidden');
    renderCoverOptions();
    renderTemplateOptions();
}

function closeNotebookModal() {
    notebookModal.classList.add('hidden');
}

let selectedTemplate = { name: "Gepunktet", pattern: "paper-dotted" };
let selectedCover = "Einfach";
let selectedOrientation = "portrait";
let notebooks = JSON.parse(localStorage.getItem('mynotes_notebooks')) || [];
let notebookFolders = [];
try {
    const savedFolders = JSON.parse(localStorage.getItem('mynotes_folders')) || [];
    notebookFolders = Array.isArray(savedFolders) ? savedFolders.filter(folder => typeof folder === 'string') : [];
} catch (error) {
    console.error('Lokale Ordner konnten nicht gelesen werden:', error);
}
let activeDashboardFilter = 'documents';
let activeDashboardFolder = '';
const validNotebookSortModes = new Set(['updated', 'created', 'title']);
const storedNotebookSortMode = localStorage.getItem('mynotes_notebook_sort');
let notebookSortMode = validNotebookSortModes.has(storedNotebookSortMode) ? storedNotebookSortMode : 'updated';
let cloudClient = null;
let cloudClientPersistence = null;
let cloudAuthSubscription = null;
let cloudSession = null;
let cloudLoginRequired = false;
let cloudSignupInProgress = false;
let cloudSyncTask = null;
let cloudSyncTimer = null;
let cloudSyncSuppression = 0;
const cloudAuthStorage = {
    getItem(key) {
        return (cloudClientPersistence ? window.localStorage : window.sessionStorage).getItem(key);
    },
    setItem(key, value) {
        return (cloudClientPersistence ? window.localStorage : window.sessionStorage).setItem(key, value);
    },
    removeItem(key) {
        return (cloudClientPersistence ? window.localStorage : window.sessionStorage).removeItem(key);
    }
};
let notebookTombstones = {};
try {
    notebookTombstones = JSON.parse(localStorage.getItem('mynotes_deleted_notebooks')) || {};
} catch (error) {
    console.error('Lokale Löschmarkierungen konnten nicht gelesen werden:', error);
}
let notebookPurgeTombstones = {};
try {
    notebookPurgeTombstones = JSON.parse(localStorage.getItem('mynotes_purged_notebooks')) || {};
} catch (error) {
    console.error('Lokale endgültige Löschmarkierungen konnten nicht gelesen werden:', error);
}
const notebookDb = window.Dexie ? new Dexie('mynotes-data') : null;
let notebookStorageError = null;
let notebookStorageErrorNotified = false;

if (notebookDb) {
    notebookDb.version(1).stores({
        pages: '[notebookId+pageIndex], notebookId'
    });
    notebookDb.version(2).stores({
        pages: '[notebookId+pageIndex], notebookId',
        flashcardDecks: 'id',
        flashcards: 'id, deckId, dueAt'
    });
    notebookDb.version(3).stores({
        pages: '[notebookId+pageIndex], notebookId',
        flashcardDecks: 'id',
        flashcards: 'id, deckId, dueAt',
        pdfOriginals: 'notebookId'
    });
    notebookDb.version(4).stores({
        pages: '[notebookId+pageIndex], notebookId',
        flashcardDecks: 'id',
        flashcards: 'id, deckId, dueAt',
        pdfOriginals: 'notebookId',
        pdfCitations: 'id, notebookId, docId, createdAt, *tags',
        documentLinks: 'id, notebookId, sourceDocId, targetDocId, createdAt',
        pdfWorkspace: 'id, updatedAt'
    });
    notebookDb.version(5).stores({
        pages: '[notebookId+pageIndex], notebookId',
        flashcardDecks: 'id',
        flashcards: 'id, deckId, dueAt',
        pdfOriginals: 'notebookId',
        pdfCitations: 'id, notebookId, docId, createdAt, *tags',
        documentLinks: 'id, notebookId, sourceDocId, targetDocId, createdAt',
        pdfWorkspace: 'id, updatedAt',
        syncQueue: 'id, notebookId, queuedAt, nextAttemptAt, attempts',
        syncVersions: 'notebookId, localUpdatedAt, remoteUpdatedAt',
        syncConflicts: 'notebookId, detectedAt'
    });
}

async function initializeNotebookStorage() {
    if (!notebookDb) throw new Error('Dexie konnte nicht geladen werden.');
    await notebookDb.open();
    const recordsToMigrate = [];
    for (const notebook of notebooks) {
        const pages = getNotebookPages(notebook);
        const keys = pages.map((page, pageIndex) => [String(notebook.id), pageIndex]);
        const existing = await notebookDb.pages.bulkGet(keys);
        pages.forEach((page, pageIndex) => {
            if (!existing[pageIndex]) {
                recordsToMigrate.push({
                    ...page,
                    notebookId: String(notebook.id),
                    pageIndex,
                    shapes: Array.isArray(page.shapes) ? page.shapes : []
                });
            }
        });
    }
    if (recordsToMigrate.length) await notebookDb.pages.bulkPut(recordsToMigrate);
    return true;
}

let notebookStorageReady;

async function initializeFlashcards() {
    try {
        if (!await notebookStorageReady) throw notebookStorageError || new Error('IndexedDB ist nicht verfügbar.');
        const { attachFlashcardManager } = await import('./flashcards.js');
        attachFlashcardManager({
            db: notebookDb,
            onChange() {
                scheduleCloudSync();
            },
            onError(error) {
                console.error('Lernkarten konnten nicht geladen oder gespeichert werden:', error);
            }
        });
    } catch (error) {
        console.error('Lernkartenmodul konnte nicht initialisiert werden:', error);
        const status = document.getElementById('flashcardStatus');
        if (status) status.textContent = 'Lernkarten sind derzeit nicht verfügbar.';
    }
}

async function ensureNotebookStorage() {
    if (!await notebookStorageReady) {
        throw notebookStorageError || new Error('IndexedDB ist nicht verfügbar.');
    }
}

function reportNotebookStorageError(error) {
    console.error('Notizseite konnte nicht in IndexedDB gespeichert werden:', error);
    if (!notebookStorageErrorNotified) {
        notebookStorageErrorNotified = true;
        alert('Notizen konnten nicht lokal gespeichert werden. Bitte prüfe den verfügbaren Speicherplatz und lade die Seite erneut.');
    }
}

async function writeNotebookPage(notebookId, pageIndex, page) {
    await ensureNotebookStorage();
    await notebookDb.pages.put({
        ...page,
        notebookId: String(notebookId),
        pageIndex,
        shapes: Array.isArray(page.shapes) ? page.shapes : []
    });
}

function saveNotebookMetadata(updatedNotebookId = null) {
    if (updatedNotebookId !== null) {
        const updatedNotebook = notebooks.find(notebook => String(notebook.id) === String(updatedNotebookId));
        if (updatedNotebook) updatedNotebook.updatedAt = new Date().toISOString();
    }
    const metadata = notebooks.map(notebook => {
        const { pages, ...details } = notebook;
        return {
            ...details,
            pageCount: Array.isArray(pages) ? pages.length : notebook.pageCount || 1
        };
    });
    localStorage.setItem('mynotes_notebooks', JSON.stringify(metadata));
    if (updatedNotebookId !== null) void enqueueNotebookSync(updatedNotebookId);
    scheduleCloudSync();
}

async function enqueueNotebookSync(notebookId, kind = 'update') {
    if (!notebookDb || cloudSyncSuppression) return;
    try {
        await ensureNotebookStorage();
        const key = String(notebookId);
        const id = `${kind}:${key}`;
        const previous = await notebookDb.syncQueue.get(id);
        await notebookDb.syncQueue.put({
            id,
            notebookId: key,
            kind,
            queuedAt: new Date().toISOString(),
            nextAttemptAt: Date.now(),
            attempts: previous?.attempts || 0,
            status: 'pending'
        });
    } catch (error) {
        console.error('Synchronisierungsänderung konnte nicht vorgemerkt werden:', error);
        setCloudStatus(`Lokal gespeichert; Sync-Warteschlange konnte nicht aktualisiert werden: ${error.message || error}`);
    }
}
