(() => {
    const MODEL_IDLE_TIMEOUT = 60_000;
    const TEXT_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
    const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
    let worker = null;
    let workerSequence = 0;
    let pendingRequest = null;
    let idleTimer = 0;
    let lastResult = '';
    let lastResultKind = '';
    let pendingFlashcards = [];
    let mediaRecorder = null;
    let recordingStream = null;
    let recordingTimeout = 0;
    let reviewCards = [];
    let reviewIndex = 0;
    let pendingImageMode = 'ocr';
    let answerSources = [];
    const pdfTextCache = new Map();

    function getPanel() {
        let panel = document.getElementById('goodnotesAISidebar');
        if (!panel) {
            panel = document.createElement('aside');
            panel.id = 'goodnotesAISidebar';
            document.body.append(panel);
        }
        panel.setAttribute('aria-label', 'Lokale KI');
        panel.setAttribute('aria-hidden', 'true');
        panel.style.cssText = [
            'position:fixed',
            'top:50px',
            'right:0',
            'bottom:0',
            `z-index:${document.body.dataset.page === 'pdf-workspace' ? 2201 : 90}`,
            'display:none',
            'flex-direction:column',
            'width:min(390px,100vw)',
            'background:#fff',
            'border-left:1px solid #e5e7eb',
            'box-shadow:0 12px 32px rgba(15,23,42,.18)',
            'color:#1f2937',
            'font:14px/1.45 Inter,Arial,sans-serif',
            'overflow:hidden'
        ].join(';');
        panel.innerHTML = `
            <header style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e5e7eb;background:#f8faff">
                <div>
                    <strong style="display:block;color:#1e55a0">MyNotes KI</strong>
                    <span style="font-size:12px;color:#64748b">Verarbeitung auf diesem Gerät</span>
                </div>
                <button type="button" data-ai-close aria-label="KI schließen" style="border:0;background:transparent;color:#64748b;font-size:22px;cursor:pointer">×</button>
            </header>
            <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb">
                <div id="ai-model-status" role="status" aria-live="polite" style="font-size:12px;color:#475569">Modelle werden erst bei Bedarf geladen. Der erste Modellabruf benötigt Internet.</div>
                <progress id="ai-model-progress" max="100" value="0" style="display:none;width:100%;height:8px;margin-top:8px"></progress>
                <button type="button" data-ai-action="download-models" style="width:100%;margin-top:8px">Alle KI-Modelle herunterladen</button>
                <div style="margin-top:4px;font-size:11px;color:#64748b">Einmaliger Download für Text, Suche, Handschrift und Sprache; danach lokal im Browser verfügbar.</div>
            </div>
            <div style="padding:12px;overflow-y:auto;flex:1">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
                    <button type="button" data-ai-action="summarize">Zusammenfassen</button>
                    <button type="button" data-ai-action="tasks">Aufgaben erkennen</button>
                    <button type="button" data-ai-action="improve">Text verbessern</button>
                    <button type="button" data-ai-action="tags">Tags vorschlagen</button>
                    <button type="button" data-ai-action="flashcards">Lernkarten erstellen</button>
                    <button type="button" data-ai-action="index">Notizen lokal indexieren</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px">
                    <button type="button" data-ai-action="ocr">Foto / Druckschrift lesen</button>
                    <button type="button" data-ai-action="handwriting">Handschrift lesen (KI)</button>
                    <input id="ai-image-input" type="file" accept="image/*" capture="environment" hidden>
                    <button type="button" data-ai-action="record" style="grid-column:1 / -1">Diktat starten</button>
                </div>
                <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb">
                    <label for="ai-question" style="display:block;margin-bottom:6px;font-size:12px;font-weight:600">Frage über alle Notizen</label>
                    <div style="display:flex;gap:6px">
                        <input id="ai-question" type="search" placeholder="Was habe ich zu … notiert?" style="min-width:0;flex:1;padding:9px;border:1px solid #cbd5e1;border-radius:9px">
                        <button type="button" data-ai-action="ask">Fragen</button>
                    </div>
                </div>
                <section id="ai-checklist-section" hidden style="margin-top:16px">
                    <h3 style="margin:0 0 8px;font-size:13px">Checkliste</h3>
                    <div id="ai-checklist" style="display:grid;gap:7px"></div>
                    <button type="button" data-ai-action="insert-tasks" style="margin-top:9px">Checkliste in Notiz einfügen</button>
                </section>
                <section id="ai-card-preview" hidden style="margin-top:16px;padding:12px;border:1px solid #dbeafe;border-radius:12px;background:#f8fbff">
                    <h3 style="margin:0 0 8px;font-size:13px">Lernkarten-Vorschau</h3>
                    <div id="ai-card-count" style="font-size:12px;color:#475569"></div>
                    <button type="button" data-ai-action="save-cards" style="margin-top:9px">Lernkarten lokal speichern</button>
                </section>
                <section id="ai-card-review" hidden style="margin-top:12px">
                    <div id="ai-review-counter" style="margin-bottom:7px;font-size:12px;color:#64748b"></div>
                    <button id="ai-review-flip" type="button" data-ai-action="flip-card" aria-label="Lernkarte umdrehen" style="width:100%;padding:0;border:0;background:transparent;text-align:left">
                        <div id="ai-review-card" class="ai-review-card">
                            <div class="ai-review-inner">
                                <div id="ai-review-front" class="ai-review-face">Frage</div>
                                <div id="ai-review-back" class="ai-review-face ai-review-back">Antwort</div>
                            </div>
                        </div>
                    </button>
                    <div style="display:flex;justify-content:space-between;gap:7px;margin-top:8px">
                        <button type="button" data-ai-action="previous-card">Zurück</button>
                        <button type="button" data-ai-action="next-card">Weiter</button>
                    </div>
                    <div style="display:flex;gap:7px;margin-top:8px">
                        <button type="button" data-ai-action="rate-again" style="flex:1">Nochmal üben</button>
                        <button type="button" data-ai-action="rate-good" style="flex:1">Gewusst</button>
                    </div>
                </section>
                <section style="margin-top:14px">
                    <div id="ai-output" aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere;min-height:44px;padding:11px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;color:#334155">Wähle eine Funktion aus.</div>
                    <section id="ai-answer-sources" hidden aria-label="Quellen" style="gap:6px;margin-top:8px">
                        <strong style="font-size:12px;color:#475569">Quellen</strong>
                        <div id="ai-answer-source-list" style="display:grid;gap:6px"></div>
                    </section>
                    <button type="button" data-ai-action="apply-result" hidden style="margin-top:8px">Ergebnis in Notiz übernehmen</button>
                </section>
            </div>
        `;
        const flipStyles = document.createElement('style');
        flipStyles.textContent = `
            #goodnotesAISidebar .ai-review-card { perspective: 900px; min-height: 158px; }
            #goodnotesAISidebar .ai-review-inner { position: relative; height: 158px; transform-style: preserve-3d; transition: transform 420ms ease; }
            #goodnotesAISidebar .ai-review-card.is-flipped .ai-review-inner { transform: rotateY(180deg); }
            #goodnotesAISidebar .ai-review-face { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 18px; border: 1px solid #dbe4f0; border-radius: 12px; background: #fff; backface-visibility: hidden; overflow-y: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
            #goodnotesAISidebar .ai-review-back { transform: rotateY(180deg); background: #f0f7ff; }
            @media (prefers-reduced-motion: reduce) { #goodnotesAISidebar .ai-review-inner { transition: none; } }
        `;
        panel.append(flipStyles);
        if (document.body.dataset.page === 'pdf-workspace') {
            panel.querySelectorAll(
                '[data-ai-action="tasks"], [data-ai-action="improve"], [data-ai-action="tags"], [data-ai-action="index"], ' +
                '[data-ai-action="ocr"], [data-ai-action="handwriting"], [data-ai-action="record"], [data-ai-action="insert-tasks"]'
            ).forEach(button => { button.hidden = true; });
            panel.querySelector('[data-ai-action="summarize"]').textContent = 'PDF vollständig zusammenfassen';
            panel.querySelector('label[for="ai-question"]').textContent = 'Fragen zu diesem PDF';
            panel.querySelector('#ai-question').placeholder = 'Frage zum geöffneten PDF …';
        }
        panel.querySelectorAll('button').forEach(button => {
            if (button.hasAttribute('data-ai-close')) return;
            button.style.cssText = 'min-height:36px;padding:7px 9px;border:1px solid #dbe4f0;border-radius:9px;background:#fff;color:#1e3a5f;font-size:12px;font-weight:600;cursor:pointer';
        });
        return panel;
    }

    function currentDocument() {
        if (document.body.dataset.page === 'notebook') {
            const notebook = notebooks.find(item => String(item.id) === String(currentNotebookId));
            const pageIndex = Number.isInteger(currentPageIndex) ? currentPageIndex : 0;
            const page = notebook && getNotebookPages(notebook)[pageIndex];
            const shapes = page?.shapes || [];
            const shapeText = shapes
                .filter(shape => ['text', 'sticky', 'mindmap'].includes(shape.kind) && (shape.text || shape.title))
                .map(shape => [shape.title, shape.text].filter(Boolean).join(': '))
                .join('\n');
            const textarea = document.getElementById('notebookContent');
            const pageText = textarea ? textarea.value : page?.content || '';
            return {
                type: 'notebook',
                id: String(currentNotebookId),
                pageIndex,
                title: notebook?.title || 'Notizbuch',
                text: [pageText, page?.searchText, shapeText]
                    .map(value => String(value || '').trim())
                    .filter((value, index, values) => value && values.indexOf(value) === index)
                    .join('\n\n')
            };
        }
        if (document.body.dataset.page === 'pdf-workspace') {
            const state = getPdfWorkspaceCurrentDocument();
            return state ? {
                type: 'pdf-workspace',
                id: String(state.docId),
                pageIndex: state.pageNumber - 1,
                title: state.title || 'PDF-Dokument',
                text: getPdfWorkspaceAiText(state)
            } : null;
        }
        if (document.body.dataset.page === 'whiteboard') {
            const board = whiteboardState;
            const objectText = (board?.objects || [])
                .filter(object => object.text || object.title)
                .map(object => [object.title, object.text].filter(Boolean).join(': '))
                .join('\n');
            return {
                type: 'whiteboard',
                id: String(board?.id || ''),
                pageIndex: 0,
                title: board?.title || 'Whiteboard',
                text: objectText.trim()
            };
        }
        return null;
    }

    function setStatus(message, progress = null) {
        const status = document.getElementById('ai-model-status');
        const meter = document.getElementById('ai-model-progress');
        if (status) status.textContent = message;
        if (meter) {
            meter.hidden = progress === null;
            meter.style.display = progress === null ? 'none' : 'block';
            if (progress !== null) meter.value = Math.max(0, Math.min(100, progress));
        }
    }

    function renderAnswerSources(sources) {
        const section = document.getElementById('ai-answer-sources');
        const list = document.getElementById('ai-answer-source-list');
        if (!section || !list) return;
        answerSources = sources;
        list.replaceChildren();
        sources.forEach((source, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.aiSource = String(index);
            button.style.cssText = 'display:grid;gap:3px;padding:8px 10px;border:1px solid #dbe4f0;border-radius:9px;background:#fff;color:#1e3a5f;text-align:left;cursor:pointer';
            const title = document.createElement('strong');
            title.textContent = `[${index + 1}] ${source.title}`;
            const excerpt = document.createElement('span');
            excerpt.style.cssText = 'font-size:11px;color:#64748b;line-height:1.4';
            excerpt.textContent = source.text.slice(0, 220);
            button.append(title, excerpt);
            list.appendChild(button);
        });
        section.hidden = sources.length === 0;
        section.style.display = sources.length ? 'grid' : 'none';
    }

    function setOutput(text, kind = '') {
        const output = document.getElementById('ai-output');
        const sourceSection = document.getElementById('ai-answer-sources');
        const sourceList = document.getElementById('ai-answer-source-list');
        const apply = document.querySelector('[data-ai-action="apply-result"]');
        if (output) output.textContent = text || '';
        if (sourceList) sourceList.replaceChildren();
        if (sourceSection) {
            sourceSection.hidden = true;
            sourceSection.style.display = 'none';
        }
        answerSources = [];
        lastResult = text || '';
        lastResultKind = kind;
        if (apply) {
            apply.hidden = document.body.dataset.page === 'pdf-workspace' ||
                !lastResult || ['tasks', 'flashcards', 'answer', 'index', 'ocr', 'speech'].includes(kind);
            apply.textContent = kind === 'improve'
                ? 'Verbesserten Text ersetzen'
                : 'Ergebnis in Notiz übernehmen';
        }
    }

    function rejectPending(error) {
        if (!pendingRequest) return;
        window.clearTimeout(pendingRequest.timeout);
        pendingRequest.reject(error);
        pendingRequest = null;
    }

    function startRequestTimeout(request, activeWorker) {
        request.timeout = window.setTimeout(() => {
            if (pendingRequest !== request) return;
            pendingRequest = null;
            activeWorker.terminate();
            if (worker === activeWorker) worker = null;
            request.reject(new Error('Die lokale KI antwortet nicht rechtzeitig. Bitte versuche es erneut oder wähle weniger Text aus.'));
        }, request.action === 'preload' ? 30 * 60 * 1000 : 5 * 60 * 1000);
    }

    function getWorker() {
        if (worker) return worker;
        const scriptUrl = document.currentScript?.src || window.location.href;
        worker = new Worker(new URL('./aiWorker.js', scriptUrl), { type: 'module' });
        worker.addEventListener('message', event => {
            const message = event.data || {};
            if (!pendingRequest || message.id !== pendingRequest.id) return;
            if (message.type === 'progress') {
                const suffix = message.total > 0
                    ? ` (${Math.round(message.loaded / message.total * 100)} %)`
                    : '';
                const modelName = {
                    text: 'Textmodell',
                    embeddings: 'Suchmodell',
                    image: 'Handschriftmodell',
                    speech: 'Sprachmodell'
                }[message.modelKey] || 'lokales Modell';
                setStatus(`Lade ${modelName}${message.file ? `: ${message.file}` : ''}${suffix}`, message.progress);
            } else if (message.type === 'backend') {
                setStatus(`${message.message} ${message.backend === 'webgpu' ? 'Lokale GPU-Inferenz.' : 'Lokale WASM-Inferenz.'}`);
            } else if (message.type === 'token') {
                pendingRequest.onToken?.(message.text);
            } else if (message.type === 'done') {
                const current = pendingRequest;
                pendingRequest = null;
                window.clearTimeout(current.timeout);
                setStatus('Lokales Modell bereit.', null);
                current.resolve(message.result);
                scheduleWorkerShutdown();
            } else if (message.type === 'error') {
                const current = pendingRequest;
                pendingRequest = null;
                window.clearTimeout(current.timeout);
                current.reject(new Error(message.message || 'Die lokale KI ist fehlgeschlagen.'));
                scheduleWorkerShutdown();
            }
        });
        worker.addEventListener('error', event => {
            const error = new Error(event.message || 'Der lokale KI-Worker konnte nicht gestartet werden.');
            rejectPending(error);
            worker?.terminate();
            worker = null;
            setStatus(error.message, null);
        });
        return worker;
    }

    function scheduleWorkerShutdown() {
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
            if (pendingRequest || !worker) return;
            worker.terminate();
            worker = null;
        }, MODEL_IDLE_TIMEOUT);
    }

    function runModel(action, payload, onToken) {
        if (pendingRequest) return Promise.reject(new Error('Bitte warte, bis die aktuelle KI-Aufgabe beendet ist.'));
        const activeWorker = getWorker();
        window.clearTimeout(idleTimer);
        setStatus('Prüfe WebGPU und lade das benötigte Modell bei Bedarf …', 0);
        const id = ++workerSequence;
        return new Promise((resolve, reject) => {
            const request = { id, action, resolve, reject, onToken };
            pendingRequest = request;
            startRequestTimeout(request, activeWorker);
            const transfer = payload.audio instanceof Float32Array ? [payload.audio.buffer] : [];
            activeWorker.postMessage({ id, action, payload }, transfer);
        });
    }

    async function getSourceText() {
        const documentInfo = currentDocument();
        if (documentInfo?.type === 'pdf-workspace') {
            const sources = await getAllSources();
            const text = sources.map(source => source.text).join('\n\n').trim();
            if (!text) {
                throw new Error('Das geöffnete PDF enthält keinen auslesbaren Text. Bei einem Scan muss zuerst OCR ausgeführt werden.');
            }
            return text;
        }
        if (!documentInfo?.text) {
            throw new Error('Die aktive Seite enthält keinen auslesbaren Text. Handschrift kann per Foto/OCR ergänzt werden.');
        }
        return documentInfo.text;
    }

    function extractJson(text) {
        const unfenced = String(text).replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const start = unfenced.indexOf('[');
        const end = unfenced.lastIndexOf(']');
        if (start < 0 || end < start) throw new Error('Die KI lieferte kein gültiges JSON. Bitte erneut versuchen.');
        return JSON.parse(unfenced.slice(start, end + 1));
    }

    function makePrompt(instruction, text) {
        return `Du bist ein sorgfältiger deutschsprachiger Notiz-Assistent. Verwende nur Informationen aus dem Material. Erfinde keine Fakten.\n\nAufgabe: ${instruction}\n\nMaterial:\n${text}\n\nAntwort:`;
    }

    function createLocalFlashcards(text) {
        const normalized = String(text)
            .replace(/\u00a0/g, ' ')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const questions = {
            definition: 'Wie wird das Thema definiert?',
            formen: 'Welche Formen werden unterschieden?',
            beschwerden: 'Welche Beschwerden werden genannt?',
            symptome: 'Welche Symptome werden genannt?',
            'auslösende ursachen': 'Welche Auslöser werden genannt?',
            ursachen: 'Welche Ursachen werden genannt?',
            risikofaktoren: 'Welche Risikofaktoren werden genannt?',
            lebensstil: 'Welche Lebensstil-Faktoren werden genannt?',
            vorbeugung: 'Was kann zur Vorbeugung getan werden?',
            prävention: 'Was kann zur Vorbeugung getan werden?',
            diagnose: 'Wie wird die Erkrankung diagnostiziert?',
            diagnostik: 'Wie wird die Erkrankung diagnostiziert?',
            behandlung: 'Welche Behandlung wird beschrieben?',
            therapie: 'Welche Therapie wird beschrieben?',
            komplikationen: 'Welche Komplikationen werden genannt?'
        };
        const headings = [...normalized.matchAll(/(^|[\s•])(Definition|Formen|Beschwerden|Symptome|Auslösende Ursachen|Ursachen|Risikofaktoren|Lebensstil|Vorbeugung|Prävention|Diagnose|Diagnostik|Behandlung|Therapie|Komplikationen)\s*:/gi)];
        const cards = [];

        for (let index = 0; index < headings.length && cards.length < 12; index += 1) {
            const heading = headings[index][2].trim();
            const start = headings[index].index + headings[index][0].length;
            const end = index + 1 < headings.length ? headings[index + 1].index : normalized.length;
            const answer = normalized.slice(start, end)
                .replace(/^[\s:;•-]+/, '')
                .replace(/•/g, ';')
                .replace(/\s*;\s*/g, '; ')
                .replace(/[;\s]+$/, '')
                .trim();
            if (answer.length < 15) continue;

            const key = heading.toLocaleLowerCase('de-DE');
            cards.push({
                front: questions[key] || `Was steht im PDF über „${heading}“?`,
                back: answer.length > 700 ? `${answer.slice(0, 697).trimEnd()}…` : answer
            });
        }

        if (!cards.length) {
            const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [];
            for (const rawSentence of sentences) {
                const sentence = rawSentence.trim();
                if (sentence.length < 30) continue;

                const cloze = sentence.match(/^(.{3,100}?)\s+(ist|sind|wird|werden|bedeutet|bezeichnet|besteht aus|bestehen aus|führt zu|führen zu|verursacht|verursachen|umfasst|umfassen)\s+(.{3,400})$/i);
                if (cloze) {
                    cards.push({
                        front: `Ergänze den Satz: ${cloze[1]} ${cloze[2]} _____.`,
                        back: cloze[3]
                    });
                } else {
                    const topic = sentence.split(/\s+/).slice(0, 5).join(' ');
                    cards.push({
                        front: `Was sagt der Abschnitt über „${topic}“?`,
                        back: sentence
                    });
                }
                if (cards.length >= 6) break;
            }
        }

        return cards.filter((card, index, all) =>
            all.findIndex(candidate =>
                candidate.front.toLocaleLowerCase('de-DE') === card.front.toLocaleLowerCase('de-DE')
            ) === index
        ).slice(0, 12);
    }

    async function generate(prompt, maxNewTokens = 300) {
        const output = document.getElementById('ai-output');
        output.textContent = '';
        let streamed = '';
        const result = await runModel('generate', { prompt, maxNewTokens }, token => {
            streamed += token;
            output.textContent = streamed;
        });
        const text = result.text || streamed;
        output.textContent = text;
        setStatus(`Textmodell bereit (${TEXT_MODEL}).`, null);
        return text;
    }

    async function downloadModels(button) {
        button.disabled = true;
        try {
            let persistent = false;
            if (navigator.storage?.persist) {
                try {
                    persistent = await navigator.storage.persist();
                } catch (error) {
                    console.warn('Dauerhafte Speicherung der KI-Modelle konnte nicht angefragt werden.', error);
                }
            }
            await runModel('preload', {});
            setStatus(persistent
                ? 'Alle KI-Modelle sind heruntergeladen und der Browser hat dauerhafte Speicherung zugesagt.'
                : 'Alle KI-Modelle sind heruntergeladen. Der Browser kann gespeicherte Daten gegebenenfalls löschen.', null);
        } finally {
            button.disabled = false;
        }
    }

    function splitText(text, maxLength = 5000) {
        const paragraphs = text.split(/\n{2,}/);
        const chunks = [];
        let current = '';
        for (const paragraph of paragraphs) {
            if (paragraph.length > maxLength) {
                if (current) chunks.push(current);
                current = '';
                for (let offset = 0; offset < paragraph.length; offset += maxLength) {
                    chunks.push(paragraph.slice(offset, offset + maxLength));
                }
            } else if (current && current.length + paragraph.length + 2 > maxLength) {
                chunks.push(current);
                current = paragraph;
            } else {
                current = current ? `${current}\n\n${paragraph}` : paragraph;
            }
        }
        if (current) chunks.push(current);
        return chunks;
    }

    async function summarize(text) {
        const chunks = splitText(text, 1200);
        const summaries = [];
        for (let index = 0; index < chunks.length; index += 1) {
            setStatus(`Fasse Abschnitt ${index + 1} von ${chunks.length} zusammen …`);
            summaries.push(await generate(makePrompt('Fasse den Abschnitt in 3 bis 6 knappen deutschen Stichpunkten zusammen.', chunks[index]), 100));
        }
        while (summaries.length > 1) {
            const reduced = [];
            for (let index = 0; index < summaries.length; index += 3) {
                const group = summaries.slice(index, index + 3);
                reduced.push(await generate(makePrompt(
                    'Fasse diese Abschnittszusammenfassungen zu einer prägnanten deutschen Gesamtzusammenfassung mit Stichpunkten zusammen.',
                    group.join('\n')
                ), 130));
            }
            summaries.splice(0, summaries.length, ...reduced);
        }
        return summaries[0];
    }

    function sourceKey(documentInfo) {
        return `${documentInfo.type}:${documentInfo.id}:${documentInfo.pageIndex}`;
    }

    async function storeTasks(items) {
        const documentInfo = currentDocument();
        if (!documentInfo || !notebookDb?.aiTasks) throw new Error('Die lokale Aufgabenliste ist nicht verfügbar.');
        const key = sourceKey(documentInfo);
        const old = await notebookDb.aiTasks.where('sourceKey').equals(key).toArray();
        await notebookDb.aiTasks.bulkDelete(old.map(item => item.id));
        const now = new Date().toISOString();
        const records = items.map(item => ({
            id: globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            sourceKey: key,
            sourceType: documentInfo.type,
            sourceId: documentInfo.id,
            pageIndex: documentInfo.pageIndex,
            text: String(item).trim(),
            done: false,
            createdAt: now,
            updatedAt: now
        })).filter(item => item.text);
        if (records.length) await notebookDb.aiTasks.bulkAdd(records);
        await renderStoredTasks();
    }

    async function renderStoredTasks() {
        const section = document.getElementById('ai-checklist-section');
        const list = document.getElementById('ai-checklist');
        const documentInfo = currentDocument();
        if (!section || !list || !documentInfo || !notebookDb?.aiTasks) return;
        await notebookStorageReady;
        const records = await notebookDb.aiTasks.where('sourceKey').equals(sourceKey(documentInfo)).sortBy('createdAt');
        section.hidden = !records.length;
        list.replaceChildren();
        records.forEach(record => {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#334155';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = Boolean(record.done);
            checkbox.dataset.aiTaskId = record.id;
            const text = document.createElement('span');
            text.textContent = record.text;
            text.style.textDecoration = record.done ? 'line-through' : '';
            label.append(checkbox, text);
            list.append(label);
        });
    }

    async function insertText(text, replace = false) {
        const documentInfo = currentDocument();
        if (!documentInfo) throw new Error('Der aktive Editor wurde nicht gefunden.');
        if (documentInfo.type === 'notebook') {
            const textarea = document.getElementById('notebookContent');
            if (!textarea) throw new Error('Das Notizfeld ist nicht verfügbar.');
            textarea.value = replace ? text : [textarea.value.trim(), text].filter(Boolean).join('\n\n');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof persistNotebookPages === 'function') persistNotebookPages();
            return;
        }
        if (documentInfo.type === 'pdf-workspace') {
            throw new Error('PDF-Dateien bleiben unverändert. KI-Ergebnisse werden im Panel angezeigt.');
        }
        const board = whiteboardState;
        if (!board) throw new Error('Das Whiteboard ist noch nicht geladen.');
        const viewport = document.getElementById('whiteboardViewport').getBoundingClientRect();
        const scale = board.viewport.scale || 1;
        const x = (viewport.width / 2 - board.viewport.x) / scale;
        const y = (viewport.height / 2 - board.viewport.y) / scale;
        board.objects.push({
            id: globalThis.crypto?.randomUUID?.() || `ai-${Date.now()}`,
            kind: 'sticky',
            x: x - 140,
            y: y - 100,
            width: 280,
            height: 200,
            title: 'KI-Ergebnis',
            text,
            fontSize: 15,
            color: '#fef3c7',
            opacity: 1
        });
        scheduleWhiteboardSave();
        requestWhiteboardRender();
    }

    async function getPdfSources(original, documentIndex, documentCount) {
        if (!window.pdfjsLib) {
            throw new Error('PDF.js ist nicht verfügbar; PDF-Texte können nicht indiziert werden.');
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const docId = String(original.notebookId);
        const notebook = notebooks.find(item => String(item.id) === docId);
        const title = notebook?.title || original.fileName || 'PDF-Dokument';
        const cacheKey = `${docId}:${original.importedAt || ''}:${original.blob.size}`;
        let extractedPages = pdfTextCache.get(cacheKey);
        if (!extractedPages) {
            extractedPages = [];
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(await original.blob.arrayBuffer())
            });
            const pdf = await loadingTask.promise;
            try {
                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                    setStatus(`Lese PDF ${documentIndex} von ${documentCount} · Seite ${pageNumber} von ${pdf.numPages} …`);
                    const pdfPage = await pdf.getPage(pageNumber);
                    try {
                        const textContent = await pdfPage.getTextContent();
                        const text = textContent.items
                            .filter(item => typeof item.str === 'string')
                            .map(item => item.str.trim())
                            .filter(Boolean)
                            .join(' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        if (text) {
                            extractedPages.push({
                                type: 'pdf-workspace',
                                id: `${docId}:${pageNumber - 1}`,
                                title: `${title} · Seite ${pageNumber}`,
                                text
                            });
                        }
                    } finally {
                        pdfPage.cleanup();
                    }
                }
            } finally {
                await pdf.destroy();
            }
            pdfTextCache.set(cacheKey, extractedPages);
        }
        return extractedPages;
    }

    async function getAllSources() {
        if (!await notebookStorageReady) throw new Error('Der lokale Notizspeicher ist nicht verfügbar.');
        const isPdfWorkspace = document.body.dataset.page === 'pdf-workspace';
        if (isPdfWorkspace) {
            const state = getPdfWorkspaceCurrentDocument();
            if (!state) return [];
            const original = await notebookDb.pdfOriginals.get(String(state.docId));
            if (!original?.blob) throw new Error('Das geöffnete Original-PDF wurde nicht gefunden.');
            return getPdfSources(original, 1, 1);
        }

        const documentInfo = currentDocument();
        const activeNotebooks = notebooks.filter(notebook =>
            !notebookTombstones[String(notebook.id)] &&
            !notebookPurgeTombstones[String(notebook.id)]
        );
        const activeNotebookIds = new Set(activeNotebooks.map(notebook => String(notebook.id)));
        const activeNotebook = documentInfo?.type === 'notebook'
            ? activeNotebooks.find(notebook => String(notebook.id) === String(currentNotebookId))
            : null;
        const activeNotebookPage = activeNotebook
            ? getNotebookPages(activeNotebook)[documentInfo.pageIndex]
            : null;
        const activeWhiteboard = documentInfo?.type === 'whiteboard' ? whiteboardState : null;
        const pages = await notebookDb.pages.toArray();
        const metadata = new Map(activeNotebooks.map(note => [String(note.id), note.title || 'Notizbuch']));
        const sources = [];
        for (const page of pages.filter(item => activeNotebookIds.has(String(item.notebookId)))) {
            const isActivePage = activeNotebookPage &&
                String(page.notebookId) === String(currentNotebookId) &&
                page.pageIndex === documentInfo.pageIndex;
            const sourcePage = isActivePage
                ? {
                    ...page,
                    content: document.getElementById('notebookContent')?.value ?? page.content,
                    shapes: activeNotebookPage.shapes || []
                }
                : page;
            const shapeText = (sourcePage.shapes || [])
                .filter(shape => ['text', 'sticky', 'mindmap'].includes(shape.kind) && (shape.text || shape.title))
                .map(shape => [shape.title, shape.text].filter(Boolean).join(': '))
                .join('\n');
            const text = [sourcePage.content, sourcePage.searchText, shapeText].filter(Boolean).join('\n\n').trim();
            if (text) sources.push({
                type: 'notebook',
                id: `${sourcePage.notebookId}:${sourcePage.pageIndex}`,
                title: `${metadata.get(String(sourcePage.notebookId)) || 'Notizbuch'} · Seite ${sourcePage.pageIndex + 1}`,
                text
            });
        }
        const boards = (await notebookDb.whiteboards.toArray()).filter(board => !board.deletedAt);
        if (activeWhiteboard && !activeWhiteboard.deletedAt) {
            const activeBoardIndex = boards.findIndex(board => String(board.id) === String(activeWhiteboard.id));
            if (activeBoardIndex >= 0) boards[activeBoardIndex] = activeWhiteboard;
            else boards.push(activeWhiteboard);
        }
        boards.forEach(board => {
            const text = (board.objects || [])
                .filter(object => object.text || object.title)
                .map(object => [object.title, object.text].filter(Boolean).join(': '))
                .join('\n')
                .trim();
            if (text) sources.push({ type: 'whiteboard', id: String(board.id), title: board.title || 'Whiteboard', text });
        });
        const pdfOriginals = (await notebookDb.pdfOriginals.toArray()).filter(original => {
            const notebook = notebooks.find(item => String(item.id) === String(original.notebookId));
            return !notebook ||
                (!notebookTombstones[String(notebook.id)] &&
                    !notebookPurgeTombstones[String(notebook.id)]);
        });
        for (const [index, original] of pdfOriginals.entries()) {
            if (original?.blob) sources.push(...await getPdfSources(original, index + 1, pdfOriginals.length));
        }
        return sources;
    }

    function hashText(text) {
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16);
    }

    function splitSource(source) {
        const chunks = splitText(source.text, 1200);
        return chunks.map((text, index) => ({
            id: `${source.type}:${source.id}:${index}`,
            sourceType: source.type,
            sourceId: source.id,
            title: source.title,
            text,
            hash: hashText(text)
        }));
    }

    async function indexAllSources() {
        if (!notebookDb?.aiEmbeddings) throw new Error('Der lokale KI-Suchindex ist nicht verfügbar.');
        const sources = await getAllSources();
        const pdfWorkspaceState = document.body.dataset.page === 'pdf-workspace'
            ? getPdfWorkspaceCurrentDocument()
            : null;
        const pdfScopePrefix = pdfWorkspaceState ? `${String(pdfWorkspaceState.docId)}:` : null;
        const chunks = sources.flatMap(splitSource);
        const existing = new Map((await notebookDb.aiEmbeddings.toArray()).map(item => [item.id, item]));
        const validIds = new Set(chunks.map(chunk => chunk.id));
        let completed = 0;
        for (const chunk of chunks) {
            const cached = existing.get(chunk.id);
            if (cached?.hash === chunk.hash && cached.modelId === EMBEDDING_MODEL) {
                completed += 1;
                continue;
            }
            setStatus(pdfWorkspaceState
                ? `Indexiere PDF lokal (${completed + 1} von ${chunks.length}) …`
                : `Indexiere Notizen lokal (${completed + 1} von ${chunks.length}) …`);
            const { vector } = await runModel('embed', { text: chunk.text });
            await notebookDb.aiEmbeddings.put({
                ...chunk,
                modelId: EMBEDDING_MODEL,
                vector,
                updatedAt: new Date().toISOString()
            });
            completed += 1;
        }
        const stale = [...existing.entries()]
            .filter(([id, item]) => {
                if (document.body.dataset.page === 'pdf-workspace') {
                    return pdfScopePrefix !== null &&
                        item.sourceType === 'pdf-workspace' &&
                        item.sourceId.startsWith(pdfScopePrefix) &&
                        !validIds.has(id);
                }
                return !validIds.has(id);
            })
            .map(([id]) => id);
        if (stale.length) await notebookDb.aiEmbeddings.bulkDelete(stale);
        setStatus(chunks.length
            ? `${pdfWorkspaceState ? 'PDF-Suchindex' : 'Lokaler Suchindex'} bereit: ${chunks.length} Textabschnitte.`
            : `${pdfWorkspaceState ? 'Kein auslesbarer PDF-Text' : 'Keine Notiztexte'} für den lokalen Suchindex gefunden.`, null);
        return chunks.length;
    }

    function cosineSimilarity(first, second) {
        let dot = 0;
        let firstNorm = 0;
        let secondNorm = 0;
        const length = Math.min(first.length, second.length);
        for (let index = 0; index < length; index += 1) {
            dot += first[index] * second[index];
            firstNorm += first[index] ** 2;
            secondNorm += second[index] ** 2;
        }
        return dot / (Math.sqrt(firstNorm) * Math.sqrt(secondNorm) || 1);
    }

    async function answerAcrossNotes(question) {
        const pdfOnly = document.body.dataset.page === 'pdf-workspace';
        const indexedCount = await indexAllSources();
        if (!indexedCount) {
            throw new Error(pdfOnly
                ? 'Im geöffneten PDF wurde kein auslesbarer Text gefunden. Bei einem Scan zuerst OCR ausführen.'
                : 'Es wurden keine gespeicherten Notiztexte für die semantische Suche gefunden.');
        }
        const pdfState = pdfOnly ? getPdfWorkspaceCurrentDocument() : null;
        const pdfScopePrefix = pdfState ? `${String(pdfState.docId)}:` : null;
        setStatus(pdfOnly
            ? 'Suche semantisch im geöffneten PDF …'
            : 'Suche semantisch in deinen lokalen Notizen …');
        const { vector } = await runModel('embed', { text: question });
        const candidates = (await notebookDb.aiEmbeddings.toArray())
            .filter(item => item.modelId === EMBEDDING_MODEL)
            .filter(item => !pdfOnly ||
                (pdfScopePrefix && item.sourceType === 'pdf-workspace' && item.sourceId.startsWith(pdfScopePrefix)))
            .map(item => ({ ...item, score: cosineSimilarity(vector, item.vector) }))
            .sort((first, second) => second.score - first.score)
            .filter((item, index, matches) =>
                matches.findIndex(candidate =>
                    candidate.sourceType === item.sourceType && candidate.sourceId === item.sourceId
                ) === index
            )
            .slice(0, 3);
        if (!candidates.length) throw new Error('Zu dieser Frage wurden keine passenden Notizen gefunden.');
        const evidence = candidates.map((item, index) =>
            `[${index + 1}] ${item.title}\n${item.text.slice(0, 550)}`
        ).join('\n\n');
        const answer = await generate(
            `Beantworte die Frage ausschließlich anhand der folgenden ${pdfOnly ? 'PDF-Auszüge' : 'lokalen Notizauszüge'}. Setze hinter jede Aussage die passende Quellenmarke wie [1] oder [2]. Wenn die Auszüge keine Antwort enthalten, sage das klar und erfinde keine Quellen.\n\nFrage: ${question.slice(0, 300)}\n\n${pdfOnly ? 'PDF-Auszüge' : 'Notizauszüge'}:\n${evidence}`,
            220
        );
        return {
            answer,
            sources: candidates.map(item => ({
                sourceType: item.sourceType,
                sourceId: item.sourceId,
                title: item.title,
                text: item.text
            }))
        };
    }

    async function openAnswerSource(source) {
        if (source.sourceType === 'pdf-workspace') {
            const separator = source.sourceId.lastIndexOf(':');
            const docId = source.sourceId.slice(0, separator);
            const pageIndex = Number(source.sourceId.slice(separator + 1));
            if (!docId || !Number.isInteger(pageIndex) || pageIndex < 0) {
                throw new Error('Die PDF-Fundstelle ist ungültig.');
            }
            const pageNumber = pageIndex + 1;
            if (document.body.dataset.page === 'pdf-workspace') {
                await openPdfWorkspaceAnchor({ docId, pageNumber });
            } else {
                window.location.href = `./pdf-workspace.html?id=${encodeURIComponent(docId)}&page=${pageNumber}`;
            }
            return;
        }
        if (source.sourceType === 'notebook') {
            const separator = source.sourceId.lastIndexOf(':');
            const notebookId = source.sourceId.slice(0, separator);
            const pageIndex = Number(source.sourceId.slice(separator + 1));
            if (!notebookId || !Number.isInteger(pageIndex) || pageIndex < 0) {
                throw new Error('Die Notiz-Fundstelle ist ungültig.');
            }
            window.location.href = `./notebook.html?id=${encodeURIComponent(notebookId)}&page=${pageIndex}`;
            return;
        }
        if (source.sourceType === 'whiteboard') {
            window.location.href = `./whiteboard.html?id=${encodeURIComponent(source.sourceId)}`;
            return;
        }
        throw new Error('Dieser Quellentyp kann nicht geöffnet werden.');
    }

    function parseGeneratedTasks(text) {
        const result = extractJson(text);
        return result.map(item => typeof item === 'string' ? item : item.task || item.text || '')
            .filter(Boolean)
            .slice(0, 30);
    }

    async function runTextAction(action) {
        const text = await getSourceText();
        if (action === 'flashcards' && currentDocument().type === 'pdf-workspace') {
            pendingFlashcards = createLocalFlashcards(text);
            if (!pendingFlashcards.length) {
                throw new Error('Im PDF-Text wurden keine geeigneten Abschnitte für Lernkarten gefunden.');
            }
            const preview = document.getElementById('ai-card-preview');
            const count = document.getElementById('ai-card-count');
            if (preview) preview.hidden = false;
            if (count) count.textContent = `${pendingFlashcards.length} Karten aus PDF-Textabschnitten erstellt.`;
            setOutput(pendingFlashcards.map((card, index) => `${index + 1}. ${card.front}\n   ${card.back}`).join('\n\n'), action);
            setStatus('Lernkarten lokal aus dem PDF-Text erstellt (ohne Modell).', null);
            return;
        }
        const chunks = splitText(text, 1200);
        if (action === 'summarize') {
            const result = await summarize(text);
            setOutput(result, action);
        } else if (action === 'tasks') {
            const tasks = [];
            for (const chunk of chunks) {
                const generated = await generate(makePrompt(
                    'Extrahiere konkrete Aufgaben als JSON-Array aus kurzen Aufgaben-Strings. Gib ausschließlich ein gültiges JSON-Array aus. Wenn keine Aufgabe vorhanden ist, gib [].',
                    chunk
                ), 160);
                tasks.push(...parseGeneratedTasks(generated));
            }
            const uniqueTasks = [...new Set(tasks.map(task => task.trim()).filter(Boolean))].slice(0, 30);
            await storeTasks(uniqueTasks);
            setOutput(uniqueTasks.length ? `${uniqueTasks.length} Aufgaben wurden als lokale, abhakbare Checkliste gespeichert.` : 'Keine Aufgaben erkannt.', action);
        } else if (action === 'improve') {
            const improved = [];
            for (const chunk of chunks) {
                improved.push(await generate(makePrompt(
                    'Korrigiere Rechtschreibung und Grammatik und formuliere Stichpunkte klar und natürlich aus. Behalte Bedeutung, Namen, Zahlen und Fachbegriffe unverändert. Gib nur den überarbeiteten Text aus.',
                    chunk
                ), 220));
            }
            setOutput(improved.join('\n\n'), action);
        } else if (action === 'tags') {
            const suggestedTags = [];
            for (const chunk of chunks) {
                const result = await generate(makePrompt(
                    'Schlage höchstens acht kurze deutsche Schlagwörter vor. Gib ausschließlich ein JSON-Array mit Strings aus.',
                    chunk
                ), 80);
                suggestedTags.push(...extractJson(result).map(tag => String(tag).trim()).filter(Boolean));
            }
            const tags = [...new Set(suggestedTags)].slice(0, 8);
            setOutput(tags.map(tag => `#${tag.replace(/^#/, '')}`).join('  '), action);
        } else if (action === 'flashcards') {
            pendingFlashcards = [];
            for (const chunk of chunks) {
                const result = await generate(makePrompt(
                    'Erstelle höchstens drei Lernkarten. Gib ausschließlich ein gültiges JSON-Array mit Objekten und den Schlüsseln "question" und "answer" aus. Jede Antwort soll kurz und korrekt sein.',
                    chunk
                ), 160);
                pendingFlashcards.push(...extractJson(result)
                    .filter(card => card && card.question && card.answer)
                    .map(card => ({ front: String(card.question), back: String(card.answer) })));
                if (pendingFlashcards.length >= 12) break;
            }
            pendingFlashcards = pendingFlashcards.slice(0, 12);
            if (!pendingFlashcards.length) throw new Error('Es konnten keine gültigen Frage-Antwort-Karten erstellt werden.');
            const preview = document.getElementById('ai-card-preview');
            const count = document.getElementById('ai-card-count');
            if (preview) preview.hidden = false;
            if (count) count.textContent = `${pendingFlashcards.length} Karten bereit aus „${currentDocument().title}“.`;
            setOutput(pendingFlashcards.map((card, index) => `${index + 1}. ${card.front}\n   ${card.back}`).join('\n\n'), action);
        }
    }

    async function saveFlashcards() {
        if (!pendingFlashcards.length) throw new Error('Es gibt keine Lernkarten zum Speichern.');
        await notebookStorageReady;
        const documentInfo = currentDocument();
        if (!documentInfo) throw new Error('Das Quelldokument der Lernkarten wurde nicht gefunden.');
        let decks = await notebookDb.flashcardDecks.toArray();
        if (!decks.length) {
            const now = new Date().toISOString();
            await notebookDb.flashcardDecks.add({ id: `deck-${Date.now()}`, name: 'Allgemein', createdAt: now, updatedAt: now });
            decks = await notebookDb.flashcardDecks.toArray();
        }
        const deck = decks.find(item => item.name === 'Allgemein') || decks[0];
        const now = new Date().toISOString();
        const records = pendingFlashcards.map((card, index) => ({
            id: globalThis.crypto?.randomUUID?.() || `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            deckId: deck.id,
            front: card.front,
            back: card.back,
            position: index,
            box: 1,
            dueAt: now,
            createdAt: now,
            updatedAt: now,
            reviewCount: 0,
            sourceId: sourceKey(documentInfo),
            sourceGroupId: `${documentInfo.type}:${documentInfo.id}`,
            sourceTitle: documentInfo.title
        }));
        await notebookDb.flashcards.bulkAdd(records);
        reviewCards = records;
        reviewIndex = 0;
        document.getElementById('ai-card-review').hidden = false;
        renderReviewCard();
        pendingFlashcards = [];
        document.getElementById('ai-card-preview').hidden = true;
        setOutput('Lernkarten wurden lokal gespeichert. Du findest sie in der Lernkarten-Ansicht.', 'saved');
        if (typeof scheduleCloudSync === 'function') scheduleCloudSync();
    }

    function renderReviewCard() {
        const card = reviewCards[reviewIndex];
        const section = document.getElementById('ai-card-review');
        if (!card || !section) {
            if (section) section.hidden = true;
            return;
        }
        section.hidden = false;
        document.getElementById('ai-review-counter').textContent = `Karte ${reviewIndex + 1} von ${reviewCards.length}`;
        document.getElementById('ai-review-front').textContent = card.front;
        document.getElementById('ai-review-back').textContent = card.back;
        document.getElementById('ai-review-card').classList.remove('is-flipped');
    }

    async function rateReviewCard(rating) {
        const card = reviewCards[reviewIndex];
        if (!card) return;
        const { getFlashcardReviewSchedule } = await import('./flashcards.js');
        const schedule = getFlashcardReviewSchedule(card.box, rating);
        await notebookDb.flashcards.update(card.id, {
            ...schedule,
            reviewCount: (card.reviewCount || 0) + 1,
            lastRating: rating,
            updatedAt: new Date().toISOString()
        });
        reviewCards.splice(reviewIndex, 1);
        if (rating === 'again') reviewCards.push({ ...card, ...schedule });
        if (reviewIndex >= reviewCards.length) reviewIndex = 0;
        renderReviewCard();
    }

    function preprocessImage(file) {
        return createImageBitmap(file).then(bitmap => {
            const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) throw new Error('Das Foto konnte nicht für OCR vorbereitet werden.');
            context.filter = 'grayscale(1) contrast(1.45)';
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            return canvas;
        });
    }

    async function runOcr(file) {
        if (!file) return;
        if (!window.Tesseract?.createWorker) throw new Error('Das lokale OCR-Modul ist nicht verfügbar.');
        const canvas = await preprocessImage(file);
        setStatus('Lade deutsche OCR-Sprachdaten bei Bedarf …');
        const ocrWorker = await Tesseract.createWorker('deu+eng', 1, {
            langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
            cacheMethod: 'write',
            logger: message => {
                if (message.status) setStatus(`OCR: ${message.status}`);
            }
        });
        try {
            const { data } = await ocrWorker.recognize(canvas);
            const text = String(data.text || '').trim();
            if (!text) throw new Error('Auf dem Bild wurde kein Text erkannt.');
            await insertText(text);
            setOutput(text, 'ocr');
            setStatus('OCR abgeschlossen; der erkannte Text wurde lokal eingefügt.', null);
        } finally {
            await ocrWorker.terminate();
        }
    }

    async function runHandwritingOcr(file) {
        if (!file) return;
        const canvas = await preprocessImage(file);
        setStatus('Lade lokales Handschriftmodell bei Bedarf …');
        const result = await runModel('image', { image: canvas.toDataURL('image/jpeg', 0.9) });
        const text = String(result.text || '').trim();
        if (!text) throw new Error('Auf dem Bild wurde kein handschriftlicher Text erkannt.');
        await insertText(text);
        setOutput(text, 'ocr');
        setStatus('Handschrift lokal erkannt und eingefügt.', null);
    }

    function downsampleAudio(audioBuffer, targetRate = 16000) {
        const sourceRate = audioBuffer.sampleRate;
        const targetLength = Math.floor(audioBuffer.length * targetRate / sourceRate);
        const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
        const mono = new Float32Array(targetLength);
        for (let index = 0; index < targetLength; index += 1) {
            const sourceIndex = index * sourceRate / targetRate;
            const left = Math.floor(sourceIndex);
            const right = Math.min(left + 1, audioBuffer.length - 1);
            const ratio = sourceIndex - left;
            let sample = 0;
            channels.forEach(channel => {
                sample += channel[left] * (1 - ratio) + channel[right] * ratio;
            });
            mono[index] = sample / channels.length;
        }
        return mono;
    }

    async function transcribeRecording(blob) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Audio-Decodierung wird in diesem Browser nicht unterstützt.');
        const audioContext = new AudioContextClass();
        try {
            const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
            const audio = downsampleAudio(decoded);
            setStatus('Transkribiere Diktat lokal …');
            const result = await runModel('speech', { audio, samplingRate: 16000 });
            const text = String(result.text || '').trim();
            if (!text) throw new Error('Im Diktat wurde kein Text erkannt.');
            await insertText(text);
            setOutput(text, 'speech');
            setStatus('Diktat lokal transkribiert und eingefügt.', null);
        } finally {
            await audioContext.close();
        }
    }

    async function toggleRecording(button) {
        if (mediaRecorder?.state === 'recording') {
            mediaRecorder.stop();
            button.textContent = 'Diktat wird verarbeitet …';
            button.disabled = true;
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            throw new Error('Mikrofonaufnahme wird in diesem Browser nicht unterstützt.');
        }
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        mediaRecorder = new MediaRecorder(recordingStream);
        mediaRecorder.addEventListener('dataavailable', event => {
            if (event.data.size) chunks.push(event.data);
        });
        mediaRecorder.addEventListener('stop', async () => {
            window.clearTimeout(recordingTimeout);
            recordingStream?.getTracks().forEach(track => track.stop());
            recordingStream = null;
            mediaRecorder = null;
            button.disabled = false;
            button.textContent = 'Diktat starten';
            try {
                await transcribeRecording(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' }));
            } catch (error) {
                setStatus(error.message, null);
                setOutput(error.message);
            }
        }, { once: true });
        mediaRecorder.start();
        button.textContent = 'Diktat beenden';
        setStatus('Aufnahme läuft. Tippe auf „Diktat beenden“, um lokal zu transkribieren.');
        recordingTimeout = window.setTimeout(() => {
            if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
        }, 180_000);
    }

    function handleError(error) {
        console.error('Lokale KI-Aufgabe fehlgeschlagen:', error);
        const message = error?.message || 'Die lokale KI-Aufgabe ist fehlgeschlagen.';
        setStatus(message.includes('fetch') || !navigator.onLine
            ? 'Modell noch nicht lokal vorhanden. Verbinde dich einmal zum Herunterladen der Modell-Dateien.'
            : message, null);
        setOutput(message);
    }

    async function handleAction(action, button) {
        try {
            if (action === 'download-models') {
                await downloadModels(button);
                return;
            }
            if (action === 'ocr' || action === 'handwriting') {
                pendingImageMode = action;
                document.getElementById('ai-image-input').click();
                return;
            }
            if (action === 'record') {
                await toggleRecording(button);
                return;
            }
            if (action === 'apply-result') {
                if (!lastResult) return;
                await insertText(lastResult, lastResultKind === 'improve');
                setStatus('Ergebnis lokal in den Editor übernommen.', null);
                return;
            }
            if (action === 'insert-tasks') {
                const documentInfo = currentDocument();
                const tasks = await notebookDb.aiTasks.where('sourceKey').equals(sourceKey(documentInfo)).toArray();
                const checklist = tasks.map(task => `- [${task.done ? 'x' : ' '}] ${task.text}`).join('\n');
                if (checklist) await insertText(`Aufgaben\n${checklist}`);
                setStatus('Checkliste in den Editor übernommen.', null);
                return;
            }
            if (action === 'save-cards') {
                await saveFlashcards();
                return;
            }
            if (action === 'flip-card') {
                document.getElementById('ai-review-card')?.classList.toggle('is-flipped');
                return;
            }
            if (action === 'previous-card' || action === 'next-card') {
                if (!reviewCards.length) return;
                const direction = action === 'next-card' ? 1 : -1;
                reviewIndex = (reviewIndex + direction + reviewCards.length) % reviewCards.length;
                renderReviewCard();
                return;
            }
            if (action === 'rate-again' || action === 'rate-good') {
                await rateReviewCard(action === 'rate-again' ? 'again' : 'good');
                return;
            }
            if (action === 'ask') {
                const question = document.getElementById('ai-question').value.trim();
                if (!question) throw new Error('Bitte gib zuerst eine Frage ein.');
                setOutput('');
                const result = await answerAcrossNotes(question);
                setOutput(result.answer, 'answer');
                renderAnswerSources(result.sources);
                return;
            }
            if (action === 'index') {
                const count = await indexAllSources();
                setOutput(`${count} Textabschnitte wurden lokal für die semantische Suche indiziert.`, action);
                return;
            }
            if (['summarize', 'tasks', 'improve', 'tags', 'flashcards'].includes(action)) {
                setOutput('');
                if (action === 'tasks') {
                    document.getElementById('ai-checklist-section').hidden = false;
                    document.getElementById('ai-checklist').replaceChildren();
                }
                if (action === 'flashcards') document.getElementById('ai-card-preview').hidden = true;
                await runTextAction(action);
            }
        } catch (error) {
            handleError(error);
        }
    }

    function openPanel() {
        const panel = getPanel();
        panel.style.display = 'flex';
        panel.setAttribute('aria-hidden', 'false');
        renderStoredTasks().catch(handleError);
        document.getElementById('ai-question')?.focus();
    }

    function closePanel() {
        const panel = document.getElementById('goodnotesAISidebar');
        if (!panel) return;
        panel.style.display = 'none';
        panel.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest('#btn-ai')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const panel = document.getElementById('goodnotesAISidebar');
            if (panel?.style.display === 'flex') closePanel();
            else openPanel();
            return;
        }
        if (target.closest('[data-ai-close]')) {
            closePanel();
            return;
        }
        const sourceButton = target.closest('[data-ai-source]');
        if (sourceButton) {
            const source = answerSources[Number(sourceButton.dataset.aiSource)];
            if (source) openAnswerSource(source).catch(handleError);
            return;
        }
        const actionButton = target.closest('[data-ai-action]');
        if (actionButton) {
            handleAction(actionButton.dataset.aiAction, actionButton);
            return;
        }
    }, true);

    document.addEventListener('change', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.id === 'ai-image-input') {
            const file = target.files?.[0];
            target.value = '';
            const runImageRecognition = pendingImageMode === 'handwriting' ? runHandwritingOcr : runOcr;
            pendingImageMode = 'ocr';
            runImageRecognition(file).catch(handleError);
            return;
        }
        const taskCheckbox = target.closest('[data-ai-task-id]');
        if (taskCheckbox) {
            const labelText = taskCheckbox.parentElement?.querySelector('span');
            if (labelText) labelText.style.textDecoration = taskCheckbox.checked ? 'line-through' : '';
            notebookDb.aiTasks.update(taskCheckbox.dataset.aiTaskId, {
                done: taskCheckbox.checked,
                updatedAt: new Date().toISOString()
            }).catch(handleError);
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePanel();
        if (event.key === 'Enter' && event.target?.id === 'ai-question') {
            event.preventDefault();
            handleAction('ask');
        }
    });

    window.addEventListener('beforeunload', () => {
        window.clearTimeout(idleTimer);
        window.clearTimeout(recordingTimeout);
        recordingStream?.getTracks().forEach(track => track.stop());
        worker?.terminate();
    });
})();
