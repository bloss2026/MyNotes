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

if (toggleMenuBtn) toggleMenuBtn.addEventListener('click', toggleMobileSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', toggleMobileSidebar);

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
    } else if (action === 'import') {
        document.getElementById('documentImportInput')?.click();
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

function createQuickNote() {
    closeNewMenus();
    const quickNote = {
        id: Date.now(),
        title: 'Schnellnotiz',
        template: 'Leer',
        date: new Date().toLocaleDateString('de-DE'),
        content: ''
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
    if (event.key === 'Escape') closeNotebookInfo();
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
const notebookDb = window.Dexie ? new Dexie('mynotes-data') : null;
let notebookStorageError = null;
let notebookStorageErrorNotified = false;

if (notebookDb) {
    notebookDb.version(1).stores({
        pages: '[notebookId+pageIndex], notebookId'
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

const notebookStorageReady = initializeNotebookStorage().catch(error => {
    notebookStorageError = error;
    console.error('IndexedDB für Notizen konnte nicht initialisiert werden:', error);
    return false;
});

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
    scheduleCloudSync();
}

function setCloudStatus(message) {
    const status = document.getElementById('cloudSyncStatus');
    const modalMessage = document.getElementById('cloudAuthMessage');
    if (status) status.textContent = message;
    if (modalMessage) modalMessage.textContent = message;
}

function openCloudAuthModal() {
    document.getElementById('cloudAuthModal')?.classList.remove('hidden');
}

function setCloudAuthMode(mode) {
    const signingUp = mode === 'signup';
    const title = document.getElementById('cloudAuthTitle');
    const password = document.getElementById('cloudPassword');
    title.textContent = signingUp ? 'Konto erstellen' : 'Bei MyNotes anmelden';
    password.autocomplete = signingUp ? 'new-password' : 'current-password';
    document.querySelector('.cloud-remember-option')?.classList.toggle('hidden', signingUp);
    document.getElementById('cloudSignIn')?.classList.toggle('hidden', signingUp);
    document.getElementById('cloudSignUp')?.classList.toggle('hidden', !signingUp);
    document.getElementById('cloudShowSignUp')?.classList.toggle('hidden', signingUp);
    document.getElementById('cloudShowSignIn')?.classList.toggle('hidden', !signingUp);
    setCloudStatus(signingUp ? 'Erstelle ein neues Konto.' : 'Melde dich mit deinem Konto an.');
}

function closeCloudAuthModal() {
    if (cloudLoginRequired) return;
    document.getElementById('cloudAuthModal')?.classList.add('hidden');
}

function setCloudLoginRequired(required) {
    cloudLoginRequired = required;
    document.getElementById('cloudAuthClose')?.classList.toggle('hidden', required);
}

function updateCloudAccountUi(session) {
    const label = document.getElementById('cloudAccountLabel');
    const loginForm = document.getElementById('cloudLoginForm');
    const accountPanel = document.getElementById('cloudAccountPanel');
    const accountEmail = document.getElementById('cloudAccountEmail');
    if (label) label.textContent = session ? session.user.email || 'Supabase-Konto' : 'Mit Supabase verbinden';
    loginForm?.classList.toggle('hidden', Boolean(session));
    accountPanel?.classList.toggle('hidden', !session);
    if (accountEmail) accountEmail.textContent = session?.user?.email || '';
}

function createSupabaseClient(keepSignedIn) {
    const config = window.MYNOTES_SUPABASE_CONFIG;
    cloudClientPersistence = keepSignedIn;
    cloudClient = window.supabase.createClient(config.url, config.publishableKey, {
        auth: {
            persistSession: true,
            storage: cloudAuthStorage
        }
    });
}

function bindSupabaseAuthState() {
    cloudAuthSubscription = cloudClient.auth.onAuthStateChange((_event, session) => {
        if (cloudSignupInProgress) return;
        cloudSession = session;
        updateCloudAccountUi(session);
        if (session) {
            setCloudLoginRequired(false);
            closeCloudAuthModal();
            setCloudStatus('Angemeldet – Synchronisierung wird gestartet.');
            window.setTimeout(() => void syncCloudData(), 0);
        } else {
            setCloudLoginRequired(true);
            openCloudAuthModal();
            setCloudStatus('Bitte melde dich an, um MyNotes zu verwenden.');
        }
    }).data.subscription;
}

async function applyCloudPersistencePreference() {
    const checkbox = document.getElementById('cloudKeepSignedIn');
    const keepSignedIn = Boolean(checkbox?.checked);
    localStorage.setItem('mynotes_keep_signed_in', String(keepSignedIn));
    cloudClientPersistence = keepSignedIn;
}

function scheduleCloudSync() {
    if (cloudSyncSuppression || !cloudClient || !cloudSession) return;
    if (!navigator.onLine) {
        setCloudStatus('Offline – Änderungen werden lokal gespeichert.');
        return;
    }
    window.clearTimeout(cloudSyncTimer);
    setCloudStatus('Änderung vorgemerkt – Synchronisierung läuft gleich.');
    cloudSyncTimer = window.setTimeout(() => {
        void syncCloudData();
    }, 1200);
}

async function initializeSupabaseCloud() {
    const config = window.MYNOTES_SUPABASE_CONFIG;
    if (!window.supabase?.createClient || !config?.url || !config?.publishableKey) {
        setCloudStatus('Supabase SDK oder Projektkonfiguration fehlt.');
        setCloudLoginRequired(true);
        openCloudAuthModal();
        return;
    }

    try {
        const savedPreference = localStorage.getItem('mynotes_keep_signed_in');
        const keepSignedIn = savedPreference === null || savedPreference === 'true';
        const checkbox = document.getElementById('cloudKeepSignedIn');
        if (checkbox) checkbox.checked = keepSignedIn;
        createSupabaseClient(keepSignedIn);
        const { data, error } = await cloudClient.auth.getSession();
        if (error) {
            console.error('Supabase-Sitzung konnte nicht geladen werden:', error);
            setCloudStatus(`Supabase-Anmeldung fehlgeschlagen: ${error.message}`);
            setCloudLoginRequired(true);
            updateCloudAccountUi(null);
            openCloudAuthModal();
            bindSupabaseAuthState();
            return;
        }

        cloudSession = data.session;
        updateCloudAccountUi(cloudSession);
        if (cloudSession) {
            setCloudLoginRequired(false);
            closeCloudAuthModal();
            setCloudStatus('Angemeldet – Synchronisierung wird gestartet.');
            void syncCloudData();
        } else {
            setCloudLoginRequired(true);
            setCloudStatus('Bitte melde dich an, um MyNotes zu verwenden.');
            openCloudAuthModal();
        }
        bindSupabaseAuthState();
    } catch (error) {
        console.error('Supabase konnte nicht initialisiert werden:', error);
        setCloudStatus(`Supabase konnte nicht initialisiert werden: ${error.message || error}`);
        setCloudLoginRequired(true);
        openCloudAuthModal();
    }
}

async function submitCloudAuthentication(action) {
    if (!cloudClient) {
        setCloudStatus('Supabase ist noch nicht verfügbar. Bitte lade die Seite online neu.');
        return;
    }
    const email = document.getElementById('cloudEmail')?.value.trim();
    const password = document.getElementById('cloudPassword')?.value;
    if (!email || !password) {
        setCloudStatus('Bitte gib E-Mail-Adresse und Passwort ein.');
        return;
    }
    setCloudStatus(action === 'signup' ? 'Konto wird erstellt …' : 'Anmeldung läuft …');
    try {
        await applyCloudPersistencePreference();
        if (action === 'signup') cloudSignupInProgress = true;
        const response = action === 'signup'
            ? await cloudClient.auth.signUp({ email, password })
            : await cloudClient.auth.signInWithPassword({ email, password });
        if (response.error) {
            cloudSignupInProgress = false;
            console.error('Supabase-Anmeldung fehlgeschlagen:', response.error);
            setCloudStatus(`${action === 'signup' ? 'Registrierung' : 'Anmeldung'} fehlgeschlagen: ${response.error.message}`);
            return;
        }
        if (action === 'signup') {
            if (response.data.session) {
                const { error } = await cloudClient.auth.signOut();
                if (error) {
                    cloudSignupInProgress = false;
                    cloudSession = response.data.session;
                    updateCloudAccountUi(cloudSession);
                    setCloudLoginRequired(false);
                    console.error('Nach der Registrierung konnte die Sitzung nicht beendet werden:', error);
                    setCloudStatus(`Konto erstellt, aber die Anmeldung konnte nicht vorbereitet werden: ${error.message}`);
                    return;
                }
            }
            cloudSignupInProgress = false;
            cloudSession = null;
            updateCloudAccountUi(null);
            setCloudLoginRequired(true);
            setCloudAuthMode('signin');
            openCloudAuthModal();
            document.getElementById('cloudPassword').value = '';
            setCloudStatus(response.data.session
                ? 'Konto erstellt. Melde dich jetzt mit deinen Zugangsdaten an.'
                : 'Konto erstellt. Bitte bestätige zuerst den Link in deiner E-Mail und melde dich danach an.');
            return;
        }
        cloudSession = response.data.session;
        updateCloudAccountUi(cloudSession);
        if (cloudSession) {
            setCloudLoginRequired(false);
            closeCloudAuthModal();
            setCloudStatus('Angemeldet – Synchronisierung wird gestartet.');
            await syncCloudData();
        } else {
            setCloudLoginRequired(true);
            setCloudStatus('Bitte bestätige zuerst den Link in deiner E-Mail und melde dich anschließend an.');
        }
    } catch (error) {
        cloudSignupInProgress = false;
        console.error('Supabase-Anmeldung ist fehlgeschlagen:', error);
        setCloudStatus(`${action === 'signup' ? 'Registrierung' : 'Anmeldung'} fehlgeschlagen: ${error.message || error}`);
    }
}

async function signOutOfCloud() {
    if (!cloudClient) return;
    try {
        const { error } = await cloudClient.auth.signOut();
        if (error) {
            console.error('Abmeldung bei Supabase fehlgeschlagen:', error);
            setCloudStatus(`Abmeldung fehlgeschlagen: ${error.message}`);
            return;
        }
        closeCloudAuthModal();
    } catch (error) {
        console.error('Abmeldung bei Supabase fehlgeschlagen:', error);
        setCloudStatus(`Abmeldung fehlgeschlagen: ${error.message || error}`);
    }
}

document.getElementById('cloudAccountButton')?.addEventListener('click', () => {
    setCloudAuthMode('signin');
    openCloudAuthModal();
});
document.getElementById('cloudAuthClose')?.addEventListener('click', closeCloudAuthModal);
document.getElementById('cloudAuthModal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeCloudAuthModal();
});
document.getElementById('cloudSignIn')?.addEventListener('click', () => void submitCloudAuthentication('signin'));
document.getElementById('cloudSignUp')?.addEventListener('click', () => void submitCloudAuthentication('signup'));
document.getElementById('cloudShowSignUp')?.addEventListener('click', () => setCloudAuthMode('signup'));
document.getElementById('cloudShowSignIn')?.addEventListener('click', () => setCloudAuthMode('signin'));
document.getElementById('cloudSignOut')?.addEventListener('click', () => void signOutOfCloud());
document.getElementById('cloudSyncNow')?.addEventListener('click', () => void syncCloudData());
window.addEventListener('online', scheduleCloudSync);

function saveNotebookTombstones() {
    localStorage.setItem('mynotes_deleted_notebooks', JSON.stringify(notebookTombstones));
}

function cloudNotebookId(notebookId) {
    return String(notebookId);
}

function cloudPageFolder(userId, notebookId) {
    return `${userId}/${encodeURIComponent(cloudNotebookId(notebookId))}/pages`;
}

function cloudPagePath(userId, notebookId, pageIndex) {
    return `${cloudPageFolder(userId, notebookId)}/${pageIndex}.zip`;
}

function throwCloudError(error, operation) {
    if (error) throw new Error(`${operation}: ${error.message || error}`);
}

async function packCloudPage(page) {
    const zip = new JSZip();
    const pageData = JSON.parse(JSON.stringify(page));
    let assetIndex = 0;
    const packImage = value => {
        if (typeof value !== 'string' || !value.startsWith('data:')) return value;
        const { mimeType, bytes } = dataUrlToBytes(value);
        const extension = (mimeType.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
        const path = `assets/${assetIndex++}.${extension}`;
        zip.file(path, bytes);
        return { __mynotesAsset: path, mimeType };
    };

    pageData.drawing = packImage(pageData.drawing);
    pageData.backgroundDataUrl = packImage(pageData.backgroundDataUrl);
    (pageData.shapes || []).forEach(shape => {
        if (shape.kind === 'image') shape.src = packImage(shape.src);
    });
    zip.file('page.json', JSON.stringify(pageData));
    return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 3 }
    });
}

async function unpackCloudPage(blob) {
    const zip = await JSZip.loadAsync(blob);
    const pageFile = zip.file('page.json');
    if (!pageFile) throw new Error('Die Cloud-Seite enthält keine Seitendaten.');
    const page = JSON.parse(await pageFile.async('text'));
    const unpackImage = async value => {
        if (!value || typeof value !== 'object' || !value.__mynotesAsset) return value;
        const asset = zip.file(value.__mynotesAsset);
        if (!asset) throw new Error(`Bilddatei ${value.__mynotesAsset} fehlt in der Cloud-Seite.`);
        const bytes = await asset.async('uint8array');
        return fileAsDataUrl(new Blob([bytes], { type: value.mimeType }));
    };
    page.drawing = await unpackImage(page.drawing);
    page.backgroundDataUrl = await unpackImage(page.backgroundDataUrl);
    for (const shape of page.shapes || []) {
        if (shape.kind === 'image') shape.src = await unpackImage(shape.src);
    }
    return page;
}

async function listCloudPageFiles(userId, notebookId) {
    const storage = cloudClient.storage.from('mynotes-pages');
    const folder = cloudPageFolder(userId, notebookId);
    const paths = [];
    for (let offset = 0; ; offset += 100) {
        const { data, error } = await storage.list(folder, { limit: 100, offset });
        throwCloudError(error, 'Cloud-Seiten konnten nicht aufgelistet werden');
        paths.push(...(data || []).map(file => `${folder}/${file.name}`));
        if (!data || data.length < 100) break;
    }
    return paths;
}

async function removeCloudPageFiles(userId, notebookId) {
    const paths = await listCloudPageFiles(userId, notebookId);
    if (!paths.length) return;
    const { error } = await cloudClient.storage.from('mynotes-pages').remove(paths);
    throwCloudError(error, 'Cloud-Seiten konnten nicht gelöscht werden');
}

async function getPagesForCloud(notebook) {
    await ensureNotebookStorage();
    const storedPages = await notebookDb.pages
        .where('notebookId')
        .equals(String(notebook.id))
        .sortBy('pageIndex');
    if (storedPages.length) {
        return storedPages.map(({ notebookId, pageIndex, ...page }) => page);
    }
    return getNotebookPages(notebook);
}

async function uploadCloudNotebook(userId, notebook) {
    const pages = await getPagesForCloud(notebook);
    const updatedAt = notebook.updatedAt || new Date().toISOString();
    notebook.updatedAt = updatedAt;
    const metadata = { ...notebook };
    delete metadata.pages;
    const { error: metadataError } = await cloudClient
        .from('mynotes_notebooks')
        .upsert({
            notebook_id: cloudNotebookId(notebook.id),
            metadata,
            page_count: pages.length,
            updated_at: updatedAt,
            deleted_at: null
        }, { onConflict: 'user_id,notebook_id' });
    throwCloudError(metadataError, `Notizbuch „${notebook.title}“ konnte nicht synchronisiert werden`);

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const archive = await packCloudPage(pages[pageIndex]);
        const { error } = await cloudClient.storage
            .from('mynotes-pages')
            .upload(cloudPagePath(userId, notebook.id, pageIndex), archive, {
                contentType: 'application/zip',
                upsert: true
            });
        throwCloudError(error, `Seite ${pageIndex + 1} von „${notebook.title}“ konnte nicht hochgeladen werden`);
    }

    const existingPaths = await listCloudPageFiles(userId, notebook.id);
    const stalePaths = existingPaths.filter(path => {
        const pageIndex = Number(path.slice(path.lastIndexOf('/') + 1).replace(/\.zip$/i, ''));
        return Number.isInteger(pageIndex) && pageIndex >= pages.length;
    });
    if (stalePaths.length) {
        const { error } = await cloudClient.storage.from('mynotes-pages').remove(stalePaths);
        throwCloudError(error, 'Veraltete Cloud-Seiten konnten nicht gelöscht werden');
    }
}

async function downloadCloudNotebook(userId, row) {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const pages = [];
    for (let pageIndex = 0; pageIndex < row.page_count; pageIndex += 1) {
        const { data, error } = await cloudClient.storage
            .from('mynotes-pages')
            .download(cloudPagePath(userId, row.notebook_id, pageIndex));
        throwCloudError(error, `Cloud-Seite ${pageIndex + 1} konnte nicht geladen werden`);
        pages.push(await unpackCloudPage(data));
    }
    if (!pages.length) pages.push({ content: '', drawing: '', shapes: [] });

    const id = /^\d+$/.test(row.notebook_id) ? Number(row.notebook_id) : row.notebook_id;
    const notebook = {
        ...metadata,
        id,
        updatedAt: row.updated_at,
        pageCount: pages.length,
        pages
    };
    await notebookDb.pages.where('notebookId').equals(String(id)).delete();
    await notebookDb.pages.bulkPut(pages.map((page, pageIndex) => ({
        ...page,
        notebookId: String(id),
        pageIndex
    })));
    notebooks = notebooks.filter(item => String(item.id) !== String(id));
    notebooks.push(notebook);
    delete notebookTombstones[String(id)];
}

async function applyCloudNotebookDeletion(row) {
    const id = /^\d+$/.test(row.notebook_id) ? Number(row.notebook_id) : row.notebook_id;
    notebooks = notebooks.filter(item => String(item.id) !== String(id));
    await notebookDb.pages.where('notebookId').equals(String(id)).delete();
    notebookTombstones[String(id)] = row.deleted_at || row.updated_at;
}

async function uploadCloudNotebookDeletion(userId, notebookId, deletedAt) {
    const { error } = await cloudClient
        .from('mynotes_notebooks')
        .upsert({
            notebook_id: cloudNotebookId(notebookId),
            metadata: {},
            page_count: 0,
            updated_at: deletedAt,
            deleted_at: deletedAt
        }, { onConflict: 'user_id,notebook_id' });
    throwCloudError(error, 'Notizbuch-Löschung konnte nicht synchronisiert werden');
    await removeCloudPageFiles(userId, notebookId);
}

async function syncCloudData() {
    if (!cloudClient || !cloudSession) return false;
    if (!navigator.onLine) {
        setCloudStatus('Offline – Änderungen werden lokal gespeichert.');
        return false;
    }
    if (cloudSyncTask) return cloudSyncTask;

    cloudSyncTask = (async () => {
        setCloudStatus('Synchronisierung läuft …');
        await ensureNotebookStorage();
        const userId = cloudSession.user.id;
        const localOwnerId = localStorage.getItem('mynotes_cloud_owner');
        if (localOwnerId && localOwnerId !== userId) {
            setCloudStatus('Dieser lokale Notizbestand ist einem anderen Supabase-Konto zugeordnet. Zum Schutz deiner Daten wurde der Sync gestoppt.');
            return false;
        }
        if (!localOwnerId) localStorage.setItem('mynotes_cloud_owner', userId);
        const { data: remoteRows, error } = await cloudClient
            .from('mynotes_notebooks')
            .select('notebook_id, metadata, page_count, updated_at, deleted_at');
        throwCloudError(error, 'Cloud-Notizbücher konnten nicht geladen werden');

        const remoteById = new Map((remoteRows || []).map(row => [String(row.notebook_id), row]));
        const localById = new Map(notebooks.map(notebook => [String(notebook.id), notebook]));
        const allIds = new Set([
            ...remoteById.keys(),
            ...localById.keys(),
            ...Object.keys(notebookTombstones)
        ]);
        const changedNotebookIds = new Set();
        cloudSyncSuppression += 1;
        try {
            for (const id of allIds) {
                const remote = remoteById.get(id);
                const local = localById.get(id);
                const deletedAt = notebookTombstones[id];
                const remoteTime = Date.parse(remote?.updated_at || '') || 0;

                if (deletedAt) {
                    const localDeleteTime = Date.parse(deletedAt) || 0;
                    if (remote && !remote.deleted_at && remoteTime > localDeleteTime) {
                        delete notebookTombstones[id];
                        await downloadCloudNotebook(userId, remote);
                        changedNotebookIds.add(id);
                    } else {
                        const winningDelete = remote?.deleted_at && remoteTime > localDeleteTime
                            ? remote.deleted_at
                            : deletedAt;
                        if (!remote?.deleted_at || remoteTime < localDeleteTime) {
                            await uploadCloudNotebookDeletion(userId, id, winningDelete);
                        } else {
                            await removeCloudPageFiles(userId, id);
                        }
                        notebookTombstones[id] = winningDelete;
                    }
                    continue;
                }

                if (local && remote) {
                    const localTime = Date.parse(local.updatedAt || '') || 0;
                    if (remote.deleted_at) {
                        if (localTime > remoteTime) await uploadCloudNotebook(userId, local);
                        else {
                            await applyCloudNotebookDeletion(remote);
                            changedNotebookIds.add(id);
                        }
                    } else if (localTime >= remoteTime) {
                        await uploadCloudNotebook(userId, local);
                    } else {
                        await downloadCloudNotebook(userId, remote);
                        changedNotebookIds.add(id);
                    }
                } else if (local) {
                    await uploadCloudNotebook(userId, local);
                } else if (remote?.deleted_at) {
                    await applyCloudNotebookDeletion(remote);
                    changedNotebookIds.add(id);
                } else if (remote) {
                    await downloadCloudNotebook(userId, remote);
                    changedNotebookIds.add(id);
                }
            }
        } finally {
            saveNotebookTombstones();
            saveNotebookMetadata();
            cloudSyncSuppression -= 1;
        }
        loadNotebooksToDashboard();
        if (currentNotebookId !== null && changedNotebookIds.has(String(currentNotebookId))) {
            if (notebooks.some(notebook => String(notebook.id) === String(currentNotebookId))) {
                await openNotebook(currentNotebookId);
            } else {
                location.reload();
                return true;
            }
        }
        setCloudStatus(`Synchronisiert um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.`);
        return true;
    })();

    try {
        return await cloudSyncTask;
    } catch (error) {
        console.error('Supabase-Synchronisierung fehlgeschlagen:', error);
        setCloudStatus(`Synchronisierung fehlgeschlagen: ${error.message || error}`);
        return false;
    } finally {
        cloudSyncTask = null;
    }
}

const coverOptions = [
    { name: "Einfach", className: "cover-simple" },
    { name: "Leinen", className: "cover-linen" },
    { name: "Leder", className: "cover-leather" },
    { name: "Dunkel", className: "cover-dark" }
];

function getCoverClass(coverName) {
    return coverOptions.find(option => option.name === coverName)?.className || 'cover-simple';
}

const templateGroups = [
    {
        name: "Herkömmlich",
        templates: [
            { name: "Leer", pattern: "" },
            { name: "Gepunktet", pattern: "paper-dotted" },
            { name: "Liniert schmal", pattern: "paper-lined-narrow" },
            { name: "Liniert breit", pattern: "paper-lined" },
            { name: "Kariert", pattern: "paper-grid" }
        ]
    },
    {
        name: "Schreibpapier",
        templates: [
            { name: "Cornell", pattern: "paper-cornell" },
            { name: "Notizblock", pattern: "paper-notepad" },
            { name: "Eine Spalte", pattern: "paper-column" },
            { name: "Eine Spalte gemischt", pattern: "paper-mixed" },
            { name: "Drei Spalten", pattern: "paper-three-columns" }
        ]
    },
    {
        name: "Planung",
        templates: [
            { name: "Buchhaltung", pattern: "paper-accounting" },
            { name: "Monatsplaner", pattern: "paper-month" },
            { name: "Wochenplaner", pattern: "paper-week" },
            { name: "Tagesplaner", pattern: "paper-day" },
            { name: "Monatsplaner C", pattern: "paper-month-dark" }
        ]
    },
    {
        name: "Musik",
        templates: [
            { name: "Noten für Gitarre", pattern: "paper-guitar" },
            { name: "Notenblatt", pattern: "paper-music" },
            { name: "Tabs für Gitarre", pattern: "paper-tabs" }
        ]
    }
];

function getPaperColor() {
    const color = document.getElementById('colorSelect')?.value || 'alle';
    return color === 'dunkel' ? 'dunkel' : color === 'weiss' ? 'weiss' : 'gelb';
}

function renderCoverOptions() {
    const container = document.getElementById('coverOptions');
    if (!container) return;
    container.innerHTML = '';
    coverOptions.forEach(cover => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `cover-choice ${selectedCover === cover.name ? 'is-selected' : ''}`;
        button.setAttribute('aria-pressed', String(selectedCover === cover.name));
        button.innerHTML = `<span class="cover-swatch ${cover.className}"></span><span>${cover.name}</span>`;
        button.addEventListener('click', () => {
            selectedCover = cover.name;
            renderCoverOptions();
            updateSelectedPaperPreview();
        });
        container.appendChild(button);
    });
}

