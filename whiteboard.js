// Offline-first infinite whiteboard integrated with the existing Dexie and Supabase stores.
const WHITEBOARD_HISTORY_LIMIT = 25;
const WHITEBOARD_ASSET_PREFIX = '__mynotes_whiteboard__';
let whiteboardState = null;
let whiteboardTool = 'pen';
let whiteboardPreview = null;
let whiteboardInteraction = null;
let whiteboardPendingText = null;
let whiteboardSaveTimer = null;
let whiteboardSaveTask = null;
let whiteboardSaveRequested = false;
let whiteboardCanvasFrame = 0;
let whiteboardCanvasDpr = 1;
let whiteboardInputPointers = new Map();
let whiteboardGesture = null;
let whiteboardImageCache = new Map();
let whiteboardClipboard = [];
let whiteboardSpaceDown = false;
let whiteboardInitialized = false;
let whiteboardLaserStrokes = [];

function createWhiteboardId(prefix = 'whiteboard') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneWhiteboardValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function getWhiteboardElements() {
    return {
        modal: document.getElementById('whiteboardModal'),
        canvas: document.getElementById('whiteboardCanvas'),
        viewport: document.getElementById('whiteboardViewport'),
        status: document.getElementById('whiteboardStatus'),
        saveStatus: document.getElementById('whiteboardSaveStatus'),
        list: document.getElementById('whiteboardBoardList'),
        title: document.getElementById('whiteboardTitle'),
        color: document.getElementById('whiteboardColor'),
        width: document.getElementById('whiteboardWidth'),
        opacity: document.getElementById('whiteboardOpacity'),
        grid: document.getElementById('whiteboardGrid'),
        background: document.getElementById('whiteboardBackground'),
        inputMode: document.getElementById('whiteboardInputMode'),
        eraserMode: document.getElementById('whiteboardEraserMode'),
        shapeType: document.getElementById('whiteboardShapeType'),
        hint: document.getElementById('whiteboardCanvasHint'),
        zoom: document.getElementById('whiteboardZoomValue'),
        textDialog: document.getElementById('whiteboardTextDialog'),
        textInput: document.getElementById('whiteboardTextInput')
    };
}

function setWhiteboardStatus(message, saveState = null) {
    const elements = getWhiteboardElements();
    if (elements.status) elements.status.textContent = message;
    if (elements.saveStatus) {
        elements.saveStatus.textContent = saveState === 'pending'
            ? 'Speichert …'
            : saveState === 'error'
                ? 'Speichern fehlgeschlagen'
                : saveState === 'saved'
                    ? 'Gespeichert'
                    : 'Lokal gespeichert';
        elements.saveStatus.classList.toggle('is-pending', saveState === 'pending');
        elements.saveStatus.classList.toggle('is-error', saveState === 'error');
    }
}

function getWhiteboardTemplate(title = 'Unbenanntes Whiteboard') {
    const now = new Date().toISOString();
    return {
        id: createWhiteboardId(),
        title,
        createdAt: now,
        updatedAt: now,
        syncBaseUpdatedAt: null,
        deletedAt: null,
        favorite: false,
        background: '#FAFAFA',
        grid: 'none',
        viewport: { x: 0, y: 0, scale: 1 },
        inputMode: 'automatic',
        color: '#172554',
        width: 4,
        opacity: 1,
        penType: 'fountain',
        toolSettings: {
            fountain: { color: '#172554', width: 4, opacity: 1, pressure: 1, smoothing: 0.2 },
            ballpoint: { color: '#172554', width: 3, opacity: 1, pressure: 0.15, smoothing: 0.12 },
            pencil: { color: '#172554', width: 5, opacity: 0.55, pressure: 0.65, smoothing: 0.3 },
            fineliner: { color: '#172554', width: 2, opacity: 1, pressure: 0, smoothing: 0.15 },
            brush: { color: '#172554', width: 8, opacity: 0.9, pressure: 1, smoothing: 0.25 },
            glaze: { color: '#172554', width: 8, opacity: 0.4, pressure: 0.6, smoothing: 0.2 },
            highlighter: { color: '#fde047', width: 18, opacity: 0.6, pressure: 0, smoothing: 0.15 }
        },
        fillColor: '#dbeafe',
        shapeFill: false,
        shapeDashed: false,
        autoShape: false,
        eraserSize: 14,
        recentColors: [],
        eraserMode: 'stroke',
        objects: [],
        assetIds: [],
        undoHistory: [],
        redoHistory: []
    };
}

function normalizeWhiteboard(record) {
    const board = { ...getWhiteboardTemplate(), ...record };
    if (board.grid === 'dots') board.grid = 'none';
    board.objects = Array.isArray(record.objects) ? record.objects : [];
    board.assetIds = Array.isArray(record.assetIds) ? [...new Set(record.assetIds.map(String))] : [];
    board.viewport = {
        x: Number(record.viewport?.x) || 0,
        y: Number(record.viewport?.y) || 0,
        scale: Math.min(5, Math.max(0.1, Number(record.viewport?.scale) || 1))
    };
    board.undoHistory = Array.isArray(record.undoHistory) ? record.undoHistory.slice(-WHITEBOARD_HISTORY_LIMIT) : [];
    board.redoHistory = Array.isArray(record.redoHistory) ? record.redoHistory.slice(-WHITEBOARD_HISTORY_LIMIT) : [];
    board.toolSettings = { ...getWhiteboardTemplate().toolSettings, ...(record.toolSettings || {}) };
    for (const [type, defaults] of Object.entries(getWhiteboardTemplate().toolSettings)) {
        board.toolSettings[type] = { ...defaults, ...(record.toolSettings?.[type] || {}) };
    }
    return board;
}

function whiteboardWorldPoint(event) {
    const { viewport, canvas } = getWhiteboardElements();
    const bounds = viewport.getBoundingClientRect();
    const screenX = event.clientX - bounds.left;
    const screenY = event.clientY - bounds.top;
    return {
        x: (screenX - whiteboardState.viewport.x) / whiteboardState.viewport.scale,
        y: (screenY - whiteboardState.viewport.y) / whiteboardState.viewport.scale
    };
}

