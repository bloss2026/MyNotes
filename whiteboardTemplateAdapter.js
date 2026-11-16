(() => {
    const get = id => document.getElementById(id);
    let toastTimer = 0;

    function showMessage(message) {
        const toaster = get('global-toaster');
        const output = get('toast-message');
        if (!toaster || !output) return;
        output.textContent = message;
        toaster.classList.remove('opacity-0', 'translate-y-2');
        toaster.classList.add('opacity-100', 'translate-y-0');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toaster.classList.add('opacity-0', 'translate-y-2');
            toaster.classList.remove('opacity-100', 'translate-y-0');
        }, 2800);
    }

    function closePopovers(except = '') {
        ['popover-tools', 'popover-add', 'popover-audio', 'popover-more'].forEach(id => {
            if (id !== except) get(id)?.classList.add('hidden');
        });
    }

    function changeControl(id, value, eventName = 'input') {
        const control = get(id);
        if (!control) return;
        control.value = value;
        control.dispatchEvent(new Event(eventName, { bubbles: true }));
    }

    function insertTemplate(name) {
        if (!whiteboardState) {
            showMessage('Das Whiteboard wird noch geladen.');
            return;
        }

        const viewport = get('whiteboardViewport').getBoundingClientRect();
        const scale = whiteboardState.viewport.scale || 1;
        const center = {
            x: (viewport.width / 2 - whiteboardState.viewport.x) / scale,
            y: (viewport.height / 2 - whiteboardState.viewport.y) / scale
        };
        const before = snapshotWhiteboardObjects();
        const makeSticky = (title, text, x, y, color = '#fef08a') => ({
            id: createWhiteboardId('sticky'),
            kind: 'sticky',
            x,
            y,
            width: 220,
            height: 170,
            title,
            text,
            fontSize: 16,
            color,
            opacity: 1
        });
        const objects = [];

        if (name === 'spider') {
            const root = {
                id: createWhiteboardId('mindmap'),
                kind: 'mindmap',
                x: center.x - 100,
                y: center.y - 36,
                width: 200,
                height: 72,
                text: 'Hauptthema',
                fontSize: 18,
                color: '#dbeafe',
                borderColor: '#2563eb',
                opacity: 1
            };
            objects.push(root);
            [
                ['Idee 1', center.x - 360, center.y - 150],
                ['Idee 2', center.x + 140, center.y - 150],
                ['Idee 3', center.x - 100, center.y + 150]
            ].forEach(([text, x, y]) => {
                const child = {
                    id: createWhiteboardId('mindmap'),
                    kind: 'mindmap',
                    x,
                    y,
                    width: 200,
                    height: 72,
                    text,
                    fontSize: 17,
                    color: '#dcfce7',
                    borderColor: '#16a34a',
                    opacity: 1
                };
                objects.push({
                    id: createWhiteboardId('connection'),
                    kind: 'connection',
                    fromId: root.id,
                    toId: child.id,
                    color: '#64748b',
                    strokeWidth: 2
                }, child);
            });
        } else if (name === 'flowchart') {
            objects.push(
                makeSticky('Start', 'Erster Schritt', center.x - 360, center.y - 85, '#bfdbfe'),
                makeSticky('Prozess', 'Was passiert als Nächstes?', center.x - 110, center.y - 85, '#fde68a'),
                makeSticky('Ziel', 'Ergebnis', center.x + 140, center.y - 85, '#bbf7d0')
            );
        } else if (name === 'poster') {
            objects.push(
                makeSticky('Überschrift', 'Titel deines Posters', center.x - 110, center.y - 200, '#bfdbfe'),
                makeSticky('Inhalt', 'Wichtige Informationen und Ideen', center.x - 230, center.y + 10),
                makeSticky('Merksatz', 'Das Wichtigste auf einen Blick', center.x + 20, center.y + 10, '#bbf7d0')
            );
        } else if (name === 'icebreaker') {
            objects.push(makeSticky('Kennenlernen', 'Was möchtest du heute lernen?', center.x - 110, center.y - 85, '#fbcfe8'));
        } else {
            objects.push(
                makeSticky('Idee 1', 'Erster Gedanke', center.x - 250, center.y - 100, '#bfdbfe'),
                makeSticky('Idee 2', 'Weitere Gedanken', center.x + 30, center.y - 100, '#fde68a'),
                makeSticky('Nächster Schritt', 'Was setzen wir um?', center.x - 110, center.y + 110, '#bbf7d0')
            );
        }

        whiteboardState.objects.push(...objects);
        whiteboardState.selectedIds = objects.filter(object => object.kind !== 'connection').map(object => object.id);
        commitWhiteboardHistory(before);
        scheduleWhiteboardSave();
        requestWhiteboardRender();
        closePopovers();
    }

    function searchBoard() {
        const input = get('search-doc-input');
        const query = input?.value.trim().toLocaleLowerCase();
        if (!query || !whiteboardState) return;
        const match = whiteboardState.objects.find(object =>
            `${object.title || ''} ${object.text || ''}`.toLocaleLowerCase().includes(query)
        );
        if (!match) {
            showMessage('Kein passender Text auf diesem Whiteboard gefunden.');
            return;
        }
        whiteboardState.selectedIds = [match.id];
        zoomWhiteboardToSelection();
    }

    function installAddBoardButton() {
        const list = get('whiteboardBoardList');
        if (!list || list.querySelector('[data-template-add-board]')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.templateAddBoard = 'true';
        button.dataset.whiteboardAction = 'new';
        button.className = 'whiteboard-template-add';
        button.textContent = '+ Board hinzufügen';
        list.appendChild(button);
    }

    function initialize() {
        const status = get('whiteboardStatus');
        if (status) {
            new MutationObserver(() => showMessage(status.textContent.trim()))
                .observe(status, { childList: true, characterData: true, subtree: true });
        }
        const boardList = get('whiteboardBoardList');
        if (boardList) {
            new MutationObserver(installAddBoardButton).observe(boardList, { childList: true });
            installAddBoardButton();
        }

        const toggles = new Map([
            ['btn-tools-dropdown', 'popover-tools'],
            ['btn-add-dropdown', 'popover-add'],
            ['btn-audio-dropdown', 'popover-audio']
        ]);
        document.addEventListener('click', event => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const button = target.closest('button');
            if (!button) return;

            if (toggles.has(button.id)) {
                const popover = get(toggles.get(button.id));
                const shouldOpen = popover?.classList.contains('hidden');
                closePopovers(toggles.get(button.id));
                popover?.classList.toggle('hidden', !shouldOpen);
                return;
            }

            if (button.id === 'btn-sidebar') {
                const sidebar = get('sidebarContainer');
                const shouldOpen = sidebar?.classList.contains('hidden');
                sidebar?.classList.toggle('hidden', !shouldOpen);
                sidebar?.classList.toggle('flex', Boolean(shouldOpen));
                return;
            }

            if (button.id === 'btn-sidebar-select' || button.id === 'tab-boards-view') {
                get('sidebar-audio-panel')?.classList.add('hidden');
                get('sidebar-boards-panel')?.classList.remove('hidden');
                return;
            }

            if (button.id === 'tab-audio-view') {
                get('sidebar-boards-panel')?.classList.add('hidden');
                get('sidebar-audio-panel')?.classList.remove('hidden');
                showMessage('Audioaufnahmen sind für Whiteboards nicht verfügbar.');
                return;
            }

            if (button.id === 'btn-undo' || button.id === 'btn-redo') {
                button.dataset.whiteboardAction = button.id === 'btn-undo' ? 'undo' : 'redo';
            } else if (button.id === 'btn-export') {
                button.dataset.whiteboardAction = 'export-png';
            } else if (button.id === 'btn-center-view') {
                button.dataset.whiteboardAction = 'fit';
            } else if (button.id === 'btn-zoom-cycle') {
                button.dataset.whiteboardAction = 'zoom-in';
            } else if (button.id === 'btn-clear-specific') {
                button.dataset.whiteboardAction = 'delete-object';
            } else if (button.id === 'btn-rename-doc') {
                button.dataset.whiteboardAction = 'rename';
            } else if (button.id === 'btn-doc-search') {
                get('search-bar-overlay')?.classList.remove('hidden');
                get('search-doc-input')?.focus();
                closePopovers();
                return;
            } else if (button.id === 'close-search-bar') {
                get('search-bar-overlay')?.classList.add('hidden');
                return;
            } else if (button.id === 'btn-readonly-toggle') {
                showMessage('Ein Schreibschutz für Whiteboards ist derzeit nicht verfügbar.');
                return;
            } else if (button.id === 'btn-doc-info') {
                const updatedAt = whiteboardState?.updatedAt
                    ? new Date(whiteboardState.updatedAt).toLocaleString()
                    : 'Noch nicht gespeichert';
                showMessage(`Zuletzt bearbeitet: ${updatedAt}`);
                return;
            } else if (button.id === 'btn-cycle-pattern') {
                const grid = get('whiteboardGrid');
                const values = ['dots', 'lines', 'squares', 'none'];
                const next = values[(values.indexOf(grid?.value || 'dots') + 1) % values.length];
                changeControl('whiteboardGrid', next, 'change');
                const labels = { dots: 'Gepunktet', lines: 'Liniert', squares: 'Kariert', none: 'Leer' };
                get('pattern-value-label').textContent = labels[next];
                return;
            } else if (button.id === 'btn-cycle-bgcolor') {
                const background = get('whiteboardBackground');
                const colors = ['#FAFAFA', '#FFF4D6', '#EAF2FF', '#FFFFFF'];
                const current = colors.indexOf((background?.value || '').toUpperCase());
                const next = colors[(current + 1) % colors.length];
                changeControl('whiteboardBackground', next);
                get('bgcolor-value-label').textContent = ['Weiß', 'Creme', 'Hellblau', 'Reinweiß'][(current + 1) % colors.length];
                return;
            } else if (button.id === 'btn-eraser-mode' || button.id === 'btn-eraser-options') {
                const mode = get('whiteboardEraserMode');
                const values = ['stroke', 'partial', 'object', 'area'];
                const next = values[(values.indexOf(mode?.value || 'stroke') + 1) % values.length];
                changeControl('whiteboardEraserMode', next, 'change');
                const labels = { stroke: 'Standard', partial: 'Teilweise', object: 'Objekte', area: 'Bereich' };
                get('eraser-mode-label').textContent = labels[next];
                return;
            } else if (button.id === 'btn-toggle-ruler') {
                get('canvas-ruler')?.classList.toggle('hidden');
                closePopovers();
                return;
            } else if (button.id === 'toggle-snap-grid' || button.id === 'toggle-align-objects' ||
                button.id === 'btn-customize-toolbar-1' || button.id === 'btn-customize-toolbar-2') {
                showMessage('Diese Einstellung wird von der Whiteboard-Engine nicht unterstützt.');
                return;
            } else if (button.id === 'btn-record-summarize' || button.id === 'btn-show-recordings') {
                showMessage('Diese Funktion ist in der aktuellen Whiteboard-Engine nicht verfügbar.');
                closePopovers();
                return;
            } else if (button.id === 'btn-all-templates') {
                showMessage('Alle verfügbaren Vorlagen stehen in dieser Liste.');
                closePopovers();
                return;
            } else if (button.dataset.template) {
                insertTemplate(button.dataset.template);
                return;
            } else if (button.dataset.width) {
                changeControl('whiteboardWidth', button.dataset.width);
                document.querySelectorAll('.stroke-opt-btn').forEach(option => {
                    const selected = option === button;
                    option.classList.toggle('bg-blue-50', selected);
                    option.classList.toggle('text-[#1E55A0]', selected);
                    option.classList.toggle('text-gray-700', !selected);
                });
            } else if (button.dataset.penType) {
                if (button.dataset.penType === 'highlighter') {
                    setWhiteboardTool('highlighter');
                } else {
                    changeControl('whiteboardPenType', button.dataset.penType, 'change');
                    setWhiteboardTool('pen');
                }
                get('whiteboardColorPalette')?.querySelectorAll('[data-pen-type]').forEach(option => {
                    option.classList.toggle('bg-[#BCE3FA]', option === button);
                });
            } else if (button.dataset.eraserSize) {
                whiteboardState.eraserSize = Number(button.dataset.eraserSize);
                scheduleWhiteboardSave();
                document.querySelectorAll('[data-eraser-size]').forEach(option => {
                    option.classList.toggle('border-[#1A73E8]', option === button);
                    option.classList.toggle('border-[#A3A3A3]', option !== button);
                });
            }

            if (button.matches('[data-whiteboard-tool], [data-whiteboard-action]')) {
                closePopovers();
                const tool = button.dataset.whiteboardTool;
                get('whiteboardColorPalette')?.classList.toggle('hidden', !['pen', 'highlighter'].includes(tool));
                get('eraser-subtoolbar')?.classList.toggle('hidden', tool !== 'eraser');
                document.querySelectorAll('#editorObjectTopbar [data-whiteboard-tool]').forEach(control => {
                    control.classList.toggle('top-tool-active', control === button);
                });
            }
        });

        get('search-doc-input')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') searchBoard();
            if (event.key === 'Escape') get('search-bar-overlay')?.classList.add('hidden');
        });
        get('minimap-viewport-area')?.addEventListener('click', () => handleWhiteboardAction('fit'));
        get('canvas-ruler')?.addEventListener('pointerdown', event => {
            const ruler = event.currentTarget;
            const startX = event.clientX;
            const startY = event.clientY;
            const bounds = ruler.getBoundingClientRect();
            const move = moveEvent => {
                ruler.style.left = `${bounds.left + moveEvent.clientX - startX}px`;
                ruler.style.top = `${bounds.top + moveEvent.clientY - startY}px`;
                ruler.style.transform = 'none';
            };
            const stop = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', stop, { once: true });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