function renderTemplateOptions() {
    const gallery = document.getElementById('templateGallery');
    if (!gallery) return;
    const paperColor = getPaperColor();
    const scrollTop = gallery.scrollTop;
    const rowScrollPositions = [...gallery.querySelectorAll('.template-row')].map(row => row.scrollLeft);
    gallery.innerHTML = '';

    templateGroups.forEach(group => {
        const section = document.createElement('section');
        section.className = 'template-group';
        section.innerHTML = `<h2 class="template-group-title"><span aria-hidden="true">▾</span>${group.name}</h2>`;
        const row = document.createElement('div');
        row.className = 'template-row';

        group.templates.forEach(template => {
            const isSelected = selectedTemplate.name === template.name;
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `template-choice ${isSelected ? 'is-selected' : ''}`;
            card.setAttribute('aria-pressed', String(isSelected));
            const pageShape = selectedOrientation === 'landscape' ? 'is-landscape' : '';
            card.innerHTML = `
                <span class="template-thumb paper-color-${paperColor} ${template.pattern} ${pageShape}"></span>
                <span class="template-choice-name">${template.name}</span>
            `;
            card.addEventListener('click', () => {
                selectedTemplate = template;
                renderTemplateOptions();
            });
            row.appendChild(card);
        });

        section.appendChild(row);
        gallery.appendChild(section);
    });

    gallery.scrollTop = scrollTop;
    gallery.querySelectorAll('.template-row').forEach((row, index) => {
        row.scrollLeft = rowScrollPositions[index] || 0;
    });
    updateSelectedPaperPreview();
}

