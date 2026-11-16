// Application startup and service worker registration
notebookStorageReady = initializeNotebookStorage().catch(error => {
    notebookStorageError = error;
    console.error('IndexedDB für Notizen konnte nicht initialisiert werden:', error);
    return false;
});
void notebookStorageReady.then(ready => ready && renderCloudSyncConflicts())
    .catch(error => console.error('Synchronisierungskonflikte konnten nicht geladen werden:', error));

loadNotebooksToDashboard();
renderTrash();
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

void initializeFlashcards();

async function initializeDedicatedPage() {
    const page = document.body.dataset.page;
    if (page === 'notebook') {
        const params = new URLSearchParams(window.location.search);
        const id = Number(params.get('id'));
        if (!Number.isFinite(id)) throw new Error('Das Notizbuch konnte nicht bestimmt werden.');
        if (!await notebookStorageReady) throw notebookStorageError || new Error('Notizbücher sind nicht verfügbar.');
        await openNotebook(id);
        if (String(currentNotebookId) !== String(id)) throw new Error('Das Notizbuch wurde nicht geöffnet.');

        const pageIndex = Math.max(0, Number(params.get('page')) || 0);
        if (pageIndex) showNotebookPage(pageIndex);
        const matchIndex = Number(params.get('match'));
        const searchQuery = params.get('query') || '';
        if (matchIndex >= 0 && searchQuery) {
            const textarea = document.getElementById('notebookContent');
            if (textarea) {
                setEditorTool('text');
                textarea.focus();
                textarea.setSelectionRange(matchIndex, matchIndex + searchQuery.length);
            }
        }
        return;
    }

    if (page === 'whiteboard') {
        await openWhiteboard();
        return;
    }

    if (page === 'pdf-workspace') {
        await openPdfWorkspace();
        const citationId = sessionStorage.getItem('mynotes_pending_pdf_citation');
        if (citationId) {
            sessionStorage.removeItem('mynotes_pending_pdf_citation');
            const citation = await notebookDb.pdfCitations.get(citationId);
            if (!citation) throw new Error('Die ausgewählte Zitatkarte wurde nicht gefunden.');
            await openPdfWorkspaceAnchor(citation);
        }
    }
}

void initializeDedicatedPage().catch(error => {
    console.error('Arbeitsbereich konnte nicht geöffnet werden:', error);
    if (document.body.dataset.page === 'pdf-workspace') {
        setPdfWorkspaceStatus(`Arbeitsbereich konnte nicht geöffnet werden: ${error.message || error}`);
    } else if (document.body.dataset.page === 'whiteboard') {
        setWhiteboardStatus(`Arbeitsbereich konnte nicht geöffnet werden: ${error.message || error}`);
    } else {
        const message = document.createElement('p');
        message.setAttribute('role', 'alert');
        message.textContent = `Arbeitsbereich konnte nicht geöffnet werden: ${error.message || error}`;
        document.querySelector('main')?.replaceChildren(message);
    }
});
