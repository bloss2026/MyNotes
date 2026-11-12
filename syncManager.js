// Supabase authentication, durable sync queue, and conflict resolution
const CLOUD_USER_DATA_NOTEBOOK_PREFIX = '__mynotes_user_data_v1__:';

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
    document.getElementById('cloudAuthModal')?.classList.add('hidden');
}

function setCloudLoginRequired(required) {
    cloudLoginRequired = required;
    document.getElementById('cloudAuthClose')?.classList.remove('hidden');
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
            setCloudLoginRequired(false);
            closeCloudAuthModal();
            setCloudStatus('Lokaler Modus aktiv. Melde dich an, wenn du deine Notizen synchronisieren möchtest.');
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
        setCloudLoginRequired(false);
        setCloudStatus('Lokaler Modus aktiv. Supabase ist momentan nicht verfügbar.');
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
            setCloudStatus(`Supabase-Anmeldung fehlgeschlagen: ${error.message} Der lokale Modus bleibt verfügbar.`);
            setCloudLoginRequired(false);
            updateCloudAccountUi(null);
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
            setCloudLoginRequired(false);
            closeCloudAuthModal();
            setCloudStatus('Lokaler Modus aktiv. Melde dich an, wenn du deine Notizen synchronisieren möchtest.');
        }
        bindSupabaseAuthState();
    } catch (error) {
        console.error('Supabase konnte nicht initialisiert werden:', error);
        setCloudStatus(`Supabase konnte nicht initialisiert werden: ${error.message || error}`);
        setCloudLoginRequired(false);
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
document.getElementById('cloudConflictsButton')?.addEventListener('click', async () => {
    await renderCloudSyncConflicts();
    document.getElementById('syncConflictModal')?.classList.remove('hidden');
});
document.getElementById('syncConflictClose')?.addEventListener('click', () => {
    document.getElementById('syncConflictModal')?.classList.add('hidden');
});
document.getElementById('syncConflictModal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) event.currentTarget.classList.add('hidden');
});
document.getElementById('syncConflictList')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-conflict-action]');
    if (!button) return;
    void resolveCloudSyncConflict(button.dataset.notebookId, button.dataset.conflictAction)
        .catch(error => {
            console.error('Synchronisierungskonflikt konnte nicht aufgelöst werden:', error);
            setCloudStatus(`Konflikt konnte nicht aufgelöst werden: ${error.message || error}`);
        });
});
window.addEventListener('online', scheduleCloudSync);

function saveNotebookTombstones() {
    localStorage.setItem('mynotes_deleted_notebooks', JSON.stringify(notebookTombstones));
    if (!cloudSyncSuppression) {
        Object.keys(notebookTombstones).forEach(id => void enqueueNotebookSync(id, 'delete'));
    }
}