function updateSelectedPaperPreview() {
    const preview = document.getElementById('selectedPaperPreview');
    const name = document.getElementById('selectedPaperName');
    if (!preview || !name) return;
    const orientationClass = selectedOrientation === 'landscape' ? 'is-landscape' : '';
    preview.className = `paper-preview paper-color-${getPaperColor()} ${selectedTemplate.pattern || ''} ${orientationClass}`;
    preview.dataset.coverClass = coverOptions.find(option => option.name === selectedCover)?.className || 'cover-simple';
    name.textContent = selectedTemplate.name;
}

function updatePaperColorFilter() {
    renderTemplateOptions();
}

function createNotebook() {
    const titleInput = document.getElementById('nbTitle');
    const title = titleInput?.value.trim() || 'Unbenanntes Notizbuch';
    const newNb = {
        id: Date.now(),
        title: title,
        template: selectedTemplate.name,
        pattern: selectedTemplate.pattern,
        paperColor: getPaperColor(),
        cover: selectedCover,
        pageSize: document.getElementById('pageSizeSelect').value,
        language: document.getElementById('languageSelect').value,
        orientation: selectedOrientation,
        date: new Date().toLocaleDateString('de-DE'),
        content: '',
        updatedAt: new Date().toISOString()
    };

    notebooks.push(newNb);
    saveNotebookMetadata(newNb.id);

    closeNotebookModal();
    loadNotebooksToDashboard();
}

document.querySelectorAll('.orientation-button').forEach(button => {
    button.addEventListener('click', () => {
        selectedOrientation = button.dataset.orientation;
        document.querySelectorAll('.orientation-button').forEach(option => {
            const isSelected = option === button;
            option.classList.toggle('is-selected', isSelected);
            option.setAttribute('aria-pressed', String(isSelected));
        });
        renderTemplateOptions();
    });
});

// Öffnet das Notizbuch im Editor mit dem exakten Goodnotes-Dreipunkt-Menü
let currentNotebookId = null;
let currentPageIndex = 0;
let activeEditorTool = 'pen';
let activePenColor = '#111111';
let activePenWidth = 3;
let activePenTool = 'pen';
const penSettings = {
    pen: { color: '#111111', width: 3 },
    pencil: { color: '#111111', width: 1 },
    'pen-fountain': { color: '#111111', width: 3 },
    highlighter: { color: '#facc15', width: 5 }
};
let pendingPenTool = 'pen';
let pendingPenSettings = { ...penSettings.pen };
let activeEraserWidth = 3;
let activeShapeWidth = 3;
let activeDrawing = false;
let currentStrokePoints = [];
let drawingStartPoint = null;
let drawingEndPoint = null;
let drawingSnapshot = null;
let activeShape = 'rectangle';
let activeObjectEmoji = '⭐';
let selectedShapeId = null;
let shapeEditStart = null;
let editorUndoStack = [];
let editorRedoStack = [];
let lastEditorText = '';
let audioRecorder = null;
let audioStream = null;
let audioChunks = [];

function openAudioDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('mynotes-audio', 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('recordings', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Audiodatenbank konnte nicht geöffnet werden.'));
    });
}

async function saveAudioRecording(blob) {
    const database = await openAudioDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction('recordings', 'readwrite');
        transaction.objectStore('recordings').put({
            id: `${currentNotebookId}-${Date.now()}`,
            notebookId: currentNotebookId,
            createdAt: new Date().toISOString(),
            blob
        });
        transaction.oncomplete = () => {
            database.close();
            resolve();
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error('Aufnahme konnte nicht gespeichert werden.'));
        };
    });
}

async function startAudioRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        alert('Audioaufnahmen werden von diesem Browser nicht unterstützt.');
        return;
    }

    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        audioRecorder = new MediaRecorder(audioStream);
        audioRecorder.addEventListener('dataavailable', event => {
            if (event.data.size) audioChunks.push(event.data);
        });
        audioRecorder.addEventListener('stop', async () => {
            audioStream?.getTracks().forEach(track => track.stop());
            audioStream = null;
            const recording = new Blob(audioChunks, { type: audioRecorder.mimeType || 'audio/webm' });
            audioRecorder = null;
            if (!recording.size) return;
            try {
                await saveAudioRecording(recording);
                document.getElementById('recordingStatus').textContent = 'Aufnahme gespeichert';
                document.getElementById('recordingStatus').classList.remove('is-recording');
            } catch (error) {
                console.error('Aufnahme konnte nicht gespeichert werden:', error);
                alert('Die Audioaufnahme konnte nicht gespeichert werden.');
            }
        }, { once: true });
        audioRecorder.start();
        document.getElementById('recordingStatus').textContent = 'Aufnahme läuft';
        document.getElementById('recordingStatus').classList.add('is-recording');
    } catch (error) {
        console.error('Mikrofonzugriff fehlgeschlagen:', error);
        alert('Mikrofonzugriff nicht möglich. Bitte erlaube den Mikrofonzugriff im Browser.');
    }
}

function stopAudioRecording() {
    if (audioRecorder?.state === 'recording') audioRecorder.stop();
}

async function showAudioRecordings() {
    const list = document.getElementById('recordingsList');
    const panel = document.getElementById('recordingsPanel');
    if (!list || !panel) return;
    list.replaceChildren();

    try {
        const database = await openAudioDatabase();
        const records = await new Promise((resolve, reject) => {
            const request = database.transaction('recordings', 'readonly').objectStore('recordings').getAll();
            request.onsuccess = () => resolve(request.result.filter(item => item.notebookId === currentNotebookId));
            request.onerror = () => reject(request.error || new Error('Aufnahmen konnten nicht geladen werden.'));
        });
        database.close();
        records.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
        if (!records.length) {
            list.textContent = 'Noch keine Aufnahmen vorhanden.';
        } else {
            records.forEach(record => {
                const item = document.createElement('div');
                item.className = 'recording-item';
                const date = document.createElement('p');
                date.textContent = new Date(record.createdAt).toLocaleString('de-DE');
                const player = document.createElement('audio');
                player.controls = true;
                player.src = URL.createObjectURL(record.blob);
                item.append(date, player);
                list.appendChild(item);
            });
        }
        panel.classList.add('is-open');
    } catch (error) {
        console.error('Aufnahmen konnten nicht geladen werden:', error);
        alert('Die gespeicherten Aufnahmen konnten nicht geladen werden.');
    }
}

function getNotebookPages(notebook) {
    if (!Array.isArray(notebook.pages) || notebook.pages.length === 0) {
        notebook.pages = [{ content: notebook.content || '', drawing: '', shapes: [] }];
    }
    return notebook.pages;
}

function persistNotebookPages() {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    const textarea = document.getElementById('notebookContent');
    const canvas = document.getElementById('notebookDrawing');
    if (!notebook || !textarea) return;

    const pages = getNotebookPages(notebook);
    const page = pages[currentPageIndex];
    if (!page) return;
    page.content = textarea.value;
    if (canvas && canvas.width && canvas.height) page.drawing = canvas.toDataURL();
    notebook.content = page.content;
    notebook.updatedAt = new Date().toISOString();
    void writeNotebookPage(notebook.id, currentPageIndex, page).catch(reportNotebookStorageError);
    saveNotebookMetadata(notebook.id);
}

function setNotebookBackground(page) {
    const background = document.getElementById('notebookBackground');
    const pageElement = document.getElementById('notebookPage');
    if (pageElement && page?.orientation) {
        pageElement.classList.toggle('max-w-4xl', page.orientation === 'landscape');
        pageElement.classList.toggle('max-w-2xl', page.orientation !== 'landscape');
    }
    if (!background) return;
    if (page?.backgroundDataUrl) {
        background.src = page.backgroundDataUrl;
        background.classList.remove('hidden');
    } else {
        background.removeAttribute('src');
        background.classList.add('hidden');
    }
}

function escapeEditorText(value) {
    return String(value || '').replace(/[&<>]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    })[character]);
}

function updatePageCounter() {
    const pages = notebooks.find(item => item.id === currentNotebookId)?.pages || [];
    const counter = document.getElementById('pageCounter');
    const sidebarCounter = document.getElementById('editorSidebarPages');
    if (counter) {
        counter.replaceChildren();
        const previousButton = document.createElement('button');
        previousButton.type = 'button';
        previousButton.className = 'page-counter-button';
        previousButton.dataset.editorAction = 'previous-page';
        previousButton.setAttribute('aria-label', 'Vorherige Seite');
        previousButton.textContent = '‹';
        previousButton.disabled = currentPageIndex <= 0;
        const pageLabel = document.createElement('span');
        pageLabel.textContent = `${currentPageIndex + 1} von ${pages.length || 1}`;
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'page-counter-button';
        nextButton.dataset.editorAction = 'next-page';
        nextButton.setAttribute('aria-label', 'Nächste Seite');
        nextButton.textContent = '›';
        nextButton.disabled = currentPageIndex >= pages.length - 1;
        counter.append(previousButton, pageLabel, nextButton);
    }
    const menuCounter = document.getElementById('menuPageCounter');
    if (menuCounter) menuCounter.textContent = `${currentPageIndex + 1} von ${pages.length || 1}`;
    if (sidebarCounter) {
        sidebarCounter.innerHTML = '';
        pages.forEach((page, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `editor-page-thumbnail ${index === currentPageIndex ? 'is-selected' : ''}`;
            button.textContent = String(index + 1);
            button.setAttribute('aria-label', `Seite ${index + 1}`);
            button.addEventListener('click', () => showNotebookPage(index));
            sidebarCounter.appendChild(button);
        });
    }
}

function showNotebookPage(index, skipSave = false) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    if (!notebook) return;
    if (!skipSave) persistNotebookPages();
    const pages = getNotebookPages(notebook);
    if (index < 0 || index >= pages.length) return;

    currentPageIndex = index;
    selectedShapeId = null;
    shapeEditStart = null;
    const textarea = document.getElementById('notebookContent');
    if (textarea) textarea.value = pages[index].content || '';
    lastEditorText = pages[index].content || '';
    setNotebookBackground(pages[index]);
    restorePageDrawing(pages[index].drawing || '');
    selectedShapeId = null;
    renderNotebookShapes();
    editorUndoStack = [];
    editorRedoStack = [];
    updatePageCounter();
}

function addNotebookPage(duplicateCurrent = false) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    if (!notebook) return;
    persistNotebookPages();
    const pages = getNotebookPages(notebook);
    const currentPage = pages[currentPageIndex] || { content: '', drawing: '' };
    const page = duplicateCurrent
        ? { ...currentPage, shapes: (currentPage.shapes || []).map(shape => ({ ...shape })) }
        : { content: '', drawing: '', shapes: [], orientation: currentPage.orientation || notebook.orientation };
    pages.splice(currentPageIndex + 1, 0, page);
    currentPageIndex += 1;
    void Promise.all(pages.map((pageData, pageIndex) => writeNotebookPage(notebook.id, pageIndex, pageData)))
        .catch(reportNotebookStorageError);
    saveNotebookMetadata(notebook.id);
    showNotebookPage(currentPageIndex, true);
    closeMenu();
}

function restorePageDrawing(dataUrl) {
    const canvas = document.getElementById('notebookDrawing');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const ratio = Number(canvas.dataset.pixelRatio) || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!dataUrl) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        return;
    }
    const image = new Image();
    image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    image.src = dataUrl;
}

function resizeNotebookCanvas() {
    const canvas = document.getElementById('notebookDrawing');
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const shapesSvg = document.getElementById('notebookShapes');
    const ratio = window.devicePixelRatio || 1;
    const oldImage = canvas.toDataURL();
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    const context = canvas.getContext('2d');
    canvas.dataset.pixelRatio = String(ratio);
    context.scale(ratio, ratio);
    if (shapesSvg) {
        shapesSvg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
        shapesSvg.setAttribute('width', String(bounds.width));
        shapesSvg.setAttribute('height', String(bounds.height));
    }
    restorePageDrawing(oldImage);
}

