(function () {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function getRawObjectBounds(object) {
        if (object.kind === 'stroke') {
            const points = object.points || [];
            if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
            const xs = points.map(point => point[0]);
            const ys = points.map(point => point[1]);
            const padding = Math.max(2, Number(object.width) || 2);
            const left = Math.min(...xs) - padding;
            const top = Math.min(...ys) - padding;
            return {
                x: left,
                y: top,
                width: Math.max(...xs) - Math.min(...xs) + padding * 2,
                height: Math.max(...ys) - Math.min(...ys) + padding * 2
            };
        }
        return {
            x: Number(object.x) || 0,
            y: Number(object.y) || 0,
            width: Math.max(1, Number(object.width) || 1),
            height: Math.max(1, Number(object.height) || 1)
        };
    }

    function rotatePoint(point, center, angle) {
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const x = point.x - center.x;
        const y = point.y - center.y;
        return {
            x: center.x + x * cosine - y * sine,
            y: center.y + x * sine + y * cosine
        };
    }

    function getObjectBounds(object) {
        const bounds = getRawObjectBounds(object);
        const angle = (Number(object.rotation) || 0) * Math.PI / 180;
        if (!angle) return bounds;
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        const corners = [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height }
        ].map(point => rotatePoint(point, center, angle));
        const xs = corners.map(point => point.x);
        const ys = corners.map(point => point.y);
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    function getSceneBounds(objects, margin = 80) {
        const visible = (objects || []).filter(object => !object.deletedAt && object.kind !== 'connection');
        if (!visible.length) return { x: -600, y: -450, width: 1200, height: 900 };
        const bounds = visible.map(getObjectBounds);
        const left = Math.min(...bounds.map(item => item.x));
        const top = Math.min(...bounds.map(item => item.y));
        const right = Math.max(...bounds.map(item => item.x + item.width));
        const bottom = Math.max(...bounds.map(item => item.y + item.height));
        return {
            x: left - margin,
            y: top - margin,
            width: Math.max(100, right - left + margin * 2),
            height: Math.max(100, bottom - top + margin * 2)
        };
    }

    function pointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const first = polygon[i];
            const second = polygon[j];
            const crosses = (first[1] > point.y) !== (second[1] > point.y) &&
                point.x < ((second[0] - first[0]) * (point.y - first[1])) /
                ((second[1] - first[1]) || Number.EPSILON) + first[0];
            if (crosses) inside = !inside;
        }
        return inside;
    }

    function distanceToSegment(point, first, second) {
        const dx = second[0] - first[0];
        const dy = second[1] - first[1];
        const length = dx * dx + dy * dy;
        const ratio = length ? clamp(((point.x - first[0]) * dx + (point.y - first[1]) * dy) / length, 0, 1) : 0;
        return Math.hypot(point.x - (first[0] + ratio * dx), point.y - (first[1] + ratio * dy));
    }

    function hitTest(objects, point, tolerance) {
        for (let index = objects.length - 1; index >= 0; index -= 1) {
            const object = objects[index];
            if (object.kind === 'connection') continue;
            const bounds = getObjectBounds(object);
            if (point.x < bounds.x - tolerance || point.x > bounds.x + bounds.width + tolerance ||
                point.y < bounds.y - tolerance || point.y > bounds.y + bounds.height + tolerance) continue;
            const rawBounds = getRawObjectBounds(object);
            const center = { x: rawBounds.x + rawBounds.width / 2, y: rawBounds.y + rawBounds.height / 2 };
            const localPoint = rotatePoint(point, center, -(Number(object.rotation) || 0) * Math.PI / 180);
            if (object.kind === 'stroke') {
                const points = object.points || [];
                if (points.length === 1 && Math.hypot(localPoint.x - points[0][0], localPoint.y - points[0][1]) <= tolerance + object.width) {
                    return object;
                }
                for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
                    if (distanceToSegment(localPoint, points[pointIndex - 1], points[pointIndex]) <= tolerance + object.width) {
                        return object;
                    }
                }
                continue;
            }
            if (localPoint.x >= rawBounds.x - tolerance && localPoint.x <= rawBounds.x + rawBounds.width + tolerance &&
                localPoint.y >= rawBounds.y - tolerance && localPoint.y <= rawBounds.y + rawBounds.height + tolerance) return object;
        }
        return null;
    }

    function getSelectionBounds(objects, selectedIds) {
        const selected = (objects || []).filter(object => selectedIds.includes(object.id) && object.kind !== 'connection');
        if (!selected.length) return null;
        const bounds = selected.map(getObjectBounds);
        const left = Math.min(...bounds.map(item => item.x));
        const top = Math.min(...bounds.map(item => item.y));
        const right = Math.max(...bounds.map(item => item.x + item.width));
        const bottom = Math.max(...bounds.map(item => item.y + item.height));
        return { x: left, y: top, width: right - left, height: bottom - top };
    }

    function drawGrid(context, width, height, background, grid, transform) {
        context.fillStyle = background || '#ffffff';
        context.fillRect(0, 0, width, height);
        if (!grid || grid === 'none') return;
        const { scale, x, y } = transform;
        const step = 24;
        const screenStep = step * scale;
        if (screenStep < 5 || screenStep > 180) return;
        const offset = grid === 'dots' ? screenStep / 2 : 0;
        const startX = ((x + offset) % screenStep + screenStep) % screenStep;
        const startY = ((y + offset) % screenStep + screenStep) % screenStep;
        const isLightBackground = ['#ffffff', '#fafafa'].includes(String(background || '').toLowerCase());
        context.save();
        if (grid === 'dots') {
            context.fillStyle = isLightBackground ? '#D5D7DB' : '#94a3b8';
            for (let px = startX; px < width; px += screenStep) {
                for (let py = startY; py < height; py += screenStep) {
                    context.beginPath();
                    context.arc(px, py, Math.max(0.7, Math.min(1.35, 1.35 * scale)), 0, Math.PI * 2);
                    context.fill();
                }
            }
        } else {
            context.strokeStyle = isLightBackground ? '#E5E7EB' : '#cbd5e166';
            context.lineWidth = 1;
            context.beginPath();
            if (grid === 'squares') {
                for (let px = startX; px < width; px += screenStep) {
                    context.moveTo(Math.round(px) + 0.5, 0);
                    context.lineTo(Math.round(px) + 0.5, height);
                }
            }
            if (grid === 'lines' || grid === 'squares') {
                for (let py = startY; py < height; py += screenStep) {
                    context.moveTo(0, Math.round(py) + 0.5);
                    context.lineTo(width, Math.round(py) + 0.5);
                }
            }
            context.stroke();
        }
        context.restore();
    }

    function drawStroke(context, object) {
        const points = object.points || [];
        if (!points.length) return;
        const highlighter = object.tool === 'highlighter';
        const penType = object.penType || 'fountain';
        const opacity = Number.isFinite(Number(object.opacity)) ? Number(object.opacity) : 1;
        context.globalAlpha = clamp(opacity, 0.05, 1) * (highlighter ? 0.3 : penType === 'pencil' ? 0.72 : 1);
        context.strokeStyle = object.color || '#172554';
        context.fillStyle = context.strokeStyle;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        if (penType === 'pencil') context.setLineDash([Math.max(1, Number(object.width) * 0.04), Math.max(1, Number(object.width) * 0.08)]);
        const pressureWidth = pressure => {
            if (highlighter || penType === 'ballpoint' || penType === 'fineliner') return 1;
            if (penType === 'pencil') return 0.55 + pressure * 0.65;
            if (penType === 'brush') return 0.3 + pressure * 1.7;
            return 0.3 + pressure * 1.25;
        };
        if (points.length === 1) {
            context.beginPath();
            context.arc(points[0][0], points[0][1], Math.max(0.5, (Number(object.width) || 2) * pressureWidth(points[0][2] || 0.5) / 2), 0, Math.PI * 2);
            context.fill();
        } else {
            for (let index = 1; index < points.length; index += 1) {
                const first = points[index - 1];
                const second = points[index];
                context.beginPath();
                context.moveTo(first[0], first[1]);
                context.lineTo(second[0], second[1]);
                const averagePressure = ((first[2] || 0.5) + (second[2] || 0.5)) / 2;
                context.lineWidth = Math.max(0.5, (Number(object.width) || 2) * pressureWidth(averagePressure));
                context.stroke();
            }
        }
        context.setLineDash([]);
        context.globalAlpha = 1;
    }

    function drawArrow(context, x1, y1, x2, y2, width) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = Math.max(10, width * 4);
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.moveTo(x2, y2);
        context.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
        context.moveTo(x2, y2);
        context.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
        context.stroke();
    }

    function drawConnector(context, connector, objectMap) {
        const from = objectMap.get(connector.fromId);
        const to = objectMap.get(connector.toId);
        if (!from || !to) return;
        const fromBounds = getObjectBounds(from);
        const toBounds = getObjectBounds(to);
        const first = { x: fromBounds.x + fromBounds.width / 2, y: fromBounds.y + fromBounds.height / 2 };
        const second = { x: toBounds.x + toBounds.width / 2, y: toBounds.y + toBounds.height / 2 };
        const angle = Math.atan2(second.y - first.y, second.x - first.x);
        const rayLength = Math.hypot(second.x - first.x, second.y - first.y) || 1;
        const edgeOffset = (bounds, direction) => {
            const xScale = bounds.width / 2 / Math.max(0.001, Math.abs(Math.cos(direction)));
            const yScale = bounds.height / 2 / Math.max(0.001, Math.abs(Math.sin(direction)));
            return Math.min(xScale, yScale);
        };
        const startOffset = edgeOffset(fromBounds, angle);
        const endOffset = edgeOffset(toBounds, angle + Math.PI);
        const x1 = first.x + Math.cos(angle) * startOffset;
        const y1 = first.y + Math.sin(angle) * startOffset;
        const x2 = second.x - Math.cos(angle) * endOffset;
        const y2 = second.y - Math.sin(angle) * endOffset;
        if (rayLength < startOffset + endOffset) return;
        context.save();
        context.strokeStyle = connector.color || '#64748b';
        context.lineWidth = Math.max(1, Number(connector.strokeWidth) || 2);
        if (connector.dashed) context.setLineDash([6, 5]);
        drawArrow(context, x1, y1, x2, y2, context.lineWidth);
        context.restore();
    }

    function drawText(context, object) {
        const fontSize = Math.max(10, Number(object.fontSize) || 24);
        context.font = `${object.italic ? 'italic ' : ''}${object.bold ? '600 ' : ''}${fontSize}px ${object.fontFamily || 'Arial, sans-serif'}`;
        context.fillStyle = object.textColor || object.color || '#172554';
        context.textBaseline = 'top';
        context.textAlign = object.align || 'left';
        const maxWidth = Math.max(50, Number(object.width) || 300);
        const textX = object.align === 'center' ? object.x + maxWidth / 2
            : object.align === 'right' ? object.x + maxWidth
                : object.x;
        const lineHeight = fontSize * 1.35;
        let lineIndex = 0;
        for (const paragraph of String(object.text || '').split('\n')) {
            let line = '';
            for (const word of paragraph.split(/\s+/)) {
                const candidate = line ? `${line} ${word}` : word;
                if (line && context.measureText(candidate).width > maxWidth) {
                    context.fillText(line, textX, object.y + lineIndex * lineHeight, maxWidth);
                    if (object.underline) {
                        const lineWidth = context.measureText(line).width;
                        const startX = object.align === 'center' ? textX - lineWidth / 2 : object.align === 'right' ? textX - lineWidth : textX;
                        context.fillRect(startX, object.y + lineIndex * lineHeight + fontSize, lineWidth, Math.max(1, fontSize / 16));
                    }
                    lineIndex += 1;
                    line = word;
                } else {
                    line = candidate;
                }
            }
            context.fillText(line, textX, object.y + lineIndex * lineHeight, maxWidth);
            if (object.underline) {
                const lineWidth = context.measureText(line).width;
                const startX = object.align === 'center' ? textX - lineWidth / 2 : object.align === 'right' ? textX - lineWidth : textX;
                context.fillRect(startX, object.y + lineIndex * lineHeight + fontSize, lineWidth, Math.max(1, fontSize / 16));
            }
            lineIndex += 1;
        }
    }

    function drawObject(context, object, assets) {
        if (object.kind === 'connection') return;
        context.save();
        const rawBounds = getRawObjectBounds(object);
        const centerX = rawBounds.x + rawBounds.width / 2;
        const centerY = rawBounds.y + rawBounds.height / 2;
        if (object.rotation) {
            context.translate(centerX, centerY);
            context.rotate(Number(object.rotation) * Math.PI / 180);
            context.translate(-centerX, -centerY);
        }
        context.globalAlpha = clamp(Number(object.opacity) || 1, 0.05, 1);
        if (object.kind === 'stroke') {
            drawStroke(context, object);
        } else if (object.kind === 'shape') {
            const x1 = object.x;
            const y1 = object.y;
            const x2 = object.x + object.width;
            const y2 = object.y + object.height;
            context.strokeStyle = object.color || '#172554';
            context.fillStyle = object.fill || 'transparent';
            context.lineWidth = Math.max(1, Number(object.strokeWidth) || 3);
            context.setLineDash(object.dashed ? [8, 6] : []);
            if (object.shape === 'line' || object.shape === 'arrow' || object.shape === 'doubleArrow') {
                if (object.shape === 'arrow') drawArrow(context, x1, y1, x2, y2, context.lineWidth);
                else if (object.shape === 'doubleArrow') {
                    drawArrow(context, x1, y1, x2, y2, context.lineWidth);
                    drawArrow(context, x2, y2, x1, y1, context.lineWidth);
                }
                else {
                    context.beginPath();
                    context.moveTo(x1, y1);
                    context.lineTo(x2, y2);
                    context.stroke();
                }
            } else if (object.shape === 'ellipse') {
                context.beginPath();
                context.ellipse(x1 + object.width / 2, y1 + object.height / 2, Math.abs(object.width / 2), Math.abs(object.height / 2), 0, 0, Math.PI * 2);
                if (object.fill && object.fill !== 'transparent') context.fill();
                context.stroke();
            } else {
                context.beginPath();
                if (object.shape === 'triangle') {
                    context.moveTo(x1 + object.width / 2, y1);
                    context.lineTo(x2, y2);
                    context.lineTo(x1, y2);
                    context.closePath();
                } else if (object.shape === 'diamond') {
                    context.moveTo(x1 + object.width / 2, y1);
                    context.lineTo(x2, y1 + object.height / 2);
                    context.lineTo(x1 + object.width / 2, y2);
                    context.lineTo(x1, y1 + object.height / 2);
                    context.closePath();
                } else if (object.shape === 'roundedRect' && context.roundRect) {
                    context.roundRect(x1, y1, object.width, object.height, Math.min(16, object.width / 8, object.height / 8));
                } else if (object.shape === 'speechBubble') {
                    const tail = Math.min(18, object.width / 5, object.height / 4);
                    context.moveTo(x1, y1);
                    context.lineTo(x2, y1);
                    context.lineTo(x2, y2 - tail);
                    context.lineTo(x1 + object.width * 0.35, y2 - tail);
                    context.lineTo(x1 + object.width * 0.25, y2);
                    context.lineTo(x1 + object.width * 0.22, y2 - tail);
                    context.lineTo(x1, y2 - tail);
                    context.closePath();
                } else if (object.shape === 'polygon') {
                    if (Array.isArray(object.points) && object.points.length > 2) {
                        context.moveTo(object.points[0][0], object.points[0][1]);
                        object.points.slice(1).forEach(point => context.lineTo(point[0], point[1]));
                    } else {
                        const sides = 6;
                        for (let index = 0; index < sides; index += 1) {
                            const angle = -Math.PI / 2 + index * Math.PI * 2 / sides;
                            const x = x1 + object.width / 2 + Math.cos(angle) * object.width / 2;
                            const y = y1 + object.height / 2 + Math.sin(angle) * object.height / 2;
                            if (index === 0) context.moveTo(x, y);
                            else context.lineTo(x, y);
                        }
                    }
                    context.closePath();
                } else if (object.shape === 'freeform' && Array.isArray(object.points) && object.points.length > 1) {
                    context.moveTo(object.points[0][0], object.points[0][1]);
                    object.points.slice(1).forEach(point => context.lineTo(point[0], point[1]));
                } else {
                    context.rect(x1, y1, object.width, object.height);
                }
                if (object.fill && object.fill !== 'transparent') context.fill();
                context.stroke();
            }
            context.setLineDash([]);
        } else if (object.kind === 'text') {
            drawText(context, object);
        } else if (object.kind === 'sticky') {
            context.fillStyle = object.color || '#fef08a';
            context.shadowColor = '#0f172a24';
            context.shadowBlur = 10;
            context.shadowOffsetY = 3;
            context.fillRect(object.x, object.y, object.width, object.height);
            context.shadowColor = 'transparent';
            context.fillStyle = '#713f12';
            context.font = `600 ${Math.max(14, Number(object.fontSize) || 16)}px Arial, sans-serif`;
            context.fillText(object.title || 'Notiz', object.x + 12, object.y + 10, object.width - 24);
            context.font = `${Math.max(12, (Number(object.fontSize) || 16) - 1)}px Arial, sans-serif`;
            drawText(context, {
                ...object,
                x: object.x + 12,
                y: object.y + 36,
                width: object.width - 24,
                fontSize: Math.max(12, (Number(object.fontSize) || 16) - 1),
                color: '#713f12'
            });
        } else if (object.kind === 'mindmap') {
            const radius = Math.min(18, object.height / 4);
            context.fillStyle = object.color || '#dbeafe';
            context.strokeStyle = object.borderColor || '#2563eb';
            context.lineWidth = Math.max(1, Number(object.strokeWidth) || 2);
            context.beginPath();
            if (context.roundRect) context.roundRect(object.x, object.y, object.width, object.height, radius);
            else context.rect(object.x, object.y, object.width, object.height);
            context.fill();
            context.stroke();
            drawText(context, {
                ...object,
                x: object.x + 12,
                y: object.y + 10,
                width: object.width - 24,
                height: object.height - 20,
                fontSize: object.fontSize || 18,
                color: object.textColor || '#172554',
                bold: object.bold !== false,
                align: 'center'
            });
        } else if (object.kind === 'image') {
            const image = assets.get(object.assetId);
            if (image) context.drawImage(image, object.x, object.y, object.width, object.height);
            else {
                context.fillStyle = '#e2e8f0';
                context.fillRect(object.x, object.y, object.width, object.height);
                context.strokeStyle = '#94a3b8';
                context.strokeRect(object.x, object.y, object.width, object.height);
            }
        }
        context.restore();
    }

    function drawSelection(context, objects, selectedIds, scale) {
        const selected = objects.filter(object => selectedIds.includes(object.id));
        if (!selected.length) return;
        const bounds = getSelectionBounds(objects, selectedIds);
        if (!bounds) return;
        context.save();
        context.strokeStyle = '#2563eb';
        context.fillStyle = '#ffffff';
        context.lineWidth = 1 / scale;
        context.setLineDash([5, 4]);
        context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        context.setLineDash([]);
        const handle = 9 / scale;
        const points = [
            [bounds.x, bounds.y], [bounds.x + bounds.width / 2, bounds.y], [bounds.x + bounds.width, bounds.y],
            [bounds.x + bounds.width, bounds.y + bounds.height / 2],
            [bounds.x + bounds.width, bounds.y + bounds.height], [bounds.x + bounds.width / 2, bounds.y + bounds.height],
            [bounds.x, bounds.y + bounds.height], [bounds.x, bounds.y + bounds.height / 2]
        ];
        points.forEach(([x, y]) => {
            context.fillRect(x - handle / 2, y - handle / 2, handle, handle);
            context.strokeRect(x - handle / 2, y - handle / 2, handle, handle);
        });
        const rotateY = bounds.y - 28 / scale;
        context.beginPath();
        context.moveTo(bounds.x + bounds.width / 2, bounds.y);
        context.lineTo(bounds.x + bounds.width / 2, rotateY);
        context.stroke();
        context.beginPath();
        context.arc(bounds.x + bounds.width / 2, rotateY, 6 / scale, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.restore();
    }

    function drawScene(context, width, height, state, transform, assets, preview) {
        const viewport = transform || state.viewport || { x: 0, y: 0, scale: 1 };
        drawGrid(context, width, height, state.background, state.grid, viewport);
        const scale = clamp(Number(viewport.scale) || 1, 0.1, 5);
        context.save();
        context.translate(viewport.x, viewport.y);
        context.scale(scale, scale);
        const visible = {
            x: -viewport.x / scale,
            y: -viewport.y / scale,
            width: width / scale,
            height: height / scale
        };
        const layerRank = object => object.kind === 'image' && object.sourcePdfAssetId && object.locked
            ? 0
            : object.kind === 'stroke' && object.tool === 'highlighter'
                ? 1
                : 2;
        const objects = [...(state.objects || [])].sort((a, b) => layerRank(a) - layerRank(b));
        const objectMap = new Map(objects.map(object => [object.id, object]));
        const isVisible = object => {
            const bounds = getObjectBounds(object);
            return !(bounds.x + bounds.width < visible.x || bounds.x > visible.x + visible.width ||
                bounds.y + bounds.height < visible.y || bounds.y > visible.y + visible.height);
        };
        for (const object of objects) {
            if (layerRank(object) === 0 && isVisible(object)) drawObject(context, object, assets);
        }
        for (const connector of objects) {
            if (connector.kind === 'connection') drawConnector(context, connector, objectMap);
        }
        for (const object of objects) {
            if (object.kind === 'connection' || layerRank(object) === 0 || !isVisible(object)) continue;
            drawObject(context, object, assets);
        }
        if (preview) drawObject(context, preview, assets);
        drawSelection(context, state.objects || [], state.selectedIds || [], scale);
        if (state.eraseArea) {
            const left = Math.min(state.eraseArea.start.x, state.eraseArea.end.x);
            const top = Math.min(state.eraseArea.start.y, state.eraseArea.end.y);
            context.save();
            context.fillStyle = '#ef444422';
            context.strokeStyle = '#dc2626';
            context.lineWidth = 1.5 / scale;
            context.setLineDash([6 / scale, 4 / scale]);
            context.fillRect(left, top, Math.abs(state.eraseArea.end.x - state.eraseArea.start.x), Math.abs(state.eraseArea.end.y - state.eraseArea.start.y));
            context.strokeRect(left, top, Math.abs(state.eraseArea.end.x - state.eraseArea.start.x), Math.abs(state.eraseArea.end.y - state.eraseArea.start.y));
            context.restore();
        }
        if (state.lassoPoints?.length > 1) {
            context.save();
            context.strokeStyle = '#2563eb';
            context.lineWidth = 1.5 / scale;
            context.setLineDash([5 / scale, 4 / scale]);
            context.beginPath();
            context.moveTo(state.lassoPoints[0][0], state.lassoPoints[0][1]);
            state.lassoPoints.slice(1).forEach(point => context.lineTo(point[0], point[1]));
            context.stroke();
            context.restore();
        }
        context.restore();
    }

    window.MyNotesWhiteboardEngine = Object.freeze({
        clamp,
        getObjectBounds,
        getSceneBounds,
        getSelectionBounds,
        pointInPolygon,
        hitTest,
        drawScene
    });
})();
