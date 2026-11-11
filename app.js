lucide.createIcons();

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
    } else {
        alert(`${action[0].toUpperCase()}${action.slice(1)} ist in MyNotes noch nicht verfügbar.`);
    }
}

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
    localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
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
        content: ''
    };

    notebooks.push(newNb);
    localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));

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
let activeDrawing = false;
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
    localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
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
    if (counter) counter.textContent = `${currentPageIndex + 1} von ${pages.length || 1}`;
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
        ? { content: currentPage.content, drawing: currentPage.drawing, shapes: (currentPage.shapes || []).map(shape => ({ ...shape })) }
        : { content: '', drawing: '', shapes: [] };
    pages.splice(currentPageIndex + 1, 0, page);
    currentPageIndex += 1;
    localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
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

function setEditorTool(tool) {
    activeEditorTool = tool;
    document.querySelectorAll('[data-editor-tool]').forEach(button => {
        const selected = button.dataset.editorTool === tool;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    const canvas = document.getElementById('notebookDrawing');
    const textarea = document.getElementById('notebookContent');
    if (canvas) canvas.classList.toggle('is-drawable', ['pen', 'pen-fountain', 'eraser', 'highlighter', 'shapes', 'sticky', 'objects'].includes(tool));
    if (textarea) textarea.readOnly = ['pen', 'eraser', 'highlighter', 'lasso', 'shapes'].includes(tool);
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

function attachEditorInteractions() {
    const editor = document.getElementById('notebookEditor');
    const textarea = document.getElementById('notebookContent');
    const canvas = document.getElementById('notebookDrawing');
    const canvasArea = document.querySelector('.editor-canvas-area');
    const laserDot = document.getElementById('editorLaserDot');
    if (!editor || !textarea || !canvas || !canvasArea || !laserDot) return;

    editor.addEventListener('click', event => {
        const toolButton = event.target.closest('[data-editor-tool]');
        if (toolButton) {
            setEditorTool(toolButton.dataset.editorTool);
            return;
        }
        const actionButton = event.target.closest('[data-editor-action]');
        if (actionButton) runEditorAction(actionButton.dataset.editorAction);
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
    canvas.addEventListener('pointerdown', event => {
        if (!canvas.classList.contains('is-drawable')) return;
        if (!['pen', 'pen-fountain', 'eraser', 'highlighter', 'shapes', 'sticky', 'objects'].includes(activeEditorTool)) return;
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
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.globalCompositeOperation = activeEditorTool === 'eraser' ? 'destination-out' : 'source-over';
        context.strokeStyle = activeEditorTool === 'highlighter' ? `${activePenColor}66` : activePenColor;
        context.lineWidth = activeEditorTool === 'eraser' ? activePenWidth * 4 : activePenWidth;
        if (activeEditorTool === 'eraser') {
            context.beginPath();
            context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2);
            context.fill();
            context.beginPath();
            context.moveTo(point.x, point.y);
        }
    });
    canvas.addEventListener('pointermove', event => {
        if (!activeDrawing) return;
        const point = pointFromEvent(event);
        if (activeEditorTool === 'shapes') drawingEndPoint = point;
        if (activeEditorTool === 'shapes') return;
        context.lineTo(point.x, point.y);
        context.stroke();
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
                strokeWidth: activePenWidth
            });
            selectedShapeId = shapeId;
            renderNotebookShapes();
        }
        activeDrawing = false;
        drawingStartPoint = null;
        drawingEndPoint = null;
        drawingSnapshot = null;
        context.globalCompositeOperation = 'source-over';
        persistNotebookPages();
        if (completedTool === 'shapes' || completedTool === 'objects') setEditorTool('lasso');
    }
    canvas.addEventListener('pointerup', finishDrawing);
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
            activePenColor = button.dataset.penColor;
            editor.querySelectorAll('[data-pen-color]').forEach(colorButton => colorButton.classList.toggle('is-color-selected', colorButton === button));
            if (activeEditorTool === 'lasso') updateSelectedShape({ color: activePenColor });
        });
    });
    editor.querySelectorAll('[data-shape-kind]').forEach(button => {
        button.addEventListener('click', () => {
            activeShape = button.dataset.shapeKind;
            setEditorTool('shapes');
            editor.querySelectorAll('[data-shape-kind]').forEach(shapeButton => shapeButton.classList.toggle('is-width-selected', shapeButton === button));
        });
    });
    editor.querySelectorAll('[data-object-emoji]').forEach(button => {
        button.addEventListener('click', () => {
            activeObjectEmoji = button.dataset.objectEmoji;
            setEditorTool('objects');
            editor.querySelectorAll('[data-object-emoji]').forEach(objectButton => objectButton.classList.toggle('is-width-selected', objectButton === button));
        });
    });
    document.getElementById('editorColorPicker').addEventListener('input', event => {
        activePenColor = event.target.value;
        editor.querySelectorAll('[data-pen-color]').forEach(colorButton => colorButton.classList.remove('is-color-selected'));
        if (activeEditorTool === 'lasso') updateSelectedShape({ color: activePenColor });
    });
    editor.querySelectorAll('[data-pen-width]').forEach(button => {
        button.addEventListener('click', () => {
            activePenWidth = Number(button.dataset.penWidth);
            editor.querySelectorAll('[data-pen-width]').forEach(widthButton => widthButton.classList.toggle('is-width-selected', widthButton === button));
            if (activeEditorTool === 'lasso') updateSelectedShape({ strokeWidth: activePenWidth });
        });
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

function runEditorAction(action) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    if (!notebook) return;
    if (action === 'add-page') addNotebookPage();
    else if (action === 'duplicate-page') addNotebookPage(true);
    else if (action === 'previous-page') showNotebookPage(currentPageIndex - 1);
    else if (action === 'next-page') showNotebookPage(currentPageIndex + 1);
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
        localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
        closeMenu();
    } else if (action === 'change-template') {
        alert(`Vorlage: ${notebook.template}`);
        closeMenu();
    } else if (action === 'rotate-page') {
        const pageIndex = currentPageIndex;
        notebook.orientation = notebook.orientation === 'landscape' ? 'portrait' : 'landscape';
        localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
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

function openNotebook(id) {
    const nb = notebooks.find(item => item.id === id);
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
                    <button class="floating-tool" data-editor-tool="lasso" title="Auswahl: Formen bearbeiten" aria-label="Auswahl"><i data-lucide="mouse-pointer-2"></i></button>
                    <button class="floating-tool" data-editor-action="delete-selected-shape" aria-label="Ausgewählte Form löschen" title="Ausgewählte Form löschen" disabled><i data-lucide="trash-2"></i></button>
                    <button class="floating-tool is-active" data-editor-tool="pen" title="Kugelschreiber"><i data-lucide="pen-tool"></i><i data-lucide="chevron-down" class="editor-caret"></i></button>
                    <button class="floating-tool" data-editor-tool="pen-fountain" title="Füllfederhalter"><i data-lucide="pen-line"></i></button>
                    <button class="floating-tool" data-editor-tool="highlighter" title="Textmarker"><i data-lucide="highlighter"></i></button>
                    <button class="floating-tool" data-editor-tool="eraser" title="Radierer"><i data-lucide="eraser"></i></button>
                    <button class="floating-tool" data-editor-tool="shapes" title="Formen"><i data-lucide="shapes"></i></button>
                    <span class="toolbar-separator"></span>
                    <button class="pen-width is-width-selected" data-shape-kind="line" aria-label="Gerade Linie">╱</button>
                    <button class="pen-width" data-shape-kind="rectangle" aria-label="Rechteck">□</button>
                    <button class="pen-width" data-shape-kind="circle" aria-label="Kreis">○</button>
                    <span class="toolbar-separator"></span>
                    <button class="pen-width" data-object-emoji="⭐" aria-label="Stern">⭐</button>
                    <button class="pen-width" data-object-emoji="❤️" aria-label="Herz">❤️</button>
                    <button class="pen-width" data-object-emoji="😊" aria-label="Smiley">😊</button>
                    <span class="toolbar-separator"></span>
                    <button class="pen-width" data-pen-width="1" aria-label="Dünne Linie"><span></span></button>
                    <button class="pen-width is-width-selected" data-pen-width="3" aria-label="Mittlere Linie"><span></span></button>
                    <button class="pen-width" data-pen-width="5" aria-label="Dicke Linie"><span></span></button>
                    <span class="toolbar-separator"></span>
                    <button class="pen-color is-color-selected" data-pen-color="#111111" aria-label="Schwarz"></button>
                    <button class="pen-color" data-pen-color="#1685f8" aria-label="Blau"></button>
                    <button class="pen-color pen-color-white" data-pen-color="#ffffff" aria-label="Weiß"></button>
                    <button class="floating-tool" data-editor-action="choose-color" title="Weitere Farben"><i data-lucide="circle-plus"></i></button>
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
        localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
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
        notebooks = notebooks.filter(item => item.id !== id);
        localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker erfolgreich registriert:', reg))
            .catch(err => console.log('Service Worker Fehler:', err));
    });
}
