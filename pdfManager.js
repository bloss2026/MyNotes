// PDF and document import/export
function fileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
    });
}

function getImageOrientation(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(new Error('Ein Seitenbild im Archiv konnte nicht geöffnet werden.'));
        image.onload = () => resolve(image.naturalWidth >= image.naturalHeight ? 'landscape' : 'portrait');
        image.src = dataUrl;
    });
}

async function renderPdfPages(data) {
    if (!window.pdfjsLib) throw new Error('PDF.js ist nicht verfügbar. Bitte lade die Seite online neu.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const pdfPage = await pdf.getPage(pageNumber);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(1.75, 1800 / Math.max(baseViewport.width, baseViewport.height));
        const viewport = pdfPage.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF-Seite konnte nicht gerendert werden.');
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        const textContent = await pdfPage.getTextContent();
        const searchText = textContent.items
            .filter(item => typeof item.str === 'string')
            .map(item => item.str.trim())
            .filter(Boolean)
            .join(' ');
        pages.push({
            content: '',
            searchText,
            drawing: '',
            shapes: [],
            backgroundDataUrl: canvas.toDataURL('image/png'),
            orientation: viewport.width >= viewport.height ? 'landscape' : 'portrait'
        });
        pdfPage.cleanup();
    }
    return pages;
}

async function extractGoodnotesPages(file) {
    if (!window.JSZip) throw new Error('JSZip ist nicht verfügbar. Bitte lade die Seite online neu.');
    const archive = await JSZip.loadAsync(file);

    async function extractArchivePages(zip, depth) {
        const files = Object.values(zip.files).filter(entry => !entry.dir);
        const pdfFiles = files
            .filter(entry => /\.pdf$/i.test(entry.name) && !/preview|thumbnail/i.test(entry.name))
            .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }));
        if (pdfFiles.length) {
            const pages = [];
            for (const entry of pdfFiles) {
                pages.push(...await renderPdfPages(await entry.async('uint8array')));
            }
            return pages;
        }

        const imageFiles = files
            .filter(entry => /\.(png|jpe?g|webp)$/i.test(entry.name) && !/preview|thumbnail|cover/i.test(entry.name))
            .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }));
        if (imageFiles.length) {
            const pages = [];
            for (const entry of imageFiles) {
                const extension = entry.name.split('.').pop().toLowerCase();
                const mimeType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`;
                const blob = new Blob([await entry.async('uint8array')], { type: mimeType });
                const backgroundDataUrl = await fileAsDataUrl(blob);
                pages.push({
                    content: '',
                    drawing: '',
                    shapes: [],
                    backgroundDataUrl,
                    orientation: await getImageOrientation(backgroundDataUrl)
                });
            }
            return pages;
        }

        if (depth < 2) {
            const nestedArchives = files.filter(entry => /\.(zip|goodnotes)$/i.test(entry.name));
            for (const entry of nestedArchives) {
                const nested = await JSZip.loadAsync(await entry.async('uint8array'));
                const pages = await extractArchivePages(nested, depth + 1);
                if (pages.length) return pages;
            }
        }
        return [];
    }

    const pages = await extractArchivePages(archive, 0);
    if (!pages.length) {
        throw new Error('In der Goodnotes-Datei wurde weder ein Hintergrund-PDF noch eine unterstützte Seitenbildstruktur gefunden.');
    }
    return pages;
}

async function importDocumentFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    let pages;
    const originalPdf = extension === 'pdf'
        ? file.slice(0, file.size, 'application/pdf')
        : null;
    if (extension === 'pdf') {
        pages = await renderPdfPages(await file.arrayBuffer());
    } else if (extension === 'goodnotes' || extension === 'zip') {
        pages = await extractGoodnotesPages(file);
    } else {
        throw new Error('Bitte wähle eine PDF- oder Goodnotes-Datei aus.');
    }

    await ensureNotebookStorage();
    let id = Date.now();
    while (notebooks.some(notebook => notebook.id === id)) id += 1;
    const title = file.name.replace(/\.(pdf|goodnotes|zip)$/i, '').trim() || 'Importiertes Dokument';
    const notebook = {
        id,
        title,
        template: 'PDF',
        pattern: '',
        paperColor: 'weiss',
        orientation: pages[0].orientation,
        cover: 'cover-simple',
        pageCount: pages.length,
        pages,
        folderName: activeDashboardFilter === 'folder' ? activeDashboardFolder : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    notebooks.push(notebook);
    try {
        await notebookDb.transaction('rw', notebookDb.pages, notebookDb.pdfOriginals, async () => {
            await notebookDb.pages.bulkPut(pages.map((page, pageIndex) => ({
                ...page,
                notebookId: String(id),
                pageIndex
            })));
            if (originalPdf) {
                await notebookDb.pdfOriginals.put({
                    notebookId: String(id),
                    fileName: file.name,
                    importedAt: new Date().toISOString(),
                    blob: originalPdf
                });
            }
        });
        saveNotebookMetadata(notebook.id);
    } catch (error) {
        notebooks = notebooks.filter(item => item.id !== id);
        throw new Error(`Das Dokument konnte nicht lokal gespeichert werden: ${error.message || error}`);
    }
    loadNotebooksToDashboard();
    await openNotebook(id);
}

function dataUrlToBytes(dataUrl) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
    if (!match) throw new Error('Ein Bildobjekt hat ein ungültiges Datenformat.');
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { mimeType: match[1], bytes };
}

function imageDataUrlAsPng(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(new Error('Ein Bild konnte für den PDF-Export nicht dekodiert werden.'));
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d');
            if (!context) {
                reject(new Error('Ein Bild konnte für den PDF-Export nicht vorbereitet werden.'));
                return;
            }
            context.drawImage(image, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        image.src = dataUrl;
    });
}

function textToPngDataUrl(text, fontSize) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.max(128, Math.ceil(fontSize * 2));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Objekt konnte nicht für den PDF-Export vorbereitet werden.');
    context.font = `${Math.ceil(fontSize * 1.5)}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
}

function wrapPdfText(text, font, fontSize, maxWidth) {
    const lines = [];
    String(text || '').split(/\r?\n/).forEach(paragraph => {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }
        lines.push(line);
    });
    return lines;
}