function stagePenChoice(tool) {
    if (!Object.hasOwn(penSettings, tool)) return;
    pendingPenTool = tool;
    pendingPenSettings = { ...penSettings[tool] };
    document.querySelectorAll('[data-pen-choice]').forEach(button => {
        const selected = button.dataset.penChoice === tool;
        button.classList.toggle('is-pending', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    const widthSelect = document.getElementById('penWidthSelect');
    if (widthSelect) widthSelect.value = String(pendingPenSettings.width);
    const colorPicker = document.getElementById('editorColorPicker');
    if (colorPicker) colorPicker.value = pendingPenSettings.color;
    document.querySelectorAll('[data-pen-color]').forEach(button => {
        button.classList.toggle('is-color-selected', button.dataset.penColor === pendingPenSettings.color);
    });
    const choice = document.querySelector(`[data-pen-choice="${tool}"]`);
    const title = document.getElementById('penSettingsTitle');
    if (title && choice) title.textContent = choice.dataset.penLabel;
}

function updateFloatingPenIcon(tool) {
    document.querySelectorAll('[data-pen-icon]').forEach(icon => {
        icon.classList.toggle('is-visible', icon.dataset.penIcon === tool);
    });
    const trigger = document.getElementById('penToolTrigger');
    const choice = document.querySelector(`[data-pen-choice="${tool}"]`);
    if (trigger && choice) {
        const label = choice.dataset.penLabel;
        trigger.setAttribute('aria-label', `Stift: ${label}`);
        trigger.title = label;
    }
}

function setEditorTool(tool) {
    activeEditorTool = tool;
    if (Object.hasOwn(penSettings, tool)) activePenTool = tool;
    document.querySelectorAll('[data-editor-tool]').forEach(button => {
        const selected = button.dataset.editorTool === tool
            || (button.dataset.toolbarGroup === 'pen' && Object.hasOwn(penSettings, tool));
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-pen-choice]').forEach(button => {
        const selected = button.dataset.penChoice === activePenTool;
        button.classList.toggle('is-selected', selected);
    });
    if (Object.hasOwn(penSettings, tool)) {
        activePenColor = penSettings[tool].color;
        activePenWidth = penSettings[tool].width;
        stagePenChoice(tool);
        updateFloatingPenIcon(tool);
    }
    const canvas = document.getElementById('notebookDrawing');
    const textarea = document.getElementById('notebookContent');
    if (canvas) canvas.classList.toggle('is-drawable', ['pen', 'pencil', 'pen-fountain', 'eraser', 'highlighter', 'shapes', 'sticky', 'objects'].includes(tool));
    if (textarea) textarea.readOnly = ['pen', 'pencil', 'eraser', 'highlighter', 'lasso', 'shapes'].includes(tool);
    const shapesSvg = document.getElementById('notebookShapes');
    if (shapesSvg) shapesSvg.classList.toggle('is-selecting', tool === 'lasso');
    updateDeleteShapeButton();
}

function getCurrentPageShapes() {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    const page = notebook && getNotebookPages(notebook)[currentPageIndex];
    if (!page) return [];
    if (!Array.isArray(page.shapes)) page.shapes = [];
    return page.shapes;
}

function updateDeleteShapeButton() {
    const button = document.querySelector('[data-editor-action="delete-selected-shape"]');
    if (button) button.disabled = !selectedShapeId;
}

function renderNotebookShapes() {
    const svg = document.getElementById('notebookShapes');
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    svg.setAttribute('width', String(bounds.width));
    svg.setAttribute('height', String(bounds.height));
    svg.replaceChildren();

    const namespace = 'http://www.w3.org/2000/svg';
    const shapes = getCurrentPageShapes();
    shapes.forEach(shape => {
        const group = document.createElementNS(namespace, 'g');
        group.dataset.shapeId = shape.id;
        const minX = Math.min(shape.x1, shape.x2);
        const minY = Math.min(shape.y1, shape.y2);
        const width = Math.abs(shape.x2 - shape.x1);
        const height = Math.abs(shape.y2 - shape.y1);
        let figure;
        if (shape.kind === 'emoji') {
            figure = document.createElementNS(namespace, 'text');
            figure.setAttribute('x', String(minX + width / 2));
            figure.setAttribute('y', String(minY + height / 2));
            figure.setAttribute('font-size', String(Math.max(Math.min(width, height), 12)));
            figure.setAttribute('text-anchor', 'middle');
            figure.setAttribute('dominant-baseline', 'central');
            figure.textContent = shape.emoji;
            figure.classList.add('notebook-object');
            const hitTarget = document.createElementNS(namespace, 'rect');
            hitTarget.setAttribute('x', String(minX));
            hitTarget.setAttribute('y', String(minY));
            hitTarget.setAttribute('width', String(Math.max(width, 12)));
            hitTarget.setAttribute('height', String(Math.max(height, 12)));
            hitTarget.classList.add('shape-hit-target', 'object-hit-target');
            group.appendChild(hitTarget);
        } else if (shape.kind === 'image') {
            figure = document.createElementNS(namespace, 'image');
            figure.setAttribute('x', String(minX));
            figure.setAttribute('y', String(minY));
            figure.setAttribute('width', String(Math.max(width, 1)));
            figure.setAttribute('height', String(Math.max(height, 1)));
            figure.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            figure.setAttribute('href', shape.src);
            figure.classList.add('notebook-object');
            const hitTarget = document.createElementNS(namespace, 'rect');
            hitTarget.setAttribute('x', String(minX));
            hitTarget.setAttribute('y', String(minY));
            hitTarget.setAttribute('width', String(Math.max(width, 12)));
            hitTarget.setAttribute('height', String(Math.max(height, 12)));
            hitTarget.classList.add('shape-hit-target', 'object-hit-target');
            group.appendChild(hitTarget);
        } else if (shape.kind === 'line') {
            figure = document.createElementNS(namespace, 'line');
            figure.setAttribute('x1', String(shape.x1));
            figure.setAttribute('y1', String(shape.y1));
            figure.setAttribute('x2', String(shape.x2));
            figure.setAttribute('y2', String(shape.y2));
        } else if (shape.kind === 'circle') {
            figure = document.createElementNS(namespace, 'ellipse');
            figure.setAttribute('cx', String(minX + width / 2));
            figure.setAttribute('cy', String(minY + height / 2));
            figure.setAttribute('rx', String(Math.max(width / 2, 0.5)));
            figure.setAttribute('ry', String(Math.max(height / 2, 0.5)));
        } else {
            figure = document.createElementNS(namespace, 'rect');
            figure.setAttribute('x', String(minX));
            figure.setAttribute('y', String(minY));
            figure.setAttribute('width', String(Math.max(width, 1)));
            figure.setAttribute('height', String(Math.max(height, 1)));
        }
        if (!['emoji', 'image'].includes(shape.kind)) {
            figure.classList.add('notebook-shape');
            figure.setAttribute('fill', 'none');
            figure.setAttribute('stroke', shape.color);
            figure.setAttribute('stroke-width', String(shape.strokeWidth));
            figure.setAttribute('stroke-linecap', 'round');
            figure.setAttribute('stroke-linejoin', 'round');
            const hitTarget = figure.cloneNode();
            hitTarget.classList.add('shape-hit-target');
            hitTarget.setAttribute('stroke', 'transparent');
            hitTarget.setAttribute('stroke-width', String(Math.max(shape.strokeWidth + 12, 16)));
            group.appendChild(hitTarget);
        }
        group.appendChild(figure);

        if (shape.id === selectedShapeId) {
            const selection = document.createElementNS(namespace, 'rect');
            selection.setAttribute('x', String(minX - 5));
            selection.setAttribute('y', String(minY - 5));
            selection.setAttribute('width', String(Math.max(width + 10, 10)));
            selection.setAttribute('height', String(Math.max(height + 10, 10)));
            selection.classList.add('shape-selection-box');
            group.appendChild(selection);
            ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(handle => {
                const handleRect = document.createElementNS(namespace, 'rect');
                const x = handle.includes('w') ? minX - 5 : handle.includes('e') ? minX + width + 1 : minX + width / 2 - 4;
                const y = handle.includes('n') ? minY - 5 : handle.includes('s') ? minY + height + 1 : minY + height / 2 - 4;
                handleRect.setAttribute('x', String(x));
                handleRect.setAttribute('y', String(y));
                handleRect.setAttribute('width', '8');
                handleRect.setAttribute('height', '8');
                handleRect.dataset.shapeHandle = handle;
                handleRect.classList.add('shape-handle');
                group.appendChild(handleRect);
            });
        }
        svg.appendChild(group);
    });
    updateDeleteShapeButton();
}

function deleteSelectedShape() {
    if (!selectedShapeId) return;
    const shapes = getCurrentPageShapes();
    const shapeIndex = shapes.findIndex(shape => shape.id === selectedShapeId);
    if (shapeIndex < 0) return;
    shapes.splice(shapeIndex, 1);
    selectedShapeId = null;
    renderNotebookShapes();
    persistNotebookPages();
}

document.addEventListener('keydown', event => {
    if (!selectedShapeId || activeEditorTool !== 'lasso' || !['Delete', 'Backspace'].includes(event.key)) return;
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) return;
    event.preventDefault();
    deleteSelectedShape();
});

function updateSelectedShape(changes) {
    if (!selectedShapeId) return;
    const shape = getCurrentPageShapes().find(item => item.id === selectedShapeId);
    if (!shape || ['emoji', 'image'].includes(shape.kind)) return;
    Object.assign(shape, changes);
    renderNotebookShapes();
    persistNotebookPages();
}

function drawStickyNote(context, point) {
    const noteWidth = 160;
    const noteHeight = 120;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#fff3a6';
    context.shadowColor = '#00000024';
    context.shadowBlur = 8;
    context.fillRect(point.x, point.y, noteWidth, noteHeight);
    context.shadowBlur = 0;
    context.fillStyle = '#475569';
    context.font = '14px Arial, sans-serif';
    context.fillText('Notizzettel', point.x + 12, point.y + 25);
    context.strokeStyle = '#e6d67a';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(point.x + 10, point.y + 36);
    context.lineTo(point.x + noteWidth - 10, point.y + 36);
    context.stroke();
}

function drawEditorObject(context, point) {
    const size = 40;
    const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    getCurrentPageShapes().push({
        id: objectId,
        kind: 'emoji',
        emoji: activeObjectEmoji,
        x1: point.x,
        y1: point.y,
        x2: point.x + size,
        y2: point.y + size
    });
    selectedShapeId = objectId;
    renderNotebookShapes();
}

function closeToolbarDropdowns() {
    document.querySelectorAll('.toolbar-dropdown-menu.is-open').forEach(menu => menu.classList.remove('is-open'));
    document.querySelectorAll('[data-toolbar-dropdown-toggle]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    document.getElementById('penSettingsPanel')?.classList.remove('is-open');
}

function toggleToolbarDropdown(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    const shouldOpen = !menu.classList.contains('is-open');
    closeToolbarDropdowns();
    menu.classList.toggle('is-open', shouldOpen);
    menu.parentElement.querySelector('[data-toolbar-dropdown-toggle]')?.setAttribute('aria-expanded', String(shouldOpen));
}

function attachEditorInteractions() {
    const editor = document.getElementById('notebookEditor');
    const textarea = document.getElementById('notebookContent');
    const canvas = document.getElementById('notebookDrawing');
    const canvasArea = document.querySelector('.editor-canvas-area');
    const laserDot = document.getElementById('editorLaserDot');
    if (!editor || !textarea || !canvas || !canvasArea || !laserDot) return;

    editor.addEventListener('click', event => {
        const dropdownTrigger = event.target.closest('[data-toolbar-dropdown-toggle]');
        if (dropdownTrigger) {
            const menu = document.getElementById(dropdownTrigger.dataset.toolbarDropdownToggle);
            const isOpening = !menu?.classList.contains('is-open');
            if (dropdownTrigger.dataset.toolbarGroup === 'pen') {
                if (isOpening) stagePenChoice(activePenTool);
            } else {
                setEditorTool(dropdownTrigger.dataset.editorTool);
            }
            toggleToolbarDropdown(dropdownTrigger.dataset.toolbarDropdownToggle);
            return;
        }
        const toolButton = event.target.closest('[data-editor-tool]');
        if (toolButton) {
            setEditorTool(toolButton.dataset.editorTool);
            closeToolbarDropdowns();
            return;
        }
        const actionButton = event.target.closest('[data-editor-action]');
        if (actionButton) {
            const action = actionButton.dataset.editorAction;
            runEditorAction(action);
            if (action !== 'choose-color') closeToolbarDropdowns();
            return;
        }
        if (!event.target.closest('.toolbar-dropdown-group')) closeToolbarDropdowns();
    });
    lastEditorText = textarea.value;
    textarea.addEventListener('input', () => {
        editorUndoStack.push(lastEditorText);
        if (editorUndoStack.length > 50) editorUndoStack.shift();
        lastEditorText = textarea.value;
        editorRedoStack = [];
        persistNotebookPages();
    });

    canvasArea.addEventListener('pointermove', event => {
        if (activeEditorTool !== 'laser') return;
        const bounds = canvasArea.getBoundingClientRect();
        laserDot.style.left = `${event.clientX - bounds.left}px`;
        laserDot.style.top = `${event.clientY - bounds.top}px`;
        laserDot.classList.add('is-visible');
    });
    canvasArea.addEventListener('pointerleave', () => laserDot.classList.remove('is-visible'));

    const context = canvas.getContext('2d');
    const pointFromEvent = event => {
        const bounds = canvas.getBoundingClientRect();
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    function renderFreehandStroke(isComplete, pointerType) {
        if (!drawingSnapshot || !currentStrokePoints.length) return;
        context.putImageData(drawingSnapshot, 0, 0);
        const isEraser = activeEditorTool === 'eraser';
        const size = isEraser
            ? activeEraserWidth * 4
            : activeEditorTool === 'pencil' ? Math.max(1, activePenWidth * 0.8) : activePenWidth;
        context.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        context.globalAlpha = activeEditorTool === 'highlighter' ? 0.4 : activeEditorTool === 'pencil' ? 0.72 : 1;
        context.fillStyle = activePenColor;
        context.strokeStyle = context.fillStyle;
        context.lineWidth = size;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        const getStroke = perfectFreehand?.getStroke;
        if (typeof getStroke === 'function') {
            const outline = getStroke(currentStrokePoints, {
                size,
                thinning: activeEditorTool === 'highlighter' ? 0.08 : activeEditorTool === 'pencil' ? 0.72 : 0.48,
                smoothing: 0.55,
                streamline: 0.45,
                simulatePressure: pointerType !== 'pen',
                last: isComplete
            });
            if (outline.length) {
                context.beginPath();
                context.moveTo(outline[0][0], outline[0][1]);
                for (let index = 1; index < outline.length; index += 1) {
                    context.lineTo(outline[index][0], outline[index][1]);
                }
                context.closePath();
                context.fill();
            }
        } else {
            context.beginPath();
            context.moveTo(currentStrokePoints[0][0], currentStrokePoints[0][1]);
            currentStrokePoints.slice(1).forEach(point => context.lineTo(point[0], point[1]));
            context.stroke();
        }
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
    }
    canvas.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch') return;
        if (!canvas.classList.contains('is-drawable')) return;
        if (!['pen', 'pencil', 'pen-fountain', 'eraser', 'highlighter', 'shapes', 'sticky', 'objects'].includes(activeEditorTool)) return;
        activeDrawing = true;
        canvas.setPointerCapture(event.pointerId);
        const point = pointFromEvent(event);
        drawingStartPoint = point;
        drawingEndPoint = point;
        drawingSnapshot = context.getImageData(0, 0, canvas.width, canvas.height);
        if (activeEditorTool === 'shapes') return;
        if (activeEditorTool === 'sticky') {
            drawStickyNote(context, point);
            finishDrawing();
            return;
        }
        if (activeEditorTool === 'objects') {
            drawEditorObject(context, point);
            finishDrawing();
            return;
        }
        const pressure = event.pointerType === 'pen' ? Math.max(event.pressure || 0.1, 0.05) : 0.5;
        currentStrokePoints = [[point.x, point.y, pressure]];
        renderFreehandStroke(false, event.pointerType);
    });
    canvas.addEventListener('pointermove', event => {
        if (!activeDrawing || event.pointerType === 'touch') return;
        const point = pointFromEvent(event);
        if (activeEditorTool === 'shapes') drawingEndPoint = point;
        if (activeEditorTool === 'shapes') return;
        const pressure = event.pointerType === 'pen' ? Math.max(event.pressure || 0.1, 0.05) : 0.5;
        currentStrokePoints.push([point.x, point.y, pressure]);
        renderFreehandStroke(false, event.pointerType);
    });
    function finishDrawing() {
        if (!activeDrawing) return;
        const completedTool = activeEditorTool;
        if (activeEditorTool === 'shapes' && drawingStartPoint && drawingEndPoint) {
            const shapeId = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            getCurrentPageShapes().push({
                id: shapeId,
                kind: activeShape,
                x1: drawingStartPoint.x,
                y1: drawingStartPoint.y,
                x2: drawingEndPoint.x,
                y2: drawingEndPoint.y,
                color: activePenColor,
                strokeWidth: activeShapeWidth
            });
            selectedShapeId = shapeId;
            renderNotebookShapes();
        }
        activeDrawing = false;
        currentStrokePoints = [];
        drawingStartPoint = null;
        drawingEndPoint = null;
        drawingSnapshot = null;
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
        persistNotebookPages();
        if (completedTool === 'shapes' || completedTool === 'objects') setEditorTool('lasso');
    }
    canvas.addEventListener('pointerup', event => {
        if (currentStrokePoints.length) renderFreehandStroke(true, event.pointerType);
        finishDrawing();
    });
    canvas.addEventListener('pointercancel', finishDrawing);

    const shapesSvg = document.getElementById('notebookShapes');
    shapesSvg?.addEventListener('pointerdown', event => {
        if (activeEditorTool !== 'lasso') return;
        const shapeGroup = event.target instanceof Element ? event.target.closest('[data-shape-id]') : null;
        if (!shapeGroup) {
            selectedShapeId = null;
            renderNotebookShapes();
            return;
        }
        const shape = getCurrentPageShapes().find(item => item.id === shapeGroup.dataset.shapeId);
        if (!shape) return;
        selectedShapeId = shape.id;
        const pointer = pointFromEvent(event);
        shapeEditStart = {
            pointer,
            shape: { ...shape },
            handle: event.target.dataset.shapeHandle || null
        };
        shapesSvg.setPointerCapture(event.pointerId);
        renderNotebookShapes();
    });
    shapesSvg?.addEventListener('pointermove', event => {
        if (!shapeEditStart || !selectedShapeId) return;
        const pointer = pointFromEvent(event);
        const shapes = getCurrentPageShapes();
        const shape = shapes.find(item => item.id === selectedShapeId);
        if (!shape) return;
        const original = shapeEditStart.shape;
        const dx = pointer.x - shapeEditStart.pointer.x;
        const dy = pointer.y - shapeEditStart.pointer.y;
        if (!shapeEditStart.handle) {
            shape.x1 = original.x1 + dx;
            shape.y1 = original.y1 + dy;
            shape.x2 = original.x2 + dx;
            shape.y2 = original.y2 + dy;
        } else {
            let left = Math.min(original.x1, original.x2);
            let right = Math.max(original.x1, original.x2);
            let top = Math.min(original.y1, original.y2);
            let bottom = Math.max(original.y1, original.y2);
            if (shapeEditStart.handle.includes('w')) left += dx;
            if (shapeEditStart.handle.includes('e')) right += dx;
            if (shapeEditStart.handle.includes('n')) top += dy;
            if (shapeEditStart.handle.includes('s')) bottom += dy;
            if (right - left < 2) right = left + 2;
            if (bottom - top < 2) bottom = top + 2;
            const reverseX = original.x2 < original.x1;
            const reverseY = original.y2 < original.y1;
            shape.x1 = reverseX ? right : left;
            shape.x2 = reverseX ? left : right;
            shape.y1 = reverseY ? bottom : top;
            shape.y2 = reverseY ? top : bottom;
        }
        renderNotebookShapes();
    });
    const finishShapeEdit = () => {
        if (!shapeEditStart) return;
        shapeEditStart = null;
        persistNotebookPages();
    };
    shapesSvg?.addEventListener('pointerup', finishShapeEdit);
    shapesSvg?.addEventListener('pointercancel', finishShapeEdit);

    editor.querySelectorAll('[data-pen-color]').forEach(button => {
        button.addEventListener('click', () => {
            pendingPenSettings.color = button.dataset.penColor;
            document.getElementById('editorColorPicker').value = pendingPenSettings.color;
            editor.querySelectorAll('[data-pen-color]').forEach(colorButton => {
                colorButton.classList.toggle('is-color-selected', colorButton === button);
            });
        });
    });
    editor.querySelectorAll('[data-pen-choice]').forEach(button => {
        button.addEventListener('click', () => {
            const tool = button.dataset.penChoice;
            stagePenChoice(tool);
            document.getElementById('penSettingsPanel').classList.add('is-open');
        });
    });
    document.getElementById('applyPenSelection').addEventListener('click', () => {
        penSettings[pendingPenTool] = { ...pendingPenSettings };
        setEditorTool(pendingPenTool);
        closeToolbarDropdowns();
    });
    document.getElementById('shapeKindSelect').addEventListener('change', event => {
        activeShape = event.target.value;
        setEditorTool('shapes');
    });
    document.getElementById('shapeWidthSelect').addEventListener('change', event => {
        activeShapeWidth = Number(event.target.value);
    });
    document.getElementById('objectEmojiSelect').addEventListener('change', event => {
        activeObjectEmoji = event.target.value;
        setEditorTool('objects');
    });
    document.getElementById('editorColorPicker').addEventListener('input', event => {
        pendingPenSettings.color = event.target.value;
        editor.querySelectorAll('[data-pen-color]').forEach(colorButton => colorButton.classList.remove('is-color-selected'));
    });
    document.getElementById('penWidthSelect').addEventListener('change', event => {
        pendingPenSettings.width = Number(event.target.value);
    });
    document.getElementById('eraserWidthSelect').addEventListener('change', event => {
        activeEraserWidth = Number(event.target.value);
    });
    editor.querySelectorAll('[data-toolbar-toggle]').forEach(input => {
        input.addEventListener('change', () => {
            const tool = editor.querySelector(`[data-toolbar-tool="${input.dataset.toolbarToggle}"]`);
            if (tool) tool.classList.toggle('toolbar-tool-hidden', !input.checked);
        });
    });
    document.getElementById('editorImageInput').addEventListener('change', event => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onerror = () => {
            console.error('Bild konnte nicht gelesen werden:', reader.error);
            alert('Das Bild konnte nicht geöffnet werden.');
        };
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => {
                console.error('Bilddatei konnte nicht dekodiert werden:', file.name);
                alert('Die Bilddatei konnte nicht angezeigt werden.');
            };
            image.onload = () => {
                const bounds = canvas.getBoundingClientRect();
                const scale = Math.min(bounds.width * 0.6 / image.width, bounds.height * 0.6 / image.height, 1);
                const width = image.width * scale;
                const height = image.height * scale;
                const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                getCurrentPageShapes().push({
                    id: objectId,
                    kind: 'image',
                    src: String(reader.result),
                    x1: (bounds.width - width) / 2,
                    y1: (bounds.height - height) / 2,
                    x2: (bounds.width + width) / 2,
                    y2: (bounds.height + height) / 2
                });
                selectedShapeId = objectId;
                renderNotebookShapes();
                persistNotebookPages();
                setEditorTool('lasso');
            };
            image.src = String(reader.result);
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    });
    resizeNotebookCanvas();
    window.onresize = resizeNotebookCanvas;
    renderNotebookShapes();
    setEditorTool(activeEditorTool);
}

function fileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
    });
}

function getImageOrientation(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(new Error('Ein Seitenbild im Archiv konnte nicht geöffnet werden.'));
        image.onload = () => resolve(image.naturalWidth >= image.naturalHeight ? 'landscape' : 'portrait');
        image.src = dataUrl;
    });
}

async function renderPdfPages(data) {
    if (!window.pdfjsLib) throw new Error('PDF.js ist nicht verfügbar. Bitte lade die Seite online neu.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const pdfPage = await pdf.getPage(pageNumber);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(1.75, 1800 / Math.max(baseViewport.width, baseViewport.height));
        const viewport = pdfPage.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF-Seite konnte nicht gerendert werden.');
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        pages.push({
            content: '',
            drawing: '',
            shapes: [],
            backgroundDataUrl: canvas.toDataURL('image/png'),
            orientation: viewport.width >= viewport.height ? 'landscape' : 'portrait'
        });
        pdfPage.cleanup();
    }
    return pages;
}

async function extractGoodnotesPages(file) {
    if (!window.JSZip) throw new Error('JSZip ist nicht verfügbar. Bitte lade die Seite online neu.');
    const archive = await JSZip.loadAsync(file);

    async function extractArchivePages(zip, depth) {
        const files = Object.values(zip.files).filter(entry => !entry.dir);
        const pdfFiles = files
            .filter(entry => /\.pdf$/i.test(entry.name) && !/preview|thumbnail/i.test(entry.name))
            .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }));
        if (pdfFiles.length) {
            const pages = [];
            for (const entry of pdfFiles) {
                pages.push(...await renderPdfPages(await entry.async('uint8array')));
            }
            return pages;
        }

        const imageFiles = files
            .filter(entry => /\.(png|jpe?g|webp)$/i.test(entry.name) && !/preview|thumbnail|cover/i.test(entry.name))
            .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }));
        if (imageFiles.length) {
            const pages = [];
            for (const entry of imageFiles) {
                const extension = entry.name.split('.').pop().toLowerCase();
                const mimeType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`;
                const blob = new Blob([await entry.async('uint8array')], { type: mimeType });
                const backgroundDataUrl = await fileAsDataUrl(blob);
                pages.push({
                    content: '',
                    drawing: '',
                    shapes: [],
                    backgroundDataUrl,
                    orientation: await getImageOrientation(backgroundDataUrl)
                });
            }
            return pages;
        }

        if (depth < 2) {
            const nestedArchives = files.filter(entry => /\.(zip|goodnotes)$/i.test(entry.name));
            for (const entry of nestedArchives) {
                const nested = await JSZip.loadAsync(await entry.async('uint8array'));
                const pages = await extractArchivePages(nested, depth + 1);
                if (pages.length) return pages;
            }
        }
        return [];
    }

    const pages = await extractArchivePages(archive, 0);
    if (!pages.length) {
        throw new Error('In der Goodnotes-Datei wurde weder ein Hintergrund-PDF noch eine unterstützte Seitenbildstruktur gefunden.');
    }
    return pages;
}

async function importDocumentFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    let pages;
    if (extension === 'pdf') {
        pages = await renderPdfPages(await file.arrayBuffer());
    } else if (extension === 'goodnotes' || extension === 'zip') {
        pages = await extractGoodnotesPages(file);
    } else {
        throw new Error('Bitte wähle eine PDF- oder Goodnotes-Datei aus.');
    }

    await ensureNotebookStorage();
    let id = Date.now();
    while (notebooks.some(notebook => notebook.id === id)) id += 1;
    const title = file.name.replace(/\.(pdf|goodnotes|zip)$/i, '').trim() || 'Importiertes Dokument';
    const notebook = {
        id,
        title,
        template: 'PDF',
        pattern: '',
        paperColor: 'weiss',
        orientation: pages[0].orientation,
        cover: 'cover-simple',
        pageCount: pages.length,
        pages,
        updatedAt: new Date().toISOString()
    };
    notebooks.push(notebook);
    try {
        await notebookDb.pages.bulkPut(pages.map((page, pageIndex) => ({
            ...page,
            notebookId: String(id),
            pageIndex
        })));
        saveNotebookMetadata(notebook.id);
    } catch (error) {
        notebooks = notebooks.filter(item => item.id !== id);
        throw new Error(`Das Dokument konnte nicht lokal gespeichert werden: ${error.message || error}`);
    }
    loadNotebooksToDashboard();
    await openNotebook(id);
}

function dataUrlToBytes(dataUrl) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
    if (!match) throw new Error('Ein Bildobjekt hat ein ungültiges Datenformat.');
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { mimeType: match[1], bytes };
}

function imageDataUrlAsPng(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(new Error('Ein Bild konnte für den PDF-Export nicht dekodiert werden.'));
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d');
            if (!context) {
                reject(new Error('Ein Bild konnte für den PDF-Export nicht vorbereitet werden.'));
                return;
            }
            context.drawImage(image, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        image.src = dataUrl;
    });
}

function textToPngDataUrl(text, fontSize) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.max(128, Math.ceil(fontSize * 2));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Objekt konnte nicht für den PDF-Export vorbereitet werden.');
    context.font = `${Math.ceil(fontSize * 1.5)}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
}

function wrapPdfText(text, font, fontSize, maxWidth) {
    const lines = [];
    String(text || '').split(/\r?\n/).forEach(paragraph => {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }
        lines.push(line);
    });
    return lines;
}

