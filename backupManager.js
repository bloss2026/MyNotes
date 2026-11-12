const BACKUP_FORMAT = 'mynotes-backup';
const BACKUP_VERSION = 4;

function openAudioDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('mynotes-audio', 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains('recordings')) {
                request.result.createObjectStore('recordings', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Audiodatenbank konnte nicht geöffnet werden.'));
    });
}

function readAudioRecordings() {
    return openAudioDatabase().then(database => new Promise((resolve, reject) => {
        const request = database.transaction('recordings', 'readonly').objectStore('recordings').getAll();
        request.onsuccess = () => {
            database.close();
            resolve(request.result || []);
        };
        request.onerror = () => {
            database.close();
            reject(request.error || new Error('Audioaufnahmen konnten nicht gelesen werden.'));
        };
    }));
}

function writeAudioRecordings(records) {
    if (!records.length) return Promise.resolve(0);
    return openAudioDatabase().then(database => new Promise((resolve, reject) => {
        const transaction = database.transaction('recordings', 'readwrite');
        const store = transaction.objectStore('recordings');
        records.forEach(record => store.put(record));
        transaction.oncomplete = () => {
            database.close();
            resolve(records.length);
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error('Audioaufnahmen konnten nicht wiederhergestellt werden.'));
        };
        transaction.onabort = () => {
            database.close();
            reject(transaction.error || new Error('Wiederherstellung der Audioaufnahmen wurde abgebrochen.'));
        };
    }));
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Audiodatei konnte nicht gelesen werden.'));
        reader.readAsDataURL(blob);
    });
}

function dataUrlToBlob(dataUrl) {
    const match = /^data:([^,]*);base64,([A-Za-z0-9+/=]*)$/.exec(dataUrl);
    if (!match) throw new Error('Eine Audioaufnahme im Backup hat ein ungültiges Datenformat.');
    const bytes = Uint8Array.from(atob(match[2]), character => character.charCodeAt(0));
    return new Blob([bytes], { type: match[1].split(';')[0] || 'application/octet-stream' });
}

export async function createBackupData({ db, notebooks, folders, preferences }) {
    const [pages, flashcardDecks, flashcards, recordings, pdfOriginals, pdfCitations, documentLinks, pdfWorkspace, syncQueue] = await Promise.all([
        db.pages.toArray(),
        db.flashcardDecks.toArray(),
        db.flashcards.toArray(),
        readAudioRecordings(),
        db.pdfOriginals.toArray(),
        db.pdfCitations.toArray(),
        db.documentLinks.toArray(),
        db.pdfWorkspace.toArray(),
        db.syncQueue.toArray()
    ]);
    const audioRecords = await Promise.all(recordings.map(async record => ({
        ...record,
        blob: undefined,
        blobDataUrl: await blobToDataUrl(record.blob)
    })));
    const originalPdfs = await Promise.all(pdfOriginals.map(async record => ({
        ...record,
        blob: undefined,
        blobDataUrl: await blobToDataUrl(record.blob)
    })));

    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        notebooks: notebooks.map(notebook => {
            const { pages: ignoredPages, ...metadata } = notebook;
            return metadata;
        }),
        pages,
        folders: [...new Set(folders.filter(folder => typeof folder === 'string'))],
        preferences,
        flashcardDecks,
        flashcards,
        audioRecords,
        pdfOriginals: originalPdfs,
        pdfCitations,
        documentLinks,
        pdfWorkspace,
        syncQueue
    };
}

export async function downloadBackup(options) {
    const backup = await createBackupData(options);
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mynotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return backup;
}