function drawTemplateBackground(page, pageData, notebook, width, height) {
    const paperColor = getNotebookPagePaperColor(pageData, notebook);
    const colors = {
        gelb: [0.973, 0.969, 0.914],
        weiss: [1, 1, 1],
        creme: [1, 0.98, 0.941],
        sepia: [0.918, 0.863, 0.769],
        dunkel: [0.188, 0.188, 0.188]
    };
    const lineColor = paperColor === 'dunkel'
        ? PDFLib.rgb(0.36, 0.36, 0.36)
        : PDFLib.rgb(0.78, 0.75, 0.69);
    page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: PDFLib.rgb(...colors[paperColor])
    });

    const pattern = getNotebookPageTemplate(pageData, notebook);
    const spacing = pattern === 'paper-lined-narrow' ? 18 : 28;
    const drawHorizontalRules = step => {
        for (let y = step; y < height; y += step) {
            page.drawLine({ start: { x: 0, y }, end: { x: width, y }, thickness: 0.45, color: lineColor });
        }
    };
    const drawVerticalRules = (count, offset = 0) => {
        for (let index = 1; index < count; index += 1) {
            const x = width * index / count;
            page.drawLine({ start: { x: x + offset, y: 0 }, end: { x: x + offset, y: height }, thickness: 0.45, color: lineColor });
        }
    };

    if (pattern === 'paper-dotted') {
        for (let y = 18; y < height; y += 18) {
            for (let x = 18; x < width; x += 18) {
                page.drawCircle({ x, y, size: 0.7, color: lineColor });
            }
        }
    } else if (['paper-grid', 'paper-accounting', 'paper-month', 'paper-week', 'paper-day', 'paper-month-dark'].includes(pattern)) {
        drawHorizontalRules(24);
        for (let x = 24; x < width; x += 24) {
            page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, thickness: 0.45, color: lineColor });
        }
    } else if (pattern === 'paper-column') {
        drawVerticalRules(2);
    } else if (pattern === 'paper-mixed') {
        drawVerticalRules(3);
        drawHorizontalRules(spacing);
    } else if (pattern === 'paper-three-columns') {
        drawVerticalRules(3);
        drawHorizontalRules(spacing);
    } else if (pattern === 'paper-cornell') {
        drawHorizontalRules(spacing);
        page.drawLine({ start: { x: width * 0.26, y: 0 }, end: { x: width * 0.26, y: height }, thickness: 0.6, color: lineColor });
    } else if (pattern === 'paper-guitar' || pattern === 'paper-tabs' || pattern === 'paper-music') {
        for (let y = 36; y < height; y += 72) {
            for (let line = 0; line < (pattern === 'paper-music' ? 5 : 6); line += 1) {
                page.drawLine({ start: { x: 0, y: y + line * 5 }, end: { x: width, y: y + line * 5 }, thickness: 0.55, color: lineColor });
            }
        }
    } else if (pattern) {
        drawHorizontalRules(spacing);
    }
}

