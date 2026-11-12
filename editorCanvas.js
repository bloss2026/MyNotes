// Page, canvas, and selection operations
function getNotebookPages(notebook) {
    if (!Array.isArray(notebook.pages) || notebook.pages.length === 0) {
        notebook.pages = [{ content: notebook.content || '', drawing: '', shapes: [] }];
    }
    return notebook.pages;
}

function getNotebookPageDimensions(pageSize, orientation) {
    const sizes = {
        'Goodnotes Standard': [595, 842],
        A7: [210, 298],
        A6: [298, 420],
        A5: [420, 595],
        A4: [595, 842],
        A3: [842, 1191],
        'Letter-Format': [612, 792],
        'Tabloid-Format': [792, 1224]
    };
    const [portraitWidth, portraitHeight] = sizes[pageSize] || sizes['Goodnotes Standard'];
    return orientation === 'landscape'
        ? { width: portraitHeight, height: portraitWidth }
        : { width: portraitWidth, height: portraitHeight };
}

function getNotebookPageTemplate(page, notebook) {
    const storedPattern = page && Object.hasOwn(page, 'pattern') ? page.pattern : notebook?.pattern;
    const pattern = templateGroups.flatMap(group => group.templates)
        .find(template => template.pattern === storedPattern)?.pattern;
    if (pattern !== undefined) return pattern;
    if (notebook?.template === 'Gepunktet') return 'paper-dotted';
    if (notebook?.template === 'Liniert') return 'paper-lined';
    if (notebook?.template === 'Kariert') return 'paper-grid';
    return '';
}

function getNotebookPagePaperColor(page, notebook) {
    const color = page && Object.hasOwn(page, 'paperColor') ? page.paperColor : notebook?.paperColor;
    return ['gelb', 'weiss', 'creme', 'sepia', 'dunkel'].includes(color) ? color : 'gelb';
}

function persistNotebookPages() {
    if (isNotebookReadOnly) return;
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

function copyPageShapes(shapes) {
    return shapes.map(shape => ({
        ...shape,
        points: shape.points?.map(point => [...point])
    }));
}

function captureEditorSnapshot(keys) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    const page = notebook && getNotebookPages(notebook)[currentPageIndex];
    if (!page) return null;
    const snapshot = {};
    if (keys.includes('content')) {
        snapshot.content = document.getElementById('notebookContent')?.value ?? page.content ?? '';
    }
    if (keys.includes('drawing')) {
        const canvas = document.getElementById('notebookDrawing');
        snapshot.drawing = canvas?.width && canvas.height ? canvas.toDataURL() : page.drawing || '';
    }
    if (keys.includes('shapes')) snapshot.shapes = copyPageShapes(page.shapes || []);
    return snapshot;
}

function recordEditorHistory(snapshot) {
    if (!snapshot) return;
    editorUndoStack.push(snapshot);
    if (editorUndoStack.length > 50) editorUndoStack.shift();
    editorRedoStack = [];
    updateEditorHistoryButtons();
}

function updateEditorHistoryButtons() {
    document.querySelectorAll('[data-editor-action="undo"]').forEach(button => {
        button.disabled = isNotebookReadOnly || editorUndoStack.length === 0;
    });
    document.querySelectorAll('[data-editor-action="redo"]').forEach(button => {
        button.disabled = isNotebookReadOnly || editorRedoStack.length === 0;
    });
}

async function applyEditorSnapshot(snapshot) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    const page = notebook && getNotebookPages(notebook)[currentPageIndex];
    if (!page) throw new Error('Die aktuelle Seite wurde nicht gefunden.');
    if (Object.hasOwn(snapshot, 'content')) {
        const textarea = document.getElementById('notebookContent');
        page.content = snapshot.content;
        if (textarea) textarea.value = snapshot.content;
        lastEditorText = snapshot.content;
    }
    if (Object.hasOwn(snapshot, 'shapes')) {
        page.shapes = copyPageShapes(snapshot.shapes);
        setSelectedShapeIds([]);
        renderNotebookShapes();
    }
    if (Object.hasOwn(snapshot, 'drawing')) {
        page.drawing = snapshot.drawing;
        await restorePageDrawing(snapshot.drawing);
    }
    persistNotebookPages();
}

async function changeEditorHistory(direction) {
    if (isNotebookReadOnly) return;
    const source = direction === 'undo' ? editorUndoStack : editorRedoStack;
    const destination = direction === 'undo' ? editorRedoStack : editorUndoStack;
    const snapshot = source.pop();
    if (!snapshot) return;
    const current = captureEditorSnapshot(Object.keys(snapshot));
    if (!current) {
        source.push(snapshot);
        updateEditorHistoryButtons();
        return;
    }
    try {
        await applyEditorSnapshot(snapshot);
        destination.push(current);
    } catch (error) {
        source.push(snapshot);
        console.error('Editoränderung konnte nicht wiederhergestellt werden:', error);
        alert('Die Änderung konnte nicht wiederhergestellt werden.');
    }
    updateEditorHistoryButtons();
}