function validateBackup(data) {
    if (!data || data.format !== BACKUP_FORMAT || ![1, 2, 3, BACKUP_VERSION].includes(data.version)) {
        throw new Error('Diese Datei ist kein unterstütztes MyNotes-Backup.');
    }
    for (const key of ['notebooks', 'pages', 'folders', 'flashcardDecks', 'flashcards', 'audioRecords']) {
        if (!Array.isArray(data[key])) throw new Error(`Das Backup enthält keine gültige Liste „${key}“.`);
    }
    if (data.version < 2 && data.pdfOriginals === undefined) data.pdfOriginals = [];
    if (!Array.isArray(data.pdfOriginals)) throw new Error('Das Backup enthält keine gültige Liste „pdfOriginals“.');
    if (data.pdfCitations === undefined && data.version < 3) data.pdfCitations = [];
    if (data.documentLinks === undefined && data.version < 3) data.documentLinks = [];
    if (data.pdfWorkspace === undefined && data.version < 3) data.pdfWorkspace = [];
    if (data.syncQueue === undefined && data.version < 4) data.syncQueue = [];
    for (const key of ['pdfCitations', 'documentLinks', 'pdfWorkspace', 'syncQueue']) {
        if (!Array.isArray(data[key])) throw new Error(`Das Backup enthält keine gültige Liste „${key}“.`);
    }
    const notebookIds = new Set();
    data.notebooks.forEach(notebook => {
        if (!notebook || typeof notebook !== 'object' || Array.isArray(notebook)
            || !['string', 'number'].includes(typeof notebook.id)) {
            throw new Error('Das Backup enthält ein Notizbuch ohne ID.');
        }
        const id = String(notebook.id);
        if (notebookIds.has(id)) throw new Error('Das Backup enthält doppelte Notizbuch-IDs.');
        notebookIds.add(id);
    });
    const pageIds = new Set();
    data.pages.forEach(page => {
        if (!page || typeof page !== 'object' || !['string', 'number'].includes(typeof page.notebookId)
            || !Number.isInteger(page.pageIndex) || page.pageIndex < 0) {
            throw new Error('Das Backup enthält ungültige Seitendaten.');
        }
        const id = `${page.notebookId}:${page.pageIndex}`;
        if (pageIds.has(id)) throw new Error('Das Backup enthält doppelte Seiten.');
        pageIds.add(id);
    });
    for (const [collectionName, key] of [['flashcardDecks', 'id'], ['flashcards', 'id']]) {
        const ids = new Set();
        data[collectionName].forEach(record => {
            if (!record || typeof record !== 'object' || !['string', 'number'].includes(typeof record[key])) {
                throw new Error(`Das Backup enthält ungültige Einträge in „${collectionName}“.`);
            }
            const id = String(record[key]);
            if (ids.has(id)) throw new Error(`Das Backup enthält doppelte IDs in „${collectionName}“.`);
            ids.add(id);
        });
    }
    const audioIds = new Set();
    data.audioRecords.forEach(record => {
        if (!record || typeof record !== 'object'
            || !['string', 'number'].includes(typeof record.id)
            || !['string', 'number'].includes(typeof record.notebookId)
            || typeof record.blobDataUrl !== 'string') {
            throw new Error('Das Backup enthält eine ungültige Audioaufnahme.');
        }
        const id = String(record.id);
        if (audioIds.has(id)) throw new Error('Das Backup enthält doppelte Audioaufnahmen.');
        audioIds.add(id);
    });
    const originalPdfIds = new Set();
    data.pdfOriginals.forEach(record => {
        if (!record || typeof record !== 'object'
            || !['string', 'number'].includes(typeof record.notebookId)
            || typeof record.fileName !== 'string'
            || typeof record.blobDataUrl !== 'string') {
            throw new Error('Das Backup enthält eine ungültige Original-PDF-Datei.');
        }
        const id = String(record.notebookId);
        if (originalPdfIds.has(id)) throw new Error('Das Backup enthält doppelte Original-PDF-Dateien.');
        originalPdfIds.add(id);
    });
    for (const collectionName of ['pdfCitations', 'documentLinks', 'pdfWorkspace', 'syncQueue']) {
        const ids = new Set();
        data[collectionName].forEach(record => {
            if (!record || typeof record !== 'object'
                || typeof record.id !== 'string'
                || (collectionName === 'syncQueue' && typeof record.notebookId !== 'string')) {
                throw new Error(`Das Backup enthält ungültige Einträge in „${collectionName}“.`);
            }
            if (ids.has(record.id)) throw new Error(`Das Backup enthält doppelte IDs in „${collectionName}“.`);
            ids.add(record.id);
        });
    }
    data.pdfCitations.forEach(citation => {
        if (!['string', 'number'].includes(typeof citation.notebookId)
            || !['string', 'number'].includes(typeof citation.docId)
            || !Number.isInteger(citation.pageNumber) || citation.pageNumber < 1
            || typeof citation.text !== 'string'
            || !Array.isArray(citation.rect) || citation.rect.length !== 4
            || !citation.rect.every(Number.isFinite)
            || !Array.isArray(citation.tags) || !citation.tags.every(tag => typeof tag === 'string')) {
            throw new Error('Das Backup enthält eine ungültige Zitatkarte.');
        }
    });
    const isPdfAnchor = anchor => anchor && typeof anchor === 'object'
        && ['string', 'number'].includes(typeof anchor.docId)
        && Number.isInteger(anchor.pageNumber) && anchor.pageNumber > 0
        && Array.isArray(anchor.rect) && anchor.rect.length === 4
        && anchor.rect.every(Number.isFinite);
    data.documentLinks.forEach(link => {
        if (!['string', 'number'].includes(typeof link.notebookId)
            || !isPdfAnchor(link.source) || !isPdfAnchor(link.target)) {
            throw new Error('Das Backup enthält eine ungültige Dokumentverknüpfung.');
        }
    });
    data.pdfWorkspace.forEach(workspace => {
        if (!Array.isArray(workspace.documents)
            || !workspace.documents.every(item => item && typeof item === 'object'
                && ['string', 'number'].includes(typeof item.docId)
                && Number.isInteger(item.pageNumber) && item.pageNumber > 0
                && Number.isFinite(item.zoom))) {
            throw new Error('Das Backup enthält ungültige PDF-Arbeitsbereichseinstellungen.');
        }
    });
    return data;
}