function whiteboardScreenPoint(event) {
    const bounds = getWhiteboardElements().viewport.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function renderWhiteboard() {
    if (!whiteboardState) return;
    const { canvas, viewport, zoom, hint } = getWhiteboardElements();
    const bounds = viewport.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    whiteboardCanvasDpr = Math.min(3, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(bounds.width * whiteboardCanvasDpr));
    const pixelHeight = Math.max(1, Math.round(bounds.height * whiteboardCanvasDpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }
    const context = canvas.getContext('2d');
    if (!context) {
        setWhiteboardStatus('Die Zeichenfläche konnte nicht initialisiert werden.');
        return;
    }
    context.setTransform(whiteboardCanvasDpr, 0, 0, whiteboardCanvasDpr, 0, 0);
    window.MyNotesWhiteboardEngine.drawScene(
        context,
        bounds.width,
        bounds.height,
        whiteboardLaserStrokes.length
            ? { ...whiteboardState, objects: [...whiteboardState.objects, ...whiteboardLaserStrokes] }
            : whiteboardState,
        whiteboardState.viewport,
        new Map([...whiteboardImageCache].map(([id, value]) => [id, value.image])),
        whiteboardPreview
    );
    const hasContent = whiteboardState.objects.length > 0;
    hint.classList.toggle('hidden', hasContent);
    zoom.textContent = `${Math.round(whiteboardState.viewport.scale * 100)}%`;
}

function requestWhiteboardRender() {
    if (whiteboardCanvasFrame) return;
    whiteboardCanvasFrame = requestAnimationFrame(() => {
        whiteboardCanvasFrame = 0;
        renderWhiteboard();
    });
}

function snapshotWhiteboardObjects() {
    return cloneWhiteboardValue(whiteboardState.objects);
}

function commitWhiteboardHistory(previousObjects) {
    if (!whiteboardState || !previousObjects) return;
    whiteboardState.undoHistory.push(previousObjects);
    whiteboardState.undoHistory = whiteboardState.undoHistory.slice(-WHITEBOARD_HISTORY_LIMIT);
    whiteboardState.redoHistory = [];
    updateWhiteboardHistoryButtons();
}

function undoWhiteboard() {
    if (!whiteboardState?.undoHistory.length) return;
    whiteboardState.redoHistory.push(snapshotWhiteboardObjects());
    whiteboardState.redoHistory = whiteboardState.redoHistory.slice(-WHITEBOARD_HISTORY_LIMIT);
    whiteboardState.objects = whiteboardState.undoHistory.pop();
    whiteboardState.selectedIds = [];
    updateWhiteboardHistoryButtons();
    requestWhiteboardRender();
    scheduleWhiteboardSave();
}

function redoWhiteboard() {
    if (!whiteboardState?.redoHistory.length) return;
    whiteboardState.undoHistory.push(snapshotWhiteboardObjects());
    whiteboardState.undoHistory = whiteboardState.undoHistory.slice(-WHITEBOARD_HISTORY_LIMIT);
    whiteboardState.objects = whiteboardState.redoHistory.pop();
    whiteboardState.selectedIds = [];
    updateWhiteboardHistoryButtons();
    requestWhiteboardRender();
    scheduleWhiteboardSave();
}

function updateWhiteboardHistoryButtons() {
    const canUndo = Boolean(whiteboardState?.undoHistory.length);
    const canRedo = Boolean(whiteboardState?.redoHistory.length);
    document.querySelectorAll('[data-whiteboard-action="undo"]').forEach(button => {
        button.disabled = !canUndo;
    });
    document.querySelectorAll('[data-whiteboard-action="redo"]').forEach(button => {
        button.disabled = !canRedo;
    });
}

async function saveWhiteboardNow() {
    if (!whiteboardState) return;
    if (whiteboardSaveTask) {
        whiteboardSaveRequested = true;
        await whiteboardSaveTask;
        return;
    }
    setWhiteboardStatus('Änderungen werden lokal gespeichert …', 'pending');
    whiteboardSaveTask = (async () => {
        await ensureNotebookStorage();
        do {
            whiteboardSaveRequested = false;
            const stateToSave = normalizeWhiteboard(whiteboardState);
            stateToSave.updatedAt = new Date().toISOString();
            whiteboardState.updatedAt = stateToSave.updatedAt;
            await notebookDb.whiteboards.put(stateToSave);
            scheduleCloudSync();
        } while (whiteboardSaveRequested);
        await renderWhiteboardBoardList();
        setWhiteboardStatus('Lokal gespeichert · Cloud-Sync wird bei Verbindung ausgeführt.', 'saved');
    })();
    try {
        await whiteboardSaveTask;
    } catch (error) {
        console.error('Whiteboard konnte nicht lokal gespeichert werden:', error);
        setWhiteboardStatus(`Whiteboard konnte nicht gespeichert werden: ${error.message || error}`, 'error');
        throw error;
    } finally {
        whiteboardSaveTask = null;
        whiteboardSaveRequested = false;
    }
}

function scheduleWhiteboardSave() {
    if (!whiteboardState) return;
    setWhiteboardStatus('Änderungen vorgemerkt …', 'pending');
    window.clearTimeout(whiteboardSaveTimer);
    whiteboardSaveTimer = window.setTimeout(() => {
        void saveWhiteboardNow().catch(() => {});
    }, 500);
}

async function renderWhiteboardBoardList() {
    const { list } = getWhiteboardElements();
    if (!list) return;
    await ensureNotebookStorage();
    const boards = (await notebookDb.whiteboards.toArray())
        .filter(board => !board.deletedAt)
        .sort((first, second) => Number(Boolean(second.favorite)) - Number(Boolean(first.favorite)) ||
            String(second.updatedAt || '').localeCompare(String(first.updatedAt || '')));
    list.replaceChildren();
    for (const board of boards) {
        const row = document.createElement('div');
        row.className = 'whiteboard-board-item';
        row.classList.toggle('is-active', board.id === whiteboardState?.id);
        const open = document.createElement('button');
        open.type = 'button';
        open.textContent = board.title || 'Unbenanntes Whiteboard';
        open.title = open.textContent;
        open.addEventListener('click', () => void switchWhiteboard(board.id));
        const favorite = document.createElement('button');
        favorite.type = 'button';
        favorite.textContent = board.favorite ? '★' : '☆';
        favorite.setAttribute('aria-label', board.favorite ? 'Favorit entfernen' : 'Als Favorit markieren');
        favorite.addEventListener('click', async () => {
            const updated = { ...board, favorite: !board.favorite, updatedAt: new Date().toISOString() };
            await notebookDb.whiteboards.put(updated);
            if (whiteboardState?.id === board.id) whiteboardState.favorite = updated.favorite;
            await renderWhiteboardBoardList();
            scheduleCloudSync();
        });
        row.append(open, favorite);
        list.appendChild(row);
    }
}

async function switchWhiteboard(id) {
    try {
        await saveWhiteboardNow();
        const record = await notebookDb.whiteboards.get(id);
        if (!record || record.deletedAt) return;
        whiteboardState = normalizeWhiteboard(record);
        whiteboardState.selectedIds = [];
        whiteboardPreview = null;
        whiteboardInteraction = null;
        whiteboardTool = 'pen';
        updateWhiteboardControls();
        await loadWhiteboardImages(whiteboardState.assetIds);
        await renderWhiteboardBoardList();
        requestWhiteboardRender();
        setWhiteboardStatus('Whiteboard geöffnet · lokal verfügbar.');
    } catch (error) {
        reportWhiteboardError(error);
    }
}

async function createWhiteboard(title = 'Unbenanntes Whiteboard') {
    try {
        await saveWhiteboardNow();
        const board = getWhiteboardTemplate(title);
        await notebookDb.whiteboards.add(board);
        whiteboardState = normalizeWhiteboard(board);
        whiteboardState.selectedIds = [];
        whiteboardPreview = null;
        updateWhiteboardControls();
        await renderWhiteboardBoardList();
        requestWhiteboardRender();
        scheduleCloudSync();
        return board;
    } catch (error) {
        reportWhiteboardError(error);
        return null;
    }
}

async function createWhiteboardFromDashboard() {
    try {
        await ensureNotebookStorage();
        const board = getWhiteboardTemplate();
        await notebookDb.whiteboards.add(board);
        scheduleCloudSync();
        window.location.href = `./whiteboard.html?id=${encodeURIComponent(board.id)}`;
    } catch (error) {
        console.error('Whiteboard konnte nicht erstellt werden:', error);
        alert(`Whiteboard konnte nicht erstellt werden: ${error.message || error}`);
    }
}

async function duplicateWhiteboard() {
    if (!whiteboardState) return;
    const copy = cloneWhiteboardValue(whiteboardState);
    copy.id = createWhiteboardId();
    copy.title = `${whiteboardState.title || 'Whiteboard'} – Kopie`;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    copy.favorite = false;
    copy.deletedAt = null;
    copy.undoHistory = [];
    copy.redoHistory = [];
    copy.objects.forEach(object => { object.id = createWhiteboardId('object'); });
    try {
        await notebookDb.whiteboards.add(copy);
        whiteboardState = normalizeWhiteboard(copy);
        whiteboardState.selectedIds = [];
        updateWhiteboardControls();
        await renderWhiteboardBoardList();
        requestWhiteboardRender();
        scheduleCloudSync();
    } catch (error) {
        reportWhiteboardError(error);
    }
}

async function deleteWhiteboard() {
    if (!whiteboardState) return;
    if (!window.confirm(`„${whiteboardState.title}“ in den Papierkorb verschieben?`)) return;
    const deleted = { ...whiteboardState, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    try {
        await notebookDb.whiteboards.put(deleted);
        whiteboardState = normalizeWhiteboard(deleted);
        const remaining = (await notebookDb.whiteboards.toArray()).filter(board => !board.deletedAt && board.id !== deleted.id);
        if (remaining.length) await switchWhiteboard(remaining[0].id);
        else await createWhiteboard();
        scheduleCloudSync();
    } catch (error) {
        reportWhiteboardError(error);
    }
}

function updateWhiteboardControls() {
    if (!whiteboardState) return;
    const elements = getWhiteboardElements();
    elements.title.value = whiteboardState.title || '';
    const activeSettings = getWhiteboardToolSettings();
    elements.color.value = activeSettings.color;
    elements.width.value = String(activeSettings.width);
    document.getElementById('whiteboardWidthValue').value = String(activeSettings.width);
    elements.opacity.value = String(Math.round(activeSettings.opacity * 100));
    document.getElementById('whiteboardOpacityValue').value = `${Math.round(activeSettings.opacity * 100)}%`;
    document.getElementById('whiteboardPenType').value = whiteboardState.penType;
    document.getElementById('whiteboardPressure').value = String(Math.round(activeSettings.pressure * 100));
    document.getElementById('whiteboardPressureValue').value = `${Math.round(activeSettings.pressure * 100)}%`;
    document.getElementById('whiteboardSmoothing').value = String(Math.round(activeSettings.smoothing * 100));
    document.getElementById('whiteboardSmoothingValue').value = `${Math.round(activeSettings.smoothing * 100)}%`;
    document.getElementById('whiteboardFillColor').value = whiteboardState.fillColor || '#dbeafe';
    document.getElementById('whiteboardShapeFill').checked = Boolean(whiteboardState.shapeFill);
    document.getElementById('whiteboardShapeDashed').checked = Boolean(whiteboardState.shapeDashed);
    document.getElementById('whiteboardAutoShape').checked = Boolean(whiteboardState.autoShape);
    renderWhiteboardPalette();
    elements.grid.value = whiteboardState.grid || 'none';
    elements.background.value = whiteboardState.background || '#ffffff';
    elements.inputMode.value = whiteboardState.inputMode || 'automatic';
    elements.eraserMode.value = whiteboardState.eraserMode || 'stroke';
    updateWhiteboardHistoryButtons();
    document.querySelectorAll('[data-whiteboard-tool]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.whiteboardTool === whiteboardTool));
    });
    document.querySelector('[data-whiteboard-action="favorite"]')?.classList.toggle('is-favorite', Boolean(whiteboardState.favorite));
    document.querySelector('[data-whiteboard-action="favorite"]')?.setAttribute('aria-pressed', String(Boolean(whiteboardState.favorite)));
    elements.viewport.classList.toggle('is-hand-tool', whiteboardTool === 'hand');
    requestWhiteboardRender();
}

function renderWhiteboardPalette() {
    const currentColor = getWhiteboardToolSettings().color.toLowerCase();
    document.querySelectorAll('[data-whiteboard-color]').forEach(button => {
        button.style.backgroundColor = button.dataset.whiteboardColor;
        button.classList.toggle('is-selected', button.dataset.whiteboardColor.toLowerCase() === currentColor);
    });
    const recent = document.getElementById('whiteboardRecentColors');
    if (!recent) return;
    recent.replaceChildren();
    (whiteboardState.recentColors || []).slice(0, 5).forEach(color => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.whiteboardColor = color;
        button.title = `Zuletzt verwendet: ${color}`;
        button.setAttribute('aria-label', `Zuletzt verwendete Farbe ${color}`);
        button.style.backgroundColor = color;
        button.classList.toggle('is-selected', color.toLowerCase() === currentColor);
        recent.appendChild(button);
    });
}

function getWhiteboardToolSettings(type = null) {
    const key = type || (whiteboardTool === 'highlighter' ? 'highlighter' : whiteboardState?.penType || 'fountain');
    const settings = whiteboardState?.toolSettings?.[key] || {};
    return {
        color: settings.color || whiteboardState?.color || '#172554',
        width: Number(settings.width) || Number(whiteboardState?.width) || 4,
        opacity: Number.isFinite(Number(settings.opacity)) ? Number(settings.opacity) : Number(whiteboardState?.opacity) || 1,
        pressure: Number.isFinite(Number(settings.pressure)) ? Number(settings.pressure) : 1,
        smoothing: Number.isFinite(Number(settings.smoothing)) ? Number(settings.smoothing) : 0.2
    };
}

function updateWhiteboardToolSetting(key, value) {
    if (!whiteboardState) return;
    const type = whiteboardTool === 'highlighter' ? 'highlighter' : whiteboardState.penType;
    whiteboardState.toolSettings[type] = { ...getWhiteboardToolSettings(type), [key]: value };
    whiteboardState.color = whiteboardState.toolSettings[type].color;
    whiteboardState.width = whiteboardState.toolSettings[type].width;
    whiteboardState.opacity = whiteboardState.toolSettings[type].opacity;
    if (key === 'color') {
        whiteboardState.recentColors = [value, ...(whiteboardState.recentColors || []).filter(color => color.toLowerCase() !== value.toLowerCase())].slice(0, 8);
        renderWhiteboardPalette();
    }
    scheduleWhiteboardSave();
}

function setWhiteboardTool(tool) {
    const supported = new Set(['select', 'lasso', 'pen', 'highlighter', 'eraser', 'shape', 'text', 'sticky', 'mindmap', 'laser', 'hand']);
    if (!supported.has(tool)) return;
    whiteboardTool = tool;
    document.querySelectorAll('[data-whiteboard-tool]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.whiteboardTool === tool));
    });
    getWhiteboardElements().viewport.classList.toggle('is-hand-tool', tool === 'hand');
    if (tool === 'pen' || tool === 'highlighter') updateWhiteboardControls();
}

function getWhiteboardPressure(event) {
    if ((event.pointerType || 'mouse') !== 'pen') return 0.55;
    const rawPressure = Number(event.pressure);
    const pressure = Math.min(1, Math.max(0.08, rawPressure || 0.5));
    const sensitivity = getWhiteboardToolSettings().pressure;
    return Math.min(1, Math.max(0.08, 0.5 + (pressure - 0.5) * sensitivity));
}

function smoothWhiteboardStroke(stroke) {
    const strength = Math.min(0.9, Math.max(0, Number(stroke.smoothing) || 0));
    if (strength < 0.05 || stroke.points.length < 3) return stroke;
    const points = stroke.points;
    stroke.points = points.map((point, index) => {
        if (index === 0 || index === points.length - 1) return point;
        const previous = points[index - 1];
        const next = points[index + 1];
        const averageX = (previous[0] + next[0]) / 2;
        const averageY = (previous[1] + next[1]) / 2;
        return [
            point[0] * (1 - strength) + averageX * strength,
            point[1] * (1 - strength) + averageY * strength,
            ...point.slice(2)
        ];
    });
    return stroke;
}

function getRecognizedShape(stroke) {
    const points = stroke.points || [];
    if (points.length < 6) return null;
    const first = points[0];
    const last = points[points.length - 1];
    let pathLength = 0;
    for (let index = 1; index < points.length; index += 1) {
        pathLength += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
    }
    const directLength = Math.hypot(last[0] - first[0], last[1] - first[1]);
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(1, Math.max(...xs) - left);
    const height = Math.max(1, Math.max(...ys) - top);
    const closed = Math.hypot(last[0] - first[0], last[1] - first[1]) < Math.hypot(width, height) * 0.2;
    if (closed) {
        return {
            shape: Math.max(width, height) / Math.min(width, height) < 1.25 ? 'ellipse' : 'rect',
            x: left, y: top, width, height
        };
    }
    if (pathLength > 0 && directLength / pathLength > 0.93) {
        return {
            shape: 'line',
            x: Math.min(first[0], last[0]),
            y: Math.min(first[1], last[1]),
            width: Math.abs(last[0] - first[0]),
            height: Math.abs(last[1] - first[1])
        };
    }
    return null;
}

function offerWhiteboardShapeRecognition(stroke, boardId) {
    if (!whiteboardState.autoShape) return;
    const candidate = getRecognizedShape(stroke);
    if (!candidate) return;
    window.setTimeout(() => {
        if (whiteboardState?.id !== boardId) return;
        const index = whiteboardState.objects.findIndex(object => object.id === stroke.id);
        if (index < 0 || !window.confirm('Eine geometrische Form wurde erkannt. Möchtest du sie übernehmen?')) return;
        whiteboardState.objects[index] = {
            ...candidate,
            id: stroke.id,
            kind: 'shape',
            color: stroke.color,
            fill: 'transparent',
            strokeWidth: stroke.width,
            opacity: stroke.opacity,
            rotation: 0
        };
        requestWhiteboardRender();
        scheduleWhiteboardSave();
    }, 550);
}

