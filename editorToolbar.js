(() => {
    const icons = {
        lasso: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 11v2M11 4h2"/><path d="m12 12 7 3-3 1.2L14.8 19 12 12Z" fill="currentColor" stroke="none"/>',
        pen: '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"/><path d="m14 6 4 4M11 19.5c2-1 4 1 6 0"/>',
        pencil: '<path d="m15 5 4 4M4 20l4.3-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/>',
        'pen-fountain': '<path d="m15 4 5 5-11 11H4v-5L15 4Z"/><path d="m12 7 5 5M4 20l5-1"/>',
        highlighter: '<path d="m9 11 4 4M3 21l3.5-.5L19 8a2.8 2.8 0 0 0-4-4L2.5 16.5 2 20Z"/><path d="M14 6 18 10"/>',
        eraser: '<path d="m18 13-7.5 7.5a2.12 2.12 0 0 1-3 0l-4-4a2.12 2.12 0 0 1 0-3L11 6a2.12 2.12 0 0 1 3 0l4 4a2.12 2.12 0 0 1 0 3Z"/><path d="m7.5 10.5 6 6"/>',
        text: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="3" cy="3" r="1.5" fill="currentColor"/><circle cx="21" cy="3" r="1.5" fill="currentColor"/><circle cx="3" cy="21" r="1.5" fill="currentColor"/><circle cx="21" cy="21" r="1.5" fill="currentColor"/><path d="M8 8h8M12 8v9"/>',
        object: '<circle cx="12" cy="12" r="9"/><path d="M9 14c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5"/><circle cx="9.5" cy="9.5" r=".8" fill="currentColor"/><circle cx="14.5" cy="9.5" r=".8" fill="currentColor"/>',
        image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
        shape: '<circle cx="9.5" cy="9.5" r="5"/><rect x="11.5" y="11.5" width="8.5" height="8.5" rx="2"/>',
        sticky: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6M8 12h4M8 16h7"/>',
        laser: '<path d="m14 7 3 3-9.5 9.5a2.12 2.12 0 0 1-3-3L14 7ZM18 3l2-1M20 6h2M16 2v2"/>',
        audio: '<rect x="4.5" y="3" width="4.5" height="9" rx="2.25"/><path d="M2.5 9.5a4.25 4.25 0 0 0 8.5 0M6.75 14v4m-2 0h4"/><circle cx="16.5" cy="7.5" r="2.2"/><path d="M13.5 12c0-1.4 1.3-2.2 3-2.2s3 .8 3 2.2"/><rect x="14" y="14.5" width="5" height="4.5" rx="1"/>',
        chevron: '<polyline points="6 9 12 15 18 9"/>'
    };

    const definitions = [
        { key: 'lasso', label: 'Lasso-Auswahl', icon: 'lasso', boardTool: 'lasso', notebookTool: 'lasso' },
        { key: 'pen', label: 'Stift', icon: 'pen', boardTool: 'pen', notebookTool: 'pen' },
        { key: 'eraser', label: 'Radiergummi', icon: 'eraser', boardTool: 'eraser', notebookTool: 'eraser' },
        { key: 'text', label: 'Textfeld', icon: 'text', boardTool: 'text', notebookAction: 'toggle-text' },
        { key: 'objects', label: 'Objekte', icon: 'object', boardTool: 'sticky', notebookTool: 'objects' },
        { key: 'image', label: 'Bilder', icon: 'image', boardAction: 'add-image', notebookAction: 'choose-image' },
        { key: 'shapes', label: 'Formen', icon: 'shape', boardTool: 'shape', notebookTool: 'shapes' },
        { key: 'sticky', label: 'Notizzettel', icon: 'sticky', boardTool: 'sticky', notebookTool: 'sticky' },
        { key: 'laser', label: 'Laserpointer', icon: 'laser', boardTool: 'laser', notebookTool: 'laser' }
    ];
    let notebookToolbarHost = null;
    let notebookToolsMenu = null;
    let notebookToolsToggle = null;

    function closeNotebookToolsMenu() {
        notebookToolsMenu?.classList.add('hidden');
        notebookToolsToggle?.setAttribute('aria-expanded', 'false');
    }

    document.addEventListener('click', event => {
        if (notebookToolbarHost && !notebookToolbarHost.contains(event.target)) closeNotebookToolsMenu();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeNotebookToolsMenu();
    });

    function icon(name, size = 20) {
        const penTip = name === 'pen' ? '<path d="m3 21 1.2-4.2 3 3L3 21Z" fill="#56CCF2" stroke="none"/>' : '';
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${penTip}${icons[name]}</svg>`;
    }

    function toolAttributes(definition, context) {
        const attributes = [`data-toolbar-tool="${definition.key}"`];
        if (context === 'whiteboard') {
            if (definition.boardTool) attributes.push(`data-whiteboard-tool="${definition.boardTool}"`, `data-tool="${definition.boardTool}"`);
            if (definition.boardAction) attributes.push(`data-whiteboard-action="${definition.boardAction}"`);
        } else {
            if (definition.notebookTool) attributes.push(`data-editor-tool="${definition.notebookTool}"`);
            if (definition.notebookAction) attributes.push(`data-editor-action="${definition.notebookAction}"`);
            const settingsMenu = {
                pen: 'penOptions',
                eraser: 'eraserOptions',
                objects: 'objectOptions',
                shapes: 'shapeOptions'
            }[definition.key];
            if (settingsMenu) {
                attributes.push(`data-toolbar-dropdown-toggle="${settingsMenu}"`, `aria-controls="${settingsMenu}"`, 'aria-expanded="false"');
                if (definition.key === 'pen') attributes.push('data-toolbar-group="pen"');
            }
        }
        return attributes.join(' ');
    }

    function mainButton(definition, context) {
        const activeClass = definition.key === 'pen'
            ? context === 'whiteboard' ? 'top-tool-active' : 'is-active'
            : '';
        const sizeClass = definition.key === 'pen' ? 'w-10' : 'w-9';
        const id = context === 'notebook' && definition.key === 'pen' ? 'id="penToolTrigger"' : '';
        const contents = context === 'notebook' && definition.key === 'pen'
            ? `<span class="toolbar-pen-icon is-visible" data-pen-icon="pen">${icon('pen', 20)}</span><span class="toolbar-pen-icon" data-pen-icon="pencil">${icon('pencil', 20)}</span><span class="toolbar-pen-icon" data-pen-icon="pen-fountain">${icon('pen-fountain', 20)}</span><span class="toolbar-pen-icon" data-pen-icon="highlighter">${icon('highlighter', 20)}</span>`
            : icon(definition.icon, definition.key === 'text' ? 21 : 20);
        return `<button type="button" ${id} class="main-tool-btn ${activeClass} ${sizeClass} h-9 rounded-[11px] flex items-center justify-center hover:bg-white/15 transition" ${toolAttributes(definition, context)} title="${definition.label}" aria-label="${definition.label}" aria-pressed="${definition.key === 'pen'}">${contents}</button>`;
    }

    function extraButton(definition, context) {
        const hasSettings = context === 'notebook' && ['objects', 'shapes'].includes(definition.key);
        const settingsIndicator = hasSettings ? `<span style="transform:rotate(-90deg)">${icon('chevron', 14)}</span>` : '';
        const attributes = toolAttributes(definition, context);
        return `<button type="button" class="extra-tool-item w-full px-4 py-2.5 flex items-center gap-3.5 hover:bg-gray-50 active:bg-gray-100 transition text-left" data-extra-tool="${definition.key}" ${attributes}>${icon(definition.icon)}<span class="text-[14px] font-medium text-gray-800 flex-1">${definition.label}</span>${settingsIndicator}</button>`;
    }

    function renderToolsPopover(context) {
        const extras = definitions.slice(4).map(definition => extraButton(definition, context)).join('');
        const customizeButton = context === 'whiteboard'
            ? '<button id="btn-customize-toolbar-1" type="button" class="w-full px-4 py-2.5 text-left text-[14px] font-medium text-gray-800 hover:bg-gray-50 rounded-b-xl transition">Werkzeugleiste anpassen</button>'
            : '<button type="button" data-editor-action="toggle-toolbar-settings" class="w-full px-4 py-2.5 text-left text-[14px] font-medium text-gray-800 hover:bg-gray-50 rounded-b-xl transition">Werkzeugleiste anpassen</button>';
        return `<div id="popover-tools" class="gn-popover hidden absolute top-11 left-1/2 -translate-x-1/2 w-[265px] text-gray-800 z-50 pt-3.5 pb-1.5" role="menu" aria-label="Werkzeuge"><div class="popover-caret left-1/2 -translate-x-1/2"></div><div class="px-4 pb-2 text-[15px] font-semibold text-gray-900">Werkzeuge</div><div class="divide-y divide-gray-100/80">${extras}</div><div class="mt-1 pt-1.5 border-t border-gray-200/80">${customizeButton}</div></div>`;
    }

    function renderAudioPopover() {
        return `<div id="popover-audio" class="gn-popover hidden absolute top-11 left-1/2 -translate-x-1/2 w-[250px] text-gray-800 z-50 pt-2 overflow-hidden">
            <div class="popover-caret left-1/2 -translate-x-1/2"></div>
            <button id="btn-record-summarize" type="button" class="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-red-50/60 transition text-left">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/></svg>
                <span class="text-[14px] font-medium text-[#DC2626] leading-tight">Aufnehmen &amp;<br/>Zusammenfassen</span>
            </button>
            <button id="btn-show-recordings" type="button" class="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-gray-50 transition text-left border-t border-gray-100">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1F2937" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M4 9v6M8 6v12M12 10v4M15 11h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-3l-2 2v-2"/></svg>
                <span class="text-[14px] font-medium text-gray-800">Aufnahmen anzeigen</span>
            </button>
            <button id="btn-toggle-ruler" type="button" class="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-gray-50 transition text-left border-t border-gray-100">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="#38BDF8" stroke="#0F172A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="m16.5 3.5 4 4-13 13-4-4 13-13Z"/><path d="m13.5 6.5 1.5 1.5m-4.5 1.5 1.5 1.5m-4.5 1.5L9 14"/></svg>
                <span id="ruler-menu-label" class="text-[14px] font-medium text-gray-800">Lineal einblenden</span>
            </button>
            <div class="border-t border-gray-200/80 bg-gradient-to-b from-gray-100/70 to-gray-300/70">
                <button id="btn-customize-toolbar-2" type="button" class="w-full px-4 py-3 text-left text-[14px] font-medium text-gray-800 hover:bg-black/5 transition">Werkzeugleiste anpassen</button>
            </div>
        </div>`;
    }

    function renderFloatingControls(context) {
        const undoRedo = context === 'whiteboard'
            ? '<button id="btn-undo" data-whiteboard-action="undo" title="Rückgängig" class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-800 hover:bg-gray-100 disabled:text-gray-300 disabled:pointer-events-none transition"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button><button id="btn-redo" data-whiteboard-action="redo" title="Wiederholen" disabled class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-800 hover:bg-gray-100 disabled:text-gray-300 disabled:pointer-events-none transition"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg></button>'
            : '<button data-editor-action="undo" title="Rückgängig" aria-label="Rückgängig" class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-800 hover:bg-gray-100 disabled:text-gray-300 disabled:pointer-events-none transition"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button><button data-editor-action="redo" title="Wiederholen" aria-label="Wiederholen" class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-800 hover:bg-gray-100 disabled:text-gray-300 disabled:pointer-events-none transition"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg></button>';
        const pagePreview = context === 'whiteboard'
            ? '<div id="minimap-viewport-area" class="relative w-full h-[94px] bg-white overflow-hidden cursor-pointer p-1.5"><div id="minimap-blue-box" class="w-full h-[68px] bg-[#DCEBFA] rounded-[10px] transition-all duration-150"></div></div>'
            : '<button type="button" id="minimap-viewport-area" data-editor-action="toggle-sidebar" title="Seitenübersicht öffnen" aria-label="Seitenübersicht öffnen" class="relative w-full h-[94px] bg-white overflow-hidden cursor-pointer p-1.5"><span id="minimap-blue-box" class="block w-full h-[68px] bg-[#DCEBFA] rounded-[10px] transition-all duration-150"></span></button>';
        const footer = context === 'whiteboard'
            ? '<div class="h-[34px] border-t border-gray-100 flex items-center bg-[#FAFAFA]/70"><button id="btn-zoom-cycle" data-whiteboard-action="zoom-in" title="Zoomstufe wechseln" class="flex-1 h-full flex items-center justify-center text-[12px] font-medium text-gray-700 hover:bg-gray-100/80 transition"><span id="whiteboardZoomValue">100%</span></button><div class="w-[1px] h-full bg-gray-200/80"></div><button id="btn-center-view" data-whiteboard-action="fit" title="Ansicht zentrieren" class="w-[42px] h-full flex items-center justify-center text-gray-600 hover:bg-gray-100/80 transition"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="8.5" r=".7" fill="currentColor"/><circle cx="12" cy="15.5" r=".7" fill="currentColor"/><circle cx="8.5" cy="12" r=".7" fill="currentColor"/><circle cx="15.5" cy="12" r=".7" fill="currentColor"/></svg></button></div>'
            : '<div id="pageCounter" class="page-counter"></div>';
        return `<div class="shared-floating-controls absolute top-3 left-3 z-20 flex flex-col items-start gap-2.5 pointer-events-none"><div class="floating-card h-[46px] px-2 flex items-center gap-1 pointer-events-auto">${undoRedo}</div><div id="minimap-card" class="floating-card w-[132px] ml-4 overflow-hidden pointer-events-auto flex flex-col">${pagePreview}${footer}</div></div>`;
    }

    function mountFloating(host, context) {
        if (!host) throw new Error('Floating editor controls mount point not found.');
        if (!['notebook', 'whiteboard'].includes(context)) throw new Error(`Unsupported floating controls context: ${context}`);
        host.innerHTML = renderFloatingControls(context);
    }

    function mountNotebookToolSettings(editor) {
        if (!editor) throw new Error('Notebook editor root not found.');
        const source = editor.querySelector('.editor-floating-toolbar');
        const sourceRow = source?.closest('.editor-controls-row');
        if (!source || !sourceRow) throw new Error('Notebook tool settings source not found.');

        const settingsContainer = document.createElement('div');
        settingsContainer.id = 'editorToolSettingsContainer';
        settingsContainer.className = 'editor-tool-settings-container';
        ['penOptions', 'eraserOptions', 'shapeOptions', 'objectOptions'].forEach(id => {
            const menu = source.querySelector(`#${id}`);
            if (!menu) throw new Error(`Notebook tool settings menu not found: ${id}`);
            const group = document.createElement('div');
            group.className = `toolbar-dropdown-group ${id === 'penOptions' || id === 'eraserOptions' ? 'notebook-floating-tool-group' : ''}`;
            group.append(menu);
            settingsContainer.append(group);
            if (id === 'penOptions' || id === 'eraserOptions') menu.classList.add('notebook-floating-toolbar', `notebook-${id === 'penOptions' ? 'pen' : 'eraser'}-floating`);
        });

        settingsContainer.querySelectorAll('[data-pen-choice]').forEach(button => {
            const label = button.dataset.penLabel || button.dataset.penChoice;
            button.setAttribute('aria-label', label);
            button.title = label;
        });

        const penSelect = settingsContainer.querySelector('#penWidthSelect');
        const penWidths = document.createElement('div');
        penWidths.className = 'notebook-pen-widths';
        [
            { value: '1', size: 6, label: 'Dünn' },
            { value: '3', size: 10, label: 'Mittel' },
            { value: '5', size: 14, label: 'Dick' }
        ].forEach(({ value, size, label }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'notebook-pen-width';
            button.dataset.notebookPenWidth = value;
            button.setAttribute('aria-label', `${label}e Stiftstärke`);
            button.title = `${label}e Stiftstärke`;
            button.setAttribute('aria-pressed', String(penSelect.value === value));
            const dot = document.createElement('span');
            dot.style.width = `${size}px`;
            dot.style.height = `${size}px`;
            button.appendChild(dot);
            penWidths.appendChild(button);
        });
        penSelect.before(penWidths);
        penSelect.hidden = true;

        const eraserMenu = settingsContainer.querySelector('#eraserOptions');
        const eraserSelect = eraserMenu.querySelector('#eraserWidthSelect');
        eraserSelect.classList.add('notebook-eraser-width-select');
        const eraserSizes = document.createElement('div');
        eraserSizes.className = 'notebook-eraser-sizes';
        [
            { value: '1', size: 7, label: 'Kleiner' },
            { value: '3', size: 11, label: 'Mittlerer' },
            { value: '5', size: 16, label: 'Großer' }
        ].forEach(({ value, size, label }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'notebook-eraser-size';
            button.dataset.notebookEraserWidth = value;
            button.setAttribute('aria-label', `${label} Radierer`);
            button.title = `${label} Radierer`;
            button.setAttribute('aria-pressed', String(eraserSelect.value === value));
            const circle = document.createElement('span');
            circle.style.width = `${size}px`;
            circle.style.height = `${size}px`;
            button.appendChild(circle);
            eraserSizes.appendChild(button);
        });
        eraserSelect.before(eraserSizes);
        eraserSelect.hidden = true;

        settingsContainer.addEventListener('click', event => {
            const eraserSizeButton = event.target.closest('[data-notebook-eraser-width]');
            if (eraserSizeButton) {
                eraserSelect.value = eraserSizeButton.dataset.notebookEraserWidth;
                eraserSelect.dispatchEvent(new Event('change', { bubbles: true }));
                settingsContainer.querySelectorAll('[data-notebook-eraser-width]').forEach(button => {
                    button.setAttribute('aria-pressed', String(button === eraserSizeButton));
                });
                return;
            }
            const penWidthButton = event.target.closest('[data-notebook-pen-width]');
            if (!penWidthButton) return;
            penSelect.value = penWidthButton.dataset.notebookPenWidth;
            penSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
        editor.append(settingsContainer);
        sourceRow.remove();
    }

    function render(context) {
        const mainTools = definitions.slice(0, 4).map(definition => mainButton(definition, context)).join('');
        const audioButton = context === 'whiteboard'
            ? '<button id="btn-audio-dropdown" type="button" title="Audio &amp; Werkzeuge" class="h-9 px-2 rounded-[11px] flex items-center gap-1 hover:bg-white/15 transition" aria-label="Audio und Werkzeuge" aria-expanded="false">'
                + `${icon('audio', 22)}${icon('chevron', 11)}</button>${renderAudioPopover()}`
            : '<button id="btn-audio-dropdown" type="button" data-editor-action="toggle-recording-menu" title="Aufnahme und Werkzeuge" class="h-9 px-2 rounded-[11px] flex items-center gap-1 hover:bg-white/15 transition" aria-label="Aufnahme und Werkzeuge" aria-expanded="false">'
                + `${icon('audio', 22)}${icon('chevron', 11)}</button>`;

        return `<div class="shared-editor-tools flex items-center gap-1 sm:gap-2.5">${mainTools}<div class="relative"><button id="btn-tools-dropdown" type="button" title="Weitere Werkzeuge" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition" aria-expanded="false" aria-controls="popover-tools">${icon('chevron', 13)}</button>${renderToolsPopover(context)}</div><div class="h-5 w-px bg-white/25 mx-0.5"></div><div class="relative">${audioButton}</div></div>`;
    }

    function mount(host, context) {
        if (!host) throw new Error('Editor toolbar mount point not found.');
        if (!['notebook', 'whiteboard'].includes(context)) throw new Error(`Unsupported editor toolbar context: ${context}`);
        host.innerHTML = render(context);
        if (context !== 'notebook') return;

        notebookToolbarHost = host;
        notebookToolsMenu = host.querySelector('#popover-tools');
        notebookToolsToggle = host.querySelector('#btn-tools-dropdown');
        host.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button || !host.contains(button)) return;
            if (button === notebookToolsToggle) {
                event.stopPropagation();
                const shouldOpen = notebookToolsMenu.classList.contains('hidden');
                notebookToolsMenu.classList.toggle('hidden', !shouldOpen);
                notebookToolsToggle.setAttribute('aria-expanded', String(shouldOpen));
                return;
            }
            closeNotebookToolsMenu();
        });
    }

    window.MyNotesEditorToolbar = Object.freeze({ mount, mountFloating, mountNotebookToolSettings });
})();