async function exportNotebookPdf() {
    try {
        if (!window.PDFLib) throw new Error('pdf-lib ist nicht verfügbar. Bitte lade die Seite online neu.');
        persistNotebookPages();
        const notebook = notebooks.find(item => item.id === currentNotebookId);
        if (!notebook) throw new Error('Das aktuelle Notizbuch wurde nicht gefunden.');
        const pages = getNotebookPages(notebook);
        const pdf = await PDFLib.PDFDocument.create();
        pdf.setTitle(notebook.title || 'MyNotes');
        const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);

        for (const pageData of pages) {
            const landscape = pageData.orientation
                ? pageData.orientation === 'landscape'
                : notebook.orientation === 'landscape';
            const width = landscape ? 842 : 595;
            const height = landscape ? 595 : 842;
            const page = pdf.addPage([width, height]);
            let pageBackground = null;
            if (pageData.backgroundDataUrl) {
                let imageData = dataUrlToBytes(pageData.backgroundDataUrl);
                if (!['image/png', 'image/jpeg'].includes(imageData.mimeType)) {
                    imageData = dataUrlToBytes(await imageDataUrlAsPng(pageData.backgroundDataUrl));
                }
                pageBackground = imageData.mimeType === 'image/jpeg'
                    ? await pdf.embedJpg(imageData.bytes)
                    : await pdf.embedPng(imageData.bytes);
                page.drawImage(pageBackground, { x: 0, y: 0, width, height });
            } else {
                page.drawRectangle({ x: 0, y: 0, width, height, color: PDFLib.rgb(1, 1, 1) });
            }

            const pageElement = document.getElementById('notebookPage');
            const bounds = pageElement?.getBoundingClientRect();
            const sourceWidth = bounds?.width || (landscape ? 1050 : 740);
            const sourceHeight = bounds?.height || (landscape ? 740 : 1050);
            const scaleX = width / sourceWidth;
            const scaleY = height / sourceHeight;
            const fontSize = 14 * scaleX;
            const textLines = wrapPdfText(pageData.content, font, fontSize, width - 80);
            textLines.forEach((line, index) => {
                const y = height - 42 * scaleY - index * fontSize * 1.45;
                if (y > 16) page.drawText(line, { x: 40 * scaleX, y, size: fontSize, font, color: PDFLib.rgb(0.12, 0.16, 0.22) });
            });

            if (pageData.drawing) {
                const drawing = dataUrlToBytes(pageData.drawing);
                const image = drawing.mimeType === 'image/jpeg'
                    ? await pdf.embedJpg(drawing.bytes)
                    : await pdf.embedPng(drawing.bytes);
                page.drawImage(image, { x: 0, y: 0, width, height });
            }

            for (const shape of pageData.shapes || []) {
                const minX = Math.min(shape.x1, shape.x2);
                const minY = Math.min(shape.y1, shape.y2);
                const shapeWidth = Math.max(Math.abs(shape.x2 - shape.x1), 1);
                const shapeHeight = Math.max(Math.abs(shape.y2 - shape.y1), 1);
                const borderWidth = Math.max(Number(shape.strokeWidth) || 2, 1) * scaleX;
                if (shape.kind === 'emoji') {
                    const emoji = dataUrlToBytes(textToPngDataUrl(shape.emoji || '', Math.min(shapeWidth, shapeHeight) * scaleX));
                    const image = await pdf.embedPng(emoji.bytes);
                    page.drawImage(image, {
                        x: minX * scaleX,
                        y: height - (minY + shapeHeight) * scaleY,
                        width: shapeWidth * scaleX,
                        height: shapeHeight * scaleY
                    });
                } else if (shape.kind === 'image' && shape.src) {
                    let imageData = dataUrlToBytes(shape.src);
                    if (!['image/png', 'image/jpeg'].includes(imageData.mimeType)) {
                        imageData = dataUrlToBytes(await imageDataUrlAsPng(shape.src));
                    }
                    const image = imageData.mimeType === 'image/jpeg'
                        ? await pdf.embedJpg(imageData.bytes)
                        : await pdf.embedPng(imageData.bytes);
                    page.drawImage(image, {
                        x: minX * scaleX,
                        y: height - (minY + shapeHeight) * scaleY,
                        width: shapeWidth * scaleX,
                        height: shapeHeight * scaleY
                    });
                } else {
                    const color = shape.color || '#1f2937';
                    const rgb = /^#?([0-9a-f]{6})$/i.exec(color);
                    const strokeColor = rgb
                        ? PDFLib.rgb(parseInt(rgb[1].slice(0, 2), 16) / 255, parseInt(rgb[1].slice(2, 4), 16) / 255, parseInt(rgb[1].slice(4, 6), 16) / 255)
                        : PDFLib.rgb(0.12, 0.16, 0.22);
                    if (shape.kind === 'line') {
                        page.drawLine({
                            start: { x: shape.x1 * scaleX, y: height - shape.y1 * scaleY },
                            end: { x: shape.x2 * scaleX, y: height - shape.y2 * scaleY },
                            thickness: borderWidth,
                            color: strokeColor
                        });
                    } else if (shape.kind === 'circle') {
                        page.drawEllipse({
                            x: (minX + shapeWidth / 2) * scaleX,
                            y: height - (minY + shapeHeight / 2) * scaleY,
                            xScale: shapeWidth * scaleX / 2,
                            yScale: shapeHeight * scaleY / 2,
                            borderColor: strokeColor,
                            borderWidth
                        });
                    } else {
                        page.drawRectangle({
                            x: minX * scaleX,
                            y: height - (minY + shapeHeight) * scaleY,
                            width: shapeWidth * scaleX,
                            height: shapeHeight * scaleY,
                            borderColor: strokeColor,
                            borderWidth
                        });
                    }
                }
            }
        }

        const bytes = await pdf.save();
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(notebook.title || 'MyNotes').replace(/[<>:"/\\|?*]+/g, '_')}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error('PDF-Export fehlgeschlagen:', error);
        alert(error instanceof Error ? error.message : 'Das Dokument konnte nicht als PDF exportiert werden.');
    }
}

function runEditorAction(action) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    if (!notebook) return;
    if (action === 'add-page') addNotebookPage();
    else if (action === 'duplicate-page') addNotebookPage(true);
    else if (action === 'previous-page') showNotebookPage(currentPageIndex - 1);
    else if (action === 'next-page') showNotebookPage(currentPageIndex + 1);
    else if (action === 'export-pdf') void exportNotebookPdf();
    else if (action === 'import-document') document.getElementById('documentImportInput')?.click();
    else if (action === 'clear-page') clearNotebookContent(currentNotebookId);
    else if (action === 'delete-notebook') deleteNotebook(currentNotebookId);
    else if (action === 'save') saveNotebookContent(currentNotebookId);
    else if (action === 'delete-selected-shape') deleteSelectedShape();
    else if (action === 'toggle-sidebar') document.getElementById('editorPageSidebar')?.classList.toggle('is-open');
    else if (action === 'toggle-options') {
        const menu = document.getElementById('notebookOptionsMenu');
        menu?.classList.toggle('is-open');
        menu?.classList.toggle('hidden', !menu.classList.contains('is-open'));
        document.getElementById('menuTriggerBtn')?.setAttribute('aria-expanded', String(menu?.classList.contains('is-open') || false));
    } else if (action === 'toggle-info') {
        const popover = document.getElementById('notebookInfoPopover');
        const shouldOpen = !popover?.classList.contains('is-open');
        popover?.classList.toggle('is-open', shouldOpen);
        document.querySelector('[data-editor-action="toggle-info"]')?.setAttribute('aria-expanded', String(shouldOpen));
    } else if (action === 'toggle-recording-menu') {
        document.getElementById('recordingMenu')?.classList.toggle('is-open');
    } else if (action === 'show-recordings') {
        showAudioRecordings();
        document.getElementById('recordingMenu')?.classList.remove('is-open');
    }
    else if (action === 'search') {
        const query = prompt('Suchbegriff in den Notizen:');
        const textarea = document.getElementById('notebookContent');
        if (!query || !textarea) return;
        const match = textarea.value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
        if (match < 0) alert('Der Suchbegriff wurde auf dieser Seite nicht gefunden.');
        else {
            setEditorTool('text');
            textarea.focus();
            textarea.setSelectionRange(match, match + query.length);
        }
    } else if (action === 'toggle-ruler') {
        document.getElementById('editorRuler')?.classList.toggle('is-visible');
        document.getElementById('recordingMenu')?.classList.remove('is-open');
    } else if (action === 'toggle-toolbar-settings') {
        document.getElementById('toolbarSettings')?.classList.toggle('is-open');
        document.getElementById('recordingMenu')?.classList.remove('is-open');
    } else if (action === 'choose-color') {
        document.getElementById('editorColorPicker')?.click();
    }
    else if (action === 'undo') {
        const textarea = document.getElementById('notebookContent');
        if (textarea && editorUndoStack.length) {
            editorRedoStack.push(textarea.value);
            textarea.value = editorUndoStack.pop();
            lastEditorText = textarea.value;
            persistNotebookPages();
        }
    } else if (action === 'redo') {
        const textarea = document.getElementById('notebookContent');
        if (textarea && editorRedoStack.length) {
            editorUndoStack.push(textarea.value);
            textarea.value = editorRedoStack.pop();
            lastEditorText = textarea.value;
            persistNotebookPages();
        }
    } else if (action === 'toggle-text') {
        const textarea = document.getElementById('notebookContent');
        setEditorTool('text');
        textarea?.focus();
    } else if (action === 'choose-image') document.getElementById('editorImageInput')?.click();
    else if (action === 'bookmark') {
        notebook.bookmarks = notebook.bookmarks || [];
        if (!notebook.bookmarks.includes(currentPageIndex)) notebook.bookmarks.push(currentPageIndex);
        saveNotebookMetadata(notebook.id);
        closeMenu();
    } else if (action === 'change-template') {
        alert(`Vorlage: ${notebook.template}`);
        closeMenu();
    } else if (action === 'rotate-page') {
        const pageIndex = currentPageIndex;
        notebook.orientation = notebook.orientation === 'landscape' ? 'portrait' : 'landscape';
        saveNotebookMetadata(notebook.id);
        closeMenu();
        openNotebook(notebook.id);
        showNotebookPage(pageIndex);
    } else if (action === 'share') {
        alert('Teilen ist in MyNotes noch nicht verfügbar.');
    } else if (action === 'record') {
        document.getElementById('recordingMenu')?.classList.remove('is-open');
        if (audioRecorder?.state === 'recording') stopAudioRecording();
        else startAudioRecording();
    }
}