function createWhiteboardStroke(point, event) {
    const penType = whiteboardTool === 'highlighter' ? 'highlighter' : whiteboardTool === 'laser' ? 'laser' : whiteboardState.penType;
    const settings = penType === 'laser'
        ? { color: '#ef4444', width: 3, opacity: 1, smoothing: 0 }
        : getWhiteboardToolSettings(penType);
    return {
        id: createWhiteboardId('stroke'),
        kind: 'stroke',
        tool: whiteboardTool,
        penType,
        color: settings.color,
        width: settings.width,
        opacity: settings.opacity,
        smoothing: settings.smoothing,
        pressureSensitivity: settings.pressure || 0,
        points: [[point.x, point.y, getWhiteboardPressure(event), event.tiltX || 0, event.tiltY || 0, event.twist || 0]],
        pointerType: event.pointerType || 'mouse'
    };
}

function getWhiteboardObjectCenter(object) {
    const bounds = window.MyNotesWhiteboardEngine.getObjectBounds(object);
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function distanceWhiteboardToSegment(point, first, second) {
    const dx = second[0] - first[0];
    const dy = second[1] - first[1];
    const length = dx * dx + dy * dy;
    const ratio = length
        ? Math.max(0, Math.min(1, ((point.x - first[0]) * dx + (point.y - first[1]) * dy) / length))
        : 0;
    return Math.hypot(point.x - first[0] - ratio * dx, point.y - first[1] - ratio * dy);
}

function removeWhiteboardObjects(ids) {
    const removed = ids instanceof Set ? ids : new Set(ids);
    whiteboardState.objects = whiteboardState.objects.filter(object =>
        !removed.has(object.id) &&
        !(object.kind === 'connection' && (removed.has(object.fromId) || removed.has(object.toId)))
    );
    whiteboardState.selectedIds = (whiteboardState.selectedIds || []).filter(id => !removed.has(id));
}

function cutWhiteboardStrokeAtPoint(stroke, point, tolerance) {
    const points = stroke.points || [];
    if (points.length < 2) {
        return Math.hypot(point.x - (points[0]?.[0] || 0), point.y - (points[0]?.[1] || 0)) <= tolerance ? [] : null;
    }
    const fragments = [];
    let current = [points[0]];
    let cut = false;
    for (let index = 1; index < points.length; index += 1) {
        if (distanceWhiteboardToSegment(point, points[index - 1], points[index]) <= tolerance + (Number(stroke.width) || 2) / 2) {
            cut = true;
            if (current.length > 1) fragments.push(current);
            current = [];
        } else {
            if (!current.length) current = [points[index - 1]];
            current.push(points[index]);
        }
    }
    if (current.length > 1) fragments.push(current);
    if (!cut) return null;
    return fragments;
}

function moveWhiteboardObject(object, dx, dy) {
    if (object.kind === 'stroke') {
        object.points = (object.points || []).map(point => [point[0] + dx, point[1] + dy, ...point.slice(2)]);
    } else {
        object.x += dx;
        object.y += dy;
    }
}

function getWhiteboardSelectionBounds() {
    return window.MyNotesWhiteboardEngine.getSelectionBounds(
        whiteboardState?.objects || [],
        whiteboardState?.selectedIds || []
    );
}

function getWhiteboardSelectionHandle(point) {
    const bounds = getWhiteboardSelectionBounds();
    if (!bounds) return null;
    const radius = 14 / whiteboardState.viewport.scale;
    const handles = [
        ['nw', bounds.x, bounds.y],
        ['n', bounds.x + bounds.width / 2, bounds.y],
        ['ne', bounds.x + bounds.width, bounds.y],
        ['e', bounds.x + bounds.width, bounds.y + bounds.height / 2],
        ['se', bounds.x + bounds.width, bounds.y + bounds.height],
        ['s', bounds.x + bounds.width / 2, bounds.y + bounds.height],
        ['sw', bounds.x, bounds.y + bounds.height],
        ['w', bounds.x, bounds.y + bounds.height / 2]
    ];
    const rotate = { x: bounds.x + bounds.width / 2, y: bounds.y - 28 / whiteboardState.viewport.scale };
    if (Math.hypot(point.x - rotate.x, point.y - rotate.y) <= radius) return { type: 'rotate', bounds, center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } };
    for (const [handle, x, y] of handles) {
        if (Math.hypot(point.x - x, point.y - y) <= radius) return { type: 'resize', handle, bounds };
    }
    return null;
}

function restoreWhiteboardSelectionFromSnapshot(snapshot, selectedIds) {
    const selected = new Set(selectedIds);
    const replacements = new Map(snapshot.filter(object => selected.has(object.id)).map(object => [object.id, cloneWhiteboardValue(object)]));
    whiteboardState.objects = whiteboardState.objects.map(object => replacements.get(object.id) || object);
}

function transformWhiteboardSelection(interaction, point) {
    const selectedIds = whiteboardState.selectedIds || [];
    restoreWhiteboardSelectionFromSnapshot(interaction.beforeObjects, selectedIds);
    const selected = whiteboardState.objects.filter(object => selectedIds.includes(object.id) && !object.locked && object.kind !== 'connection');
    if (interaction.type === 'rotate') {
        const angle = Math.atan2(point.y - interaction.center.y, point.x - interaction.center.x);
        const delta = angle - interaction.startAngle;
        const cosine = Math.cos(delta);
        const sine = Math.sin(delta);
        for (const object of selected) {
            const bounds = window.MyNotesWhiteboardEngine.getObjectBounds(object);
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            const dx = centerX - interaction.center.x;
            const dy = centerY - interaction.center.y;
            moveWhiteboardObject(object,
                interaction.center.x + dx * cosine - dy * sine - centerX,
                interaction.center.y + dx * sine + dy * cosine - centerY);
            object.rotation = (Number(object.rotation) || 0) + delta * 180 / Math.PI;
        }
        return;
    }

    const bounds = interaction.bounds;
    const west = interaction.handle.includes('w');
    const east = interaction.handle.includes('e');
    const north = interaction.handle.includes('n');
    const south = interaction.handle.includes('s');
    const horizontal = west || east;
    const vertical = north || south;
    const anchorX = west ? bounds.x + bounds.width : east ? bounds.x : bounds.x + bounds.width / 2;
    const anchorY = north ? bounds.y + bounds.height : south ? bounds.y : bounds.y + bounds.height / 2;
    const width = horizontal ? Math.max(12, Math.abs(point.x - anchorX)) : bounds.width;
    const height = vertical ? Math.max(12, Math.abs(point.y - anchorY)) : bounds.height;
    const scaleX = horizontal ? width / Math.max(1, bounds.width) : 1;
    const scaleY = vertical ? height / Math.max(1, bounds.height) : 1;
    const newLeft = west ? anchorX - width : east ? anchorX : bounds.x;
    const newTop = north ? anchorY - height : south ? anchorY : bounds.y;

    for (const object of selected) {
        const original = interaction.beforeObjects.find(item => item.id === object.id);
        const originalBounds = window.MyNotesWhiteboardEngine.getObjectBounds(original);
        const x = newLeft + (originalBounds.x - bounds.x) * scaleX;
        const y = newTop + (originalBounds.y - bounds.y) * scaleY;
        if (object.kind === 'stroke') {
            object.points = original.points.map(sample => [
                x + (sample[0] - originalBounds.x) * scaleX,
                y + (sample[1] - originalBounds.y) * scaleY,
                ...sample.slice(2)
            ]);
            object.width = Math.max(1, (Number(original.width) || 2) * (scaleX + scaleY) / 2);
        } else {
            object.x = x;
            object.y = y;
            object.width = Math.max(12, originalBounds.width * scaleX);
            object.height = Math.max(12, originalBounds.height * scaleY);
        }
    }
}

function selectWhiteboardObject(object, extend = false) {
    const ids = object.groupId
        ? whiteboardState.objects.filter(item => item.groupId === object.groupId).map(item => item.id)
        : [object.id];
    if (extend) {
        const current = new Set(whiteboardState.selectedIds || []);
        const allSelected = ids.every(id => current.has(id));
        ids.forEach(id => allSelected ? current.delete(id) : current.add(id));
        whiteboardState.selectedIds = [...current];
    } else {
        whiteboardState.selectedIds = ids;
    }
}

function applyWhiteboardEraser(point) {
    const tolerance = (Number(whiteboardState.eraserSize) || 14) / whiteboardState.viewport.scale + 12;
    const hit = window.MyNotesWhiteboardEngine.hitTest(whiteboardState.objects, point, tolerance);
    if (!hit) return false;
    if (hit.locked) return false;
    if (whiteboardState.eraserMode === 'stroke' && hit.kind !== 'stroke') return false;
    if (whiteboardState.eraserMode === 'partial') {
        if (hit.kind !== 'stroke') return false;
        const fragments = cutWhiteboardStrokeAtPoint(hit, point, tolerance);
        if (!fragments) return false;
        if (!whiteboardInteraction.beforeObjects) whiteboardInteraction.beforeObjects = snapshotWhiteboardObjects();
        const replacements = fragments.map((points, index) => ({
            ...hit,
            id: index === 0 ? hit.id : createWhiteboardId('stroke'),
            points
        }));
        whiteboardState.objects = whiteboardState.objects.flatMap(object =>
            object.id === hit.id ? replacements : [object]
        );
        return true;
    }
    if (!whiteboardInteraction.beforeObjects) whiteboardInteraction.beforeObjects = snapshotWhiteboardObjects();
    removeWhiteboardObjects(new Set([hit.id]));
    return true;
}

