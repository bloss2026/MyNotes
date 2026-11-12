// Global search
let globalSearchTimer = null;
let globalSearchRequest = 0;

function openGlobalSearch(query = '') {
    const modal = document.getElementById('globalSearchModal');
    const input = document.getElementById('globalSearchInput');
    if (!modal || !input) return;
    modal.classList.remove('hidden');
    input.value = query;
    if (query.trim()) {
        void runGlobalSearch(query);
    } else {
        document.getElementById('globalSearchStatus').textContent = 'Suchbegriff eingeben.';
        document.getElementById('globalSearchResults').replaceChildren();
    }
    window.requestAnimationFrame(() => input.focus());
}

function closeGlobalSearch() {
    const modal = document.getElementById('globalSearchModal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    globalSearchRequest += 1;
}

async function runGlobalSearch(query) {
    const status = document.getElementById('globalSearchStatus');
    const resultsContainer = document.getElementById('globalSearchResults');
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const requestId = ++globalSearchRequest;
    if (!normalizedQuery) {
        status.textContent = 'Suchbegriff eingeben.';
        resultsContainer.replaceChildren();
        return;
    }

    status.textContent = 'Suche läuft …';
    resultsContainer.replaceChildren();
    try {
        await ensureNotebookStorage();
        if (currentNotebookId !== null && !isNotebookReadOnly) {
            persistNotebookPages();
            const notebook = notebooks.find(item => String(item.id) === String(currentNotebookId));
            const page = notebook && getNotebookPages(notebook)[currentPageIndex];
            if (page) await writeNotebookPage(currentNotebookId, currentPageIndex, page);
        }

        const activeNotebooks = notebooks.filter(notebook =>
            !notebookTombstones[String(notebook.id)] &&
            !notebookPurgeTombstones[String(notebook.id)]
        );
        const notebookIds = activeNotebooks.map(notebook => String(notebook.id));
        const storedPages = notebookIds.length
            ? await notebookDb.pages.where('notebookId').anyOf(notebookIds).toArray()
            : [];
        const storedCitations = await notebookDb.pdfCitations.toArray();
        if (requestId !== globalSearchRequest) return;

        const pagesByNotebook = new Map();
        storedPages.forEach(record => {
            const key = String(record.notebookId);
            if (!pagesByNotebook.has(key)) pagesByNotebook.set(key, []);
            pagesByNotebook.get(key).push(record);
        });

        const results = [];
        activeNotebooks.forEach(notebook => {
            const title = String(notebook.title || 'Unbenanntes Notizbuch');
            if (title.toLocaleLowerCase().includes(normalizedQuery)) {
                results.push({
                    notebookId: notebook.id,
                    title,
                    pageIndex: 0,
                    matchIndex: -1,
                    excerpt: title,
                    type: 'Notizbuch'
                });
            }

            const stored = pagesByNotebook.get(String(notebook.id)) || [];
            const pages = stored.length
                ? stored.sort((first, second) => first.pageIndex - second.pageIndex)
                    .map(({ notebookId, pageIndex, ...page }) => page)
                : getNotebookPages(notebook);
            pages.forEach((page, pageIndex) => {
                const sources = [
                    { text: String(page.content || ''), type: `Seite ${pageIndex + 1}`, editable: true },
                    { text: String(page.searchText || ''), type: `PDF Seite ${pageIndex + 1}`, editable: false },
                    {
                        text: (page.shapes || []).filter(shape => shape.kind === 'text')
                            .map(shape => String(shape.text || '')).join('\n'),
                        type: `Textobjekt Seite ${pageIndex + 1}`,
                        editable: false
                    }
                ];
                sources.forEach(source => {
                    const matchIndex = source.text.toLocaleLowerCase().indexOf(normalizedQuery);
                    if (matchIndex < 0) return;
                    const excerptStart = Math.max(0, matchIndex - 48);
                    const excerptEnd = Math.min(source.text.length, matchIndex + query.trim().length + 72);
                    results.push({
                        notebookId: notebook.id,
                        title,
                        pageIndex,
                        matchIndex: source.editable ? matchIndex : -1,
                        excerpt: `${excerptStart ? '…' : ''}${source.text.slice(excerptStart, excerptEnd)}${excerptEnd < source.text.length ? '…' : ''}`,
                        type: source.type
                    });
                });
                storedCitations.forEach(citation => {
                    const searchable = [
                        citation.text,
                        citation.note,
                        ...(citation.tags || []),
                        citation.documentName
                    ].filter(Boolean).join(' ');
                    if (!searchable.toLocaleLowerCase().includes(normalizedQuery)) return;
                    const title = citation.documentName || notebooks.find(item =>
                        String(item.id) === String(citation.docId)
                    )?.title || 'PDF-Zitat';
                    results.push({
                        title,
                        notebookId: citation.notebookId,
                        pageIndex: Math.max(0, Number(citation.pageNumber) - 1),
                        matchIndex: -1,
                        excerpt: String(citation.text || citation.note || '').slice(0, 180),
                        type: `Zitatkarte · Seite ${citation.pageNumber}`,
                        citationId: citation.id,
                        docId: citation.docId,
                        pageNumber: citation.pageNumber,
                        rect: citation.rect
                    });
                });
            });
        });

        if (requestId !== globalSearchRequest) return;
        if (!results.length) {
            status.textContent = 'Keine Treffer in Notizbüchern, Textseiten oder PDF-Texten.';
            return;
        }
        status.textContent = `${results.length} Treffer${results.length > 100 ? ' (Anzeige auf 100 begrenzt)' : ''}`;
        results.slice(0, 100).forEach(result => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'global-search-result';
            const heading = document.createElement('span');
            heading.className = 'global-search-result-heading';
            heading.textContent = result.title;
            const type = document.createElement('span');
            type.className = 'global-search-result-type';
            type.textContent = result.type;
            const excerpt = document.createElement('span');
            excerpt.className = 'global-search-result-excerpt';
            excerpt.textContent = result.excerpt;
            button.append(heading, type, excerpt);
            button.addEventListener('click', async () => {
                closeGlobalSearch();
                try {
                    if (result.citationId) {
                        await openPdfWorkspace();
                        await openPdfWorkspaceAnchor(result);
                        return;
                    }
                    await openNotebook(result.notebookId);
                    if (String(currentNotebookId) !== String(result.notebookId)) {
                        throw new Error('Das Notizbuch wurde nicht geöffnet.');
                    }
                    showNotebookPage(result.pageIndex);
                    if (result.matchIndex >= 0) {
                        const textarea = document.getElementById('notebookContent');
                        if (textarea) {
                            setEditorTool('text');
                            textarea.focus();
                            textarea.setSelectionRange(result.matchIndex, result.matchIndex + query.trim().length);
                        }
                    }
                } catch (error) {
                    console.error('Suchtreffer konnte nicht geöffnet werden:', error);
                    alert(`Der Suchtreffer konnte nicht geöffnet werden: ${error.message || error}`);
                }
            });
            resultsContainer.appendChild(button);
        });
    } catch (error) {
        console.error('Globale Suche fehlgeschlagen:', error);
        if (requestId === globalSearchRequest) {
            status.textContent = `Suche fehlgeschlagen: ${error.message || error}`;
        }
    }
}