function setNotebookBackground(page) {
    const background = document.getElementById('notebookBackground');
    const pageElement = document.getElementById('notebookPage');
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    if (pageElement) {
        const pattern = getNotebookPageTemplate(page, notebook);
        const paperColor = getNotebookPagePaperColor(page, notebook);
        pageElement.classList.remove(
            ...templateGroups.flatMap(group => group.templates)
                .map(template => template.pattern)
                .filter(Boolean),
            'paper-color-gelb', 'paper-color-weiss', 'paper-color-creme',
            'paper-color-sepia', 'paper-color-dunkel', 'paper-text-dark', 'paper-text-light'
        );
        if (pattern) pageElement.classList.add(pattern);
        pageElement.classList.add(`paper-color-${paperColor}`);
        pageElement.classList.add(paperColor === 'dunkel' ? 'paper-text-dark' : 'paper-text-light');
        const dimensions = getNotebookPageDimensions(
            page?.pageSize || notebook?.pageSize,
            page?.orientation || notebook?.orientation
        );
        pageElement.style.setProperty('--page-width', `${dimensions.width}px`);
        pageElement.style.setProperty('--page-aspect', `${dimensions.width} / ${dimensions.height}`);
        pageElement.style.aspectRatio = `${dimensions.width} / ${dimensions.height}`;
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
        const zoomLabel = document.createElement('span');
        zoomLabel.id = 'pageZoomIndicator';
        zoomLabel.className = 'page-zoom-indicator';
        zoomLabel.title = 'Mit zwei Fingern zoomen';
        zoomLabel.textContent = `${Math.round(currentPageZoom * 100)}%`;
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'page-counter-button';
        nextButton.dataset.editorAction = 'next-page';
        nextButton.setAttribute('aria-label', 'Nächste Seite');
        nextButton.textContent = '›';
        nextButton.disabled = currentPageIndex >= pages.length - 1;
        counter.append(previousButton, pageLabel, nextButton, zoomLabel);
    }
    const menuCounter = document.getElementById('menuPageCounter');
    if (menuCounter) menuCounter.textContent = `${currentPageIndex + 1} von ${pages.length || 1}`;
    if (sidebarCounter) {
        sidebarCounter.innerHTML = '';
        pages.forEach((page, index) => {
            const notebook = notebooks.find(item => item.id === currentNotebookId);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `editor-page-thumbnail ${index === currentPageIndex ? 'is-selected' : ''}`;
            button.classList.add(`paper-color-${getNotebookPagePaperColor(page, notebook)}`);
            const pattern = getNotebookPageTemplate(page, notebook);
            if (pattern) button.classList.add(pattern);
            const number = document.createElement('span');
            number.className = 'editor-page-thumbnail-number';
            number.textContent = String(index + 1);
            const preview = document.createElement('span');
            preview.className = 'editor-page-thumbnail-preview';
            preview.textContent = String(page.content || '').trim().slice(0, 68);
            button.append(number, preview);
            button.setAttribute('aria-label', `Seite ${index + 1}`);
            button.addEventListener('click', () => showNotebookPage(index));
            const item = document.createElement('div');
            item.className = 'editor-page-item';
            item.appendChild(button);
            const actions = document.createElement('div');
            actions.className = 'editor-page-actions';
            [
                { label: 'Seite nach oben verschieben', action: 'move-up', disabled: index === 0, icon: '↑' },
                { label: 'Seite nach unten verschieben', action: 'move-down', disabled: index === pages.length - 1, icon: '↓' },
                { label: 'Seite löschen', action: 'delete', disabled: pages.length <= 1, icon: '×' }
            ].forEach(({ label, action, disabled, icon }) => {
                const actionButton = document.createElement('button');
                actionButton.type = 'button';
                actionButton.className = 'editor-page-action';
                actionButton.textContent = icon;
                actionButton.setAttribute('aria-label', label);
                actionButton.disabled = disabled || isNotebookReadOnly;
                actionButton.addEventListener('click', () => {
                    if (action === 'move-up') void moveNotebookPage(index, -1);
                    else if (action === 'move-down') void moveNotebookPage(index, 1);
                    else if (action === 'delete') void deleteNotebookPage(index);
                });
                actions.appendChild(actionButton);
            });
            item.appendChild(actions);
            sidebarCounter.appendChild(item);
        });
    }
}

function openPageTemplateDialog() {
    const notebook = notebooks.find(item => String(item.id) === String(currentNotebookId));
    const page = notebook && getNotebookPages(notebook)[currentPageIndex];
    const modal = document.getElementById('pageTemplateModal');
    if (!notebook || !page || !modal) return;
    document.getElementById('pageTemplateSelect').value = getNotebookPageTemplate(page, notebook);
    document.getElementById('pagePaperColorSelect').value = getNotebookPagePaperColor(page, notebook);
    document.getElementById('pageSizeSelectEditor').value = page.pageSize || notebook.pageSize || 'Goodnotes Standard';
    document.getElementById('pageOrientationSelect').value = page.orientation || notebook.orientation || 'portrait';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
}

function closePageTemplateDialog() {
    const modal = document.getElementById('pageTemplateModal');
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
}

function applyPageTemplateDialog() {
    if (isNotebookReadOnly) return;
    const notebook = notebooks.find(item => String(item.id) === String(currentNotebookId));
    const page = notebook && getNotebookPages(notebook)[currentPageIndex];
    if (!notebook || !page) return;
    const pattern = document.getElementById('pageTemplateSelect')?.value;
    const template = templateGroups.flatMap(group => group.templates)
        .find(item => item.pattern === pattern);
    const paperColor = document.getElementById('pagePaperColorSelect')?.value;
    const pageSize = document.getElementById('pageSizeSelectEditor')?.value;
    const orientation = document.getElementById('pageOrientationSelect')?.value;
    const validPageSize = [...document.getElementById('pageSizeSelectEditor').options]
        .some(option => option.value === pageSize);
    if (!template || !['gelb', 'weiss', 'creme', 'sepia', 'dunkel'].includes(paperColor) ||
        !validPageSize || !['portrait', 'landscape'].includes(orientation)) {
        alert('Die Seiteneinstellungen sind ungültig.');
        return;
    }
    page.template = template.name;
    page.pattern = template.pattern;
    page.paperColor = paperColor;
    page.pageSize = pageSize;
    page.orientation = orientation;
    setNotebookBackground(page);
    persistNotebookPages();
    updatePageCounter();
    closePageTemplateDialog();
}

function showNotebookPage(index, skipSave = false) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    if (!notebook) return;
    if (!skipSave) persistNotebookPages();
    const pages = getNotebookPages(notebook);
    if (index < 0 || index >= pages.length) return;

    currentPageIndex = index;
    setSelectedShapeIds([]);
    lassoActive = false;
    lassoPoints = [];
    shapeEditStart = null;
    const textarea = document.getElementById('notebookContent');
    if (textarea) textarea.value = pages[index].content || '';
    lastEditorText = pages[index].content || '';
    setNotebookBackground(pages[index]);
    void restorePageDrawing(pages[index].drawing || '').catch(reportDrawingRestoreError);
    setSelectedShapeIds([]);
    renderNotebookShapes();
    editorUndoStack = [];
    editorRedoStack = [];
    updateEditorHistoryButtons();
    updatePageCounter();
}