async function openNotebook(id) {
    let nb = notebooks.find(item => item.id === id);
    if (!nb) return;
    try {
        await ensureNotebookStorage();
        const storedPages = await notebookDb.pages
            .where('notebookId')
            .equals(String(id))
            .sortBy('pageIndex');
        if (storedPages.length) {
            nb.pages = storedPages.map(({ notebookId, pageIndex, ...page }) => page);
        } else {
            const pages = getNotebookPages(nb);
            await Promise.all(pages.map((page, pageIndex) => writeNotebookPage(id, pageIndex, page)));
        }
        nb.pageCount = getNotebookPages(nb).length;
    } catch (error) {
        reportNotebookStorageError(error);
        return;
    }
    nb = notebooks.find(item => item.id === id);
    if (!nb) return;
    currentNotebookId = id;
    currentPageIndex = 0;
    selectedShapeId = null;
    shapeEditStart = null;
    activeEditorTool = 'pen';
    const pages = getNotebookPages(nb);
    const notebookTitle = escapeEditorText(nb.title);

    const mobileHeader = document.querySelector('.md\\:hidden.bg-white');
    if (mobileHeader) mobileHeader.classList.add('hidden');
    if (sidebar) sidebar.classList.add('hidden');

    let paperPatternClass = nb.pattern || "";
    if (!paperPatternClass && nb.template === "Gepunktet") paperPatternClass = "paper-dotted";
    if (!paperPatternClass && nb.template === "Liniert") paperPatternClass = "paper-lined";
    if (!paperPatternClass && nb.template === "Kariert") paperPatternClass = "paper-grid";
    const paperColorClass = `paper-color-${nb.paperColor || 'gelb'}`;
    const paperTextClass = nb.paperColor === 'dunkel' ? 'paper-text-dark' : 'paper-text-light';
    const pageWidthClass = nb.orientation === 'landscape' ? 'max-w-4xl' : 'max-w-2xl';

    const mainContainer = document.querySelector('main');
    mainContainer.innerHTML = `
        <div id="notebookEditor" class="notebook-editor flex flex-col h-full w-full bg-slate-300 overflow-hidden relative">
            
            <!-- 1. Obere Blaue Hauptleiste -->
            <header class="h-12 bg-[#2b59a2] text-white px-3 flex items-center justify-between shrink-0 z-30 shadow-sm select-none">
                <div class="flex items-center gap-2 md:gap-3">
                    <button onclick="location.reload()" class="editor-top-button" title="Zurück zur Dokumentübersicht" aria-label="Zurück zur Dokumentübersicht">
                        <i data-lucide="home" class="w-5 h-5"></i>
                    </button>
                    <button class="editor-new-button" data-editor-action="add-page" title="Neue Seite">
                        <span>Neu</span><i data-lucide="chevron-down" class="w-4 h-4"></i>
                    </button>
                    <button class="editor-top-button" data-editor-action="toggle-sidebar" title="Seitenübersicht" aria-label="Seitenübersicht">
                        <i data-lucide="panel-left" class="w-5 h-5"></i>
                    </button>
                    <button class="editor-top-button" data-editor-action="toggle-info" title="Dokumentstatus" aria-label="Dokumentstatus">
                        <i data-lucide="file-check-2" class="w-5 h-5"></i>
                    </button>
                    <button class="editor-top-button" data-editor-action="search" title="Suche" aria-label="Suche">
                        <i data-lucide="search" class="w-5 h-5"></i>
                    </button>
                    <button class="editor-top-button text-amber-300" title="KI-Werkzeuge" aria-label="KI-Werkzeuge">
                        <i data-lucide="sparkles" class="w-5 h-5"></i>
                    </button>
                </div>

                <div class="editor-main-tools flex items-center gap-1 md:gap-2">
                    <button class="editor-top-button" data-toolbar-tool="lasso" data-editor-tool="lasso" title="Auswahl (V)" aria-label="Auswahl"><i data-lucide="mouse-pointer-2"></i></button>
                    <button class="editor-top-button is-active" data-toolbar-tool="pen" data-editor-tool="pen" title="Stift (W)" aria-label="Stift" aria-pressed="true"><i data-lucide="pen-tool"></i></button>
                    <button class="editor-top-button" data-toolbar-tool="eraser" data-editor-tool="eraser" title="Radierer (E)" aria-label="Radierer"><i data-lucide="eraser"></i></button>
                    <button class="editor-top-button" data-toolbar-tool="text" data-editor-action="toggle-text" title="Text (T)" aria-label="Text"><i data-lucide="type"></i></button>
                    <button class="editor-top-button" data-toolbar-tool="objects" data-editor-tool="objects" title="Objekte (M)" aria-label="Objekte"><i data-lucide="smile"></i></button>
                    <button class="editor-top-button" data-toolbar-tool="image" data-editor-action="choose-image" title="Bilder (I)" aria-label="Bild einfügen"><i data-lucide="image"></i></button>
                    <button class="editor-top-button" data-toolbar-tool="shapes" data-editor-tool="shapes" title="Formen (S)" aria-label="Formen"><i data-lucide="shapes"></i></button>
                    <button class="editor-top-button" data-toolbar-tool="sticky" data-editor-tool="sticky" title="Notizzettel (N)" aria-label="Notizzettel"><i data-lucide="message-square"></i></button>
                    <button class="editor-top-button" data-toolbar-tool="laser" data-editor-tool="laser" title="Laserpointer (L)" aria-label="Laserpointer"><i data-lucide="wand-sparkles"></i></button>
                    <button class="editor-top-button" data-editor-action="toggle-recording-menu" title="Aufnahme und Werkzeuge" aria-label="Aufnahme und Werkzeuge"><i data-lucide="mic"></i><i data-lucide="chevron-down" class="editor-caret"></i></button>
                </div>

                <!-- Rechte Aktionen & Drei-Punkte-Menü -->
                <div class="flex items-center gap-1 md:gap-2 relative">
                    <button data-editor-action="add-page" class="editor-top-button" title="Seite hinzufügen" aria-label="Seite hinzufügen"><i data-lucide="file-plus-2"></i></button>
                    <button data-editor-action="share" class="editor-top-button" title="Teilen" aria-label="Teilen"><i data-lucide="upload"></i></button>
                    
                    <!-- Trigger Button -->
                    <button id="menuTriggerBtn" data-editor-action="toggle-options" class="editor-top-button relative" title="Weitere Optionen" aria-label="Weitere Optionen" aria-expanded="false">
                        <i data-lucide="ellipsis"></i>
                    </button>

                    <!-- Das Goodnotes-Original-Menü (Standardmäßig ausgeblendet) -->
                    <div id="notebookOptionsMenu" class="hidden absolute right-0 top-12 w-72 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 select-none text-xs max-h-[80vh] overflow-y-auto">
                        
                        <!-- Header / Titel -->
                        <div class="px-4 py-2.5 font-bold text-slate-800 border-b border-slate-100 truncate">
                            ${notebookTitle}
                        </div>

                        <!-- Suchen / Nur lesen -->
                        <div class="grid grid-cols-2 border-b border-slate-100 py-1 text-center">
                            <button onclick="alert('Suche-Funktion'); closeMenu();" class="py-2 hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700 border-r border-slate-100">
                                <i data-lucide="search" class="w-4 h-4"></i> Suchen
                            </button>
                            <button onclick="alert('Nur-Lesen Modus'); closeMenu();" class="py-2 hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700">
                                <i data-lucide="book-open" class="w-4 h-4"></i> Nur lesen
                            </button>
                        </div>

                        <!-- Dokumentinfos & Umbenennen -->
                        <div class="py-1 border-b border-slate-100">
                            <button onclick="alert('Dokumentinfos: Vorlage ' + '${nb.template}'); closeMenu();" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700">
                                <span class="flex items-center gap-2.5"><i data-lucide="info" class="w-4 h-4 text-slate-500"></i> Dokumentinfos</span>
                                <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                            </button>
                            <button onclick="renameNotebookPrompt(${nb.id})" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="edit-3" class="w-4 h-4 text-slate-500"></i> Umbenennen
                            </button>
                        </div>

                        <!-- Sektion: Seite 1 -->
                        <div class="px-4 py-1.5 font-semibold text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/50">
                            Seite ${currentPageIndex + 1}
                        </div>
                        <div class="py-1 border-b border-slate-100">
                            <button data-editor-action="bookmark" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="bookmark" class="w-4 h-4 text-slate-500"></i> Lesezeichen hinzufügen
                            </button>
                            <button data-editor-action="duplicate-page" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="copy" class="w-4 h-4 text-slate-500"></i> Seite kopieren
                            </button>
                            <button data-editor-action="duplicate-page" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="files" class="w-4 h-4 text-slate-500"></i> Seite duplizieren
                            </button>
                            <button data-editor-action="rotate-page" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="rotate-ccw" class="w-4 h-4 text-slate-500"></i> Seite drehen
                            </button>
                            <button data-editor-action="change-template" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="panel-top" class="w-4 h-4 text-slate-500"></i> Vorlage wechseln
                            </button>
                            <button data-editor-action="next-page" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700">
                                <span class="flex items-center gap-2.5"><i data-lucide="move-right" class="w-4 h-4 text-slate-500"></i> Gehe zu Seite</span>
                                <span id="menuPageCounter" class="text-slate-400"></span>
                            </button>
                        </div>

                        <!-- Sektion: Seite leeren oder löschen -->
                        <div class="px-4 py-1.5 font-semibold text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/50">
                            Seite leeren oder löschen
                        </div>
                        <div class="py-1 border-b border-slate-100">
                            <button onclick="clearNotebookContent(${nb.id})" class="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2.5 text-red-600">
                                <i data-lucide="eraser" class="w-4 h-4"></i> Seite leeren
                            </button>
                            <button onclick="deleteNotebook(${nb.id})" class="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2.5 text-red-600">
                                <i data-lucide="trash-2" class="w-4 h-4"></i> In den Papierkorb
                            </button>
                        </div>

                        <!-- Einstellungen -->
                        <div class="px-4 py-1.5 font-semibold text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/50">
                            Einstellungen
                        </div>
                        <div class="py-1">
                            <button onclick="saveNotebookContent(${nb.id})" class="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 font-medium">
                                <i data-lucide="save" class="w-4 h-4 text-blue-600"></i> Notizen speichern
                            </button>
                            <button data-editor-action="export-pdf" class="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 font-medium">
                                <i data-lucide="file-down" class="w-4 h-4 text-blue-600"></i> Als PDF exportieren
                            </button>
                            <button data-editor-action="import-document" class="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 font-medium">
                                <i data-lucide="file-up" class="w-4 h-4 text-blue-600"></i> PDF / Goodnotes importieren
                            </button>
                        </div>

                    </div>
                </div>
            </header>

            <div id="notebookInfoPopover" class="editor-info-popover">
                <p><span>Zuletzt bearbeitet</span><span>gerade eben</span></p>
                <p><span>Sync-Status</span><span class="text-emerald-600">Synchronisiert</span></p>
                <p><span>Für offline gespeichert</span><span>Bereit</span></p>
                <button onclick="renameNotebookPrompt(${nb.id})"><i data-lucide="pencil"></i> Umbenennen</button>
            </div>

            <div id="recordingMenu" class="editor-recording-menu">
                <p id="recordingStatus">Bereit</p>
                <button data-editor-action="record"><i data-lucide="mic"></i>Aufnahme starten / stoppen</button>
                <button data-editor-action="show-recordings"><i data-lucide="audio-lines"></i>Aufnahmen anzeigen</button>
                <button data-editor-action="toggle-ruler"><i data-lucide="ruler"></i>Lineal einblenden</button>
                <button data-editor-action="toggle-toolbar-settings"><i data-lucide="settings-2"></i>Werkzeugleiste anpassen</button>
            </div>

            <section id="recordingsPanel" class="editor-recordings-panel">
                <div class="recordings-heading">
                    <h2>Aufnahmen</h2>
                    <button type="button" aria-label="Aufnahmen schließen" onclick="document.getElementById('recordingsPanel').classList.remove('is-open')">×</button>
                </div>
                <div id="recordingsList"></div>
            </section>

            <div id="toolbarSettings" class="editor-toolbar-settings">
                <h3>Werkzeugleiste anpassen</h3>
                <label><input type="checkbox" data-toolbar-toggle="lasso" checked> Lasso</label>
                <label><input type="checkbox" data-toolbar-toggle="pen" checked> Stift</label>
                <label><input type="checkbox" data-toolbar-toggle="eraser" checked> Radierer</label>
                <label><input type="checkbox" data-toolbar-toggle="text" checked> Text</label>
                <label><input type="checkbox" data-toolbar-toggle="objects" checked> Objekte</label>
                <label><input type="checkbox" data-toolbar-toggle="image" checked> Bilder</label>
                <label><input type="checkbox" data-toolbar-toggle="shapes" checked> Formen</label>
                <label><input type="checkbox" data-toolbar-toggle="sticky" checked> Notizzettel</label>
                <label><input type="checkbox" data-toolbar-toggle="laser" checked> Laserpointer</label>
            </div>

            <!-- Schwebende Werkzeugleiste -->
            <div class="editor-controls-row z-20 shrink-0">
                <div class="editor-history-controls">
                    <button data-editor-action="undo" aria-label="Rückgängig"><i data-lucide="undo-2"></i></button>
                    <button data-editor-action="redo" aria-label="Wiederholen"><i data-lucide="redo-2"></i></button>
                </div>
                <div class="editor-floating-toolbar">
                    <button class="floating-tool toolbar-delete-tool" data-editor-action="delete-selected-shape" aria-label="Ausgewählte Form löschen" title="Ausgewählte Form löschen" disabled><i data-lucide="trash-2"></i></button>
                    <div class="toolbar-dropdown-group">
                        <button id="penToolTrigger" class="floating-tool" data-editor-tool="pen" data-toolbar-group="pen" data-toolbar-dropdown-toggle="penOptions" aria-label="Stift: Kugelschreiber" aria-expanded="false" aria-controls="penOptions" title="Kugelschreiber">
                            <span class="toolbar-pen-icon is-visible" data-pen-icon="pen"><i data-lucide="pen-tool"></i></span>
                            <span class="toolbar-pen-icon" data-pen-icon="pencil"><i data-lucide="pencil"></i></span>
                            <span class="toolbar-pen-icon" data-pen-icon="pen-fountain"><i data-lucide="pen-line"></i></span>
                            <span class="toolbar-pen-icon" data-pen-icon="highlighter"><i data-lucide="highlighter"></i></span>
                            <i data-lucide="chevron-down" class="editor-caret"></i>
                        </button>
                        <div id="penOptions" class="toolbar-dropdown-menu pen-dropdown-menu">
                            <div class="pen-choice-list" role="group" aria-label="Stift auswählen">
                                <span class="toolbar-menu-heading">Stifte</span>
                                <button type="button" class="pen-choice" data-pen-choice="pen" data-pen-label="Kugelschreiber" aria-pressed="true"><i data-lucide="pen-tool"></i><span>Kugelschreiber</span></button>
                                <button type="button" class="pen-choice" data-pen-choice="pencil" data-pen-label="Bleistift" aria-pressed="false"><i data-lucide="pencil"></i><span>Bleistift</span></button>
                                <button type="button" class="pen-choice" data-pen-choice="pen-fountain" data-pen-label="Füllfederhalter" aria-pressed="false"><i data-lucide="pen-line"></i><span>Füllfederhalter</span></button>
                                <button type="button" class="pen-choice" data-pen-choice="highlighter" data-pen-label="Textmarker" aria-pressed="false"><i data-lucide="highlighter"></i><span>Textmarker</span></button>
                            </div>
                            <div id="penSettingsPanel" class="pen-settings-panel">
                                <h3 id="penSettingsTitle">Stifteinstellungen</h3>
                                <label for="penWidthSelect">Linienstärke</label>
                                <select id="penWidthSelect" class="toolbar-select" aria-label="Stiftstärke">
                                    <option value="1">Dünn</option>
                                    <option value="3" selected>Mittel</option>
                                    <option value="5">Dick</option>
                                </select>
                                <span class="toolbar-popover-divider"></span>
                                <span class="toolbar-menu-heading">Farbe</span>
                                <div class="toolbar-color-options" aria-label="Stiftfarbe wählen">
                                    <button type="button" class="pen-color is-color-selected" data-pen-color="#111111" aria-label="Schwarz"></button>
                                    <button type="button" class="pen-color" data-pen-color="#1685f8" aria-label="Blau"></button>
                                    <button type="button" class="pen-color" data-pen-color="#dc2626" aria-label="Rot"></button>
                                    <button type="button" class="pen-color" data-pen-color="#16a34a" aria-label="Grün"></button>
                                    <button type="button" class="pen-color pen-color-yellow" data-pen-color="#facc15" aria-label="Gelb"></button>
                                    <button type="button" class="pen-color pen-color-white" data-pen-color="#ffffff" aria-label="Weiß"></button>
                                    <button type="button" class="floating-tool toolbar-custom-color" data-editor-action="choose-color" title="Weitere Farben" aria-label="Weitere Farben"><i data-lucide="circle-plus"></i></button>
                                </div>
                                <button id="applyPenSelection" type="button" class="toolbar-apply-pen">Übernehmen</button>
                            </div>
                        </div>
                    </div>
                    <div class="toolbar-dropdown-group">
                        <button class="floating-tool" data-editor-tool="eraser" data-toolbar-dropdown-toggle="eraserOptions" aria-label="Radierer" aria-expanded="false" aria-controls="eraserOptions" title="Radierer"><i data-lucide="eraser"></i><i data-lucide="chevron-down" class="editor-caret"></i></button>
                        <div id="eraserOptions" class="toolbar-dropdown-menu">
                            <label for="eraserWidthSelect">Radierergröße</label>
                            <select id="eraserWidthSelect" class="toolbar-select" aria-label="Radierergröße">
                                <option value="1">Klein</option>
                                <option value="3" selected>Mittel</option>
                                <option value="5">Groß</option>
                            </select>
                        </div>
                    </div>
                    <div class="toolbar-dropdown-group">
                        <button class="floating-tool" data-editor-tool="shapes" data-toolbar-dropdown-toggle="shapeOptions" aria-label="Formen" aria-expanded="false" aria-controls="shapeOptions" title="Formen"><i data-lucide="shapes"></i><i data-lucide="chevron-down" class="editor-caret"></i></button>
                        <div id="shapeOptions" class="toolbar-dropdown-menu">
                            <label for="shapeKindSelect">Form</label>
                            <select id="shapeKindSelect" class="toolbar-select" aria-label="Form auswählen">
                                <option value="line">Linie</option>
                                <option value="rectangle" selected>Rechteck</option>
                                <option value="circle">Kreis</option>
                            </select>
                            <label for="shapeWidthSelect">Linienstärke</label>
                            <select id="shapeWidthSelect" class="toolbar-select" aria-label="Linienstärke der Form">
                                <option value="1">Dünn</option>
                                <option value="3" selected>Mittel</option>
                                <option value="5">Dick</option>
                            </select>
                        </div>
                    </div>
                    <div class="toolbar-dropdown-group">
                        <button class="floating-tool" data-editor-tool="objects" data-toolbar-dropdown-toggle="objectOptions" aria-label="Smileys" aria-expanded="false" aria-controls="objectOptions" title="Smileys"><i data-lucide="smile"></i><i data-lucide="chevron-down" class="editor-caret"></i></button>
                        <div id="objectOptions" class="toolbar-dropdown-menu">
                            <label for="objectEmojiSelect">Smiley auswählen</label>
                            <select id="objectEmojiSelect" class="toolbar-select" aria-label="Smiley auswählen">
                                <option value="⭐" selected>Stern</option>
                                <option value="❤️">Herz</option>
                                <option value="😊">Smiley</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="editor-workspace">
                <div id="editorRuler" class="editor-ruler" aria-hidden="true"></div>
                <aside id="editorPageSidebar" class="editor-page-sidebar">
                    <h2>Seiten</h2>
                    <div id="editorSidebarPages"></div>
                    <button class="editor-add-page" data-editor-action="add-page"><i data-lucide="plus"></i> Seite hinzufügen</button>
                </aside>
                <div class="editor-canvas-area">
                    <div id="notebookPage" class="notebook-page ${pageWidthClass} ${paperColorClass} ${paperPatternClass}">
                        <img id="notebookBackground" class="notebook-background hidden" alt="">
                        <textarea id="notebookContent" class="${paperTextClass}" aria-label="Notizen auf dieser Seite"></textarea>
                        <canvas id="notebookDrawing" aria-label="Zeichenfläche"></canvas>
                        <svg id="notebookShapes" aria-label="Formen auf dieser Seite"></svg>
                    </div>
                    <div id="editorLaserDot" class="editor-laser-dot" aria-hidden="true"></div>
                </div>
                <div id="pageCounter" class="page-counter"></div>
            </div>
            <input id="editorColorPicker" type="color" value="#111111" class="hidden" aria-label="Stiftfarbe wählen">
            <input id="editorImageInput" type="file" accept="image/*" class="hidden">
        </div>
    `;
    document.getElementById('notebookContent').value = pages[0].content || '';
    setNotebookBackground(pages[0]);
    document.getElementById('menuPageCounter').textContent = `1 von ${pages.length}`;
    attachEditorInteractions();
    restorePageDrawing(pages[0].drawing || '');
    renderNotebookShapes();
    updatePageCounter();
    lucide.createIcons();
}