function saveNotebookPurgeTombstones() {
    localStorage.setItem('mynotes_purged_notebooks', JSON.stringify(notebookPurgeTombstones));
    if (!cloudSyncSuppression) {
        Object.keys(notebookPurgeTombstones).forEach(id => void enqueueNotebookSync(id, 'purge'));
    }
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

function cloudOriginalPdfPath(userId, notebookId) {
    return `${cloudPageFolder(userId, notebookId)}/original.pdf`;
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
    delete metadata.mynotesResearch;

    await ensureNotebookStorage();
    const notebookId = String(notebook.id);
    const [originalPdf, citations, documentLinks] = await Promise.all([
        notebookDb.pdfOriginals.get(notebookId),
        notebookDb.pdfCitations.where('notebookId').equals(notebookId).toArray(),
        notebookDb.documentLinks.where('sourceDocId').equals(notebookId).toArray()
    ]);
    const originalPdfPath = cloudOriginalPdfPath(userId, notebook.id);
    const storage = cloudClient.storage.from('mynotes-pages');
    let originalPdfMetadata = null;
    if (originalPdf?.blob) {
        const { error } = await storage.upload(originalPdfPath, originalPdf.blob, {
            contentType: originalPdf.mimeType || 'application/pdf',
            upsert: true
        });
        throwCloudError(error, `Original-PDF von „${notebook.title}“ konnte nicht hochgeladen werden`);
        originalPdfMetadata = {
            fileName: originalPdf.fileName || `${notebook.title || 'document'}.pdf`,
            mimeType: originalPdf.mimeType || 'application/pdf',
            updatedAt: originalPdf.updatedAt || updatedAt
        };
    } else {
        const { error } = await storage.remove([originalPdfPath]);
        throwCloudError(error, `Veraltetes Original-PDF von „${notebook.title}“ konnte nicht entfernt werden`);
    }
    metadata.mynotesResearch = {
        originalPdf: originalPdfMetadata,
        citations,
        documentLinks
    };

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
    const { mynotesResearch, ...notebookMetadata } = metadata;
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
    const notebookId = String(id);
    const notebook = {
        ...notebookMetadata,
        id,
        updatedAt: row.updated_at,
        pageCount: pages.length,
        pages
    };
    await notebookDb.pages.where('notebookId').equals(String(id)).delete();
    await notebookDb.pages.bulkPut(pages.map((page, pageIndex) => ({
        ...page,
        notebookId,
        pageIndex
    })));
    if (mynotesResearch && typeof mynotesResearch === 'object') {
        if (mynotesResearch.originalPdf) {
            const { data, error } = await cloudClient.storage
                .from('mynotes-pages')
                .download(cloudOriginalPdfPath(userId, id));
            throwCloudError(error, `Original-PDF von „${notebook.title}“ konnte nicht geladen werden`);
            await notebookDb.pdfOriginals.put({
                notebookId,
                fileName: mynotesResearch.originalPdf.fileName || `${notebook.title || 'document'}.pdf`,
                mimeType: mynotesResearch.originalPdf.mimeType || 'application/pdf',
                updatedAt: mynotesResearch.originalPdf.updatedAt || row.updated_at,
                blob: data
            });
        } else {
            await notebookDb.pdfOriginals.delete(notebookId);
        }

        if (Array.isArray(mynotesResearch.citations)) {
            await notebookDb.pdfCitations.where('notebookId').equals(notebookId).delete();
            if (mynotesResearch.citations.length) {
                await notebookDb.pdfCitations.bulkPut(mynotesResearch.citations.map(citation => ({
                    ...citation,
                    notebookId
                })));
            }
        }
        if (Array.isArray(mynotesResearch.documentLinks)) {
            await notebookDb.documentLinks.where('sourceDocId').equals(notebookId).delete();
            if (mynotesResearch.documentLinks.length) {
                await notebookDb.documentLinks.bulkPut(mynotesResearch.documentLinks.map(link => ({
                    ...link,
                    notebookId,
                    sourceDocId: notebookId
                })));
            }
        }
    }
    notebooks = notebooks.filter(item => String(item.id) !== String(id));
    notebooks.push(notebook);
    delete notebookTombstones[String(id)];
}

async function applyCloudNotebookDeletion(userId, row) {
    const id = /^\d+$/.test(row.notebook_id) ? Number(row.notebook_id) : row.notebook_id;
    const localNotebook = notebooks.find(item => String(item.id) === String(id));
    if (!localNotebook && row.page_count > 0) {
        await downloadCloudNotebook(userId, row);
    } else if (!localNotebook && row.metadata && Object.keys(row.metadata).length) {
        notebooks.push({
            ...row.metadata,
            id,
            updatedAt: row.updated_at,
            pageCount: row.page_count
        });
    }
    notebookTombstones[String(id)] = row.deleted_at || row.updated_at;
}

async function uploadCloudNotebookDeletion(notebookId, deletedAt, notebook, remote) {
    const pages = notebook ? await getPagesForCloud(notebook) : null;
    const metadata = notebook ? { ...notebook } : { ...(remote?.metadata || {}) };
    delete metadata.pages;
    const { error } = await cloudClient
        .from('mynotes_notebooks')
        .upsert({
            notebook_id: cloudNotebookId(notebookId),
            metadata,
            page_count: pages ? pages.length : remote?.page_count || 0,
            updated_at: deletedAt,
            deleted_at: deletedAt
        }, { onConflict: 'user_id,notebook_id' });
    throwCloudError(error, 'Notizbuch-Löschung konnte nicht synchronisiert werden');
}

async function uploadCloudNotebookPurge(userId, notebookId, purgedAt) {
    const { error } = await cloudClient
        .from('mynotes_notebooks')
        .upsert({
            notebook_id: cloudNotebookId(notebookId),
            metadata: { mynotes_permanently_deleted: true },
            page_count: 0,
            updated_at: purgedAt,
            deleted_at: purgedAt
        }, { onConflict: 'user_id,notebook_id' });
    throwCloudError(error, 'Endgültige Löschung konnte nicht synchronisiert werden');
    await removeCloudPageFiles(userId, notebookId);
    await notebookDb.pages.where('notebookId').equals(String(notebookId)).delete();
    await notebookDb.pdfOriginals.delete(String(notebookId));
}

async function recordCloudSyncFailure(error) {
    try {
        await ensureNotebookStorage();
        const now = Date.now();
        let queue = await notebookDb.syncQueue.toArray();
        if (!queue.some(item => item.id === 'sync:global')) {
            await notebookDb.syncQueue.put({
                id: 'sync:global',
                notebookId: '*',
                kind: 'sync',
                queuedAt: new Date().toISOString(),
                nextAttemptAt: now,
                attempts: 0,
                status: 'pending'
            });
            queue = await notebookDb.syncQueue.toArray();
        }
        let retryDelay = 300000;
        for (const item of queue) {
            if (item.status === 'conflict') continue;
            const attempts = (item.attempts || 0) + 1;
            const delay = Math.min(300000, 1000 * (2 ** Math.min(attempts, 8)));
            retryDelay = Math.min(retryDelay, delay);
            await notebookDb.syncQueue.put({
                ...item,
                attempts,
                nextAttemptAt: now + delay,
                lastError: error.message || String(error)
            });
        }
        return retryDelay;
    } catch (queueError) {
        console.error('Fehlerzustand konnte nicht in der Sync-Warteschlange gespeichert werden:', queueError);
        return 300000;
    }
}

async function renderCloudSyncConflicts() {
    if (!notebookDb) return;
    await ensureNotebookStorage();
    const conflicts = await notebookDb.syncConflicts.orderBy('detectedAt').toArray();
    const button = document.getElementById('cloudConflictsButton');
    const list = document.getElementById('syncConflictList');
    if (button) {
        button.textContent = `Synchronisierungskonflikte (${conflicts.length})`;
        button.classList.toggle('hidden', conflicts.length === 0);
    }
    if (!list) return;
    list.replaceChildren();
    conflicts.forEach(conflict => {
        const card = document.createElement('article');
        card.className = 'sync-conflict-card';
        const heading = document.createElement('h3');
        heading.textContent = conflict.title || `Notizbuch ${conflict.notebookId}`;
        const description = document.createElement('p');
        description.textContent = `Lokal geändert: ${new Date(conflict.localUpdatedAt).toLocaleString('de-DE')} · Cloud geändert: ${new Date(conflict.remoteUpdatedAt).toLocaleString('de-DE')}`;
        const actions = document.createElement('div');
        actions.className = 'sync-conflict-actions';
        const keepLocal = document.createElement('button');
        keepLocal.type = 'button';
        keepLocal.textContent = 'Lokale Version behalten';
        keepLocal.dataset.conflictAction = 'local';
        keepLocal.dataset.notebookId = String(conflict.notebookId);
        const keepCloud = document.createElement('button');
        keepCloud.type = 'button';
        keepCloud.textContent = 'Cloud-Version übernehmen';
        keepCloud.dataset.conflictAction = 'cloud';
        keepCloud.dataset.notebookId = String(conflict.notebookId);
        actions.append(keepLocal, keepCloud);
        card.append(heading, description, actions);
        list.appendChild(card);
    });
    if (!conflicts.length) list.textContent = 'Keine offenen Konflikte.';
}

async function resolveCloudSyncConflict(notebookId, choice) {
    if (!cloudSession || !navigator.onLine) {
        setCloudStatus('Zum Auflösen eines Konflikts wird eine Internetverbindung benötigt.');
        return;
    }
    const id = String(notebookId);
    const conflict = await notebookDb.syncConflicts.get(id);
    if (!conflict) return;
    if (choice === 'cloud') {
        if (conflict.remoteRow.deleted_at) {
            await applyCloudNotebookDeletion(cloudSession.user.id, conflict.remoteRow);
        } else {
            await downloadCloudNotebook(cloudSession.user.id, conflict.remoteRow);
        }
        const remoteTime = conflict.remoteRow.updated_at;
        await notebookDb.syncVersions.put({
            notebookId: id,
            localUpdatedAt: remoteTime,
            remoteUpdatedAt: remoteTime
        });
    } else {
        const local = notebooks.find(item => String(item.id) === id);
        if (!local) throw new Error('Die lokale Notizbuchversion wurde nicht gefunden.');
        local.updatedAt = new Date().toISOString();
        saveNotebookMetadata(id);
        await notebookDb.syncVersions.put({
            notebookId: id,
            localUpdatedAt: local.updatedAt,
            remoteUpdatedAt: conflict.remoteRow.updated_at
        });
    }
    await notebookDb.syncConflicts.delete(id);
    await notebookDb.syncQueue.delete(`conflict:${id}`);
    await renderCloudSyncConflicts();
    await syncCloudData();
}

function getCloudUserDataUpdatedAt(record) {
    const timestamp = Date.parse(record?.updatedAt || record?.createdAt || '');
    return Number.isFinite(timestamp) ? timestamp : 0;
}

async function applyCloudUserDataRecord(record) {
    const payload = record.payload && typeof record.payload === 'object' ? record.payload : {};
    const syncedRecord = {
        ...payload,
        id: record.record_id,
        updatedAt: record.updated_at,
        deletedAt: record.deleted_at || null
    };

    switch (record.data_type) {
        case 'flashcard_deck':
            await notebookDb.flashcardDecks.put(syncedRecord);
            return;
        case 'flashcard':
            await notebookDb.flashcards.put(syncedRecord);
            return;
        case 'pdf_workspace':
            await notebookDb.pdfWorkspace.put(syncedRecord);
            return;
        default:
            throw new Error(`Unbekannter synchronisierter Datentyp: ${record.data_type}`);
    }
}

async function syncCloudUserData(userId, cloudRows) {
    const [decks, flashcards, workspace] = await Promise.all([
        notebookDb.flashcardDecks.toArray(),
        notebookDb.flashcards.toArray(),
        notebookDb.pdfWorkspace.get('default')
    ]);

    const localRecords = new Map();
    const addLocalRecord = (dataType, record) => {
        if (record?.id === undefined || record?.id === null) {
            throw new Error(`Ein lokaler Datensatz vom Typ ${dataType} hat keine ID.`);
        }
        const key = `${dataType}:${String(record.id)}`;
        localRecords.set(key, {
            key,
            data_type: dataType,
            record_id: String(record.id),
            payload: record,
            updatedAt: record.updatedAt || record.createdAt || new Date(0).toISOString(),
            deletedAt: record.deletedAt || null
        });
    };
    decks.forEach(record => addLocalRecord('flashcard_deck', record));
    flashcards.forEach(record => addLocalRecord('flashcard', record));
    if (workspace) addLocalRecord('pdf_workspace', workspace);

    const remoteRecords = new Map((cloudRows || []).map(row => {
        const record = row.metadata?.mynotesUserDataRecord;
        if (row.metadata?.mynotes_system_record !== 'user-data-v1' ||
            !record || typeof record !== 'object' ||
            !['flashcard_deck', 'flashcard', 'pdf_workspace'].includes(record.data_type) ||
            record.record_id === undefined || record.record_id === null) {
            throw new Error(`Ungültiger Cloud-Datensatz ${row.notebook_id}.`);
        }
        return [
        `${record.data_type}:${String(record.record_id)}`,
        {
            ...record,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at
        }
        ];
    }));
    const keys = new Set([...localRecords.keys(), ...remoteRecords.keys()]);

    for (const key of keys) {
        const local = localRecords.get(key);
        const remote = remoteRecords.get(key);
        if (!local) {
            await applyCloudUserDataRecord(remote);
            continue;
        }

        const localTime = getCloudUserDataUpdatedAt(local);
        const remoteTime = Date.parse(remote?.updated_at || '') || 0;
        if (!remote || localTime > remoteTime) {
            const { error } = await cloudClient
                .from('mynotes_notebooks')
                .upsert({
                    notebook_id: `${CLOUD_USER_DATA_NOTEBOOK_PREFIX}${local.data_type}:${encodeURIComponent(local.record_id)}`,
                    metadata: {
                        mynotes_system_record: 'user-data-v1',
                        mynotesUserDataRecord: {
                            data_type: local.data_type,
                            record_id: local.record_id,
                            payload: local.payload
                        }
                    },
                    page_count: 0,
                    updated_at: local.updatedAt,
                    deleted_at: local.deletedAt
                }, { onConflict: 'user_id,notebook_id' });
            throwCloudError(error, `Datensatz ${local.data_type}/${local.record_id} konnte nicht synchronisiert werden`);
        } else {
            await applyCloudUserDataRecord(remote);
        }
    }
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

        const cloudUserDataRows = (remoteRows || [])
            .filter(row => String(row.notebook_id).startsWith(CLOUD_USER_DATA_NOTEBOOK_PREFIX));
        const remoteById = new Map((remoteRows || [])
            .filter(row => !String(row.notebook_id).startsWith(CLOUD_USER_DATA_NOTEBOOK_PREFIX))
            .map(row => [String(row.notebook_id), row]));
        const localById = new Map(notebooks.map(notebook => [String(notebook.id), notebook]));
        if (notebooks.some(notebook => String(notebook.id).startsWith(CLOUD_USER_DATA_NOTEBOOK_PREFIX))) {
            throw new Error('Eine lokale Notizbuch-ID verwendet ein reserviertes Präfix für interne Synchronisierungsdaten.');
        }
        const allIds = new Set([
            ...remoteById.keys(),
            ...localById.keys(),
            ...Object.keys(notebookTombstones),
            ...Object.keys(notebookPurgeTombstones)
        ]);
        const changedNotebookIds = new Set();
        cloudSyncSuppression += 1;
        try {
            for (const id of allIds) {
                const remote = remoteById.get(id);
                const local = localById.get(id);
                const deletedAt = notebookTombstones[id];
                const remoteTime = Date.parse(remote?.updated_at || '') || 0;
                const purgedAt = notebookPurgeTombstones[id];
                const remotelyPurged = remote?.metadata?.mynotes_permanently_deleted === true;

                if (await notebookDb.syncConflicts.get(id)) {
                    continue;
                }
                if (local && remote) {
                    const version = await notebookDb.syncVersions.get(id);
                    const localTime = Date.parse(local.updatedAt || '') || 0;
                    const priorLocalTime = Date.parse(version?.localUpdatedAt || '') || 0;
                    const priorRemoteTime = Date.parse(version?.remoteUpdatedAt || '') || 0;
                    if (version && localTime > priorLocalTime && remoteTime > priorRemoteTime) {
                        await notebookDb.syncConflicts.put({
                            notebookId: id,
                            title: local.title || remote.metadata?.title || `Notizbuch ${id}`,
                            localUpdatedAt: local.updatedAt,
                            remoteUpdatedAt: remote.updated_at,
                            remoteRow: remote,
                            detectedAt: new Date().toISOString()
                        });
                        continue;
                    }
                }

                if (purgedAt || remotelyPurged) {
                    const localPurgeTime = Date.parse(purgedAt || '') || 0;
                    const winningPurge = remotelyPurged && remoteTime > localPurgeTime
                        ? remote.updated_at
                        : purgedAt || remote?.updated_at || new Date().toISOString();
                    notebookPurgeTombstones[id] = winningPurge;
                    delete notebookTombstones[id];
                    notebooks = notebooks.filter(item => String(item.id) !== id);
                    const winningPurgeTime = Date.parse(winningPurge) || 0;
                    if (!remotelyPurged || remoteTime < winningPurgeTime) {
                        await uploadCloudNotebookPurge(userId, id, winningPurge);
                    } else {
                        await removeCloudPageFiles(userId, id);
                        await notebookDb.pages.where('notebookId').equals(id).delete();
                        await notebookDb.pdfOriginals.delete(id);
                    }
                    continue;
                }

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
                            await uploadCloudNotebookDeletion(id, winningDelete, local, remote);
                        }
                        notebookTombstones[id] = winningDelete;
                    }
                    const baseline = notebookTombstones[id] || local?.updatedAt || remote?.updated_at;
                    if (baseline) {
                        await notebookDb.syncVersions.put({
                            notebookId: id,
                            localUpdatedAt: baseline,
                            remoteUpdatedAt: baseline
                        });
                    }
                    continue;
                }

                if (local && remote) {
                    const localTime = Date.parse(local.updatedAt || '') || 0;
                    if (remote.deleted_at) {
                        if (localTime > remoteTime) await uploadCloudNotebook(userId, local);
                        else {
                            await applyCloudNotebookDeletion(userId, remote);
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
                    await applyCloudNotebookDeletion(userId, remote);
                    changedNotebookIds.add(id);
                } else if (remote) {
                    await downloadCloudNotebook(userId, remote);
                    changedNotebookIds.add(id);
                }
                const currentLocal = notebooks.find(item => String(item.id) === id);
                const baseline = notebookTombstones[id] || currentLocal?.updatedAt || remote?.updated_at;
                if (baseline) {
                    await notebookDb.syncVersions.put({
                        notebookId: id,
                        localUpdatedAt: baseline,
                        remoteUpdatedAt: baseline
                    });
                }
            }
        } finally {
            saveNotebookTombstones();
            saveNotebookPurgeTombstones();
            saveNotebookMetadata();
            cloudSyncSuppression -= 1;
        }
        await syncCloudUserData(userId, cloudUserDataRows);
        const pendingConflicts = await notebookDb.syncConflicts.toArray();
        await notebookDb.syncQueue.clear();
        for (const conflict of pendingConflicts) {
            const conflictId = String(conflict.notebookId);
            await notebookDb.syncQueue.put({
                id: `conflict:${conflictId}`,
                notebookId: conflictId,
                kind: 'conflict',
                queuedAt: conflict.detectedAt,
                nextAttemptAt: null,
                attempts: 0,
                status: 'conflict'
            });
        }
        await renderCloudSyncConflicts();
        loadNotebooksToDashboard();
        renderTrash();
        if (currentNotebookId !== null && changedNotebookIds.has(String(currentNotebookId))) {
            if (notebooks.some(notebook => String(notebook.id) === String(currentNotebookId)) &&
                !notebookTombstones[String(currentNotebookId)]) {
                await openNotebook(currentNotebookId);
            } else {
                location.reload();
                return true;
            }
        }
        if (pendingConflicts.length) {
            setCloudStatus(`${pendingConflicts.length} Synchronisierungskonflikt${pendingConflicts.length === 1 ? '' : 'e'} müssen aufgelöst werden.`);
        } else {
            setCloudStatus(`Synchronisiert um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.`);
        }
        return true;
    })();

    try {
        return await cloudSyncTask;
    } catch (error) {
        console.error('Supabase-Synchronisierung fehlgeschlagen:', error);
        setCloudStatus(`Synchronisierung fehlgeschlagen: ${error.message || error}`);
        const retryDelay = await recordCloudSyncFailure(error);
        if (cloudSession && navigator.onLine) {
            window.clearTimeout(cloudSyncTimer);
            cloudSyncTimer = window.setTimeout(() => void syncCloudData(), retryDelay);
        }
        return false;
    } finally {
        cloudSyncTask = null;
    }
}