function addNotebookPage(duplicateCurrent = false) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    if (!notebook) return;
    persistNotebookPages();
    const pages = getNotebookPages(notebook);
    const currentPage = pages[currentPageIndex] || { content: '', drawing: '' };
    const page = duplicateCurrent
        ? {
            ...currentPage,
            shapes: (currentPage.shapes || []).map(shape => ({
                ...shape,
                points: shape.points?.map(point => [...point])
            }))
        }
        : {
            content: '',
            drawing: '',
            shapes: [],
            pattern: getNotebookPageTemplate(currentPage, notebook),
            paperColor: getNotebookPagePaperColor(currentPage, notebook),
            pageSize: currentPage.pageSize || notebook.pageSize,
            orientation: currentPage.orientation || notebook.orientation
        };
    pages.splice(currentPageIndex + 1, 0, page);
    currentPageIndex += 1;
    void Promise.all(pages.map((pageData, pageIndex) => writeNotebookPage(notebook.id, pageIndex, pageData)))
        .catch(reportNotebookStorageError);
    saveNotebookMetadata(notebook.id);
    showNotebookPage(currentPageIndex, true);
    closeMenu();
}

async function saveNotebookPageOrder(notebook) {
    await ensureNotebookStorage();
    const pages = getNotebookPages(notebook);
    await notebookDb.transaction('rw', notebookDb.pages, async () => {
        await notebookDb.pages.where('notebookId').equals(String(notebook.id)).delete();
        await notebookDb.pages.bulkPut(pages.map((page, pageIndex) => ({
            ...page,
            notebookId: String(notebook.id),
            pageIndex,
            shapes: Array.isArray(page.shapes) ? page.shapes : []
        })));
    });
    notebook.pageCount = pages.length;
    notebook.updatedAt = new Date().toISOString();
    saveNotebookMetadata(notebook.id);
}

async function moveNotebookPage(index, offset) {
    const notebook = notebooks.find(item => String(item.id) === String(currentNotebookId));
    if (!notebook || isNotebookReadOnly) return;
    persistNotebookPages();
    const pages = getNotebookPages(notebook);
    const target = index + offset;
    if (target < 0 || target >= pages.length) return;
    [pages[index], pages[target]] = [pages[target], pages[index]];
    notebook.bookmarks = (notebook.bookmarks || []).map(bookmark =>
        bookmark === index ? target : bookmark === target ? index : bookmark
    );
    if (currentPageIndex === index) currentPageIndex = target;
    else if (currentPageIndex === target) currentPageIndex = index;
    try {
        await saveNotebookPageOrder(notebook);
        showNotebookPage(currentPageIndex, true);
    } catch (error) {
        reportNotebookStorageError(error);
    }
}

async function deleteNotebookPage(index) {
    const notebook = notebooks.find(item => String(item.id) === String(currentNotebookId));
    if (!notebook || isNotebookReadOnly) return;
    const pages = getNotebookPages(notebook);
    if (pages.length <= 1 || index < 0 || index >= pages.length) return;
    if (!confirm(`Seite ${index + 1} wirklich löschen?`)) return;
    persistNotebookPages();
    pages.splice(index, 1);
    notebook.bookmarks = (notebook.bookmarks || [])
        .filter(bookmark => bookmark !== index)
        .map(bookmark => bookmark > index ? bookmark - 1 : bookmark);
    if (currentPageIndex > index) currentPageIndex -= 1;
    else if (currentPageIndex === index) currentPageIndex = Math.min(index, pages.length - 1);
    try {
        await saveNotebookPageOrder(notebook);
        showNotebookPage(currentPageIndex, true);
    } catch (error) {
        reportNotebookStorageError(error);
    }
}

function restorePageDrawing(dataUrl) {
    return new Promise((resolve, reject) => {
        const canvas = document.getElementById('notebookDrawing');
        if (!canvas) {
            resolve();
            return;
        }
        const context = canvas.getContext('2d');
        const ratio = Number(canvas.dataset.pixelRatio) || 1;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (!dataUrl) {
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            resolve();
            return;
        }
        const image = new Image();
        image.onload = () => {
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            resolve();
        };
        image.onerror = () => reject(new Error('Gespeicherte Zeichnung konnte nicht geladen werden.'));
        image.src = dataUrl;
    });
}

function reportDrawingRestoreError(error) {
    console.error('Gespeicherte Zeichnung konnte nicht geladen werden:', error);
    alert('Eine gespeicherte Zeichnung konnte nicht geladen werden.');
}

function resizeNotebookCanvas() {
    const canvas = document.getElementById('notebookDrawing');
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const shapesSvg = document.getElementById('notebookShapes');
    const ratio = window.devicePixelRatio || 1;
    const oldImage = canvas.toDataURL();
    const width = bounds.width / currentPageZoom;
    const height = bounds.height / currentPageZoom;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d');
    canvas.dataset.pixelRatio = String(ratio);
    context.scale(ratio, ratio);
    if (shapesSvg) {
        shapesSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        shapesSvg.setAttribute('width', String(width));
        shapesSvg.setAttribute('height', String(height));
    }
    void restorePageDrawing(oldImage).catch(reportDrawingRestoreError);
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
    currentToolState.tool = tool;
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
    if (canvas) canvas.style.touchAction = currentToolState.inputMode === 'finger-draw' ? 'none' : 'pan-y';
    if (textarea) {
        textarea.readOnly = isNotebookReadOnly || ['pen', 'pencil', 'pen-fountain', 'eraser', 'highlighter', 'lasso', 'shapes', 'sticky', 'objects'].includes(tool);
    }
    const shapesSvg = document.getElementById('notebookShapes');
    if (shapesSvg) shapesSvg.classList.toggle('is-selecting', tool === 'lasso');
    updateDeleteShapeButton();
}