function startWhiteboardPointer(event) {
    if (!whiteboardState || (event.button !== undefined && event.button > 0 && event.button !== 1)) return;
    const { canvas, viewport } = getWhiteboardElements();
    const activePen = [...whiteboardInputPointers.entries()].some(([, pointer]) => pointer.pointerType === 'pen');
    if (event.pointerType === 'touch' && activePen) {
        event.preventDefault();
        return;
    }
    if (event.pointerType === 'pen') {
        const activeTouches = [...whiteboardInputPointers.entries()]
            .filter(([, pointer]) => pointer.pointerType === 'touch')
            .map(([pointerId]) => pointerId);
        activeTouches.forEach(pointerId => whiteboardInputPointers.delete(pointerId));
        if (activeTouches.includes(whiteboardInteraction?.pointerId)) {
            whiteboardInteraction = null;
            whiteboardPreview = null;
            viewport.classList.remove('is-panning');
        }
        whiteboardGesture = null;
    }
    const point = whiteboardWorldPoint(event);
    const screen = whiteboardScreenPoint(event);
    canvas.setPointerCapture(event.pointerId);
    whiteboardInputPointers.set(event.pointerId, { ...screen, pointerType: event.pointerType });

    if (whiteboardInputPointers.size >= 2 && [...whiteboardInputPointers.values()].every(pointer => pointer.pointerType === 'touch')) {
        if (whiteboardInteraction?.type === 'draw') whiteboardPreview = null;
        whiteboardInteraction = { type: 'gesture' };
        const pointers = [...whiteboardInputPointers.values()];
        const center = { x: (pointers[0].x + pointers[1].x) / 2, y: (pointers[0].y + pointers[1].y) / 2 };
        whiteboardGesture = {
            distance: Math.max(1, Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y)),
            scale: whiteboardState.viewport.scale,
            center,
            anchor: {
                x: (center.x - whiteboardState.viewport.x) / whiteboardState.viewport.scale,
                y: (center.y - whiteboardState.viewport.y) / whiteboardState.viewport.scale
            }
        };
        event.preventDefault();
        return;
    }

    if ((event.pointerType === 'touch' && ['finger-navigate', 'stylus-only'].includes(whiteboardState.inputMode)) ||
        (event.pointerType === 'mouse' && whiteboardState.inputMode === 'stylus-only') ||
        whiteboardTool === 'hand' || event.button === 1 || whiteboardSpaceDown) {
        whiteboardInteraction = { type: 'pan', pointerId: event.pointerId, lastScreen: screen };
        viewport.classList.add('is-panning');
        event.preventDefault();
        return;
    }

    if (whiteboardTool === 'select' || whiteboardTool === 'lasso') {
        const transformHandle = whiteboardTool === 'select' ? getWhiteboardSelectionHandle(point) : null;
        if (transformHandle) {
            const beforeObjects = snapshotWhiteboardObjects();
            whiteboardInteraction = transformHandle.type === 'rotate'
                ? {
                    type: 'rotate',
                    pointerId: event.pointerId,
                    beforeObjects,
                    center: transformHandle.center,
                    startAngle: Math.atan2(point.y - transformHandle.center.y, point.x - transformHandle.center.x)
                }
                : {
                    type: 'resize',
                    pointerId: event.pointerId,
                    beforeObjects,
                    bounds: transformHandle.bounds,
                    handle: transformHandle.handle
                };
            event.preventDefault();
            return;
        }
        const hit = window.MyNotesWhiteboardEngine.hitTest(
            whiteboardState.objects,
            point,
            8 / whiteboardState.viewport.scale
        );
        if (whiteboardTool === 'lasso') {
            whiteboardState.lassoPoints = [[point.x, point.y]];
            whiteboardInteraction = { type: 'lasso', pointerId: event.pointerId };
        } else {
            const extend = event.ctrlKey || event.metaKey;
            if (hit) selectWhiteboardObject(hit, extend);
            else if (!extend) whiteboardState.selectedIds = [];
            if (hit && whiteboardState.selectedIds.includes(hit.id) && !hit.locked) {
                whiteboardInteraction = {
                    type: 'move',
                    pointerId: event.pointerId,
                    lastPoint: point,
                    beforeObjects: snapshotWhiteboardObjects()
                };
            } else {
                whiteboardInteraction = { type: 'select', pointerId: event.pointerId };
            }
        }
        requestWhiteboardRender();
        event.preventDefault();
        return;
    }

    if (whiteboardTool === 'text') {
        openWhiteboardTextEditor(point);
        whiteboardInputPointers.delete(event.pointerId);
        event.preventDefault();
        return;
    }
    if (whiteboardTool === 'mindmap') {
        const previousObjects = snapshotWhiteboardObjects();
        const node = {
            id: createWhiteboardId('mindmap'),
            kind: 'mindmap',
            x: point.x - 100,
            y: point.y - 36,
            width: 200,
            height: 72,
            text: 'Neues Thema',
            fontSize: 18,
            color: '#dbeafe',
            borderColor: whiteboardState.color || '#2563eb',
            opacity: 1
        };
        whiteboardState.objects.push(node);
        whiteboardState.selectedIds = [node.id];
        commitWhiteboardHistory(previousObjects);
        openWhiteboardTextEditor(point, node.id);
        requestWhiteboardRender();
        whiteboardInputPointers.delete(event.pointerId);
        event.preventDefault();
        return;
    }
    if (whiteboardTool === 'sticky') {
        const previousObjects = snapshotWhiteboardObjects();
        const sticky = {
            id: createWhiteboardId('sticky'),
            kind: 'sticky',
            x: point.x,
            y: point.y,
            width: 250,
            height: 190,
            title: 'Haftnotiz',
            text: '',
            fontSize: 16,
            color: '#fef08a',
            opacity: 1
        };
        whiteboardState.objects.push(sticky);
        whiteboardState.selectedIds = [sticky.id];
        commitWhiteboardHistory(previousObjects);
        openWhiteboardTextEditor(point, sticky.id);
        requestWhiteboardRender();
        whiteboardInputPointers.delete(event.pointerId);
        event.preventDefault();
        return;
    }
    if (whiteboardTool === 'eraser') {
        if (whiteboardState.eraserMode === 'area') {
            whiteboardState.eraseArea = { start: point, end: point };
            whiteboardInteraction = { type: 'eraseArea', pointerId: event.pointerId, start: point, beforeObjects: snapshotWhiteboardObjects() };
        } else {
            whiteboardInteraction = { type: 'erase', pointerId: event.pointerId, beforeObjects: null };
            applyWhiteboardEraser(point);
        }
    } else if (whiteboardTool === 'shape') {
        const shape = document.getElementById('whiteboardShapeType').value;
        whiteboardPreview = {
            id: createWhiteboardId('shape-preview'),
            kind: 'shape',
            shape,
            x: point.x,
            y: point.y,
            width: 1,
            height: 1,
            color: whiteboardState.color,
            fill: whiteboardState.shapeFill ? whiteboardState.fillColor : 'transparent',
            dashed: whiteboardState.shapeDashed,
            strokeWidth: whiteboardState.width,
            opacity: whiteboardState.opacity,
            points: shape === 'freeform' ? [[point.x, point.y]] : undefined
        };
        whiteboardInteraction = { type: 'shape', pointerId: event.pointerId, start: point, beforeObjects: snapshotWhiteboardObjects() };
    } else {
        whiteboardPreview = createWhiteboardStroke(point, event);
        whiteboardInteraction = { type: 'draw', pointerId: event.pointerId };
    }
    event.preventDefault();
    requestWhiteboardRender();
}

function updateWhiteboardPointer(event) {
    if (!whiteboardState) return;
    const screen = whiteboardScreenPoint(event);
    if (whiteboardInputPointers.has(event.pointerId)) {
        whiteboardInputPointers.set(event.pointerId, { ...screen, pointerType: event.pointerType });
    }
    if (whiteboardInteraction?.type === 'gesture' && whiteboardGesture && whiteboardInputPointers.size >= 2) {
        const pointers = [...whiteboardInputPointers.values()].slice(0, 2);
        const center = { x: (pointers[0].x + pointers[1].x) / 2, y: (pointers[0].y + pointers[1].y) / 2 };
        const distance = Math.max(1, Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y));
        const scale = Math.min(5, Math.max(0.1, whiteboardGesture.scale * distance / whiteboardGesture.distance));
        whiteboardState.viewport.scale = scale;
        whiteboardState.viewport.x = center.x - whiteboardGesture.anchor.x * scale;
        whiteboardState.viewport.y = center.y - whiteboardGesture.anchor.y * scale;
        requestWhiteboardRender();
        scheduleWhiteboardSave();
        event.preventDefault();
        return;
    }
    if (!whiteboardInteraction || whiteboardInteraction.pointerId !== event.pointerId) return;
    const point = whiteboardWorldPoint(event);
    switch (whiteboardInteraction.type) {
        case 'draw': {
            const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
            for (const sample of samples.length ? samples : [event]) {
                const samplePoint = whiteboardWorldPoint(sample);
                whiteboardPreview.points.push([
                    samplePoint.x,
                    samplePoint.y,
                    getWhiteboardPressure(sample),
                    sample.tiltX || 0,
                    sample.tiltY || 0,
                    sample.twist || 0
                ]);
            }
            requestWhiteboardRender();
            break;
        }
        case 'shape':
            whiteboardPreview.x = Math.min(whiteboardInteraction.start.x, point.x);
            whiteboardPreview.y = Math.min(whiteboardInteraction.start.y, point.y);
            whiteboardPreview.width = Math.max(1, Math.abs(point.x - whiteboardInteraction.start.x));
            whiteboardPreview.height = Math.max(1, Math.abs(point.y - whiteboardInteraction.start.y));
            if (whiteboardPreview.shape === 'freeform') whiteboardPreview.points.push([point.x, point.y]);
            requestWhiteboardRender();
            break;
        case 'pan': {
            const dx = screen.x - whiteboardInteraction.lastScreen.x;
            const dy = screen.y - whiteboardInteraction.lastScreen.y;
            whiteboardState.viewport.x += dx;
            whiteboardState.viewport.y += dy;
            whiteboardInteraction.lastScreen = screen;
            requestWhiteboardRender();
            scheduleWhiteboardSave();
            break;
        }
        case 'move': {
            const dx = point.x - whiteboardInteraction.lastPoint.x;
            const dy = point.y - whiteboardInteraction.lastPoint.y;
            whiteboardState.objects
                .filter(object => whiteboardState.selectedIds.includes(object.id))
                .forEach(object => moveWhiteboardObject(object, dx, dy));
            whiteboardInteraction.lastPoint = point;
            requestWhiteboardRender();
            break;
        }
        case 'resize':
        case 'rotate':
            transformWhiteboardSelection(whiteboardInteraction, point);
            requestWhiteboardRender();
            break;
        case 'lasso':
            whiteboardState.lassoPoints.push([point.x, point.y]);
            requestWhiteboardRender();
            break;
        case 'erase':
            applyWhiteboardEraser(point);
            requestWhiteboardRender();
            break;
        case 'eraseArea':
            whiteboardState.eraseArea.end = point;
            requestWhiteboardRender();
            break;
        default:
            break;
    }
    event.preventDefault();
}

function finishWhiteboardPointer(event) {
    if (!whiteboardState) return;
    const interaction = whiteboardInteraction;
    if (interaction?.pointerId === event.pointerId) {
        const ephemeralStroke = interaction.type === 'draw' && whiteboardPreview?.penType === 'laser';
        if (interaction.type === 'draw' && whiteboardPreview) {
            if (whiteboardPreview.penType === 'laser') {
                const laser = whiteboardPreview;
                whiteboardLaserStrokes.push(laser);
                window.setTimeout(() => {
                    whiteboardLaserStrokes = whiteboardLaserStrokes.filter(item => item.id !== laser.id);
                    requestWhiteboardRender();
                }, 1300);
            } else {
                whiteboardPreview = smoothWhiteboardStroke(whiteboardPreview);
                const recognitionStroke = whiteboardPreview;
                const boardId = whiteboardState.id;
                commitWhiteboardHistory(snapshotWhiteboardObjects());
                whiteboardState.objects.push(whiteboardPreview);
                whiteboardState.selectedIds = [];
                offerWhiteboardShapeRecognition(recognitionStroke, boardId);
            }
        } else if (interaction.type === 'shape' && whiteboardPreview) {
            commitWhiteboardHistory(interaction.beforeObjects);
            whiteboardState.objects.push(whiteboardPreview);
            whiteboardState.selectedIds = [whiteboardPreview.id];
        } else if (interaction.type === 'move' && interaction.beforeObjects) {
            commitWhiteboardHistory(interaction.beforeObjects);
        } else if ((interaction.type === 'resize' || interaction.type === 'rotate') && interaction.beforeObjects) {
            commitWhiteboardHistory(interaction.beforeObjects);
        } else if (interaction.type === 'erase' && interaction.beforeObjects) {
            commitWhiteboardHistory(interaction.beforeObjects);
        } else if (interaction.type === 'eraseArea') {
            const area = {
                x: Math.min(interaction.start.x, whiteboardState.eraseArea.end.x),
                y: Math.min(interaction.start.y, whiteboardState.eraseArea.end.y),
                width: Math.abs(whiteboardState.eraseArea.end.x - interaction.start.x),
                height: Math.abs(whiteboardState.eraseArea.end.y - interaction.start.y)
            };
            const removedIds = new Set(whiteboardState.objects
                .filter(object => object.kind !== 'connection' && !object.locked)
                .filter(object => {
                    const bounds = window.MyNotesWhiteboardEngine.getObjectBounds(object);
                    return bounds.x <= area.x + area.width && bounds.x + bounds.width >= area.x &&
                        bounds.y <= area.y + area.height && bounds.y + bounds.height >= area.y;
                })
                .map(object => object.id));
            if (removedIds.size) {
                removeWhiteboardObjects(removedIds);
                commitWhiteboardHistory(interaction.beforeObjects);
            }
            whiteboardState.eraseArea = null;
        } else if (interaction.type === 'lasso') {
            const polygon = whiteboardState.lassoPoints || [];
            whiteboardState.selectedIds = whiteboardState.objects
                .filter(object => object.kind !== 'connection')
                .filter(object => window.MyNotesWhiteboardEngine.pointInPolygon(getWhiteboardObjectCenter(object), polygon))
                .map(object => object.id);
            whiteboardState.lassoPoints = [];
        }
        whiteboardPreview = null;
        whiteboardInteraction = null;
        getWhiteboardElements().viewport.classList.remove('is-panning');
        if ((['draw', 'shape', 'move', 'resize', 'rotate', 'erase'].includes(interaction.type) && !ephemeralStroke) ||
            (interaction.type === 'eraseArea' && interaction.beforeObjects?.length !== whiteboardState.objects.length)) {
            scheduleWhiteboardSave();
        }
    }
    whiteboardInputPointers.delete(event.pointerId);
    if (whiteboardInputPointers.size < 2) {
        whiteboardGesture = null;
        if (whiteboardInteraction?.type === 'gesture') whiteboardInteraction = null;
    }
    requestWhiteboardRender();
}

