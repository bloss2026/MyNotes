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
