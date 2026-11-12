// IndexedDB persistence for links between PDF text positions
function isValidCrossLinkAnchor(anchor) {
    return Boolean(anchor && typeof anchor === 'object'
        && ['string', 'number'].includes(typeof anchor.docId)
        && Number.isInteger(anchor.pageNumber) && anchor.pageNumber > 0
        && Array.isArray(anchor.rect) && anchor.rect.length === 4
        && anchor.rect.every(Number.isFinite));
}

async function saveDocumentCrossLink({ source, target, sourceText = '', targetText = '' }) {
    if (!isValidCrossLinkAnchor(source) || !isValidCrossLinkAnchor(target)) {
        throw new Error('Quelle und Ziel müssen gültige PDF-Seitenpositionen enthalten.');
    }
    await ensureNotebookStorage();
    const record = {
        id: `link-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        notebookId: String(source.docId),
        sourceDocId: String(source.docId),
        targetDocId: String(target.docId),
        source: {
            docId: String(source.docId),
            pageNumber: source.pageNumber,
            rect: [...source.rect]
        },
        target: {
            docId: String(target.docId),
            pageNumber: target.pageNumber,
            rect: [...target.rect]
        },
        sourceText,
        targetText,
        createdAt: new Date().toISOString()
    };
    await notebookDb.documentLinks.add(record);
    if (notebooks.some(notebook => String(notebook.id) === record.notebookId)) {
        saveNotebookMetadata(record.notebookId);
    }
    return record;
}

async function listDocumentCrossLinks(limit = 100) {
    await ensureNotebookStorage();
    return notebookDb.documentLinks.orderBy('createdAt').reverse().limit(limit).toArray();
}

async function getDocumentCrossLink(id) {
    await ensureNotebookStorage();
    return notebookDb.documentLinks.get(id);
}
