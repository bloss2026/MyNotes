// Local multi-PDF workspace, citation cards, and position-aware document links
let pdfWorkspaceDocuments = [];
let pdfWorkspacePdfCache = new Map();
let pdfWorkspacePendingLinkSource = null;
let pdfWorkspacePendingCitation = null;

function setPdfWorkspaceStatus(message) {
    const status = document.getElementById('pdfWorkspaceStatus');
    if (status) status.textContent = message;
}

function createPdfWorkspaceId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getPdfWorkspacePdf(docId) {
    const key = String(docId);
    if (!pdfWorkspacePdfCache.has(key)) {
        const loading = (async () => {
            const original = await notebookDb.pdfOriginals.get(key);
            if (!original?.blob) throw new Error('Das Original-PDF wurde nicht gefunden.');
            if (!window.pdfjsLib) throw new Error('PDF.js ist nicht verfügbar.');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            return pdfjsLib.getDocument({ data: new Uint8Array(await original.blob.arrayBuffer()) }).promise;
        })();
        pdfWorkspacePdfCache.set(key, loading);
        loading.catch(() => pdfWorkspacePdfCache.delete(key));
    }
    return pdfWorkspacePdfCache.get(key);
}

async function persistPdfWorkspace() {
    await ensureNotebookStorage();
    await notebookDb.pdfWorkspace.put({
        id: 'default',
        documents: pdfWorkspaceDocuments.map(({ docId, pageNumber, zoom }) => ({
            docId: String(docId),
            pageNumber,
            zoom
        })),
        updatedAt: new Date().toISOString()
    });
    scheduleCloudSync();
}