function setInputMode(mode) {
    if (!inputModes.has(mode)) return;
    currentToolState.inputMode = mode;
    localStorage.setItem('mynotes_input_mode', mode);
    const selector = document.getElementById('inputModeSelect');
    if (selector) selector.value = mode;
    const canvas = document.getElementById('notebookDrawing');
    if (canvas) canvas.style.touchAction = mode === 'finger-draw' ? 'none' : 'pan-y';
}

function canPointerDraw(event) {
    const pointerType = event.pointerType || 'mouse';
    if (currentToolState.inputMode === 'stylus-only') return pointerType === 'pen';
    if (pointerType === 'touch') return currentToolState.inputMode === 'finger-draw';
    return true;
}

function setNotebookReadOnlyMode(enabled) {
    const editor = document.getElementById('notebookEditor');
    if (!editor) return;
    isNotebookReadOnly = enabled;
    editor.classList.toggle('is-read-only', enabled);

    if (enabled && activeDrawing) {
        const canvas = document.getElementById('notebookDrawing');
        const context = canvas?.getContext('2d');
        if (context && drawingSnapshot) context.putImageData(drawingSnapshot, 0, 0);
        activeDrawing = false;
        currentToolState.activePointerId = null;
        currentToolState.pointer = null;
        currentToolState.strokePointerType = null;
        currentStrokePoints = [];
        drawingStartPoint = null;
        drawingEndPoint = null;
        drawingSnapshot = null;
        drawingHistorySnapshot = null;
    }
    if (enabled && shapeEditStart) {
        const shapes = getCurrentPageShapes();
        shapeEditStart.items.forEach(original => {
            const shape = shapes.find(item => item.id === original.id);
            if (shape) Object.assign(shape, original);
        });
        shapeEditStart = null;
        renderNotebookShapes();
    }
    if (enabled && (getSelectedShapeIds().length || lassoActive)) {
        setSelectedShapeIds([]);
        lassoActive = false;
        lassoPoints = [];
        renderNotebookShapes();
    }
    if (enabled) editor.querySelector('#selectionContextMenu')?.classList.add('hidden');

    const textarea = document.getElementById('notebookContent');
    if (textarea) {
        textarea.readOnly = enabled || ['pen', 'pencil', 'pen-fountain', 'eraser', 'highlighter', 'lasso', 'shapes'].includes(currentToolState.tool);
    }

    const modeButton = editor.querySelector('[data-editor-action="toggle-read-only"]');
    if (modeButton) {
        modeButton.setAttribute('aria-pressed', String(enabled));
        modeButton.setAttribute('aria-label', enabled ? 'Bearbeitungsmodus aktivieren' : 'Lesemodus aktivieren');
        modeButton.title = enabled ? 'Bearbeitungsmodus aktivieren' : 'Lesemodus aktivieren';
        modeButton.innerHTML = `<i data-lucide="${enabled ? 'pencil' : 'book-open'}" class="w-4 h-4"></i><span>${enabled ? 'Bearbeiten' : 'Nur lesen'}</span>`;
        lucide.createIcons();
    }

    editor.querySelectorAll('[data-editor-action]').forEach(button => {
        button.disabled = enabled && !readOnlyEditorActions.has(button.dataset.editorAction);
    });
    editor.querySelectorAll([
        '.editor-main-tools button',
        '.editor-floating-toolbar button',
        '.editor-history-controls button',
        '#editorPageSidebar .editor-add-page',
        '[data-pen-choice]',
        '[data-pen-color]',
        '[data-toolbar-toggle]',
        '.toolbar-select',
        '#applyPenSelection',
        '#editorColorPicker',
        '#editorImageInput',
        '#objectEmojiSelect',
        '#notebookOptionsMenu button[onclick]',
        '#notebookInfoPopover button'
    ].join(',')).forEach(control => {
        control.disabled = enabled;
    });
    updatePageCounter();
    updateEditorHistoryButtons();
    if (!enabled) updateDeleteShapeButton();
}

function getCurrentPageShapes() {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    const page = notebook && getNotebookPages(notebook)[currentPageIndex];
    if (!page) return [];
    if (!Array.isArray(page.shapes)) page.shapes = [];
    return page.shapes;
}

function getSelectedShapeIds() {
    if (selectedShapeIds.length) return selectedShapeIds;
    return selectedShapeId ? [selectedShapeId] : [];
}

function setSelectedShapeIds(ids) {
    selectedShapeIds = [...new Set(ids)];
    selectedShapeId = selectedShapeIds.length === 1 ? selectedShapeIds[0] : null;
    updateDeleteShapeButton();
}

function getElementBounds(element) {
    const left = Math.min(element.x1, element.x2);
    const top = Math.min(element.y1, element.y2);
    const right = Math.max(element.x1, element.x2);
    const bottom = Math.max(element.y1, element.y2);
    const rotation = Number(element.rotation) || 0;
    if (!rotation) return { left, top, right, bottom };
    const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
    const radians = rotation * Math.PI / 180;
    const corners = [
        [left, top], [right, top], [right, bottom], [left, bottom]
    ].map(([x, y]) => {
        const dx = x - center.x;
        const dy = y - center.y;
        return [
            center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
            center.y + dx * Math.sin(radians) + dy * Math.cos(radians)
        ];
    });
    return {
        left: Math.min(...corners.map(point => point[0])),
        top: Math.min(...corners.map(point => point[1])),
        right: Math.max(...corners.map(point => point[0])),
        bottom: Math.max(...corners.map(point => point[1]))
    };
}

function pointInPolygon(point, polygon) {
    if (polygon.length < 3) return false;
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
        const [x, y] = point;
        const [previousX, previousY] = polygon[previous];
        const [currentX, currentY] = polygon[index];
        const crosses = (currentY > y) !== (previousY > y)
            && x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
        if (crosses) inside = !inside;
    }
    return inside;
}

function pageElementIntersectsPolygon(element, polygon) {
    const bounds = getElementBounds(element);
    const corners = [
        [bounds.left, bounds.top],
        [bounds.right, bounds.top],
        [bounds.right, bounds.bottom],
        [bounds.left, bounds.bottom]
    ];
    if (corners.some(point => pointInPolygon(point, polygon))) return true;
    if (polygon.some(point => point[0] >= bounds.left && point[0] <= bounds.right
        && point[1] >= bounds.top && point[1] <= bounds.bottom)) return true;
    return element.kind === 'stroke'
        && (element.points || []).some(point => pointInPolygon(point, polygon));
}

