// Editor state and audio synchronization
let currentNotebookId = null;
let currentPageIndex = 0;
let currentPageZoom = 1;
let isNotebookReadOnly = false;
let editingTextBoxId = null;
const readOnlyEditorActions = new Set([
    'export-pdf',
    'export-page-pdf',
    'export-original-pdf',
    'next-page',
    'previous-page',
    'search',
    'share',
    'show-recordings',
    'record',
    'pause-recording',
    'toggle-info',
    'toggle-options',
    'toggle-read-only',
    'toggle-recording-menu',
    'toggle-ruler',
    'toggle-sidebar',
    'toggle-toolbar-settings',
    'change-template'
]);
let activePenColor = '#111111';
let activePenWidth = 3;
let activePenTool = 'pen';
const inputModes = new Set(['stylus-only', 'finger-draw', 'finger-navigate', 'automatic']);
const storedInputMode = localStorage.getItem('mynotes_input_mode');
const currentToolState = {
    tool: 'pen',
    inputMode: inputModes.has(storedInputMode) ? storedInputMode : 'automatic',
    pointer: null,
    activePointerId: null,
    strokePointerType: null
};
const penSettings = {
    pen: { color: '#111111', width: 3 },
    pencil: { color: '#111111', width: 1 },
    'pen-fountain': { color: '#111111', width: 3 },
    highlighter: { color: '#facc15', width: 5 }
};
let pendingPenTool = 'pen';
let pendingPenSettings = { ...penSettings.pen };
let activeEraserWidth = 3;
let activeShapeWidth = 3;
let activeDrawing = false;
let currentStrokePoints = [];
let drawingStartPoint = null;
let drawingEndPoint = null;
let drawingSnapshot = null;
let activeShape = 'rectangle';
let activeObjectEmoji = '⭐';
let selectedShapeId = null;
let selectedShapeIds = [];
let shapeEditStart = null;
let lassoActive = false;
let lassoPoints = [];
let editorUndoStack = [];
let editorRedoStack = [];
let lastEditorText = '';
let drawingHistorySnapshot = null;
let lassoSelectionFilter = localStorage.getItem('mynotes_lasso_filter') || 'all';
let editorClipboardElements = [];