async function exportNotebookOriginalPdf() {
    try {
        await ensureNotebookStorage();
        const original = await notebookDb.pdfOriginals.get(String(currentNotebookId));
        if (!original?.blob) throw new Error('Für dieses Notizbuch wurde keine Original-PDF-Datei gespeichert.');
        const url = URL.createObjectURL(original.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = original.fileName || 'Originaldokument.pdf';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error('Original-PDF konnte nicht exportiert werden:', error);
        alert(error instanceof Error ? error.message : 'Die Original-PDF-Datei konnte nicht exportiert werden.');
    }
}

async function exportNotebookPdf(pageIndexes = null) {
    try {
        if (!window.PDFLib) throw new Error('pdf-lib ist nicht verfügbar. Bitte lade die Seite online neu.');
        persistNotebookPages();
        const notebook = notebooks.find(item => item.id === currentNotebookId);
        if (!notebook) throw new Error('Das aktuelle Notizbuch wurde nicht gefunden.');
        const pages = getNotebookPages(notebook);
        const selectedPageIndexes = pageIndexes || pages.map((page, index) => index);
        if (!selectedPageIndexes.length || selectedPageIndexes.some(index => !Number.isInteger(index) || index < 0 || index >= pages.length)) {
            throw new Error('Die ausgewählte Seite konnte nicht exportiert werden.');
        }
        const pdf = await PDFLib.PDFDocument.create();
        const singlePage = selectedPageIndexes.length === 1;
        const exportedPageNumber = selectedPageIndexes[0] + 1;
        pdf.setTitle(singlePage ? `${notebook.title || 'MyNotes'} - Seite ${exportedPageNumber}` : notebook.title || 'MyNotes');
        const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);

        for (const pageIndex of selectedPageIndexes) {
            const pageData = pages[pageIndex];
            const orientation = pageData.orientation || notebook.orientation;
            const { width, height } = getNotebookPageDimensions(
                pageData.pageSize || notebook.pageSize,
                orientation
            );
            const page = pdf.addPage([width, height]);
            let pageBackground = null;
            if (pageData.backgroundDataUrl) {
                let imageData = dataUrlToBytes(pageData.backgroundDataUrl);
                if (!['image/png', 'image/jpeg'].includes(imageData.mimeType)) {
                    imageData = dataUrlToBytes(await imageDataUrlAsPng(pageData.backgroundDataUrl));
                }
                pageBackground = imageData.mimeType === 'image/jpeg'
                    ? await pdf.embedJpg(imageData.bytes)
                    : await pdf.embedPng(imageData.bytes);
                page.drawImage(pageBackground, { x: 0, y: 0, width, height });
            } else {
                drawTemplateBackground(page, pageData, notebook, width, height);
            }

            const pageElement = document.getElementById('notebookPage');
            const bounds = pageElement?.getBoundingClientRect();
            const sourceWidth = bounds ? bounds.width / currentPageZoom : (landscape ? 1050 : 740);
            const sourceHeight = bounds ? bounds.height / currentPageZoom : (landscape ? 740 : 1050);
            const scaleX = width / sourceWidth;
            const scaleY = height / sourceHeight;
            const fontSize = 14 * scaleX;
            const paperTextColor = getNotebookPagePaperColor(pageData, notebook) === 'dunkel'
                ? PDFLib.rgb(0.95, 0.95, 0.95)
                : PDFLib.rgb(0.12, 0.16, 0.22);
            const textLines = wrapPdfText(pageData.content, font, fontSize, width - 80);
            textLines.forEach((line, index) => {
                const y = height - 42 * scaleY - index * fontSize * 1.45;
                if (y > 16) page.drawText(line, { x: 40 * scaleX, y, size: fontSize, font, color: paperTextColor });
            });

            if (pageData.drawing) {
                const drawing = dataUrlToBytes(pageData.drawing);
                const image = drawing.mimeType === 'image/jpeg'
                    ? await pdf.embedJpg(drawing.bytes)
                    : await pdf.embedPng(drawing.bytes);
                page.drawImage(image, { x: 0, y: 0, width, height });
            }

            for (const shape of pageData.shapes || []) {
                const minX = Math.min(shape.x1, shape.x2);
                const minY = Math.min(shape.y1, shape.y2);
                const shapeWidth = Math.max(Math.abs(shape.x2 - shape.x1), 1);
                const shapeHeight = Math.max(Math.abs(shape.y2 - shape.y1), 1);
                const borderWidth = Math.max(Number(shape.strokeWidth) || 2, 1) * scaleX;
                const color = shape.color || '#1f2937';
                const rgb = /^#?([0-9a-f]{6})$/i.exec(color);
                const strokeColor = rgb
                    ? PDFLib.rgb(parseInt(rgb[1].slice(0, 2), 16) / 255, parseInt(rgb[1].slice(2, 4), 16) / 255, parseInt(rgb[1].slice(4, 6), 16) / 255)
                    : PDFLib.rgb(0.12, 0.16, 0.22);
                if (shape.kind === 'text') {
                    const textFontSize = Math.max(Number(shape.fontSize) || 18, 8) * scaleX;
                    const lines = String(shape.text || '').split(/\r?\n/)
                        .flatMap(paragraph => wrapPdfText(paragraph, font, textFontSize, shapeWidth * scaleX));
                    const textX = minX * scaleX;
                    lines.forEach((line, index) => {
                        const y = height - (minY + (index + 1) * textFontSize * 1.25) * scaleY;
                        if (y > 0) page.drawText(line, {
                            x: textX,
                            y,
                            size: textFontSize,
                            font,
                            color: strokeColor,
                            rotate: PDFLib.degrees(-(Number(shape.rotation) || 0))
                        });
                    });
                } else if (shape.kind === 'emoji') {
                    const emoji = dataUrlToBytes(textToPngDataUrl(shape.emoji || '', Math.min(shapeWidth, shapeHeight) * scaleX));
                    const image = await pdf.embedPng(emoji.bytes);
                    page.drawImage(image, {
                        x: minX * scaleX,
                        y: height - (minY + shapeHeight) * scaleY,
                        width: shapeWidth * scaleX,
                        height: shapeHeight * scaleY,
                        rotate: PDFLib.degrees(-(Number(shape.rotation) || 0))
                    });
                } else if (shape.kind === 'image' && shape.src) {
                    let imageData = dataUrlToBytes(shape.src);
                    if (!['image/png', 'image/jpeg'].includes(imageData.mimeType)) {
                        imageData = dataUrlToBytes(await imageDataUrlAsPng(shape.src));
                    }
                    const image = imageData.mimeType === 'image/jpeg'
                        ? await pdf.embedJpg(imageData.bytes)
                        : await pdf.embedPng(imageData.bytes);
                    page.drawImage(image, {
                        x: minX * scaleX,
                        y: height - (minY + shapeHeight) * scaleY,
                        width: shapeWidth * scaleX,
                        height: shapeHeight * scaleY,
                        rotate: PDFLib.degrees(-(Number(shape.rotation) || 0))
                    });
                } else if (shape.kind === 'stroke' && Array.isArray(shape.points)) {
                    const points = shape.points;
                    const storedOpacity = Number(shape.opacity);
                    const opacity = Number.isFinite(storedOpacity) ? Math.max(0, Math.min(1, storedOpacity)) : 1;
                    const baseThickness = Math.max((Number(shape.strokeWidth) || 2) * (scaleX + scaleY) / 2, 0.5);
                    if (points.length === 1) {
                        const point = points[0];
                        page.drawCircle({
                            x: point[0] * scaleX,
                            y: height - point[1] * scaleY,
                            size: baseThickness * Math.max(Number(point[2]) || 0.5, 0.1) / 2,
                            color: strokeColor,
                            opacity
                        });
                    }
                    for (let index = 1; index < points.length; index += 1) {
                        const start = points[index - 1];
                        const end = points[index];
                        const pressure = Math.max(0.1, ((Number(start[2]) || 0.5) + (Number(end[2]) || 0.5)) / 2);
                        page.drawLine({
                            start: { x: start[0] * scaleX, y: height - start[1] * scaleY },
                            end: { x: end[0] * scaleX, y: height - end[1] * scaleY },
                            thickness: Math.max(baseThickness * pressure, 0.5),
                            color: strokeColor,
                            opacity
                        });
                    }
                } else {
                    if (shape.kind === 'line') {
                        page.drawLine({
                            start: { x: shape.x1 * scaleX, y: height - shape.y1 * scaleY },
                            end: { x: shape.x2 * scaleX, y: height - shape.y2 * scaleY },
                            thickness: borderWidth,
                            color: strokeColor
                        });
                    } else if (shape.kind === 'circle') {
                        page.drawEllipse({
                            x: (minX + shapeWidth / 2) * scaleX,
                            y: height - (minY + shapeHeight / 2) * scaleY,
                            xScale: shapeWidth * scaleX / 2,
                            yScale: shapeHeight * scaleY / 2,
                            borderColor: strokeColor,
                            borderWidth,
                            rotate: PDFLib.degrees(-(Number(shape.rotation) || 0))
                        });
                    } else {
                        page.drawRectangle({
                            x: minX * scaleX,
                            y: height - (minY + shapeHeight) * scaleY,
                            width: shapeWidth * scaleX,
                            height: shapeHeight * scaleY,
                            borderColor: strokeColor,
                            borderWidth,
                            rotate: PDFLib.degrees(-(Number(shape.rotation) || 0))
                        });
                    }
                }
            }
        }

        const bytes = await pdf.save();
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        const fileTitle = (notebook.title || 'MyNotes').replace(/[<>:"/\\|?*]+/g, '_');
        link.download = singlePage ? `${fileTitle} - Seite ${exportedPageNumber}.pdf` : `${fileTitle}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error('PDF-Export fehlgeschlagen:', error);
        alert(error instanceof Error ? error.message : 'Das Dokument konnte nicht als PDF exportiert werden.');
    }
}

function runEditorAction(action) {
    const notebook = notebooks.find(item => item.id === currentNotebookId);
    if (!notebook) return;
    if (isNotebookReadOnly && !readOnlyEditorActions.has(action)) return;
    if (action === 'add-page') addNotebookPage();
    else if (action === 'duplicate-page') addNotebookPage(true);
    else if (action === 'previous-page') showNotebookPage(currentPageIndex - 1);
    else if (action === 'next-page') showNotebookPage(currentPageIndex + 1);
    else if (action === 'export-pdf') void exportNotebookPdf();
    else if (action === 'export-page-pdf') void exportNotebookPdf([currentPageIndex]);
    else if (action === 'export-original-pdf') void exportNotebookOriginalPdf();
    else if (action === 'import-document') document.getElementById('documentImportInput')?.click();
    else if (action === 'add-textbox') addTextBox();
    else if (action === 'clear-page') clearNotebookContent(currentNotebookId);
    else if (action === 'delete-notebook') deleteNotebook(currentNotebookId);
    else if (action === 'save') saveNotebookContent(currentNotebookId);
    else if (action === 'delete-selected-shape') deleteSelectedShape();
    else if (action === 'toggle-sidebar') document.getElementById('editorPageSidebar')?.classList.toggle('is-open');
    else if (action === 'toggle-read-only') {
        if (!isNotebookReadOnly) persistNotebookPages();
        setNotebookReadOnlyMode(!isNotebookReadOnly);
        closeMenu();
    }
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
        openGlobalSearch();
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
        void changeEditorHistory('undo');
        closeMenu();
    } else if (action === 'redo') {
        void changeEditorHistory('redo');
        closeMenu();
    } else if (action === 'toggle-text') {
        const textarea = document.getElementById('notebookContent');
        setEditorTool('text');
        textarea?.focus();
    } else if (action === 'choose-image') document.getElementById('editorImageInput')?.click();
    else if (action === 'bookmark') {
        notebook.bookmarks = notebook.bookmarks || [];
        if (!notebook.bookmarks.includes(currentPageIndex)) notebook.bookmarks.push(currentPageIndex);
        saveNotebookMetadata(notebook.id);
        closeMenu();
    } else if (action === 'change-template') {
        openPageTemplateDialog();
        closeMenu();
    } else if (action === 'rotate-page') {
        const page = getNotebookPages(notebook)[currentPageIndex];
        page.orientation = (page.orientation || notebook.orientation) === 'landscape' ? 'portrait' : 'landscape';
        setNotebookBackground(page);
        persistNotebookPages();
        updatePageCounter();
        closeMenu();
    } else if (action === 'share') {
        alert('Teilen ist in MyNotes noch nicht verfügbar.');
    } else if (action === 'record') {
        if (audioRecorder && audioRecorder.state !== 'inactive') stopAudioRecording();
        else void startAudioRecording();
    } else if (action === 'pause-recording') {
        void toggleAudioRecordingPause();
    }
}