function cancelWhiteboardPointer(event) {
    const interaction = whiteboardInteraction;
    if (interaction?.pointerId === event.pointerId) {
        if (interaction.beforeObjects) whiteboardState.objects = interaction.beforeObjects;
        whiteboardPreview = null;
        whiteboardState.lassoPoints = [];
        whiteboardState.eraseArea = null;
        whiteboardInteraction = null;
        getWhiteboardElements().viewport.classList.remove('is-panning');
        requestWhiteboardRender();
    }
    whiteboardInputPointers.delete(event.pointerId);
    whiteboardGesture = null;
}

function zoomWhiteboard(factor, screenPoint = null) {
    if (!whiteboardState) return;
    const { viewport } = getWhiteboardElements();
    const bounds = viewport.getBoundingClientRect();
    const focus = screenPoint || { x: bounds.width / 2, y: bounds.height / 2 };
    const worldX = (focus.x - whiteboardState.viewport.x) / whiteboardState.viewport.scale;
    const worldY = (focus.y - whiteboardState.viewport.y) / whiteboardState.viewport.scale;
    const scale = Math.min(5, Math.max(0.1, whiteboardState.viewport.scale * factor));
    whiteboardState.viewport.scale = scale;
    whiteboardState.viewport.x = focus.x - worldX * scale;
    whiteboardState.viewport.y = focus.y - worldY * scale;
    requestWhiteboardRender();
    scheduleWhiteboardSave();
}

function fitWhiteboardToContent() {
    if (!whiteboardState) return;
    const { viewport } = getWhiteboardElements();
    const area = viewport.getBoundingClientRect();
    const bounds = window.MyNotesWhiteboardEngine.getSceneBounds(whiteboardState.objects);
    const scale = Math.min(2, Math.max(0.1, Math.min((area.width - 80) / bounds.width, (area.height - 80) / bounds.height)));
    whiteboardState.viewport = {
        x: (area.width - bounds.width * scale) / 2 - bounds.x * scale,
        y: (area.height - bounds.height * scale) / 2 - bounds.y * scale,
        scale
    };
    requestWhiteboardRender();
    scheduleWhiteboardSave();
}

function zoomWhiteboardToSelection() {
    const bounds = getWhiteboardSelectionBounds();
    if (!bounds) {
        setWhiteboardStatus('Wähle zuerst ein Objekt aus.');
        return;
    }
    const viewportBounds = getWhiteboardElements().viewport.getBoundingClientRect();
    const scale = Math.min(3, Math.max(0.1, Math.min(
        (viewportBounds.width - 80) / Math.max(1, bounds.width),
        (viewportBounds.height - 80) / Math.max(1, bounds.height)
    )));
    whiteboardState.viewport = {
        x: viewportBounds.width / 2 - (bounds.x + bounds.width / 2) * scale,
        y: viewportBounds.height / 2 - (bounds.y + bounds.height / 2) * scale,
        scale
    };
    requestWhiteboardRender();
    scheduleWhiteboardSave();
}

function openWhiteboardTextEditor(point, objectId = null) {
    const elements = getWhiteboardElements();
    const object = objectId ? whiteboardState.objects.find(item => item.id === objectId) : null;
    whiteboardPendingText = {
        point,
        objectId,
        beforeObjects: object ? snapshotWhiteboardObjects() : null
    };
    elements.textInput.value = object?.text || '';
    document.getElementById('whiteboardTextFont').value = object?.fontFamily || 'Arial, sans-serif';
    const textColor = object?.textColor ||
        (object?.kind === 'sticky' ? '#713f12'
            : object?.kind === 'mindmap' ? '#172554'
                : object?.color || whiteboardState.color || '#172554');
    document.getElementById('whiteboardTextColor').value = textColor;
    document.getElementById('whiteboardTextSize').value = String(object?.fontSize || 26);
    document.getElementById('whiteboardTextAlign').value = object?.align || 'left';
    document.getElementById('whiteboardTextBold').checked = Boolean(object?.bold);
    document.getElementById('whiteboardTextItalic').checked = Boolean(object?.italic);
    document.getElementById('whiteboardTextUnderline').checked = Boolean(object?.underline);
    document.getElementById('whiteboardTextHeading').textContent = object
        ? object.kind === 'sticky' ? 'Haftnotiz bearbeiten' : 'Text bearbeiten'
        : 'Text einfügen';
    elements.textDialog.classList.remove('hidden');
    elements.textInput.focus();
}

function closeWhiteboardTextEditor() {
    getWhiteboardElements().textDialog.classList.add('hidden');
    whiteboardPendingText = null;
}