export async function restoreBackup(file, { db, existingNotebooks, confirmImport, onImported }) {
    const data = validateBackup(JSON.parse(await file.text()));
    const existingIds = new Set(existingNotebooks.map(notebook => String(notebook.id)));
    const newNotebooks = data.notebooks.filter(notebook => !existingIds.has(String(notebook.id)));
    const newIds = new Set(newNotebooks.map(notebook => String(notebook.id)));
    const newPages = data.pages
        .filter(page => newIds.has(String(page.notebookId)))
        .map(page => ({ ...page, notebookId: String(page.notebookId) }));
    const newOriginalPdfs = data.pdfOriginals
        .filter(record => newIds.has(String(record.notebookId)))
        .map(({ blobDataUrl, ...record }) => ({
            ...record,
            notebookId: String(record.notebookId),
            blob: dataUrlToBlob(blobDataUrl)
        }));
    const newPdfCitations = data.pdfCitations.filter(record => newIds.has(String(record.notebookId)));
    const newDocumentLinks = data.documentLinks.filter(record => newIds.has(String(record.notebookId)));
    const newPdfWorkspace = data.pdfWorkspace
        .map(record => ({
            ...record,
            documents: Array.isArray(record.documents)
                ? record.documents.filter(document => newIds.has(String(document.docId)))
                : []
        }))
        .filter(record => record.documents.length);
    const newSyncQueue = data.syncQueue.filter(record =>
        record.status !== 'conflict' && newIds.has(String(record.notebookId))
    );
    const folders = [...new Set(data.folders.filter(folder => typeof folder === 'string'))];
    const existingDeckIds = new Set((await db.flashcardDecks.toArray()).map(deck => String(deck.id)));
    const newDecks = data.flashcardDecks.filter(deck => !existingDeckIds.has(String(deck.id)));
    const newDeckIds = new Set(newDecks.map(deck => String(deck.id)));
    const existingCardIds = new Set((await db.flashcards.toArray()).map(card => String(card.id)));
    const newCards = data.flashcards.filter(card =>
        newDeckIds.has(String(card.deckId)) && !existingCardIds.has(String(card.id))
    );
    const summary = {
        notebooks: newNotebooks.length,
        pages: newPages.length,
        originalPdfs: newOriginalPdfs.length,
        citations: newPdfCitations.length,
        documentLinks: newDocumentLinks.length,
        pendingSyncOperations: newSyncQueue.length,
        decks: newDecks.length,
        cards: newCards.length,
        recordings: data.audioRecords.filter(record => newIds.has(String(record.notebookId))).length
    };
    if (!await confirmImport(summary)) return { cancelled: true, ...summary };

    await db.transaction('rw', db.pages, db.flashcardDecks, db.flashcards, db.pdfOriginals,
        db.pdfCitations, db.documentLinks, db.pdfWorkspace, db.syncQueue, async () => {
        if (newPages.length) await db.pages.bulkPut(newPages);
        if (newDecks.length) await db.flashcardDecks.bulkAdd(newDecks);
        if (newCards.length) await db.flashcards.bulkAdd(newCards);
        if (newOriginalPdfs.length) await db.pdfOriginals.bulkAdd(newOriginalPdfs);
        if (newPdfCitations.length) await db.pdfCitations.bulkAdd(newPdfCitations);
        if (newDocumentLinks.length) await db.documentLinks.bulkAdd(newDocumentLinks);
        if (newPdfWorkspace.length) await db.pdfWorkspace.bulkPut(newPdfWorkspace);
        if (newSyncQueue.length) await db.syncQueue.bulkAdd(newSyncQueue);
    });

    let restoredRecordings = 0;
    try {
        const existingRecordings = new Set((await readAudioRecordings()).map(record => String(record.id)));
        const recordings = data.audioRecords
            .filter(record => newIds.has(String(record.notebookId)) && !existingRecordings.has(String(record.id)))
            .map(({ blobDataUrl, ...record }) => ({ ...record, blob: dataUrlToBlob(blobDataUrl) }));
        restoredRecordings = await writeAudioRecordings(recordings);
    } catch (error) {
        await onImported({ notebooks: newNotebooks, folders, preferences: data.preferences });
        throw new Error(`Notizbücher und Seiten wurden importiert, Audio konnte jedoch nicht vollständig wiederhergestellt werden: ${error.message}`);
    }

    await onImported({ notebooks: newNotebooks, folders, preferences: data.preferences });
    return {
        cancelled: false,
        notebooks: newNotebooks.length,
        pages: newPages.length,
        originalPdfs: newOriginalPdfs.length,
        citations: newPdfCitations.length,
        documentLinks: newDocumentLinks.length,
        pendingSyncOperations: newSyncQueue.length,
        decks: newDecks.length,
        cards: newCards.length,
        recordings: restoredRecordings,
        skippedNotebooks: data.notebooks.length - newNotebooks.length
    };
}