function matchesLassoSelectionFilter(element) {
    if (lassoSelectionFilter === 'handwriting') return element.kind === 'stroke';
    if (lassoSelectionFilter === 'images') return element.kind === 'image';
    if (lassoSelectionFilter === 'text') return element.kind === 'text';
    if (lassoSelectionFilter === 'shapes') return !['stroke', 'image', 'text'].includes(element.kind);
    return true;
}

function updateDeleteShapeButton() {
    const button = document.querySelector('[data-editor-action="delete-selected-shape"]');
    if (button) button.disabled = getSelectedShapeIds().length === 0;
}

function getVectorStrokeOutline(stroke) {
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    if (!points.length) return [];
    const size = Math.max(Number(stroke.strokeWidth) || 1, 0.5);
    const getStroke = perfectFreehand?.getStroke;
    if (typeof getStroke === 'function') {
        return getStroke(points, {
            size,
            thinning: stroke.tool === 'highlighter' ? 0.08 : stroke.tool === 'pencil' ? 0.72 : 0.48,
            smoothing: 0.55,
            streamline: 0.45,
            simulatePressure: stroke.pointerType !== 'pen',
            last: true
        });
    }
    return [];
}

function getVectorStrokeBounds(points) {
    const validPoints = points.filter(point =>
        Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    );
    if (!validPoints.length) return { x1: 0, y1: 0, x2: 0, y2: 0 };
    return validPoints.reduce((bounds, point) => ({
        x1: Math.min(bounds.x1, point[0]),
        y1: Math.min(bounds.y1, point[1]),
        x2: Math.max(bounds.x2, point[0]),
        y2: Math.max(bounds.y2, point[1])
    }), {
        x1: validPoints[0][0],
        y1: validPoints[0][1],
        x2: validPoints[0][0],
        y2: validPoints[0][1]
    });
}

function distanceToSegment(point, start, end) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    if (!dx && !dy) return Math.hypot(point[0] - start[0], point[1] - start[1]);
    const progress = Math.max(0, Math.min(1,
        ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)
    ));
    return Math.hypot(point[0] - (start[0] + progress * dx), point[1] - (start[1] + progress * dy));
}

function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
    const orientation = (first, second, third) =>
        (second[0] - first[0]) * (third[1] - first[1])
        - (second[1] - first[1]) * (third[0] - first[0]);
    const onSegment = (first, second, point) =>
        point[0] >= Math.min(first[0], second[0]) - 1e-8
        && point[0] <= Math.max(first[0], second[0]) + 1e-8
        && point[1] >= Math.min(first[1], second[1]) - 1e-8
        && point[1] <= Math.max(first[1], second[1]) + 1e-8;
    const firstOrientation = orientation(firstStart, firstEnd, secondStart);
    const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
    const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
    const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);
    if (firstOrientation * secondOrientation < 0 && thirdOrientation * fourthOrientation < 0) return true;
    return (Math.abs(firstOrientation) <= 1e-8 && onSegment(firstStart, firstEnd, secondStart))
        || (Math.abs(secondOrientation) <= 1e-8 && onSegment(firstStart, firstEnd, secondEnd))
        || (Math.abs(thirdOrientation) <= 1e-8 && onSegment(secondStart, secondEnd, firstStart))
        || (Math.abs(fourthOrientation) <= 1e-8 && onSegment(secondStart, secondEnd, firstEnd));
}

function vectorStrokeIntersectsEraser(stroke, eraserPoints, radius) {
    const strokeBounds = getVectorStrokeBounds(stroke.points || []);
    const eraserBounds = getVectorStrokeBounds(eraserPoints);
    if (strokeBounds.x2 + radius < eraserBounds.x1 || eraserBounds.x2 + radius < strokeBounds.x1
        || strokeBounds.y2 + radius < eraserBounds.y1 || eraserBounds.y2 + radius < strokeBounds.y1) {
        return false;
    }
    const points = stroke.points || [];
    if (!points.length || !eraserPoints.length) return false;
    for (let strokeIndex = 0; strokeIndex < Math.max(points.length - 1, 1); strokeIndex += 1) {
        const strokeStart = points[strokeIndex];
        const strokeEnd = points[Math.min(strokeIndex + 1, points.length - 1)];
        for (let eraserIndex = 0; eraserIndex < eraserPoints.length; eraserIndex += 1) {
            const eraserStart = eraserPoints[eraserIndex];
            const eraserEnd = eraserPoints[Math.min(eraserIndex + 1, eraserPoints.length - 1)];
            if (segmentsIntersect(strokeStart, strokeEnd, eraserStart, eraserEnd)
                || distanceToSegment(strokeStart, eraserStart, eraserEnd) <= radius
                || distanceToSegment(strokeEnd, eraserStart, eraserEnd) <= radius
                || distanceToSegment(eraserStart, strokeStart, strokeEnd) <= radius
                || distanceToSegment(eraserEnd, strokeStart, strokeEnd) <= radius) {
                return true;
            }
        }
    }
    return false;
}

function pointNearEraser(point, eraserPoints, radius) {
    for (let index = 0; index < eraserPoints.length; index += 1) {
        const start = eraserPoints[index];
        const end = eraserPoints[Math.min(index + 1, eraserPoints.length - 1)];
        if (distanceToSegment(point, start, end) <= radius) return true;
    }
    return false;
}