document.getElementById('globalSearchClose')?.addEventListener('click', closeGlobalSearch);
document.getElementById('globalSearchModal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeGlobalSearch();
});
document.getElementById('globalSearchInput')?.addEventListener('input', event => {
    window.clearTimeout(globalSearchTimer);
    const query = event.target.value;
    globalSearchTimer = window.setTimeout(() => void runGlobalSearch(query), 180);
});
document.getElementById('globalSearchTrigger')?.addEventListener('focus', event => {
    openGlobalSearch(event.target.value);
});
document.getElementById('globalSearchTrigger')?.addEventListener('input', event => {
    openGlobalSearch(event.target.value);
});
document.getElementById('mobileSearchBtn')?.addEventListener('click', () => openGlobalSearch());
document.getElementById('notebookSortSelect')?.addEventListener('change', event => {
    const sortMode = event.target.value;
    if (!validNotebookSortModes.has(sortMode)) return;
    const previousSortMode = notebookSortMode;
    notebookSortMode = sortMode;
    try {
        localStorage.setItem('mynotes_notebook_sort', notebookSortMode);
    } catch (error) {
        notebookSortMode = previousSortMode;
        event.target.value = previousSortMode;
        console.error('Sortierung konnte nicht gespeichert werden:', error);
        alert('Die Sortierung konnte nicht lokal gespeichert werden.');
        return;
    }
    loadNotebooksToDashboard();
});

