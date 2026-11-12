// Pointer interactions and drawing tools
function attachEditorInteractions() {
    const editor = document.getElementById('notebookEditor');
    const textarea = document.getElementById('notebookContent');
    const canvas = document.getElementById('notebookDrawing');
    const canvasArea = document.querySelector('.editor-canvas-area');
    const laserDot = document.getElementById('editorLaserDot');
    if (!editor || !textarea || !canvas || !canvasArea || !laserDot) return;

    let pinchGesture = null;
    let panGesture = null;
    let pagePanX = 0;
    let pagePanY = 0;
    const midpoint = (first, second) => ({
        clientX: (first.clientX + second.clientX) / 2,
        clientY: (first.clientY + second.clientY) / 2
    });
    const touchDistance = (first, second) => Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY
    );
    const constrainPagePan = (page, panX, panY, pageOffsetX, pageOffsetY) => {
        const areaStyle = getComputedStyle(canvasArea);
        const paddingLeft = parseFloat(areaStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(areaStyle.paddingRight) || 0;
        const paddingTop = parseFloat(areaStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(areaStyle.paddingBottom) || 0;
        const viewportLeft = canvasArea.clientLeft + paddingLeft;
        const viewportRight = canvasArea.clientLeft + canvasArea.clientWidth - paddingRight;
        const viewportTop = canvasArea.clientTop + paddingTop;
        const viewportBottom = canvasArea.clientTop + canvasArea.clientHeight - paddingBottom;
        const pageWidth = page.offsetWidth * currentPageZoom;
        const pageHeight = page.offsetHeight * currentPageZoom;
        const scrollLeft = canvasArea.scrollLeft;
        const scrollTop = canvasArea.scrollTop;

        if (pageWidth > viewportRight - viewportLeft) {
            const minPanX = viewportRight - pageWidth + scrollLeft - pageOffsetX;
            const maxPanX = viewportLeft + scrollLeft - pageOffsetX;
            panX = Math.max(minPanX, Math.min(maxPanX, panX));
        } else {
            panX = 0;
        }
        if (pageHeight > viewportBottom - viewportTop) {
            const minPanY = viewportBottom - pageHeight + scrollTop - pageOffsetY;
            const maxPanY = viewportTop + scrollTop - pageOffsetY;
            panY = Math.max(minPanY, Math.min(maxPanY, panY));
        } else {
            panY = 0;
        }
        return { x: panX, y: panY };
    };
    const setPageTransform = page => {
        page.style.transform = currentPageZoom === 1 && pagePanX === 0 && pagePanY === 0
            ? ''
            : `translate3d(${pagePanX}px, ${pagePanY}px, 0) scale(${currentPageZoom})`;
    };
    const applyPinchZoom = (zoom, center) => {
        const page = document.getElementById('notebookPage');
        if (!page || !pinchGesture) return;
        currentPageZoom = Math.max(1, Math.min(3, zoom));
        canvasArea.classList.toggle('is-zoomed', currentPageZoom > 1);
        const zoomIndicator = document.getElementById('pageZoomIndicator');
        if (zoomIndicator) zoomIndicator.textContent = `${Math.round(currentPageZoom * 100)}%`;
        const areaBounds = canvasArea.getBoundingClientRect();
        if (currentPageZoom === 1) {
            pagePanX = 0;
            pagePanY = 0;
            setPageTransform(page);
            canvasArea.scrollLeft = 0;
            canvasArea.scrollTop = 0;
            return;
        }
        const pan = constrainPagePan(
            page,
            center.clientX - areaBounds.left - pinchGesture.pageOffsetX + canvasArea.scrollLeft - pinchGesture.anchorX * currentPageZoom,
            center.clientY - areaBounds.top - pinchGesture.pageOffsetY + canvasArea.scrollTop - pinchGesture.anchorY * currentPageZoom,
            pinchGesture.pageOffsetX,
            pinchGesture.pageOffsetY
        );
        pagePanX = pan.x;
        pagePanY = pan.y;
        setPageTransform(page);
    };

    canvasArea.addEventListener('touchstart', event => {
        if (event.touches.length >= 2) {
            const first = event.touches[0];
            const second = event.touches[1];
            const center = midpoint(first, second);
            const page = document.getElementById('notebookPage');
            const pageBounds = page.getBoundingClientRect();
            const areaBounds = canvasArea.getBoundingClientRect();
            const startDistance = touchDistance(first, second);
            if (!startDistance) return;
            pinchGesture = {
                startZoom: currentPageZoom,
                startDistance,
                anchorX: (center.clientX - pageBounds.left) / currentPageZoom,
                anchorY: (center.clientY - pageBounds.top) / currentPageZoom,
                pageOffsetX: pageBounds.left - areaBounds.left + canvasArea.scrollLeft - pagePanX,
                pageOffsetY: pageBounds.top - areaBounds.top + canvasArea.scrollTop - pagePanY
            };
            panGesture = null;
            event.preventDefault();
        } else if (event.touches.length === 1 && currentPageZoom > 1) {
            const touch = event.touches[0];
            const pageBounds = document.getElementById('notebookPage').getBoundingClientRect();
            const areaBounds = canvasArea.getBoundingClientRect();
            panGesture = {
                startX: touch.clientX,
                startY: touch.clientY,
                panX: pagePanX,
                panY: pagePanY,
                pageOffsetX: pageBounds.left - areaBounds.left + canvasArea.scrollLeft - pagePanX,
                pageOffsetY: pageBounds.top - areaBounds.top + canvasArea.scrollTop - pagePanY
            };
        }
    }, { passive: false });

    canvasArea.addEventListener('touchmove', event => {
        if (event.touches.length >= 2 && pinchGesture) {
            event.preventDefault();
            const first = event.touches[0];
            const second = event.touches[1];
            const center = midpoint(first, second);
            const scale = touchDistance(first, second) / pinchGesture.startDistance;
            applyPinchZoom(pinchGesture.startZoom * scale, center);
        } else if (event.touches.length === 1 && panGesture && currentPageZoom > 1) {
            event.preventDefault();
            const touch = event.touches[0];
            const page = document.getElementById('notebookPage');
            const pan = constrainPagePan(
                page,
                panGesture.panX + touch.clientX - panGesture.startX,
                panGesture.panY + touch.clientY - panGesture.startY,
                panGesture.pageOffsetX,
                panGesture.pageOffsetY
            );
            pagePanX = pan.x;
            pagePanY = pan.y;
            setPageTransform(page);
        }
    }, { passive: false });

    canvasArea.addEventListener('touchend', event => {
        if (event.touches.length < 2) pinchGesture = null;
        if (event.touches.length === 1 && currentPageZoom > 1) {
            const touch = event.touches[0];
            const pageBounds = document.getElementById('notebookPage').getBoundingClientRect();
            const areaBounds = canvasArea.getBoundingClientRect();
            panGesture = {
                startX: touch.clientX,
                startY: touch.clientY,
                panX: pagePanX,
                panY: pagePanY,
                pageOffsetX: pageBounds.left - areaBounds.left + canvasArea.scrollLeft - pagePanX,
                pageOffsetY: pageBounds.top - areaBounds.top + canvasArea.scrollTop - pagePanY
            };
        } else if (!event.touches.length) {
            panGesture = null;
        }
    });
    canvasArea.addEventListener('touchcancel', () => {
        pinchGesture = null;
        panGesture = null;
    });

    editor.addEventListener('click', event => {
        const dropdownTrigger = event.target.closest('[data-toolbar-dropdown-toggle]');
        if (dropdownTrigger) {
            if (isNotebookReadOnly) return;
            const menu = document.getElementById(dropdownTrigger.dataset.toolbarDropdownToggle);
            const isOpening = !menu?.classList.contains('is-open');
            if (dropdownTrigger.dataset.toolbarGroup === 'pen') {
                if (isOpening) stagePenChoice(activePenTool);
            } else {
                setEditorTool(dropdownTrigger.dataset.editorTool);
            }
            toggleToolbarDropdown(dropdownTrigger.dataset.toolbarDropdownToggle);
            return;
        }
        const toolButton = event.target.closest('[data-editor-tool]');
        if (toolButton) {
            if (isNotebookReadOnly) return;
            setEditorTool(toolButton.dataset.editorTool);
            closeToolbarDropdowns();
            return;
        }
        const actionButton = event.target.closest('[data-editor-action]');
        if (actionButton) {
            const action = actionButton.dataset.editorAction;
            runEditorAction(action);
            if (action !== 'choose-color') closeToolbarDropdowns();
            return;
        }
        if (!event.target.closest('.toolbar-dropdown-group')) closeToolbarDropdowns();
    });
    lastEditorText = textarea.value;
    textarea.addEventListener('input', () => {
        if (isNotebookReadOnly) return;
        recordEditorHistory({ content: lastEditorText });
        lastEditorText = textarea.value;
        persistNotebookPages();
        recordAudioNoteEvent('text');
    });

    canvasArea.addEventListener('pointermove', event => {
        if (currentToolState.tool !== 'laser') return;
        const bounds = canvasArea.getBoundingClientRect();
        laserDot.style.left = `${event.clientX - bounds.left}px`;
        laserDot.style.top = `${event.clientY - bounds.top}px`;
        laserDot.classList.add('is-visible');
    });
    canvasArea.addEventListener('pointerleave', () => laserDot.classList.remove('is-visible'));

    const context = canvas.getContext('2d');
    const pointFromEvent = event => {
        const bounds = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - bounds.left) / currentPageZoom,
            y: (event.clientY - bounds.top) / currentPageZoom
        };
    };
    function renderFreehandStroke(isComplete, pointerType) {
        if (!drawingSnapshot || !currentStrokePoints.length) return;
        context.putImageData(drawingSnapshot, 0, 0);
        const isEraser = currentToolState.tool === 'eraser';
        const size = isEraser
            ? activeEraserWidth * 4
            : currentToolState.tool === 'pencil' ? Math.max(1, activePenWidth * 0.8) : activePenWidth;
        context.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        context.globalAlpha = currentToolState.tool === 'highlighter' ? 0.4 : currentToolState.tool === 'pencil' ? 0.72 : 1;
        context.fillStyle = activePenColor;
        context.strokeStyle = context.fillStyle;
        context.lineWidth = size;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        const getStroke = perfectFreehand?.getStroke;
        if (typeof getStroke === 'function') {
            const outline = getStroke(currentStrokePoints, {
                size,
                thinning: currentToolState.tool === 'highlighter' ? 0.08 : currentToolState.tool === 'pencil' ? 0.72 : 0.48,
                smoothing: 0.55,
                streamline: 0.45,
                simulatePressure: pointerType !== 'pen',
                last: isComplete
            });
            if (outline.length) {
                context.beginPath();
                context.moveTo(outline[0][0], outline[0][1]);
                for (let index = 1; index < outline.length; index += 1) {
                    context.lineTo(outline[index][0], outline[index][1]);
                }
                context.closePath();
                context.fill();
            }
        } else {
            context.beginPath();
            context.moveTo(currentStrokePoints[0][0], currentStrokePoints[0][1]);
            currentStrokePoints.slice(1).forEach(point => context.lineTo(point[0], point[1]));
            context.stroke();
        }
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
    }
    canvas.addEventListener('pointerdown', event => {
        if (isNotebookReadOnly) return;
        if (activeDrawing || !canPointerDraw(event)) return;
        if (!canvas.classList.contains('is-drawable')) return;
        if (!['pen', 'pencil', 'pen-fountain', 'eraser', 'highlighter', 'shapes', 'sticky', 'objects'].includes(currentToolState.tool)) return;
        event.preventDefault();
        activeDrawing = true;
        currentToolState.activePointerId = event.pointerId;
        currentToolState.strokePointerType = event.pointerType || 'mouse';
        currentToolState.pointer = {
            pointerId: event.pointerId,
            pointerType: event.pointerType || 'mouse',
            pressure: event.pressure,
            tiltX: event.tiltX || 0,
            tiltY: event.tiltY || 0,
            twist: event.twist || 0
        };
        canvas.setPointerCapture(event.pointerId);
        const point = pointFromEvent(event);
        drawingStartPoint = point;
        drawingEndPoint = point;
        drawingSnapshot = context.getImageData(0, 0, canvas.width, canvas.height);
        const historyKeys = ['eraser', 'sticky'].includes(currentToolState.tool)
            ? ['drawing', 'shapes']
            : ['shapes'];
        drawingHistorySnapshot = captureEditorSnapshot(historyKeys);
        if (currentToolState.tool === 'shapes') return;
        if (currentToolState.tool === 'sticky') {
            drawStickyNote(context, point);
            finishDrawing();
            return;
        }
        if (currentToolState.tool === 'objects') {
            drawEditorObject(context, point);
            finishDrawing();
            return;
        }
        const pressure = getStrokePressure(event);
        currentStrokePoints = [[point.x, point.y, pressure]];
        renderFreehandStroke(false, currentToolState.strokePointerType);
    });
    const getStrokePressure = event => {
        const isPressurePointer = (event.pointerType || currentToolState.strokePointerType) === 'pen';
        const pressure = isPressurePointer ? Math.max(event.pressure || 0.1, 0.05) : 0.5;
        const tilt = Math.min(1, Math.hypot(event.tiltX || 0, event.tiltY || 0) / 90);
        return Math.min(1, pressure * (1 + tilt * 0.25));
    };
    canvas.addEventListener('pointermove', event => {
        if (isNotebookReadOnly) return;
        if (!activeDrawing || event.pointerId !== currentToolState.activePointerId) return;
        const coalescedEvents = typeof event.getCoalescedEvents === 'function'
            ? event.getCoalescedEvents()
            : [event];
        for (const pointerEvent of coalescedEvents.length ? coalescedEvents : [event]) {
            currentToolState.pointer = {
                pointerId: pointerEvent.pointerId,
                pointerType: pointerEvent.pointerType || 'mouse',
                pressure: pointerEvent.pressure,
                tiltX: pointerEvent.tiltX || 0,
                tiltY: pointerEvent.tiltY || 0,
                twist: pointerEvent.twist || 0
            };
            const point = pointFromEvent(pointerEvent);
            if (currentToolState.tool === 'shapes') {
                drawingEndPoint = point;
                continue;
            }
            const pressure = getStrokePressure(pointerEvent);
            const lastPoint = currentStrokePoints[currentStrokePoints.length - 1];
            if (!lastPoint || lastPoint[0] !== point.x || lastPoint[1] !== point.y) {
                currentStrokePoints.push([point.x, point.y, pressure]);
            }
        }
        if (currentToolState.tool !== 'shapes') {
            renderFreehandStroke(false, currentToolState.strokePointerType);
        }
    });
    function finishDrawing() {
        if (!activeDrawing) return;
        if (isNotebookReadOnly) {
            if (drawingSnapshot) context.putImageData(drawingSnapshot, 0, 0);
            activeDrawing = false;
            currentToolState.activePointerId = null;
            currentToolState.pointer = null;
            currentToolState.strokePointerType = null;
            currentStrokePoints = [];
            drawingStartPoint = null;
            drawingEndPoint = null;
            drawingSnapshot = null;
            drawingHistorySnapshot = null;
            return;
        }
        const completedTool = currentToolState.tool;
        let changed = false;
        let audioEventShapeId = null;
        if (completedTool === 'eraser' && currentStrokePoints.length) {
            const shapes = getCurrentPageShapes();
            const radius = activeEraserWidth * 2;
            const erased = shapes.flatMap(shape =>
                shape.kind === 'stroke'
                    ? eraseVectorStroke(shape, currentStrokePoints, radius)
                    : [shape]
            );
            shapes.splice(0, shapes.length, ...erased);
            renderNotebookShapes();
            changed = true;
        } else if (['pen', 'pencil', 'pen-fountain', 'highlighter'].includes(completedTool)
            && currentStrokePoints.length && drawingSnapshot) {
            const points = currentStrokePoints.map(point => [...point]);
            const bounds = getVectorStrokeBounds(points);
            const strokeWidth = completedTool === 'pencil'
                ? Math.max(1, activePenWidth * 0.8)
                : activePenWidth;
            audioEventShapeId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            getCurrentPageShapes().push({
                id: audioEventShapeId,
                kind: 'stroke',
                ...bounds,
                points,
                color: activePenColor,
                strokeWidth,
                opacity: completedTool === 'highlighter' ? 0.4 : completedTool === 'pencil' ? 0.72 : 1,
                tool: completedTool,
                pointerType: currentToolState.strokePointerType
            });
            context.putImageData(drawingSnapshot, 0, 0);
            renderNotebookShapes();
            changed = true;
        } else if (completedTool === 'sticky' || completedTool === 'objects') {
            changed = true;
        }
        if (currentToolState.tool === 'shapes' && drawingStartPoint && drawingEndPoint) {
            const shapeId = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            audioEventShapeId = shapeId;
            getCurrentPageShapes().push({
                id: shapeId,
                kind: activeShape,
                x1: drawingStartPoint.x,
                y1: drawingStartPoint.y,
                x2: drawingEndPoint.x,
                y2: drawingEndPoint.y,
                color: activePenColor,
                strokeWidth: activeShapeWidth
            });
            setSelectedShapeIds([shapeId]);
            renderNotebookShapes();
            changed = true;
        }
        if (changed) {
            recordEditorHistory(drawingHistorySnapshot);
            recordAudioNoteEvent(completedTool === 'eraser' ? 'erase' : 'drawing', audioEventShapeId);
        }
        activeDrawing = false;
        currentToolState.activePointerId = null;
        currentToolState.pointer = null;
        currentToolState.strokePointerType = null;
        currentStrokePoints = [];
        drawingStartPoint = null;
        drawingEndPoint = null;
        drawingSnapshot = null;
        drawingHistorySnapshot = null;
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
        persistNotebookPages();
        if (completedTool === 'shapes' || completedTool === 'objects') setEditorTool('lasso');
    }
    canvas.addEventListener('pointerup', event => {
        if (!activeDrawing || event.pointerId !== currentToolState.activePointerId) return;
        const point = pointFromEvent(event);
        const lastPoint = currentStrokePoints[currentStrokePoints.length - 1];
        if (currentStrokePoints.length && (!lastPoint || lastPoint[0] !== point.x || lastPoint[1] !== point.y)) {
            currentStrokePoints.push([point.x, point.y, getStrokePressure(event)]);
        }
        if (currentStrokePoints.length) renderFreehandStroke(true, currentToolState.strokePointerType);
        finishDrawing();
    });
    canvas.addEventListener('pointercancel', event => {
        if (!activeDrawing || event.pointerId !== currentToolState.activePointerId) return;
        if (drawingSnapshot) context.putImageData(drawingSnapshot, 0, 0);
        activeDrawing = false;
        currentToolState.activePointerId = null;
        currentToolState.pointer = null;
        currentToolState.strokePointerType = null;
        currentStrokePoints = [];
        drawingStartPoint = null;
        drawingEndPoint = null;
        drawingSnapshot = null;
        drawingHistorySnapshot = null;
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
    });

    const shapesSvg = document.getElementById('notebookShapes');
    shapesSvg?.addEventListener('pointerdown', event => {
        if (isNotebookReadOnly) return;
        if (currentToolState.tool !== 'lasso') return;
        const shapeGroup = event.target instanceof Element ? event.target.closest('[data-shape-id]') : null;
        const handle = event.target instanceof Element ? event.target.closest('[data-shape-handle], [data-shape-rotate]') : null;
        if (!shapeGroup && !handle) {
            lassoActive = true;
            const point = pointFromEvent(event);
            lassoPoints = [[point.x, point.y]];
            shapesSvg.classList.add('is-lasso-drawing');
            shapesSvg.setPointerCapture(event.pointerId);
            renderNotebookShapes();
            return;
        }
        const ids = getSelectedShapeIds();
        if (shapeGroup) {
            const shapeId = shapeGroup.dataset.shapeId;
            if (!ids.includes(shapeId)) setSelectedShapeIds([shapeId]);
        } else if (!ids.length) {
            return;
        }
        const selectedIds = new Set(getSelectedShapeIds());
        const selectedItems = getCurrentPageShapes()
            .filter(item => selectedIds.has(item.id))
            .map(item => ({ ...item, points: item.points?.map(point => [...point]) }));
        if (!selectedItems.length) return;
        const pointer = pointFromEvent(event);
        shapeEditStart = {
            pointer,
            items: selectedItems,
            handle: handle?.dataset.shapeRotate ? 'rotate' : handle?.dataset.shapeHandle || null,
            historySnapshot: captureEditorSnapshot(['shapes']),
            moved: false,
            center: selectedItems.reduce((bounds, item) => {
                const itemBounds = getElementBounds(item);
                return {
                    left: Math.min(bounds.left, itemBounds.left),
                    top: Math.min(bounds.top, itemBounds.top),
                    right: Math.max(bounds.right, itemBounds.right),
                    bottom: Math.max(bounds.bottom, itemBounds.bottom)
                };
            }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })
        };
        shapeEditStart.center = {
            x: (shapeEditStart.center.left + shapeEditStart.center.right) / 2,
            y: (shapeEditStart.center.top + shapeEditStart.center.bottom) / 2
        };
        shapeEditStart.startAngle = Math.atan2(
            pointer.y - shapeEditStart.center.y,
            pointer.x - shapeEditStart.center.x
        );
        event.preventDefault();
        shapesSvg.setPointerCapture(event.pointerId);
        renderNotebookShapes();
    });
    shapesSvg?.addEventListener('pointermove', event => {
        if (isNotebookReadOnly) return;
        const pointer = pointFromEvent(event);
        if (lassoActive) {
            const previous = lassoPoints[lassoPoints.length - 1];
            if (!previous || Math.hypot(pointer.x - previous[0], pointer.y - previous[1]) >= 2) {
                lassoPoints.push([pointer.x, pointer.y]);
                renderNotebookShapes();
            }
            return;
        }
        if (!shapeEditStart) return;
        const dx = pointer.x - shapeEditStart.pointer.x;
        const dy = pointer.y - shapeEditStart.pointer.y;
        if (dx || dy) shapeEditStart.moved = true;
        if (shapeEditStart.handle === 'rotate') {
            const currentAngle = Math.atan2(
                pointer.y - shapeEditStart.center.y,
                pointer.x - shapeEditStart.center.x
            );
            const rotation = currentAngle - shapeEditStart.startAngle;
            const cosine = Math.cos(rotation);
            const sine = Math.sin(rotation);
            const rotatePoint = point => {
                const pointX = point[0] - shapeEditStart.center.x;
                const pointY = point[1] - shapeEditStart.center.y;
                return [
                    shapeEditStart.center.x + pointX * cosine - pointY * sine,
                    shapeEditStart.center.y + pointX * sine + pointY * cosine
                ];
            };
            const shapes = getCurrentPageShapes();
            shapeEditStart.items.forEach(original => {
                const shape = shapes.find(item => item.id === original.id);
                if (!shape) return;
                if (original.kind === 'stroke' && Array.isArray(original.points)) {
                    shape.points = original.points.map(point => [...rotatePoint(point), point[2]]);
                    Object.assign(shape, getVectorStrokeBounds(shape.points));
                } else if (original.kind === 'line') {
                    [shape.x1, shape.y1] = rotatePoint([original.x1, original.y1]);
                    [shape.x2, shape.y2] = rotatePoint([original.x2, original.y2]);
                } else {
                    const originalBounds = getElementBounds({ ...original, rotation: 0 });
                    const center = rotatePoint([
                        (originalBounds.left + originalBounds.right) / 2,
                        (originalBounds.top + originalBounds.bottom) / 2
                    ]);
                    const width = originalBounds.right - originalBounds.left;
                    const height = originalBounds.bottom - originalBounds.top;
                    shape.x1 = center[0] - width / 2;
                    shape.x2 = center[0] + width / 2;
                    shape.y1 = center[1] - height / 2;
                    shape.y2 = center[1] + height / 2;
                    shape.rotation = (Number(original.rotation) || 0) + rotation * 180 / Math.PI;
                }
            });
            renderNotebookShapes();
            return;
        }
        const originalBounds = shapeEditStart.items.reduce((bounds, item) => {
            const itemBounds = getElementBounds(item);
            return {
                left: Math.min(bounds.left, itemBounds.left),
                top: Math.min(bounds.top, itemBounds.top),
                right: Math.max(bounds.right, itemBounds.right),
                bottom: Math.max(bounds.bottom, itemBounds.bottom)
            };
        }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
        const nextBounds = { ...originalBounds };
        if (!shapeEditStart.handle) {
            nextBounds.left += dx;
            nextBounds.right += dx;
            nextBounds.top += dy;
            nextBounds.bottom += dy;
        } else {
            if (shapeEditStart.handle.includes('w')) nextBounds.left += dx;
            if (shapeEditStart.handle.includes('e')) nextBounds.right += dx;
            if (shapeEditStart.handle.includes('n')) nextBounds.top += dy;
            if (shapeEditStart.handle.includes('s')) nextBounds.bottom += dy;
            if (nextBounds.right - nextBounds.left < 2) {
                if (shapeEditStart.handle.includes('w')) nextBounds.left = nextBounds.right - 2;
                else nextBounds.right = nextBounds.left + 2;
            }
            if (nextBounds.bottom - nextBounds.top < 2) {
                if (shapeEditStart.handle.includes('n')) nextBounds.top = nextBounds.bottom - 2;
                else nextBounds.bottom = nextBounds.top + 2;
            }
        }
        const scaleX = (nextBounds.right - nextBounds.left) / Math.max(originalBounds.right - originalBounds.left, 1);
        const scaleY = (nextBounds.bottom - nextBounds.top) / Math.max(originalBounds.bottom - originalBounds.top, 1);
        const shapes = getCurrentPageShapes();
        shapeEditStart.items.forEach(original => {
            const shape = shapes.find(item => item.id === original.id);
            if (!shape) return;
            const transformX = x => nextBounds.left + (x - originalBounds.left) * scaleX;
            const transformY = y => nextBounds.top + (y - originalBounds.top) * scaleY;
            shape.x1 = transformX(original.x1);
            shape.x2 = transformX(original.x2);
            shape.y1 = transformY(original.y1);
            shape.y2 = transformY(original.y2);
            if (original.kind === 'stroke' && Array.isArray(original.points)) {
                shape.points = original.points.map(point => [
                    transformX(point[0]),
                    transformY(point[1]),
                    point[2]
                ]);
            }
            if (original.kind === 'text') {
                shape.fontSize = Math.max(8, (Number(original.fontSize) || 18) * Math.sqrt(Math.abs(scaleX * scaleY)));
            }
        });
        renderNotebookShapes();
    });
    const finishLasso = () => {
        if (!lassoActive) return false;
        const polygon = lassoPoints;
        lassoActive = false;
        lassoPoints = [];
        shapesSvg.classList.remove('is-lasso-drawing');
        const selected = polygon.length >= 3
            ? getCurrentPageShapes()
                .filter(shape => matchesLassoSelectionFilter(shape) && pageElementIntersectsPolygon(shape, polygon))
                .map(shape => shape.id)
            : [];
        setSelectedShapeIds(selected);
        renderNotebookShapes();
        return true;
    };
    const finishShapeEdit = () => {
        if (finishLasso()) return;
        if (!shapeEditStart) return;
        const edit = shapeEditStart;
        shapeEditStart = null;
        if (edit.moved) {
            recordEditorHistory(edit.historySnapshot);
            persistNotebookPages();
        }
    };
    const cancelShapeEdit = () => {
        if (lassoActive) {
            lassoActive = false;
            lassoPoints = [];
            shapesSvg.classList.remove('is-lasso-drawing');
            renderNotebookShapes();
            return;
        }
        if (!shapeEditStart) return;
        const shapes = getCurrentPageShapes();
        shapeEditStart.items.forEach(original => {
            const shape = shapes.find(item => item.id === original.id);
            if (shape) Object.assign(shape, original);
        });
        shapeEditStart = null;
        renderNotebookShapes();
    };
    shapesSvg?.addEventListener('pointerup', finishShapeEdit);
    shapesSvg?.addEventListener('pointercancel', cancelShapeEdit);
    const selectionMenu = editor.querySelector('#selectionContextMenu');
    const selectionColorPicker = editor.querySelector('#selectionColorPicker');
    shapesSvg?.addEventListener('contextmenu', event => {
        if (isNotebookReadOnly || currentToolState.tool !== 'lasso') return;
        const shapeGroup = event.target instanceof Element ? event.target.closest('[data-shape-id]') : null;
        if (shapeGroup && !getSelectedShapeIds().includes(shapeGroup.dataset.shapeId)) {
            setSelectedShapeIds([shapeGroup.dataset.shapeId]);
            renderNotebookShapes();
        }
        if (!getSelectedShapeIds().length || !selectionMenu) return;
        const editTextButton = selectionMenu.querySelector('[data-selection-action="edit-text"]');
        if (editTextButton) {
            editTextButton.disabled = !getSelectedPageElements().some(element => element.kind === 'text');
        }
        event.preventDefault();
        selectionMenu.classList.remove('hidden');
        const bounds = selectionMenu.getBoundingClientRect();
        selectionMenu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - bounds.width - 8))}px`;
        selectionMenu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - bounds.height - 8))}px`;
    });
    editor.addEventListener('pointerdown', event => {
        if (selectionMenu && !selectionMenu.contains(event.target)) selectionMenu.classList.add('hidden');
    });
    selectionMenu?.addEventListener('click', event => {
        const action = event.target.closest('[data-selection-action]')?.dataset.selectionAction;
        if (!action) return;
        selectionMenu.classList.add('hidden');
        if (action === 'copy') copySelectedPageElements();
        else if (action === 'cut') copySelectedPageElements(true);
        else if (action === 'duplicate') duplicatePageElements();
        else if (action === 'delete') deleteSelectedShape();
        else if (action === 'edit-text') editSelectedTextBox();
        else if (action === 'color') selectionColorPicker?.click();
        else if (action === 'export') void exportSelectionAsImage();
        else if (action === 'share') void exportSelectionAsImage(true);
    });
    selectionColorPicker?.addEventListener('input', () => {
        updateSelectedShape({ color: selectionColorPicker.value });
    });
    const textBoxModal = editor.querySelector('#textBoxModal');
    textBoxModal?.addEventListener('click', event => {
        if (event.target === textBoxModal) cancelTextBoxEditor();
    });
    const pageTemplateModal = editor.querySelector('#pageTemplateModal');
    pageTemplateModal?.addEventListener('click', event => {
        if (event.target === pageTemplateModal) closePageTemplateDialog();
    });
    editor.querySelectorAll('[data-page-template-action]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.pageTemplateAction === 'cancel') closePageTemplateDialog();
            else applyPageTemplateDialog();
        });
    });
    editor.querySelectorAll('[data-textbox-action]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.textboxAction === 'cancel') cancelTextBoxEditor();
            else {
                try {
                    saveTextBoxEditor();
                } catch (error) {
                    console.error('Textfeld konnte nicht gespeichert werden:', error);
                    alert(error.message || 'Das Textfeld konnte nicht gespeichert werden.');
                }
            }
        });
    });
    editor.querySelector('#textBoxContent')?.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelTextBoxEditor();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            editor.querySelector('[data-textbox-action="save"]')?.click();
        }
    });

    editor.querySelectorAll('[data-pen-color]').forEach(button => {
        button.addEventListener('click', () => {
            if (isNotebookReadOnly) return;
            pendingPenSettings.color = button.dataset.penColor;
            document.getElementById('editorColorPicker').value = pendingPenSettings.color;
            editor.querySelectorAll('[data-pen-color]').forEach(colorButton => {
                colorButton.classList.toggle('is-color-selected', colorButton === button);
            });
        });
    });
    editor.querySelectorAll('[data-pen-choice]').forEach(button => {
        button.addEventListener('click', () => {
            if (isNotebookReadOnly) return;
            const tool = button.dataset.penChoice;
            stagePenChoice(tool);
            document.getElementById('penSettingsPanel').classList.add('is-open');
        });
    });
    document.getElementById('applyPenSelection').addEventListener('click', () => {
        if (isNotebookReadOnly) return;
        penSettings[pendingPenTool] = { ...pendingPenSettings };
        setEditorTool(pendingPenTool);
        closeToolbarDropdowns();
    });
    document.getElementById('shapeKindSelect').addEventListener('change', event => {
        activeShape = event.target.value;
        setEditorTool('shapes');
    });
    document.getElementById('shapeWidthSelect').addEventListener('change', event => {
        activeShapeWidth = Number(event.target.value);
    });
    document.getElementById('objectEmojiSelect').addEventListener('change', event => {
        activeObjectEmoji = event.target.value;
        setEditorTool('objects');
    });
    document.getElementById('editorColorPicker').addEventListener('input', event => {
        pendingPenSettings.color = event.target.value;
        editor.querySelectorAll('[data-pen-color]').forEach(colorButton => colorButton.classList.remove('is-color-selected'));
    });
    document.getElementById('penWidthSelect').addEventListener('change', event => {
        pendingPenSettings.width = Number(event.target.value);
    });
    document.getElementById('eraserWidthSelect').addEventListener('change', event => {
        activeEraserWidth = Number(event.target.value);
    });
    editor.querySelectorAll('[data-toolbar-toggle]').forEach(input => {
        input.addEventListener('change', () => {
            const tool = editor.querySelector(`[data-toolbar-tool="${input.dataset.toolbarToggle}"]`);
            if (tool) tool.classList.toggle('toolbar-tool-hidden', !input.checked);
        });
    });
    document.getElementById('inputModeSelect')?.addEventListener('change', event => {
        setInputMode(event.target.value);
    });
    const lassoFilterSelect = document.getElementById('lassoFilterSelect');
    const availableLassoFilters = ['all', 'handwriting', 'images', 'text', 'shapes'];
    if (!availableLassoFilters.includes(lassoSelectionFilter)) lassoSelectionFilter = 'all';
    if (lassoFilterSelect) {
        lassoFilterSelect.value = lassoSelectionFilter;
        lassoFilterSelect.addEventListener('change', event => {
            lassoSelectionFilter = event.target.value;
            localStorage.setItem('mynotes_lasso_filter', lassoSelectionFilter);
        });
    }
    document.getElementById('editorImageInput').addEventListener('change', event => {
        if (isNotebookReadOnly) {
            event.target.value = '';
            return;
        }
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
                if (isNotebookReadOnly) return;
                const bounds = canvas.getBoundingClientRect();
                const canvasWidth = bounds.width / currentPageZoom;
                const canvasHeight = bounds.height / currentPageZoom;
                const scale = Math.min(canvasWidth * 0.6 / image.width, canvasHeight * 0.6 / image.height, 1);
                const width = image.width * scale;
                const height = image.height * scale;
                const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                recordEditorHistory(captureEditorSnapshot(['shapes']));
                getCurrentPageShapes().push({
                    id: objectId,
                    kind: 'image',
                    src: String(reader.result),
                    x1: (canvasWidth - width) / 2,
                    y1: (canvasHeight - height) / 2,
                    x2: (canvasWidth + width) / 2,
                    y2: (canvasHeight + height) / 2
                });
                setSelectedShapeIds([objectId]);
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
    setInputMode(currentToolState.inputMode);
    setEditorTool(currentToolState.tool);
    updateEditorHistoryButtons();
}