function eraseVectorStroke(stroke, eraserPoints, radius) {
    if (!vectorStrokeIntersectsEraser(stroke, eraserPoints, radius)) return [stroke];
    const points = stroke.points || [];
    if (points.length < 2) return [];
    const sampleStep = Math.max(radius * 0.5, 1);
    const pieces = [];
    let currentPiece = [];
    const finishPiece = () => {
        if (currentPiece.length > 1) pieces.push(currentPiece);
        currentPiece = [];
    };

    for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
        const steps = Math.max(1, Math.ceil(segmentLength / sampleStep));
        for (let step = index ? 1 : 0; step <= steps; step += 1) {
            const progress = step / steps;
            const point = [
                start[0] + (end[0] - start[0]) * progress,
                start[1] + (end[1] - start[1]) * progress,
                (start[2] ?? 0.5) + ((end[2] ?? 0.5) - (start[2] ?? 0.5)) * progress
            ];
            if (pointNearEraser(point, eraserPoints, radius)) {
                finishPiece();
            } else {
                currentPiece.push(point);
            }
        }
    }
    finishPiece();
    return pieces.map((piece, index) => ({
        ...stroke,
        id: `${stroke.id}-part-${Date.now()}-${index}`,
        ...getVectorStrokeBounds(piece),
        points: piece
    }));
}