async function commitWhiteboardText(event) {
    event.preventDefault();
    if (!whiteboardState || !whiteboardPendingText) return;
    const text = getWhiteboardElements().textInput.value.trim();
    if (!text) return;
    const pending = whiteboardPendingText;
    const format = {
        fontFamily: document.getElementById('whiteboardTextFont').value,
        textColor: document.getElementById('whiteboardTextColor').value,
        fontSize: Math.min(96, Math.max(10, Number(document.getElementById('whiteboardTextSize').value) || 26)),
        align: document.getElementById('whiteboardTextAlign').value,
        bold: document.getElementById('whiteboardTextBold').checked,
        italic: document.getElementById('whiteboardTextItalic').checked,
        underline: document.getElementById('whiteboardTextUnderline').checked
    };
    if (pending.objectId) {
        const object = whiteboardState.objects.find(item => item.id === pending.objectId);
        if (object) {
            const before = pending.beforeObjects || snapshotWhiteboardObjects();
            object.text = text;
            Object.assign(object, format);
            if (object.kind === 'text') object.color = format.textColor;
            if (object.kind === 'mindmap') object.textColor = format.textColor;
            commitWhiteboardHistory(before);
        }
    } else {
        const object = {
            id: createWhiteboardId('text'),
            kind: 'text',
            x: pending.point.x,
            y: pending.point.y,
            width: 320,
            height: Math.max(42, text.split('\n').length * 34),
            text,
            ...format,
            color: format.textColor,
            opacity: whiteboardState.opacity
        };
        const before = snapshotWhiteboardObjects();
        whiteboardState.objects.push(object);
        whiteboardState.selectedIds = [object.id];
        commitWhiteboardHistory(before);
    }
    closeWhiteboardTextEditor();
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function deleteWhiteboardSelection() {
    if (!whiteboardState?.selectedIds?.length) return;
    const before = snapshotWhiteboardObjects();
    removeWhiteboardObjects(new Set(whiteboardState.selectedIds));
    commitWhiteboardHistory(before);
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function selectAllWhiteboardObjects() {
    if (!whiteboardState) return;
    whiteboardState.selectedIds = whiteboardState.objects
        .filter(object => object.kind !== 'connection')
        .map(object => object.id);
    requestWhiteboardRender();
}

function groupWhiteboardSelection() {
    if (!whiteboardState || whiteboardState.selectedIds.length < 2) return;
    const before = snapshotWhiteboardObjects();
    const groupId = createWhiteboardId('group');
    whiteboardState.objects
        .filter(object => whiteboardState.selectedIds.includes(object.id))
        .forEach(object => { object.groupId = groupId; });
    commitWhiteboardHistory(before);
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function ungroupWhiteboardSelection() {
    if (!whiteboardState || !whiteboardState.selectedIds.length) return;
    const groups = new Set(whiteboardState.objects
        .filter(object => whiteboardState.selectedIds.includes(object.id))
        .map(object => object.groupId)
        .filter(Boolean));
    if (!groups.size) return;
    const before = snapshotWhiteboardObjects();
    whiteboardState.objects.forEach(object => {
        if (groups.has(object.groupId)) delete object.groupId;
    });
    commitWhiteboardHistory(before);
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function toggleWhiteboardLock() {
    if (!whiteboardState?.selectedIds.length) return;
    const selected = whiteboardState.objects.filter(object => whiteboardState.selectedIds.includes(object.id));
    const lock = selected.some(object => !object.locked);
    const before = snapshotWhiteboardObjects();
    selected.forEach(object => { object.locked = lock; });
    commitWhiteboardHistory(before);
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function fixSelectedPdfAsBackground() {
    const selected = whiteboardState?.objects.filter(object =>
        whiteboardState.selectedIds.includes(object.id) && object.kind === 'image' && object.sourcePdfAssetId
    ) || [];
    if (!selected.length) {
        setWhiteboardStatus('Wähle mindestens eine PDF-Seite aus.');
        return;
    }
    const before = snapshotWhiteboardObjects();
    selected.forEach(object => { object.locked = true; });
    commitWhiteboardHistory(before);
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function moveWhiteboardLayer(direction) {
    if (!whiteboardState?.selectedIds.length) return;
    const before = snapshotWhiteboardObjects();
    const selected = new Set(whiteboardState.selectedIds);
    const connections = whiteboardState.objects.filter(object => object.kind === 'connection');
    const objects = whiteboardState.objects.filter(object => object.kind !== 'connection');
    const picked = objects.filter(object => selected.has(object.id));
    const rest = objects.filter(object => !selected.has(object.id));
    whiteboardState.objects = direction === 'front'
        ? [...rest, ...picked, ...connections]
        : [...picked, ...rest, ...connections];
    commitWhiteboardHistory(before);
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function createWhiteboardMindmapChild() {
    if (!whiteboardState?.selectedIds.length) return;
    const parent = whiteboardState.objects.find(object =>
        whiteboardState.selectedIds.includes(object.id) && object.kind === 'mindmap'
    );
    if (!parent) {
        setWhiteboardStatus('Wähle zuerst einen Mindmap-Knoten aus.');
        return;
    }
    const before = snapshotWhiteboardObjects();
    const child = {
        id: createWhiteboardId('mindmap'),
        kind: 'mindmap',
        x: parent.x + parent.width + 90,
        y: parent.y + (Math.random() - 0.5) * 40,
        width: 200,
        height: 72,
        text: 'Unterthema',
        fontSize: 17,
        color: '#dcfce7',
        borderColor: whiteboardState.color || '#16a34a',
        opacity: 1
    };
    whiteboardState.objects.push({
        id: createWhiteboardId('connection'),
        kind: 'connection',
        fromId: parent.id,
        toId: child.id,
        color: '#64748b',
        strokeWidth: 2
    }, child);
    whiteboardState.selectedIds = [child.id];
    commitWhiteboardHistory(before);
    openWhiteboardTextEditor({ x: child.x, y: child.y }, child.id);
    requestWhiteboardRender();
}

function duplicateWhiteboardSelection() {
    if (!whiteboardState?.selectedIds?.length) return;
    const before = snapshotWhiteboardObjects();
    const copies = whiteboardState.objects
        .filter(object => whiteboardState.selectedIds.includes(object.id))
        .map(object => {
            const copy = cloneWhiteboardValue(object);
            copy.id = createWhiteboardId('object');
            moveWhiteboardObject(copy, 24, 24);
            return copy;
        });
    whiteboardState.objects.push(...copies);
    whiteboardState.selectedIds = copies.map(object => object.id);
    commitWhiteboardHistory(before);
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function copyWhiteboardSelection(cut = false) {
    if (!whiteboardState?.selectedIds?.length) return;
    whiteboardClipboard = cloneWhiteboardValue(
        whiteboardState.objects.filter(object => whiteboardState.selectedIds.includes(object.id))
    );
    if (cut) deleteWhiteboardSelection();
    setWhiteboardStatus(`${whiteboardClipboard.length} Objekt${whiteboardClipboard.length === 1 ? '' : 'e'} kopiert.`);
}

function pasteWhiteboardClipboard() {
    if (!whiteboardState || !whiteboardClipboard.length) return;
    const before = snapshotWhiteboardObjects();
    const copies = cloneWhiteboardValue(whiteboardClipboard).map(object => {
        object.id = createWhiteboardId('object');
        moveWhiteboardObject(object, 24, 24);
        return object;
    });
    whiteboardState.objects.push(...copies);
    whiteboardState.selectedIds = copies.map(object => object.id);
    commitWhiteboardHistory(before);
    scheduleWhiteboardSave();
    requestWhiteboardRender();
}

function reportWhiteboardError(error) {
    console.error('Whiteboard-Aktion fehlgeschlagen:', error);
    setWhiteboardStatus(`Aktion fehlgeschlagen: ${error.message || error}`);
}

function whiteboardAssetPath(userId, boardId, assetId) {
    return `${userId}/${WHITEBOARD_ASSET_PREFIX}/${encodeURIComponent(String(boardId))}/${encodeURIComponent(String(assetId))}`;
}

async function uploadWhiteboardAssetsToCloud(userId, board) {
    const ids = [...new Set(board.assetIds || [])];
    for (const id of ids) {
        const asset = await notebookDb.whiteboardAssets.get(String(id));
        if (!asset?.blob) throw new Error(`Whiteboard-Medium ${id} fehlt im lokalen Speicher.`);
        const { error } = await cloudClient.storage.from('mynotes-pages').upload(
            whiteboardAssetPath(userId, board.id, id),
            asset.blob,
            { contentType: asset.mimeType || asset.blob.type || 'application/octet-stream', upsert: true }
        );
        if (error) throw new Error(`Whiteboard-Medium ${id} konnte nicht hochgeladen werden: ${error.message || error}`);
    }
}

async function restoreWhiteboardAssetsFromCloud(userId, board) {
    for (const id of [...new Set(board.assetIds || [])]) {
        const existing = await notebookDb.whiteboardAssets.get(String(id));
        if (existing?.blob) continue;
        const { data, error } = await cloudClient.storage.from('mynotes-pages')
            .download(whiteboardAssetPath(userId, board.id, id));
        if (error) throw new Error(`Whiteboard-Medium ${id} konnte nicht geladen werden: ${error.message || error}`);
        await notebookDb.whiteboardAssets.put({
            id: String(id),
            whiteboardId: String(board.id),
            mimeType: data.type || 'application/octet-stream',
            blob: data
        });
    }
}

function loadWhiteboardImage(assetId) {
    const key = String(assetId);
    if (whiteboardImageCache.has(key)) return whiteboardImageCache.get(key).promise;
    const entry = { image: null, url: null, promise: null };
    entry.promise = (async () => {
        const asset = await notebookDb.whiteboardAssets.get(key);
        if (!asset?.blob) throw new Error(`Bilddatei ${key} wurde nicht gefunden.`);
        if (window.createImageBitmap) {
            entry.image = await createImageBitmap(asset.blob);
        } else {
            entry.url = URL.createObjectURL(asset.blob);
            entry.image = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
                image.src = entry.url;
            });
        }
        requestWhiteboardRender();
        return entry.image;
    })().catch(error => {
        whiteboardImageCache.delete(key);
        throw error;
    });
    whiteboardImageCache.set(key, entry);
    return entry.promise;
}

async function loadWhiteboardImages(ids) {
    const placedImageIds = new Set(
        (whiteboardState?.objects || [])
            .filter(object => object.kind === 'image' && object.assetId)
            .map(object => String(object.assetId))
    );
    await Promise.all([...new Set(ids || [])]
        .filter(id => placedImageIds.has(String(id)))
        .map(id =>
        loadWhiteboardImage(id).catch(error => {
            console.error('Whiteboard-Bild konnte nicht geladen werden:', error);
            setWhiteboardStatus(`Ein Bild konnte nicht geladen werden: ${error.message || error}`);
        })
        ));
}

async function addWhiteboardImage(file) {
    if (!whiteboardState || !file) return;
    if (file.size > 40 * 1024 * 1024) throw new Error('Bilder dürfen höchstens 40 MB groß sein.');
    const acceptedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
    if (!acceptedTypes.has(file.type)) throw new Error('Unterstützt werden PNG, JPG, WebP und SVG.');
    const assetId = createWhiteboardId('asset');
    const blob = file.slice(0, file.size, file.type);
    const dimensions = await getWhiteboardImageDimensions(blob);
    const scale = Math.min(1, 620 / dimensions.width, 620 / dimensions.height);
    const width = Math.max(1, dimensions.width * scale);
    const height = Math.max(1, dimensions.height * scale);
    const bounds = getWhiteboardElements().viewport.getBoundingClientRect();
    const point = {
        x: (bounds.width / 2 - whiteboardState.viewport.x) / whiteboardState.viewport.scale,
        y: (bounds.height / 2 - whiteboardState.viewport.y) / whiteboardState.viewport.scale
    };
    const before = snapshotWhiteboardObjects();
    await notebookDb.whiteboardAssets.put({
        id: assetId,
        whiteboardId: whiteboardState.id,
        fileName: file.name,
        mimeType: file.type,
        blob
    });
    whiteboardState.assetIds = [...new Set([...whiteboardState.assetIds, assetId])];
    const object = {
        id: createWhiteboardId('image'),
        kind: 'image',
        assetId,
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        opacity: 1
    };
    whiteboardState.objects.push(object);
    whiteboardState.selectedIds = [object.id];
    commitWhiteboardHistory(before);
    await loadWhiteboardImage(assetId);
    scheduleWhiteboardSave();
}

function blobFromCanvas(canvas, type = 'image/png') {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas-Inhalt konnte nicht exportiert werden.')), type);
    });
}

async function getWhiteboardImageDimensions(blob) {
    if (window.createImageBitmap) {
        const image = await createImageBitmap(blob);
        const dimensions = { width: image.width, height: image.height };
        image.close?.();
        return dimensions;
    }
    const url = URL.createObjectURL(blob);
    try {
        return await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error('Bild konnte nicht geöffnet werden.'));
            image.src = url;
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function addWhiteboardPdf(file) {
    if (!whiteboardState || !window.pdfjsLib) throw new Error('PDF.js ist nicht verfügbar.');
    if (file.size > 150 * 1024 * 1024) throw new Error('PDF-Dateien dürfen höchstens 150 MB groß sein.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (pdf.numPages > 100) throw new Error('Zum Schutz des Gerätes können pro Import höchstens 100 PDF-Seiten platziert werden.');
    const originalId = createWhiteboardId('pdf');
    const before = snapshotWhiteboardObjects();
    await notebookDb.whiteboardAssets.put({
        id: originalId,
        whiteboardId: whiteboardState.id,
        fileName: file.name,
        mimeType: 'application/pdf',
        blob: file.slice(0, file.size, 'application/pdf')
    });
    whiteboardState.assetIds.push(originalId);
    const viewportBounds = getWhiteboardElements().viewport.getBoundingClientRect();
    const center = {
        x: (viewportBounds.width / 2 - whiteboardState.viewport.x) / whiteboardState.viewport.scale,
        y: (viewportBounds.height / 2 - whiteboardState.viewport.y) / whiteboardState.viewport.scale
    };
    let offsetY = 0;
    const pdfObjects = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setWhiteboardStatus(`PDF-Seite ${pageNumber} von ${pdf.numPages} wird vorbereitet …`);
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.35, 1400 / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error(`PDF-Seite ${pageNumber} konnte nicht gerendert werden.`);
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await blobFromCanvas(canvas);
        const assetId = createWhiteboardId('pdf-page');
        await notebookDb.whiteboardAssets.put({
            id: assetId,
            whiteboardId: whiteboardState.id,
            fileName: `${file.name} - Seite ${pageNumber}.png`,
            mimeType: 'image/png',
            blob
        });
        whiteboardState.assetIds.push(assetId);
        pdfObjects.push({
            id: createWhiteboardId('pdf-object'),
            kind: 'image',
            assetId,
            sourcePdfAssetId: originalId,
            pageNumber,
            x: center.x - viewport.width / 2,
            y: center.y + offsetY,
            width: viewport.width,
            height: viewport.height,
            opacity: 1,
            locked: false
        });
        offsetY += viewport.height + 30;
        page.cleanup();
    }
    if (pdfObjects.length) {
        const connections = whiteboardState.objects.filter(object => object.kind === 'connection');
        const highlighters = whiteboardState.objects.filter(object => object.kind === 'stroke' && object.tool === 'highlighter');
        const annotations = whiteboardState.objects.filter(object => object.kind !== 'connection' &&
            !(object.kind === 'stroke' && object.tool === 'highlighter'));
        whiteboardState.objects = [...highlighters, ...pdfObjects, ...annotations, ...connections];
    }
    pdf.cleanup();
    whiteboardState.assetIds = [...new Set(whiteboardState.assetIds)];
    commitWhiteboardHistory(before);
    await loadWhiteboardImages(whiteboardState.assetIds);
    scheduleWhiteboardSave();
    setWhiteboardStatus(`${pdf.numPages} PDF-Seite${pdf.numPages === 1 ? '' : 'n'} als verschiebbare Bilder eingefügt.`);
}

async function getWhiteboardExportCanvas(includeGrid = true, objectSet = null) {
    await loadWhiteboardImages(whiteboardState.assetIds);
    const objects = objectSet || whiteboardState.objects;
    const bounds = window.MyNotesWhiteboardEngine.getSceneBounds(objects);
    const area = Math.max(1, bounds.width * bounds.height);
    const scale = Math.min(1.5, 8000 / bounds.width, 8000 / bounds.height, Math.sqrt(16000000 / area));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(bounds.width * scale));
    canvas.height = Math.max(1, Math.ceil(bounds.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Exportfläche konnte nicht angelegt werden.');
    const exportState = {
        ...whiteboardState,
        objects,
        selectedIds: [],
        lassoPoints: [],
        grid: includeGrid ? whiteboardState.grid : 'none'
    };
    window.MyNotesWhiteboardEngine.drawScene(
        context,
        canvas.width,
        canvas.height,
        exportState,
        { x: -bounds.x * scale, y: -bounds.y * scale, scale },
        new Map([...whiteboardImageCache].map(([id, value]) => [id, value.image]))
    );
    return canvas;
}

function downloadWhiteboardBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportWhiteboardPng(includeGrid = true, selectedOnly = false) {
    const selected = selectedOnly
        ? whiteboardState.objects.filter(object => whiteboardState.selectedIds.includes(object.id))
        : null;
    if (selectedOnly && !selected.length) throw new Error('Wähle zuerst Objekte für den Export aus.');
    const canvas = await getWhiteboardExportCanvas(includeGrid, selected);
    downloadWhiteboardBlob(await blobFromCanvas(canvas), `${whiteboardState.title || 'Whiteboard'}.png`);
}

async function exportWhiteboardPdf(includeGrid = true, selectedOnly = false) {
    if (!window.PDFLib?.PDFDocument) throw new Error('Die PDF-Exportbibliothek ist nicht verfügbar.');
    const selected = selectedOnly
        ? whiteboardState.objects.filter(object => whiteboardState.selectedIds.includes(object.id))
        : null;
    if (selectedOnly && !selected.length) throw new Error('Wähle zuerst Objekte für den Export aus.');
    const canvas = await getWhiteboardExportCanvas(includeGrid, selected);
    const png = await blobFromCanvas(canvas);
    const pdf = await PDFLib.PDFDocument.create();
    const image = await pdf.embedPng(await png.arrayBuffer());
    const page = pdf.addPage([image.width * 0.75, image.height * 0.75]);
    page.drawImage(image, { x: 0, y: 0, width: image.width * 0.75, height: image.height * 0.75 });
    downloadWhiteboardBlob(new Blob([await pdf.save()], { type: 'application/pdf' }), `${whiteboardState.title || 'Whiteboard'}.pdf`);
}

function escapeWhiteboardXml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[character]);
}

function whiteboardObjectSvgTransform(object) {
    const rotation = Number(object.rotation) || 0;
    if (!rotation) return '';
    const bounds = window.MyNotesWhiteboardEngine.getObjectBounds(object);
    return ` transform="rotate(${rotation} ${bounds.x + bounds.width / 2} ${bounds.y + bounds.height / 2})"`;
}

async function blobToWhiteboardDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Bild konnte nicht für den SVG-Export gelesen werden.'));
        reader.readAsDataURL(blob);
    });
}

async function exportWhiteboardSvg(selectedOnly = false) {
    const objects = selectedOnly
        ? whiteboardState.objects.filter(object => whiteboardState.selectedIds.includes(object.id))
        : whiteboardState.objects;
    if (selectedOnly && !objects.length) throw new Error('Wähle zuerst Objekte für den Export aus.');
    const bounds = window.MyNotesWhiteboardEngine.getSceneBounds(objects);
    const content = [];
    const objectMap = new Map(whiteboardState.objects.map(object => [object.id, object]));
    for (const object of objects) {
        const transform = whiteboardObjectSvgTransform(object);
        const opacity = Number.isFinite(Number(object.opacity)) ? Number(object.opacity) : 1;
        if (object.kind === 'connection') {
            const from = objectMap.get(object.fromId);
            const to = objectMap.get(object.toId);
            if (!from || !to) continue;
            const first = getWhiteboardObjectCenter(from);
            const second = getWhiteboardObjectCenter(to);
            content.push(`<line x1="${first.x}" y1="${first.y}" x2="${second.x}" y2="${second.y}" stroke="${escapeWhiteboardXml(object.color || '#64748b')}" stroke-width="${Number(object.strokeWidth) || 2}" marker-end="url(#arrow)" />`);
            continue;
        }
        if (object.kind === 'stroke') {
            const path = object.points.map((point, index) => `${index ? 'L' : 'M'} ${point[0]} ${point[1]}`).join(' ');
            content.push(`<path d="${path}" fill="none" stroke="${escapeWhiteboardXml(object.color || '#172554')}" stroke-width="${Number(object.width) || 2}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity * (object.tool === 'highlighter' ? 0.3 : 1)}"${transform} />`);
        } else if (object.kind === 'text' || object.kind === 'sticky' || object.kind === 'mindmap') {
            const fill = object.kind === 'sticky' || object.kind === 'mindmap' ? object.color || '#fef08a' : 'none';
            const rx = object.kind === 'mindmap' ? 14 : 0;
            content.push(`<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${rx}" fill="${escapeWhiteboardXml(fill)}" stroke="${object.kind === 'mindmap' ? escapeWhiteboardXml(object.borderColor || '#2563eb') : 'none'}" opacity="${opacity}"${transform} />`);
            const text = String(object.text || object.title || '').split('\n');
            text.forEach((line, index) => {
                content.push(`<text x="${object.x + 12}" y="${object.y + (object.kind === 'sticky' ? 40 : 30) + index * (Number(object.fontSize) || 24) * 1.35}" font-family="${escapeWhiteboardXml(object.fontFamily || 'Arial, sans-serif')}" font-size="${Number(object.fontSize) || 24}" font-weight="${object.bold ? 'bold' : 'normal'}" font-style="${object.italic ? 'italic' : 'normal'}" fill="${escapeWhiteboardXml(object.textColor || object.color || '#172554')}" opacity="${opacity}"${transform}>${escapeWhiteboardXml(line)}</text>`);
            });
        } else if (object.kind === 'shape') {
            const color = escapeWhiteboardXml(object.color || '#172554');
            const fill = escapeWhiteboardXml(object.fill || 'none');
            const dash = object.dashed ? ' stroke-dasharray="8 6"' : '';
            const common = `stroke="${color}" stroke-width="${Number(object.strokeWidth) || 2}" fill="${fill}" opacity="${opacity}"${dash}${transform}`;
            const x2 = object.x + object.width;
            const y2 = object.y + object.height;
            if (object.shape === 'ellipse') {
                content.push(`<ellipse cx="${object.x + object.width / 2}" cy="${object.y + object.height / 2}" rx="${object.width / 2}" ry="${object.height / 2}" ${common} />`);
            } else if (object.shape === 'line' || object.shape === 'arrow' || object.shape === 'doubleArrow') {
                content.push(`<line x1="${object.x}" y1="${object.y}" x2="${object.x + object.width}" y2="${object.y + object.height}" ${common} ${object.shape !== 'line' ? 'marker-end="url(#arrow)"' : ''} ${object.shape === 'doubleArrow' ? 'marker-start="url(#arrow)"' : ''} />`);
            } else if (object.shape === 'triangle') {
                content.push(`<polygon points="${object.x + object.width / 2},${object.y} ${x2},${y2} ${object.x},${y2}" ${common} />`);
            } else if (object.shape === 'diamond') {
                content.push(`<polygon points="${object.x + object.width / 2},${object.y} ${x2},${object.y + object.height / 2} ${object.x + object.width / 2},${y2} ${object.x},${object.y + object.height / 2}" ${common} />`);
            } else if (object.shape === 'polygon') {
                const points = Array.isArray(object.points) && object.points.length > 2
                    ? object.points
                    : Array.from({ length: 6 }, (_, index) => {
                        const angle = -Math.PI / 2 + index * Math.PI / 3;
                        return [
                            object.x + object.width / 2 + Math.cos(angle) * object.width / 2,
                            object.y + object.height / 2 + Math.sin(angle) * object.height / 2
                        ];
                    });
                content.push(`<polygon points="${points.map(point => `${point[0]},${point[1]}`).join(' ')}" ${common} />`);
            } else if (object.shape === 'freeform' && Array.isArray(object.points) && object.points.length > 1) {
                const path = object.points.map((point, index) => `${index ? 'L' : 'M'} ${point[0]} ${point[1]}`).join(' ');
                content.push(`<path d="${path}" ${common} />`);
            } else if (object.shape === 'speechBubble') {
                const tail = Math.min(18, object.width / 5, object.height / 4);
                const path = `M ${object.x} ${object.y} H ${x2} V ${y2 - tail} H ${object.x + object.width * 0.35} L ${object.x + object.width * 0.25} ${y2} L ${object.x + object.width * 0.22} ${y2 - tail} H ${object.x} Z`;
                content.push(`<path d="${path}" ${common} />`);
            } else {
                content.push(`<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.shape === 'roundedRect' ? 12 : 0}" ${common} />`);
            }
        } else if (object.kind === 'image') {
            const asset = await notebookDb.whiteboardAssets.get(String(object.assetId));
            if (!asset?.blob) throw new Error(`Bilddatei ${object.assetId} fehlt.`);
            const href = await blobToWhiteboardDataUrl(asset.blob);
            content.push(`<image x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" href="${href}" opacity="${opacity}"${transform} />`);
        }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#64748b"/></marker></defs><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${escapeWhiteboardXml(whiteboardState.background)}"/>${content.join('')}</svg>`;
    downloadWhiteboardBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${whiteboardState.title || 'Whiteboard'}.svg`);
}

async function exportWhiteboardArchive() {
    if (!window.JSZip) throw new Error('Die Archivbibliothek ist nicht verfügbar.');
    const archive = new JSZip();
    const metadata = cloneWhiteboardValue(whiteboardState);
    delete metadata.undoHistory;
    delete metadata.redoHistory;
    const assets = [];
    for (const id of whiteboardState.assetIds) {
        const asset = await notebookDb.whiteboardAssets.get(id);
        if (!asset?.blob) throw new Error(`Medium ${id} fehlt im lokalen Speicher.`);
        const extension = (asset.mimeType.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
        const path = `assets/${id}.${extension}`;
        archive.file(path, asset.blob);
        assets.push({ id, path, fileName: asset.fileName || '', mimeType: asset.mimeType });
    }
    archive.file('whiteboard.json', JSON.stringify({ board: metadata, assets }));
    const blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    downloadWhiteboardBlob(blob, `${whiteboardState.title || 'Whiteboard'}.whiteboard`);
}

async function importWhiteboardArchive(file) {
    if (!window.JSZip) throw new Error('Die Archivbibliothek ist nicht verfügbar.');
    const archive = await JSZip.loadAsync(file);
    const metadataFile = archive.file('whiteboard.json');
    if (!metadataFile) throw new Error('Das Archiv enthält kein gültiges Whiteboard-Dokument.');
    const content = JSON.parse(await metadataFile.async('text'));
    if (!content.board || !Array.isArray(content.board.objects) || !Array.isArray(content.assets)) {
        throw new Error('Das Whiteboard-Dokument ist unvollständig oder ungültig.');
    }
    const board = normalizeWhiteboard(content.board);
    const newId = createWhiteboardId();
    const assetMap = new Map();
    for (const entry of content.assets) {
        const zipEntry = archive.file(entry.path);
        if (!zipEntry) throw new Error(`Whiteboard-Medium ${entry.path} fehlt im Archiv.`);
        const blob = await zipEntry.async('blob');
        const assetId = createWhiteboardId('asset');
        assetMap.set(String(entry.id), assetId);
        await notebookDb.whiteboardAssets.put({
            id: assetId,
            whiteboardId: newId,
            fileName: entry.fileName,
            mimeType: entry.mimeType || blob.type || 'application/octet-stream',
            blob
        });
    }
    board.id = newId;
    board.title = `${board.title || 'Whiteboard'} – Import`;
    board.createdAt = new Date().toISOString();
    board.updatedAt = board.createdAt;
    board.deletedAt = null;
    board.favorite = false;
    board.assetIds = board.assetIds.map(id => assetMap.get(String(id))).filter(Boolean);
    board.objects.forEach(object => {
        if (object.assetId) object.assetId = assetMap.get(String(object.assetId));
        if (object.sourcePdfAssetId) object.sourcePdfAssetId = assetMap.get(String(object.sourcePdfAssetId));
    });
    board.undoHistory = [];
    board.redoHistory = [];
    await notebookDb.whiteboards.add(board);
    whiteboardState = normalizeWhiteboard(board);
    whiteboardState.selectedIds = [];
    await loadWhiteboardImages(board.assetIds);
    updateWhiteboardControls();
    await renderWhiteboardBoardList();
    scheduleCloudSync();
    requestWhiteboardRender();
}

async function handleWhiteboardAction(action) {
    switch (action) {
        case 'new':
            await createWhiteboard();
            return;
        case 'duplicate':
            await duplicateWhiteboard();
            return;
        case 'delete':
            await deleteWhiteboard();
            return;
        case 'favorite':
            whiteboardState.favorite = !whiteboardState.favorite;
            scheduleWhiteboardSave();
            updateWhiteboardControls();
            return;
        case 'rename': {
            const titleInput = document.getElementById('whiteboardTitle');
            if (titleInput) {
                titleInput.focus();
                const end = titleInput.value.length;
                titleInput.setSelectionRange(end, end);
            }
            const docMenu = document.getElementById('whiteboardDocMenu');
            if (docMenu) docMenu.classList.add('hidden');
            return;
        }
        case 'board-overview': {
            const shell = document.querySelector('.whiteboard-shell');
            if (!shell) return;
            const willOpen = !shell.classList.contains('is-board-overview');
            shell.classList.toggle('is-board-overview', willOpen);
            shell.classList.toggle('is-properties-open', false);
            return;
        }
        case 'undo':
            undoWhiteboard();
            return;
        case 'redo':
            redoWhiteboard();
            return;
        case 'delete-object':
            deleteWhiteboardSelection();
            return;
        case 'duplicate-object':
            duplicateWhiteboardSelection();
            return;
        case 'group':
            groupWhiteboardSelection();
            return;
        case 'ungroup':
            ungroupWhiteboardSelection();
            return;
        case 'lock':
            toggleWhiteboardLock();
            return;
        case 'pdf-background':
            fixSelectedPdfAsBackground();
            return;
        case 'bring-front':
            moveWhiteboardLayer('front');
            return;
        case 'send-back':
            moveWhiteboardLayer('back');
            return;
        case 'mindmap-child':
            createWhiteboardMindmapChild();
            return;
        case 'copy':
            copyWhiteboardSelection();
            return;
        case 'cut':
            copyWhiteboardSelection(true);
            return;
        case 'paste':
            pasteWhiteboardClipboard();
            return;
        case 'zoom-in':
            zoomWhiteboard(1.15);
            return;
        case 'zoom-out':
            zoomWhiteboard(1 / 1.15);
            return;
        case 'fit':
            fitWhiteboardToContent();
            return;
        case 'zoom-selection':
            zoomWhiteboardToSelection();
            return;
        case 'add-image':
            document.getElementById('whiteboardImageInput').click();
            return;
        case 'add-pdf':
            document.getElementById('whiteboardPdfInput').click();
            return;
        case 'import-board':
            document.getElementById('whiteboardImportInput').click();
            return;
        case 'export-board':
            await exportWhiteboardArchive();
            return;
        case 'export-png':
            await exportWhiteboardPng();
            return;
        case 'export-png-no-grid':
            await exportWhiteboardPng(false);
            return;
        case 'export-selected':
            await exportWhiteboardPng(false, true);
            return;
        case 'export-pdf':
            await exportWhiteboardPdf();
            return;
        case 'export-pdf-no-grid':
            await exportWhiteboardPdf(false);
            return;
        case 'export-svg':
            await exportWhiteboardSvg();
            return;
        default:
            return;
    }
}

function reportWhiteboardActionError(error) {
    console.error('Whiteboard-Aktion konnte nicht ausgeführt werden:', error);
    setWhiteboardStatus(`Fehler: ${error.message || error}`);
}

async function openWhiteboard() {
    if (document.body.dataset.page !== 'whiteboard') {
        window.location.href = './whiteboard.html';
        return;
    }
    const elements = getWhiteboardElements();
    elements.modal.classList.remove('hidden');
    if (!whiteboardInitialized) initializeWhiteboardUi();
    try {
        await ensureNotebookStorage();
        let boards = (await notebookDb.whiteboards.toArray()).filter(board => !board.deletedAt);
        boards.sort((first, second) => Number(Boolean(second.favorite)) - Number(Boolean(first.favorite)) ||
            String(second.updatedAt || '').localeCompare(String(first.updatedAt || '')));
        if (!boards.length) {
            const board = getWhiteboardTemplate();
            await notebookDb.whiteboards.add(board);
            boards = [board];
            scheduleCloudSync();
        }
        const requestedId = new URLSearchParams(window.location.search).get('id');
        const requestedBoard = requestedId
            ? boards.find(board => String(board.id) === requestedId)
            : null;
        if (requestedId && !requestedBoard) throw new Error('Das ausgewählte Whiteboard wurde nicht gefunden.');
        const selected = requestedBoard || boards.find(board => board.id === whiteboardState?.id) || boards[0];
        whiteboardState = normalizeWhiteboard(selected);
        whiteboardState.selectedIds = [];
        updateWhiteboardControls();
        await loadWhiteboardImages(whiteboardState.assetIds);
        await renderWhiteboardBoardList();
        requestWhiteboardRender();
        setWhiteboardStatus('Lokal gespeichert · offline nutzbar.');
    } catch (error) {
        reportWhiteboardError(error);
    }
}

function closeWhiteboard() {
    if (document.body.dataset.page === 'whiteboard') {
        void saveWhiteboardNow()
            .then(() => window.location.href = './dashboard.html')
            .catch(reportWhiteboardActionError);
        return;
    }
    void saveWhiteboardNow().catch(reportWhiteboardActionError);
    getWhiteboardElements().modal.classList.add('hidden');
    whiteboardInteraction = null;
    whiteboardInputPointers.clear();
    whiteboardGesture = null;
}

function initializeWhiteboardUi() {
    if (whiteboardInitialized) return;
    whiteboardInitialized = true;
    const elements = getWhiteboardElements();
    elements.canvas.addEventListener('pointerdown', startWhiteboardPointer);
    elements.canvas.addEventListener('pointermove', updateWhiteboardPointer);
    elements.canvas.addEventListener('pointerup', finishWhiteboardPointer);
    elements.canvas.addEventListener('pointercancel', cancelWhiteboardPointer);
    elements.canvas.addEventListener('lostpointercapture', cancelWhiteboardPointer);
    elements.canvas.addEventListener('dblclick', event => {
        const point = whiteboardWorldPoint(event);
        const object = window.MyNotesWhiteboardEngine.hitTest(whiteboardState.objects, point, 8 / whiteboardState.viewport.scale);
        if (object && ['text', 'sticky'].includes(object.kind)) openWhiteboardTextEditor(point, object.id);
    });
    elements.viewport.addEventListener('wheel', event => {
        event.preventDefault();
        const point = whiteboardScreenPoint(event);
        zoomWhiteboard(event.deltaY < 0 ? 1.1 : 1 / 1.1, point);
    }, { passive: false });
    document.querySelectorAll('[data-whiteboard-tool]').forEach(button => {
        button.addEventListener('click', () => setWhiteboardTool(button.dataset.whiteboardTool));
    });
    document.getElementById('whiteboardModal').addEventListener('click', event => {
        const button = event.target.closest('[data-whiteboard-action]');
        if (!button) return;
        void handleWhiteboardAction(button.dataset.whiteboardAction).catch(reportWhiteboardActionError);
    });
    document.getElementById('whiteboardClose').addEventListener('click', closeWhiteboard);
    const whiteboardDocMenu = document.getElementById('whiteboardDocMenu');
    const whiteboardDocMenuToggle = document.getElementById('whiteboardDocMenuToggle');
    if (whiteboardDocMenuToggle && whiteboardDocMenu) {
        whiteboardDocMenuToggle.addEventListener('click', event => {
            event.stopPropagation();
            const shouldOpen = whiteboardDocMenu.classList.contains('hidden');
            whiteboardDocMenu.classList.toggle('hidden', !shouldOpen);
            whiteboardDocMenuToggle.setAttribute('aria-expanded', String(shouldOpen));
        });
        document.addEventListener('click', event => {
            if (!whiteboardDocMenu.classList.contains('hidden') && !event.target.closest('#whiteboardDocMenu') && !event.target.closest('#whiteboardDocMenuToggle')) {
                whiteboardDocMenu.classList.add('hidden');
                whiteboardDocMenuToggle.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !whiteboardDocMenu.classList.contains('hidden')) {
                whiteboardDocMenu.classList.add('hidden');
                whiteboardDocMenuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }
    document.getElementById('whiteboardTitle').addEventListener('input', event => {
        if (!whiteboardState) return;
        whiteboardState.title = event.target.value.trim() || 'Unbenanntes Whiteboard';
        scheduleWhiteboardSave();
    });
    document.getElementById('whiteboardTitle').addEventListener('blur', () => void renderWhiteboardBoardList());
    document.getElementById('whiteboardPenType').addEventListener('change', event => {
        whiteboardState.penType = event.target.value;
        const settings = getWhiteboardToolSettings(event.target.value);
        whiteboardState.color = settings.color;
        whiteboardState.width = settings.width;
        whiteboardState.opacity = settings.opacity;
        updateWhiteboardControls();
        scheduleWhiteboardSave();
    });
    document.getElementById('whiteboardColor').addEventListener('input', event => {
        updateWhiteboardToolSetting('color', event.target.value);
    });
    document.getElementById('whiteboardColorPalette').addEventListener('click', event => {
        const button = event.target.closest('[data-whiteboard-color]');
        if (!button) return;
        const color = button.dataset.whiteboardColor;
        document.getElementById('whiteboardColor').value = color;
        updateWhiteboardToolSetting('color', color);
    });
    document.getElementById('whiteboardWidth').addEventListener('input', event => {
        if (!whiteboardState) return;
        updateWhiteboardToolSetting('width', Number(event.target.value));
        document.getElementById('whiteboardWidthValue').value = event.target.value;
    });
    document.getElementById('whiteboardOpacity').addEventListener('input', event => {
        if (!whiteboardState) return;
        updateWhiteboardToolSetting('opacity', Number(event.target.value) / 100);
        document.getElementById('whiteboardOpacityValue').value = `${event.target.value}%`;
    });
    document.getElementById('whiteboardPressure').addEventListener('input', event => {
        updateWhiteboardToolSetting('pressure', Number(event.target.value) / 100);
        document.getElementById('whiteboardPressureValue').value = `${event.target.value}%`;
    });
    document.getElementById('whiteboardSmoothing').addEventListener('input', event => {
        updateWhiteboardToolSetting('smoothing', Number(event.target.value) / 100);
        document.getElementById('whiteboardSmoothingValue').value = `${event.target.value}%`;
    });
    document.getElementById('whiteboardFillColor').addEventListener('input', event => {
        whiteboardState.fillColor = event.target.value;
        scheduleWhiteboardSave();
    });
    document.getElementById('whiteboardShapeFill').addEventListener('change', event => {
        whiteboardState.shapeFill = event.target.checked;
        scheduleWhiteboardSave();
    });
    document.getElementById('whiteboardShapeDashed').addEventListener('change', event => {
        whiteboardState.shapeDashed = event.target.checked;
        scheduleWhiteboardSave();
    });
    document.getElementById('whiteboardAutoShape').addEventListener('change', event => {
        whiteboardState.autoShape = event.target.checked;
        scheduleWhiteboardSave();
    });
    document.getElementById('whiteboardGrid').addEventListener('change', event => {
        whiteboardState.grid = event.target.value;
        scheduleWhiteboardSave();
        requestWhiteboardRender();
    });
    document.getElementById('whiteboardBackground').addEventListener('input', event => {
        whiteboardState.background = event.target.value;
        scheduleWhiteboardSave();
        requestWhiteboardRender();
    });
    document.getElementById('whiteboardInputMode').addEventListener('change', event => {
        whiteboardState.inputMode = event.target.value;
        scheduleWhiteboardSave();
    });
    document.getElementById('whiteboardEraserMode').addEventListener('change', event => {
        whiteboardState.eraserMode = event.target.value;
        scheduleWhiteboardSave();
    });
    document.getElementById('whiteboardImageInput').addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (file) void addWhiteboardImage(file).catch(reportWhiteboardActionError);
        event.target.value = '';
    });
    document.getElementById('whiteboardPdfInput').addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (file) void addWhiteboardPdf(file).catch(reportWhiteboardActionError);
        event.target.value = '';
    });
    document.getElementById('whiteboardImportInput').addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (file) void importWhiteboardArchive(file).catch(reportWhiteboardActionError);
        event.target.value = '';
    });
    document.getElementById('whiteboardTextForm').addEventListener('submit', event => {
        void commitWhiteboardText(event).catch(reportWhiteboardActionError);
    });
    document.getElementById('whiteboardTextCancel').addEventListener('click', closeWhiteboardTextEditor);
    document.addEventListener('keydown', event => {
        if (elements.modal.classList.contains('hidden')) return;
        const textDialogOpen = !elements.textDialog.classList.contains('hidden');
        if (event.code === 'Space' && !textDialogOpen) {
            whiteboardSpaceDown = true;
            event.preventDefault();
        }
        if (textDialogOpen) {
            if (event.key === 'Escape') closeWhiteboardTextEditor();
            return;
        }
        const target = event.target;
        const isTyping = target instanceof HTMLElement &&
            (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
        if (event.key === 'Escape') closeWhiteboard();
        else if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            if (event.shiftKey) redoWhiteboard();
            else undoWhiteboard();
        } else if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            redoWhiteboard();
        } else if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
            copyWhiteboardSelection();
        } else if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
            copyWhiteboardSelection(true);
        } else if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
            pasteWhiteboardClipboard();
        } else if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
            duplicateWhiteboardSelection();
        } else if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            selectAllWhiteboardObjects();
        } else if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
            event.preventDefault();
            if (event.shiftKey) ungroupWhiteboardSelection();
            else groupWhiteboardSelection();
        } else if (!isTyping && ['Delete', 'Backspace'].includes(event.key)) {
            deleteWhiteboardSelection();
        }
    });
    document.addEventListener('keyup', event => {
        if (event.code === 'Space') whiteboardSpaceDown = false;
    });
    window.addEventListener('resize', requestWhiteboardRender);
}

window.openWhiteboard = openWhiteboard;