async function openPdfWorkspace() {
    const modal = document.getElementById('pdfWorkspaceModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    setPdfWorkspaceStatus('PDF-Dokumente werden geladen …');
    try {
        await ensureNotebookStorage();
        const [originals, savedWorkspace] = await Promise.all([
            notebookDb.pdfOriginals.toArray(),
            notebookDb.pdfWorkspace.get('default')
        ]);
        const available = originals
            .filter(original => notebooks.some(notebook => String(notebook.id) === String(original.notebookId)))
            .map(original => {
                const notebook = notebooks.find(item => String(item.id) === String(original.notebookId));
                return {
                    docId: String(original.notebookId),
                    title: notebook?.title || original.fileName || 'PDF-Dokument'
                };
            });
        const select = document.getElementById('pdfWorkspaceDocumentSelect');
        select.replaceChildren();
        available.forEach(item => {
            const option = document.createElement('option');
            option.value = item.docId;
            option.textContent = item.title;
            select.appendChild(option);
        });
        const availableIds = new Set(available.map(item => item.docId));
        const storedDocs = (savedWorkspace?.documents || [])
            .filter(item => availableIds.has(String(item.docId)))
            .map(item => ({
                docId: String(item.docId),
                title: available.find(doc => doc.docId === String(item.docId)).title,
                pageNumber: Math.max(1, Number(item.pageNumber) || 1),
                zoom: Math.min(2, Math.max(0.6, Number(item.zoom) || 1))
            }));
        pdfWorkspaceDocuments = storedDocs.length
            ? storedDocs
            : available.slice(0, 1).map(item => ({ ...item, pageNumber: 1, zoom: 1 }));
        renderPdfWorkspaceDocuments();
        await renderPdfWorkspaceSavedItems();
        setPdfWorkspaceStatus(available.length
            ? `${available.length} lokal gespeicherte Original-PDF${available.length === 1 ? '' : 's'} verfügbar.`
            : 'Noch keine Original-PDFs. Importiere zuerst ein PDF-Dokument.');
        await persistPdfWorkspace();
    } catch (error) {
        console.error('PDF-Arbeitsbereich konnte nicht geladen werden:', error);
        setPdfWorkspaceStatus(`PDF-Arbeitsbereich konnte nicht geladen werden: ${error.message || error}`);
    }
}

function closePdfWorkspace() {
    document.getElementById('pdfWorkspaceModal')?.classList.add('hidden');
}

async function addPdfWorkspaceDocument(docId) {
    const key = String(docId || '');
    if (!key || pdfWorkspaceDocuments.some(item => String(item.docId) === key)) return;
    const notebook = notebooks.find(item => String(item.id) === key);
    if (!notebook) {
        setPdfWorkspaceStatus('Das ausgewählte Dokument wurde nicht gefunden.');
        return;
    }
    try {
        await getPdfWorkspacePdf(key);
        pdfWorkspaceDocuments.push({ docId: key, title: notebook.title || 'PDF-Dokument', pageNumber: 1, zoom: 1 });
        renderPdfWorkspaceDocuments();
        await persistPdfWorkspace();
        setPdfWorkspaceStatus(`„${notebook.title}“ wurde geöffnet.`);
    } catch (error) {
        console.error('PDF konnte nicht im Arbeitsbereich geöffnet werden:', error);
        setPdfWorkspaceStatus(`PDF konnte nicht geöffnet werden: ${error.message || error}`);
    }
}

function createPdfWorkspaceButton(label, action, docId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.docId = String(docId);
    return button;
}

function renderPdfWorkspaceDocuments() {
    const container = document.getElementById('pdfWorkspaceDocuments');
    if (!container) return;
    container.replaceChildren();
    if (!pdfWorkspaceDocuments.length) {
        const empty = document.createElement('p');
        empty.className = 'pdf-workspace-empty';
        empty.textContent = 'Wähle oben ein PDF aus, um es hier zu öffnen.';
        container.appendChild(empty);
        return;
    }

    pdfWorkspaceDocuments.forEach(state => {
        const panel = document.createElement('article');
        panel.className = 'pdf-workspace-document';
        panel.dataset.docId = String(state.docId);
        const header = document.createElement('header');
        header.className = 'pdf-workspace-document-header';
        const title = document.createElement('span');
        title.className = 'pdf-workspace-document-title';
        title.textContent = state.title;
        const actions = document.createElement('div');
        actions.className = 'pdf-workspace-document-actions';
        actions.append(
            createPdfWorkspaceButton('←', 'move-left', state.docId),
            createPdfWorkspaceButton('→', 'move-right', state.docId),
            createPdfWorkspaceButton('Schließen', 'close-document', state.docId)
        );
        header.append(title, actions);

        const controls = document.createElement('div');
        controls.className = 'pdf-workspace-page-control';
        const previous = createPdfWorkspaceButton('‹', 'previous-page', state.docId);
        const pageInput = document.createElement('input');
        pageInput.type = 'number';
        pageInput.min = '1';
        pageInput.value = String(state.pageNumber);
        pageInput.setAttribute('aria-label', `Seite in ${state.title}`);
        pageInput.dataset.action = 'page-number';
        pageInput.dataset.docId = String(state.docId);
        const next = createPdfWorkspaceButton('›', 'next-page', state.docId);
        const zoom = document.createElement('input');
        zoom.type = 'range';
        zoom.min = '0.6';
        zoom.max = '2';
        zoom.step = '0.1';
        zoom.value = String(state.zoom);
        zoom.setAttribute('aria-label', `Zoom für ${state.title}`);
        zoom.dataset.action = 'zoom';
        zoom.dataset.docId = String(state.docId);
        const quote = createPdfWorkspaceButton('Zitat speichern', 'quote', state.docId);
        const ocr = createPdfWorkspaceButton('OCR-Seite', 'ocr', state.docId);
        const source = createPdfWorkspaceButton('Link-Quelle', 'link-source', state.docId);
        const target = createPdfWorkspaceButton('Link-Ziel', 'link-target', state.docId);
        controls.append(previous, pageInput, next, zoom, quote, ocr, source, target);

        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-workspace-page-container';
        panel.append(header, controls, pageContainer);
        container.appendChild(panel);
        state.pageContainer = pageContainer;
        void renderPdfWorkspacePage(state, panel);
    });
}

async function renderPdfWorkspacePage(state, panel) {
    const token = (state.renderToken || 0) + 1;
    state.renderToken = token;
    const pageContainer = state.pageContainer;
    if (!pageContainer) return;
    pageContainer.textContent = 'PDF-Seite wird gerendert …';
    try {
        const pdf = await getPdfWorkspacePdf(state.docId);
        state.pageNumber = Math.min(pdf.numPages, Math.max(1, state.pageNumber));
        const pdfPage = await pdf.getPage(state.pageNumber);
        const viewport = pdfPage.getViewport({ scale: state.zoom });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF-Seite konnte nicht dargestellt werden.');
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        if (state.renderToken !== token || !panel.isConnected) return;

        const stage = document.createElement('div');
        stage.className = 'pdf-workspace-page-stage';
        stage.appendChild(canvas);
        const textLayer = document.createElement('div');
        textLayer.className = 'pdf-workspace-text-layer';
        const textContent = await pdfPage.getTextContent();
        const styles = textContent.styles || {};
        textContent.items.forEach(item => {
            if (typeof item.str !== 'string' || !item.str) return;
            const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const fontHeight = Math.hypot(transform[2], transform[3]);
            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.left = `${transform[4]}px`;
            span.style.top = `${transform[5] - fontHeight}px`;
            span.style.fontSize = `${fontHeight}px`;
            span.style.fontFamily = styles[item.fontName]?.fontFamily || 'sans-serif';
            span.style.transform = `rotate(${Math.atan2(transform[1], transform[0])}rad)`;
            textLayer.appendChild(span);
        });
        stage.appendChild(textLayer);
        pageContainer.replaceChildren(stage);
        state.viewport = viewport;
        state.pageWidth = viewport.width;
        state.pageHeight = viewport.height;
        if (state.highlightRect) {
            addPdfWorkspaceHighlight(stage, viewport, state.highlightRect);
            state.highlightRect = null;
        }
        const pageInput = panel.querySelector('[data-action="page-number"]');
        if (pageInput) pageInput.max = String(pdf.numPages);
        pdfPage.cleanup();
    } catch (error) {
        if (state.renderToken !== token) return;
        console.error('PDF-Seite konnte nicht gerendert werden:', error);
        pageContainer.textContent = `PDF-Seite konnte nicht gerendert werden: ${error.message || error}`;
    }
}

function addPdfWorkspaceHighlight(stage, viewport, rect) {
    const first = viewport.convertToViewportPoint(rect[0], rect[1]);
    const second = viewport.convertToViewportPoint(rect[2], rect[3]);
    const highlight = document.createElement('div');
    highlight.className = 'pdf-workspace-highlight';
    highlight.style.left = `${Math.min(first[0], second[0])}px`;
    highlight.style.top = `${Math.min(first[1], second[1])}px`;
    highlight.style.width = `${Math.max(8, Math.abs(second[0] - first[0]))}px`;
    highlight.style.height = `${Math.max(8, Math.abs(second[1] - first[1]))}px`;
    stage.appendChild(highlight);
}

function getPdfWorkspaceSelectionAnchor(state) {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const stage = state.pageContainer?.querySelector('.pdf-workspace-page-stage');
    if (!range || selection.isCollapsed || !stage || !stage.contains(range.commonAncestorContainer)) {
        throw new Error('Markiere zuerst eine Textstelle auf der PDF-Seite.');
    }
    const bounds = range.getBoundingClientRect();
    const pageBounds = stage.getBoundingClientRect();
    const first = state.viewport.convertToPdfPoint(bounds.left - pageBounds.left, bounds.top - pageBounds.top);
    const second = state.viewport.convertToPdfPoint(bounds.right - pageBounds.left, bounds.bottom - pageBounds.top);
    return {
        docId: String(state.docId),
        pageNumber: state.pageNumber,
        rect: [
            Math.min(first[0], second[0]),
            Math.min(first[1], second[1]),
            Math.max(first[0], second[0]),
            Math.max(first[1], second[1])
        ],
        text: selection.toString().trim()
    };
}

function openPdfWorkspaceCitationEditor(state) {
    const anchor = getPdfWorkspaceSelectionAnchor(state);
    pdfWorkspacePendingCitation = { anchor, title: state.title };
    document.getElementById('pdfCitationNote').value = '';
    document.getElementById('pdfCitationTags').value = '';
    document.getElementById('pdfCitationEditor')?.classList.remove('hidden');
    document.getElementById('pdfCitationNote')?.focus();
}

async function savePdfWorkspaceCitation(event) {
    event.preventDefault();
    if (!pdfWorkspacePendingCitation) {
        setPdfWorkspaceStatus('Wähle zuerst eine Textstelle für die Zitatkarte aus.');
        return;
    }
    const { anchor, title } = pdfWorkspacePendingCitation;
    const note = document.getElementById('pdfCitationNote').value;
    const tagText = document.getElementById('pdfCitationTags').value;
    const notebook = notebooks.find(item => String(item.id) === anchor.docId);
    await notebookDb.pdfCitations.add({
        id: createPdfWorkspaceId('citation'),
        notebookId: anchor.docId,
        docId: anchor.docId,
        pageNumber: anchor.pageNumber,
        rect: anchor.rect,
        text: anchor.text,
        note: note.trim(),
        tags: [...new Set(tagText.split(',').map(tag => tag.trim()).filter(Boolean))],
        documentName: notebook?.title || title,
        createdAt: new Date().toISOString()
    });
    if (notebook) saveNotebookMetadata(notebook.id);
    pdfWorkspacePendingCitation = null;
    document.getElementById('pdfCitationEditor')?.classList.add('hidden');
    document.getElementById('pdfCitationForm')?.reset();
    await renderPdfWorkspaceSavedItems();
    setPdfWorkspaceStatus('Zitatkarte lokal gespeichert.');
}

async function runPdfWorkspaceOcr(state) {
    const canvas = state.pageContainer?.querySelector('canvas');
    const language = document.getElementById('pdfWorkspaceOcrLanguage')?.value || 'deu';
    const languageLabel = language === 'deu' ? 'Deutsche' : 'Englische';
    const text = await runPdfPageOcr({
        docId: state.docId,
        pageNumber: state.pageNumber,
        canvas,
        language,
        onProgress: message => setPdfWorkspaceStatus(`${languageLabel} ${message}`)
    });
    setPdfWorkspaceStatus(text
        ? `OCR abgeschlossen; ${text.length.toLocaleString('de-DE')} Zeichen wurden gespeichert. Sprachdaten sind für Offline-OCR zwischengespeichert.`
        : 'OCR abgeschlossen; auf dieser Seite wurde kein Text erkannt.');
}

async function setPdfWorkspaceLinkAnchor(state, role) {
    const anchor = getPdfWorkspaceSelectionAnchor(state);
    if (role === 'source') {
        pdfWorkspacePendingLinkSource = anchor;
        setPdfWorkspaceStatus('Quelle gespeichert. Markiere nun den Zieltext in einem Dokument.');
        return;
    }
    if (!pdfWorkspacePendingLinkSource) {
        throw new Error('Wähle zuerst die Link-Quelle aus.');
    }
    const source = pdfWorkspacePendingLinkSource;
    pdfWorkspacePendingLinkSource = null;
    await saveDocumentCrossLink({
        source,
        target: anchor,
        sourceText: source.text,
        targetText: anchor.text
    });
    await renderPdfWorkspaceSavedItems();
    setPdfWorkspaceStatus('Dokumentverknüpfung lokal gespeichert.');
}

async function renderPdfWorkspaceSavedItems() {
    const [citations, links] = await Promise.all([
        notebookDb.pdfCitations.orderBy('createdAt').reverse().limit(100).toArray(),
        listDocumentCrossLinks(100)
    ]);
    const citationsContainer = document.getElementById('pdfWorkspaceCitations');
    const linksContainer = document.getElementById('pdfWorkspaceLinks');
    citationsContainer.replaceChildren();
    linksContainer.replaceChildren();
    citations.forEach(citation => {
        citationsContainer.appendChild(createPdfWorkspaceSavedCard(
            `${citation.documentName || citation.docId} · Seite ${citation.pageNumber}`,
            [citation.text, citation.note, (citation.tags || []).join(', ')].filter(Boolean).join(' — '),
            'Zitat öffnen',
            'open-citation',
            citation.id
        ));
    });
    links.forEach(link => {
        linksContainer.appendChild(createPdfWorkspaceSavedCard(
            `${link.sourceText || link.documentName || 'Quelle'} → ${link.targetText || 'Ziel'}`,
            `Seite ${link.source.pageNumber} → Seite ${link.target.pageNumber}`,
            'Ziel öffnen',
            'open-link',
            link.id
        ));
    });
    if (!citations.length) citationsContainer.textContent = 'Noch keine Zitatkarten.';
    if (!links.length) linksContainer.textContent = 'Noch keine Dokumentverknüpfungen.';
}

function createPdfWorkspaceSavedCard(title, detail, actionLabel, action, id) {
    const card = document.createElement('article');
    card.className = 'pdf-workspace-card';
    const description = document.createElement('p');
    description.textContent = title;
    const details = document.createElement('small');
    details.textContent = detail;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = actionLabel;
    button.dataset.action = action;
    button.dataset.recordId = id;
    card.append(description, details, button);
    return card;
}

async function openPdfWorkspaceAnchor(anchor) {
    let state = pdfWorkspaceDocuments.find(item => String(item.docId) === String(anchor.docId));
    if (!state) {
        const notebook = notebooks.find(item => String(item.id) === String(anchor.docId));
        if (!notebook) throw new Error('Das Zieldokument ist nicht verfügbar.');
        state = { docId: String(anchor.docId), title: notebook.title || 'PDF-Dokument', pageNumber: 1, zoom: 1 };
        pdfWorkspaceDocuments.push(state);
    }
    state.pageNumber = anchor.pageNumber;
    state.highlightRect = anchor.rect;
    renderPdfWorkspaceDocuments();
    await persistPdfWorkspace();
}

async function handlePdfWorkspaceAction(event) {
    const button = event.target.closest('button[data-action]');
    if (button && button.closest('#pdfWorkspaceDocuments')) {
        const state = pdfWorkspaceDocuments.find(item => String(item.docId) === button.dataset.docId);
        if (!state) return;
        try {
            switch (button.dataset.action) {
                case 'close-document':
                    pdfWorkspaceDocuments = pdfWorkspaceDocuments.filter(item => item !== state);
                    renderPdfWorkspaceDocuments();
                    await persistPdfWorkspace();
                    return;
                case 'move-left':
                case 'move-right': {
                    const index = pdfWorkspaceDocuments.indexOf(state);
                    const offset = button.dataset.action === 'move-left' ? -1 : 1;
                    const target = index + offset;
                    if (target >= 0 && target < pdfWorkspaceDocuments.length) {
                        [pdfWorkspaceDocuments[index], pdfWorkspaceDocuments[target]] =
                            [pdfWorkspaceDocuments[target], pdfWorkspaceDocuments[index]];
                        renderPdfWorkspaceDocuments();
                        await persistPdfWorkspace();
                    }
                    return;
                }
                case 'previous-page':
                    state.pageNumber = Math.max(1, state.pageNumber - 1);
                    break;
                case 'next-page': {
                    const pdf = await getPdfWorkspacePdf(state.docId);
                    state.pageNumber = Math.min(pdf.numPages, state.pageNumber + 1);
                    break;
                }
                case 'quote':
                    openPdfWorkspaceCitationEditor(state);
                    return;
                case 'ocr':
                    await runPdfWorkspaceOcr(state);
                    return;
                case 'link-source':
                    await setPdfWorkspaceLinkAnchor(state, 'source');
                    return;
                case 'link-target':
                    await setPdfWorkspaceLinkAnchor(state, 'target');
                    return;
                default:
                    return;
            }
            renderPdfWorkspaceDocuments();
            await persistPdfWorkspace();
        } catch (error) {
            console.error('PDF-Arbeitsbereich-Aktion fehlgeschlagen:', error);
            setPdfWorkspaceStatus(error.message || 'Die Aktion konnte nicht abgeschlossen werden.');
        }
        return;
    }

    const input = event.target.closest('input[data-action]');
    if (input && input.closest('#pdfWorkspaceDocuments')) {
        const state = pdfWorkspaceDocuments.find(item => String(item.docId) === input.dataset.docId);
        if (!state) return;
        if (input.dataset.action === 'zoom') state.zoom = Number(input.value);
        if (input.dataset.action === 'page-number') state.pageNumber = Math.max(1, Number(input.value) || 1);
        renderPdfWorkspaceDocuments();
        await persistPdfWorkspace();
        return;
    }

    if (!button) return;
    if (button.dataset.action === 'open-citation') {
        const citation = await notebookDb.pdfCitations.get(button.dataset.recordId);
        if (citation) await openPdfWorkspaceAnchor(citation);
    } else if (button.dataset.action === 'open-link') {
        const link = await getDocumentCrossLink(button.dataset.recordId);
        if (link?.target) await openPdfWorkspaceAnchor(link.target);
    }
}

document.getElementById('pdfWorkspaceOpen')?.addEventListener('click', () => void openPdfWorkspace());
document.getElementById('pdfWorkspaceClose')?.addEventListener('click', closePdfWorkspace);
document.getElementById('pdfWorkspaceHelpOpen')?.addEventListener('click', () => {
    const help = document.getElementById('pdfWorkspaceHelp');
    const isOpen = help?.classList.contains('hidden');
    help?.classList.toggle('hidden', !isOpen);
    document.getElementById('pdfWorkspaceHelpOpen')?.setAttribute('aria-expanded', String(Boolean(isOpen)));
});
document.getElementById('pdfWorkspaceHelpClose')?.addEventListener('click', () => {
    document.getElementById('pdfWorkspaceHelp')?.classList.add('hidden');
    document.getElementById('pdfWorkspaceHelpOpen')?.setAttribute('aria-expanded', 'false');
    document.getElementById('pdfWorkspaceHelpOpen')?.focus();
});
document.getElementById('pdfWorkspaceModal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closePdfWorkspace();
});
document.getElementById('pdfWorkspaceAddDocument')?.addEventListener('click', () => {
    const select = document.getElementById('pdfWorkspaceDocumentSelect');
    void addPdfWorkspaceDocument(select.value);
});
document.getElementById('pdfWorkspaceDocuments')?.addEventListener('click', event => {
    void handlePdfWorkspaceAction(event);
});
document.getElementById('pdfWorkspaceDocuments')?.addEventListener('change', event => {
    void handlePdfWorkspaceAction(event);
});
document.getElementById('pdfWorkspaceCitations')?.addEventListener('click', event => {
    void handlePdfWorkspaceAction(event);
});
document.getElementById('pdfWorkspaceLinks')?.addEventListener('click', event => {
    void handlePdfWorkspaceAction(event);
});
document.getElementById('pdfCitationForm')?.addEventListener('submit', event => {
    void savePdfWorkspaceCitation(event).catch(error => {
        console.error('Zitatkarte konnte nicht gespeichert werden:', error);
        setPdfWorkspaceStatus(`Zitatkarte konnte nicht gespeichert werden: ${error.message || error}`);
    });
});
document.getElementById('pdfCitationCancel')?.addEventListener('click', () => {
    pdfWorkspacePendingCitation = null;
    document.getElementById('pdfCitationEditor')?.classList.add('hidden');
});