function renderNotebookShapes() {
    const svg = document.getElementById('notebookShapes');
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    const width = bounds.width / currentPageZoom;
    const height = bounds.height / currentPageZoom;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.replaceChildren();

    const namespace = 'http://www.w3.org/2000/svg';
    const shapes = [...getCurrentPageShapes()].sort((first, second) => {
        const firstLayer = first.kind === 'stroke' ? first.tool === 'highlighter' ? 0 : 1 : 2;
        const secondLayer = second.kind === 'stroke' ? second.tool === 'highlighter' ? 0 : 1 : 2;
        return firstLayer - secondLayer;
    });
    const selectedIds = new Set(getSelectedShapeIds());
    shapes.forEach(shape => {
        const group = document.createElementNS(namespace, 'g');
        group.dataset.shapeId = shape.id;
        const minX = Math.min(shape.x1, shape.x2);
        const minY = Math.min(shape.y1, shape.y2);
        const width = Math.abs(shape.x2 - shape.x1);
        const height = Math.abs(shape.y2 - shape.y1);
        let figure;
        if (shape.rotation) {
            group.setAttribute(
                'transform',
                `rotate(${shape.rotation} ${minX + width / 2} ${minY + height / 2})`
            );
        }
        if (shape.kind === 'stroke') {
            figure = document.createElementNS(namespace, 'path');
            const outline = getVectorStrokeOutline(shape);
            const strokePoints = outline.length ? outline : shape.points || [];
            const pathData = strokePoints.map((point, index) =>
                `${index ? 'L' : 'M'} ${point[0]} ${point[1]}`
            ).join(' ');
            figure.setAttribute('d', outline.length ? `${pathData} Z` : pathData);
            figure.setAttribute('fill', outline.length ? shape.color : 'none');
            figure.setAttribute('stroke', outline.length ? 'none' : shape.color);
            figure.setAttribute('stroke-width', String(Math.max(Number(shape.strokeWidth) || 1, 0.5)));
            figure.setAttribute('stroke-linecap', 'round');
            figure.setAttribute('stroke-linejoin', 'round');
            figure.setAttribute('opacity', String(shape.opacity ?? 1));
            figure.classList.add('notebook-stroke');
        } else if (shape.kind === 'emoji') {
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
        } else if (shape.kind === 'text') {
            figure = document.createElementNS(namespace, 'text');
            const fontSize = Math.max(Number(shape.fontSize) || 18, 8);
            const alignment = ['center', 'right'].includes(shape.align) ? shape.align : 'left';
            const textX = alignment === 'center' ? minX + width / 2
                : alignment === 'right' ? minX + width : minX + 4;
            figure.setAttribute('x', String(textX));
            figure.setAttribute('fill', shape.color || '#111111');
            figure.setAttribute('font-size', String(fontSize));
            figure.setAttribute('font-family', shape.fontFamily || 'Arial, sans-serif');
            figure.setAttribute('font-weight', shape.bold ? '700' : '400');
            figure.setAttribute('font-style', shape.italic ? 'italic' : 'normal');
            figure.setAttribute('text-anchor', alignment === 'left' ? 'start' : alignment);
            figure.classList.add('notebook-text-object');
            String(shape.text || '').split(/\r?\n/).forEach((line, index) => {
                const lineElement = document.createElementNS(namespace, 'tspan');
                lineElement.setAttribute('x', String(textX));
                lineElement.setAttribute('y', String(minY + fontSize + index * fontSize * 1.35));
                lineElement.textContent = line;
                figure.appendChild(lineElement);
            });
            const hitTarget = document.createElementNS(namespace, 'rect');
            hitTarget.setAttribute('x', String(minX));
            hitTarget.setAttribute('y', String(minY));
            hitTarget.setAttribute('width', String(Math.max(width, 24)));
            hitTarget.setAttribute('height', String(Math.max(height, fontSize + 8)));
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
        if (!['emoji', 'image', 'stroke', 'text'].includes(shape.kind)) {
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
        } else if (shape.kind === 'stroke') {
            const hitTarget = figure.cloneNode();
            hitTarget.classList.remove('notebook-stroke');
            hitTarget.classList.add('shape-hit-target', 'stroke-hit-target');
            hitTarget.setAttribute('fill', 'none');
            hitTarget.setAttribute('stroke', 'transparent');
            hitTarget.setAttribute('stroke-width', String(Math.max((Number(shape.strokeWidth) || 1) + 12, 16)));
            group.appendChild(hitTarget);
        }
        group.appendChild(figure);

        if (selectedIds.has(shape.id)) {
            const selection = document.createElementNS(namespace, 'rect');
            selection.setAttribute('x', String(minX - 5));
            selection.setAttribute('y', String(minY - 5));
            selection.setAttribute('width', String(Math.max(width + 10, 10)));
            selection.setAttribute('height', String(Math.max(height + 10, 10)));
            selection.classList.add('shape-selection-box', 'element-selection-box');
            group.appendChild(selection);
        }
        svg.appendChild(group);
    });
    const selectedShapes = shapes.filter(shape => selectedIds.has(shape.id));
    if (selectedShapes.length) {
        const bounds = selectedShapes.reduce((result, shape) => {
            const elementBounds = getElementBounds(shape);
            return {
                left: Math.min(result.left, elementBounds.left),
                top: Math.min(result.top, elementBounds.top),
                right: Math.max(result.right, elementBounds.right),
                bottom: Math.max(result.bottom, elementBounds.bottom)
            };
        }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
        const overlay = document.createElementNS(namespace, 'g');
        overlay.classList.add('selection-overlay');
        const selection = document.createElementNS(namespace, 'rect');
        selection.setAttribute('x', String(bounds.left - 5));
        selection.setAttribute('y', String(bounds.top - 5));
        selection.setAttribute('width', String(Math.max(bounds.right - bounds.left + 10, 10)));
        selection.setAttribute('height', String(Math.max(bounds.bottom - bounds.top + 10, 10)));
        selection.classList.add('shape-selection-box');
        overlay.appendChild(selection);
        ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(handle => {
            const handleRect = document.createElementNS(namespace, 'rect');
            const x = handle.includes('w') ? bounds.left - 5 : handle.includes('e') ? bounds.right + 1 : (bounds.left + bounds.right) / 2 - 4;
            const y = handle.includes('n') ? bounds.top - 5 : handle.includes('s') ? bounds.bottom + 1 : (bounds.top + bounds.bottom) / 2 - 4;
            handleRect.setAttribute('x', String(x));
            handleRect.setAttribute('y', String(y));
            handleRect.setAttribute('width', '8');
            handleRect.setAttribute('height', '8');
            handleRect.dataset.shapeHandle = handle;
            handleRect.classList.add('shape-handle');
            overlay.appendChild(handleRect);
        });
        const rotationStem = document.createElementNS(namespace, 'line');
        rotationStem.setAttribute('x1', String((bounds.left + bounds.right) / 2));
        rotationStem.setAttribute('y1', String(bounds.top - 5));
        rotationStem.setAttribute('x2', String((bounds.left + bounds.right) / 2));
        rotationStem.setAttribute('y2', String(bounds.top - 20));
        rotationStem.classList.add('shape-selection-box');
        overlay.appendChild(rotationStem);
        const rotationHandle = document.createElementNS(namespace, 'circle');
        rotationHandle.setAttribute('cx', String((bounds.left + bounds.right) / 2));
        rotationHandle.setAttribute('cy', String(bounds.top - 20));
        rotationHandle.setAttribute('r', '6');
        rotationHandle.dataset.shapeRotate = 'true';
        rotationHandle.classList.add('shape-handle', 'shape-rotate-handle');
        overlay.appendChild(rotationHandle);
        svg.appendChild(overlay);
    }
    if (lassoActive && lassoPoints.length) {
        const contour = document.createElementNS(namespace, 'path');
        contour.setAttribute('d', lassoPoints.map((point, index) =>
            `${index ? 'L' : 'M'} ${point[0]} ${point[1]}`
        ).join(' '));
        contour.classList.add('lasso-contour');
        svg.appendChild(contour);
    }
    updateDeleteShapeButton();
}

function deleteSelectedShape() {
    if (isNotebookReadOnly || !getSelectedShapeIds().length) return;
    const shapes = getCurrentPageShapes();
    const selectedIds = new Set(getSelectedShapeIds());
    const survivors = shapes.filter(shape => !selectedIds.has(shape.id));
    if (survivors.length === shapes.length) return;
    recordEditorHistory(captureEditorSnapshot(['shapes']));
    shapes.splice(0, shapes.length, ...survivors);
    setSelectedShapeIds([]);
    renderNotebookShapes();
    persistNotebookPages();
}

document.addEventListener('keydown', event => {
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) return;
    if (isNotebookReadOnly || currentToolState.tool !== 'lasso') return;
    const key = event.key.toLowerCase();
    const command = event.ctrlKey || event.metaKey;
    if (command && key === 'c') {
        event.preventDefault();
        copySelectedPageElements();
        return;
    }
    if (command && key === 'x') {
        event.preventDefault();
        copySelectedPageElements(true);
        return;
    }
    if (command && key === 'v') {
        event.preventDefault();
        duplicatePageElements(editorClipboardElements);
        return;
    }
    if (command && key === 'd') {
        event.preventDefault();
        duplicatePageElements();
        return;
    }
    if (key === 'escape') {
        document.getElementById('selectionContextMenu')?.classList.add('hidden');
        setSelectedShapeIds([]);
        renderNotebookShapes();
        return;
    }
    if (!getSelectedShapeIds().length || !['delete', 'backspace'].includes(key)) return;
    event.preventDefault();
    deleteSelectedShape();
});

function updateSelectedShape(changes) {
    const selectedIds = new Set(getSelectedShapeIds());
    if (isNotebookReadOnly || !selectedIds.size) return;
    const shapes = getCurrentPageShapes();
    if (!shapes.some(shape => selectedIds.has(shape.id) && !['emoji', 'image'].includes(shape.kind))) return;
    recordEditorHistory(captureEditorSnapshot(['shapes']));
    shapes.forEach(shape => {
        if (selectedIds.has(shape.id) && !['emoji', 'image'].includes(shape.kind)) Object.assign(shape, changes);
    });
    renderNotebookShapes();
    persistNotebookPages();
}

function clonePageElement(element, offset = 0) {
    const clone = JSON.parse(JSON.stringify(element));
    clone.id = `${element.kind || 'element'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    clone.x1 += offset;
    clone.x2 += offset;
    clone.y1 += offset;
    clone.y2 += offset;
    if (Array.isArray(clone.points)) {
        clone.points = clone.points.map(point => [point[0] + offset, point[1] + offset, point[2]]);
    }
    return clone;
}

function getSelectedPageElements() {
    const selectedIds = new Set(getSelectedShapeIds());
    return getCurrentPageShapes().filter(element => selectedIds.has(element.id));
}

function copySelectedPageElements(cut = false) {
    const selected = getSelectedPageElements();
    if (!selected.length) return;
    editorClipboardElements = selected.map(element => JSON.parse(JSON.stringify(element)));
    if (cut) deleteSelectedShape();
}

function duplicatePageElements(elements = getSelectedPageElements()) {
    if (isNotebookReadOnly || !elements.length) return;
    const clones = elements.map(element => clonePageElement(element, 16));
    recordEditorHistory(captureEditorSnapshot(['shapes']));
    getCurrentPageShapes().push(...clones);
    setSelectedShapeIds(clones.map(element => element.id));
    renderNotebookShapes();
    persistNotebookPages();
}

function openTextBoxEditor(textBoxId = null) {
    if (isNotebookReadOnly) return;
    editingTextBoxId = textBoxId;
    const textBox = textBoxId && getCurrentPageShapes().find(shape => shape.id === textBoxId);
    const modal = document.getElementById('textBoxModal');
    const input = document.getElementById('textBoxContent');
    if (!modal || !input) return;
    if (textBoxId && !textBox) throw new Error('Das zu bearbeitende Textfeld wurde nicht gefunden.');
    input.value = textBox?.text || '';
    const title = document.getElementById('textBoxModalTitle');
    if (title) title.textContent = textBox ? 'Textfeld bearbeiten' : 'Textfeld einfügen';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    input.focus();
}

function addTextBox() {
    openTextBoxEditor();
}

function saveTextBoxEditor() {
    if (isNotebookReadOnly) return;
    const input = document.getElementById('textBoxContent');
    const text = input?.value ?? '';
    const existing = editingTextBoxId
        ? getCurrentPageShapes().find(shape => shape.id === editingTextBoxId)
        : null;
    if (editingTextBoxId && !existing) {
        editingTextBoxId = null;
        throw new Error('Das zu bearbeitende Textfeld wurde nicht gefunden.');
    }
    if (existing) {
        if (existing.text !== text) {
            recordEditorHistory(captureEditorSnapshot(['shapes']));
            existing.text = text;
            const lineCount = text.split(/\r?\n/).length;
            existing.y2 = existing.y1 + Math.max(Number(existing.fontSize) || 18, 8) * lineCount * 1.35 + 8;
            renderNotebookShapes();
            persistNotebookPages();
            recordAudioNoteEvent('textbox', existing.id);
        }
    } else if (text.trim()) {
        const canvas = document.getElementById('notebookDrawing');
        const bounds = canvas?.getBoundingClientRect();
        if (!bounds) throw new Error('Die Notizseite ist derzeit nicht verfügbar.');
        const pageWidth = bounds.width / currentPageZoom;
        const pageHeight = bounds.height / currentPageZoom;
        const fontSize = 18;
        const lines = text.split(/\r?\n/);
        const width = Math.min(280, Math.max(100, pageWidth - 24));
        const height = Math.min(pageHeight - 24, Math.max(fontSize * 2, lines.length * fontSize * 1.35 + 8));
        const x = Math.max(12, (pageWidth - width) / 2);
        const y = Math.max(12, (pageHeight - height) / 2);
        const element = {
            id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            kind: 'text',
            text,
            x1: x,
            y1: y,
            x2: x + width,
            y2: y + height,
            fontSize,
            fontFamily: 'Arial, sans-serif',
            color: activePenColor || '#111111',
            align: 'left'
        };
        recordEditorHistory(captureEditorSnapshot(['shapes']));
        getCurrentPageShapes().push(element);
        setSelectedShapeIds([element.id]);
        renderNotebookShapes();
        persistNotebookPages();
        recordAudioNoteEvent('textbox', element.id);
        setEditorTool('lasso');
    }
    const modal = document.getElementById('textBoxModal');
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
    editingTextBoxId = null;
}

function editSelectedTextBox() {
    if (isNotebookReadOnly) return;
    const selected = getSelectedPageElements().filter(element => element.kind === 'text');
    if (selected.length !== 1) return;
    openTextBoxEditor(selected[0].id);
}

function cancelTextBoxEditor() {
    const modal = document.getElementById('textBoxModal');
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
    editingTextBoxId = null;
}

function createSelectionImageBlob() {
    const svg = document.getElementById('notebookShapes');
    const selectedIds = new Set(getSelectedShapeIds());
    const elements = getCurrentPageShapes().filter(element => selectedIds.has(element.id));
    if (!svg || !elements.length) throw new Error('Wähle zuerst mindestens ein Element aus.');
    const bounds = elements.reduce((result, element) => {
        const elementBounds = getElementBounds(element);
        return {
            left: Math.min(result.left, elementBounds.left),
            top: Math.min(result.top, elementBounds.top),
            right: Math.max(result.right, elementBounds.right),
            bottom: Math.max(result.bottom, elementBounds.bottom)
        };
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const padding = 8;
    const width = Math.max(1, Math.ceil(bounds.right - bounds.left + padding * 2));
    const height = Math.max(1, Math.ceil(bounds.bottom - bounds.top + padding * 2));
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    root.setAttribute('width', String(width));
    root.setAttribute('height', String(height));
    root.setAttribute('viewBox', `${bounds.left - padding} ${bounds.top - padding} ${width} ${height}`);
    for (const element of elements) {
        const group = [...svg.querySelectorAll('g[data-shape-id]')]
            .find(item => item.dataset.shapeId === element.id);
        if (!group) continue;
        const clone = group.cloneNode(true);
        clone.querySelectorAll('.shape-hit-target, .shape-selection-box, .shape-handle').forEach(node => node.remove());
        root.appendChild(clone);
    }
    const svgBlob = new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(3, window.devicePixelRatio || 1);
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const context = canvas.getContext('2d');
            context.scale(scale, scale);
            context.drawImage(image, 0, 0, width, height);
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Die Auswahl konnte nicht als Bild gerendert werden.'));
            }, 'image/png');
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Die Auswahl konnte nicht als SVG dargestellt werden.'));
        };
        image.src = url;
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportSelectionAsImage(share = false) {
    try {
        const blob = await createSelectionImageBlob();
        const file = new File([blob], 'mynotes-auswahl.png', { type: 'image/png' });
        if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: 'MyNotes-Auswahl' });
        } else {
            downloadBlob(blob, file.name);
            if (share) alert('Teilen wird von diesem Browser nicht unterstützt. Das Bild wurde heruntergeladen.');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Auswahl konnte nicht exportiert werden:', error);
            alert(`Auswahl konnte nicht exportiert werden: ${error.message || error}`);
        }
    }
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
    setSelectedShapeIds([objectId]);
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