// Menü ein-/ausschalten per Touch & Klick
function toggleNotebookMenu(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const menu = document.getElementById('notebookOptionsMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function closeMenu() {
    const menu = document.getElementById('notebookOptionsMenu');
    if (menu) {
        menu.classList.add('hidden');
        menu.classList.remove('is-open');
    }
    document.getElementById('menuTriggerBtn')?.setAttribute('aria-expanded', 'false');
}

function closeNotebookInfo() {
    document.getElementById('notebookInfoPopover')?.classList.remove('is-open');
    document.querySelector('[data-editor-action="toggle-info"]')?.setAttribute('aria-expanded', 'false');
}

// Notizbuch umbenennen
function renameNotebookPrompt(id) {
    closeMenu();
    closeNotebookInfo();
    const nb = notebooks.find(item => item.id === id);
    if (!nb) return;
    const newTitle = prompt("Neuer Name für das Notizbuch:", nb.title);
    if (newTitle && newTitle.trim() !== "") {
        notebooks = notebooks.map(item => {
            if (item.id === id) item.title = newTitle.trim();
            return item;
        });
        saveNotebookMetadata(id);
        openNotebook(id);
    }
}

// Seite leeren
function clearNotebookContent(id) {
    closeMenu();
    if (confirm("Möchtest du diese Seite wirklich leeren?")) {
        const textarea = document.getElementById('notebookContent');
        if (textarea) textarea.value = '';
        const canvas = document.getElementById('notebookDrawing');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        const notebook = notebooks.find(item => item.id === id);
        const page = notebook?.pages?.[currentPageIndex];
        if (page) {
            page.content = '';
            page.drawing = '';
            page.shapes = [];
        }
        selectedShapeId = null;
        renderNotebookShapes();
        saveNotebookContent(id);
    }
}

// Notizbuch löschen
function deleteNotebook(id) {
    closeMenu();
    if (confirm("Möchtest du dieses Notizbuch wirklich in den Papierkorb verschieben?")) {
        notebookTombstones[String(id)] = new Date().toISOString();
        localStorage.setItem('mynotes_deleted_notebooks', JSON.stringify(notebookTombstones));
        notebooks = notebooks.filter(item => item.id !== id);
        saveNotebookMetadata();
        location.reload();
    }
}

function saveNotebookContent(id) {
    closeMenu();
    const contentElement = document.getElementById('notebookContent');
    if (!contentElement) return;
    persistNotebookPages();
    alert('Notizen erfolgreich gespeichert!');
}

function loadNotebooksToDashboard() {
    const section = document.getElementById('userNotebooksSection');
    const list = document.getElementById('notebooksList');
    
    if (!section || !list) return;

    if (notebooks.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    list.innerHTML = '';

    notebooks.forEach(nb => {
        const card = document.createElement('div');
        card.className = "bg-white border border-slate-200 rounded-xl md:rounded-2xl p-2.5 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between";
        card.onclick = () => openNotebook(nb.id);
        card.innerHTML = `
            <div class="notebook-cover-preview h-24 md:h-32 ${getCoverClass(nb.cover)} rounded-lg md:rounded-xl shadow-sm mb-2 p-2 flex flex-col justify-between">
                <span class="text-[8px] md:text-[10px] font-bold text-amber-900/60 uppercase">MyNotes</span>
                <span class="text-xs font-semibold text-slate-700 truncate">${nb.title}</span>
            </div>
            <div>
                <h4 class="text-xs font-bold text-slate-800 truncate">${nb.title}</h4>
                <p class="text-[9px] md:text-[10px] text-slate-400">${nb.template}</p>
            </div>
        `;
        list.appendChild(card);
    });
}

loadNotebooksToDashboard();
void initializeSupabaseCloud();

if ('serviceWorker' in navigator) {
    let hasControlledPage = Boolean(navigator.serviceWorker.controller);
    let isReloadingForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hasControlledPage) {
            hasControlledPage = true;
            return;
        }
        if (isReloadingForUpdate) return;
        isReloadingForUpdate = true;
        window.location.reload();
    });

    let serviceWorkerRegistration = null;
    const checkForAppUpdate = () => {
        if (!navigator.onLine || !serviceWorkerRegistration) return;
        serviceWorkerRegistration.update().catch(error => {
            console.warn('Nach App-Updates konnte nicht gesucht werden:', error);
        });
    };

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
            .then(registration => {
                serviceWorkerRegistration = registration;
                console.log('Service Worker erfolgreich registriert:', registration);
                checkForAppUpdate();
            })
            .catch(err => console.log('Service Worker Fehler:', err));
    });
    window.addEventListener('online', checkForAppUpdate);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForAppUpdate();
    });
}
