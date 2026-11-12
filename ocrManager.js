// Optional German/English OCR for scanned PDF pages
async function runPdfPageOcr({ docId, pageNumber, canvas, language, onProgress }) {
    if (!window.Tesseract?.createWorker) throw new Error('Das OCR-Modul ist nicht verfügbar.');
    if (!canvas) throw new Error('Die PDF-Seite muss vollständig gerendert sein, bevor OCR gestartet werden kann.');
    const worker = await Tesseract.createWorker(language, 1, {
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
        cacheMethod: 'write'
    });
    onProgress?.('OCR läuft …');
    try {
        const highResolutionCanvas = document.createElement('canvas');
        highResolutionCanvas.width = Math.ceil(canvas.width * 1.5);
        highResolutionCanvas.height = Math.ceil(canvas.height * 1.5);
        const context = highResolutionCanvas.getContext('2d');
        if (!context) throw new Error('Die Seite konnte nicht für OCR vorbereitet werden.');
        context.drawImage(canvas, 0, 0, highResolutionCanvas.width, highResolutionCanvas.height);
        const { data } = await worker.recognize(highResolutionCanvas);
        const text = String(data.text || '').trim();
        const notebookId = String(docId);
        const pageIndex = pageNumber - 1;
        const storedPage = await notebookDb.pages.get([notebookId, pageIndex]);
        if (!storedPage) throw new Error('Die lokale PDF-Seite wurde nicht gefunden.');
        const existingText = String(storedPage.searchText || '').trim();
        storedPage.searchText = text && !existingText.includes(text)
            ? [existingText, text].filter(Boolean).join('\n').trim()
            : existingText;
        await notebookDb.pages.put(storedPage);
        const notebook = notebooks.find(item => String(item.id) === notebookId);
        if (notebook) {
            const pages = getNotebookPages(notebook);
            pages[pageIndex] = { ...pages[pageIndex], searchText: storedPage.searchText };
            saveNotebookMetadata(notebook.id);
        }
        return text;
    } finally {
        await worker.terminate();
    }
}
