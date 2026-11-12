// Notebook editor and dashboard operations
async function openNotebook(id) {
    let nb = notebooks.find(item => item.id === id);
    if (!nb || notebookTombstones[String(id)] || notebookPurgeTombstones[String(id)]) return;
    let hasOriginalPdf = false;
    try {
        await ensureNotebookStorage();
        hasOriginalPdf = Boolean(await notebookDb.pdfOriginals.get(String(id)));
        const storedPages = await notebookDb.pages
            .where('notebookId')
            .equals(String(id))
            .sortBy('pageIndex');
        if (storedPages.length) {
            nb.pages = storedPages.map(({ notebookId, pageIndex, ...page }) => page);
        } else {
            const pages = getNotebookPages(nb);
            await Promise.all(pages.map((page, pageIndex) => writeNotebookPage(id, pageIndex, page)));
        }
        nb.pageCount = getNotebookPages(nb).length;
    } catch (error) {
        reportNotebookStorageError(error);
        return;
    }
    nb = notebooks.find(item => item.id === id);
    if (!nb) return;
    currentNotebookId = id;
    currentPageIndex = 0;
    currentPageZoom = 1;
    editorUndoStack = [];
    editorRedoStack = [];
    isNotebookReadOnly = false;
    setSelectedShapeIds([]);
    lassoActive = false;
    lassoPoints = [];
    shapeEditStart = null;
    currentToolState.tool = 'pen';
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
    const originalPdfAction = hasOriginalPdf
        ? `<button data-editor-action="export-original-pdf" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"><i data-lucide="file-down" class="w-4 h-4 text-slate-500"></i>Original-PDF herunterladen</button>`
        : '';
    const pageTemplateOptions = templateGroups.map(group =>
        group.templates.map(template =>
            `<option value="${escapeEditorText(template.pattern)}">${escapeEditorText(template.name)}</option>`
        ).join('')
    ).join('');

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
                            <button data-editor-action="toggle-read-only" aria-pressed="false" class="py-2 hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700">
                                <i data-lucide="book-open" class="w-4 h-4"></i><span>Nur lesen</span>
                            </button>
                        </div>
                        <div class="grid grid-cols-2 border-b border-slate-100 py-1 text-center">
                            <button data-editor-action="undo" class="py-2 hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700 border-r border-slate-100" aria-label="Rückgängig">
                                <i data-lucide="undo-2" class="w-4 h-4"></i> Rückgängig
                            </button>
                            <button data-editor-action="redo" class="py-2 hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700" aria-label="Wiederholen">
                                <i data-lucide="redo-2" class="w-4 h-4"></i> Wiederholen
                            </button>
                        </div>
                        <div class="py-1 border-b border-slate-100">
                            <button data-editor-action="add-textbox" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="text-cursor-input" class="w-4 h-4 text-slate-500"></i> Textfeld einfügen
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
                            <button data-editor-action="export-page-pdf" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="file-down" class="w-4 h-4 text-slate-500"></i> Seite als PDF exportieren
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
                            ${originalPdfAction}
                            <button onclick="saveNotebookContent(${nb.id})" class="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 font-medium">
                                <i data-lucide="save" class="w-4 h-4 text-blue-600"></i> Notizen speichern
                            </button>
                            <button data-editor-action="export-pdf" class="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 font-medium">
                                <i data-lucide="file-down" class="w-4 h-4 text-blue-600"></i> Als PDF exportieren
                            </button>
                            <button data-editor-action="import-document" class="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 font-medium">
                                <i data-lucide="file-up" class="w-4 h-4 text-blue-600"></i> PDF / Goodnotes importieren
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
                <button data-editor-action="pause-recording" disabled>Aufnahme pausieren</button>
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
                <div class="editor-toolbar-settings-heading">
                    <h3>Werkzeugleiste anpassen</h3>
                    <button type="button" data-editor-action="toggle-toolbar-settings" aria-label="Werkzeugeinstellungen schließen">×</button>
                </div>
                <label for="inputModeSelect">Eingabe</label>
                <select id="inputModeSelect" class="toolbar-select" aria-label="Eingabemodus">
                    <option value="stylus-only">Nur Stift schreibt</option>
                    <option value="finger-draw">Finger schreibt und zeichnet</option>
                    <option value="finger-navigate">Finger navigiert, Stift schreibt</option>
                    <option value="automatic">Automatische Eingabeerkennung</option>
                </select>
                <p class="input-mode-note">Automatisch: Stift/Maus schreibt, Finger navigiert. Druck und Neigung hängen von Gerät und Browser ab.</p>
                <label for="lassoFilterSelect">Lasso-Auswahl</label>
                <select id="lassoFilterSelect" class="toolbar-select" aria-label="Lasso-Auswahlfilter">
                    <option value="all">Alle Elemente</option>
                    <option value="handwriting">Handschrift</option>
                    <option value="images">Bilder</option>
                    <option value="text">Textfelder</option>
                    <option value="shapes">Formen und Sticker</option>
                </select>
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
                    <button class="floating-tool toolbar-delete-tool" data-editor-action="delete-selected-shape" aria-label="Ausgewählte Form löschen" title="Ausgewählte Form löschen" disabled><i data-lucide="trash-2"></i></button>
                    <button class="floating-tool" data-editor-tool="lasso" aria-label="Formen, Smileys und Bilder auswählen und bearbeiten" title="Auswählen und bearbeiten"><i data-lucide="mouse-pointer-2"></i></button>
                    <div class="toolbar-dropdown-group">
                        <button id="penToolTrigger" class="floating-tool" data-editor-tool="pen" data-toolbar-group="pen" data-toolbar-dropdown-toggle="penOptions" aria-label="Stift: Kugelschreiber" aria-expanded="false" aria-controls="penOptions" title="Kugelschreiber">
                            <span class="toolbar-pen-icon is-visible" data-pen-icon="pen"><i data-lucide="pen-tool"></i></span>
                            <span class="toolbar-pen-icon" data-pen-icon="pencil"><i data-lucide="pencil"></i></span>
                            <span class="toolbar-pen-icon" data-pen-icon="pen-fountain"><i data-lucide="pen-line"></i></span>
                            <span class="toolbar-pen-icon" data-pen-icon="highlighter"><i data-lucide="highlighter"></i></span>
                            <i data-lucide="chevron-down" class="editor-caret"></i>
                        </button>
                        <div id="penOptions" class="toolbar-dropdown-menu pen-dropdown-menu">
                            <div class="pen-choice-list" role="group" aria-label="Stift auswählen">
                                <span class="toolbar-menu-heading">Stifte</span>
                                <button type="button" class="pen-choice" data-pen-choice="pen" data-pen-label="Kugelschreiber" aria-pressed="true"><i data-lucide="pen-tool"></i><span>Kugelschreiber</span></button>
                                <button type="button" class="pen-choice" data-pen-choice="pencil" data-pen-label="Bleistift" aria-pressed="false"><i data-lucide="pencil"></i><span>Bleistift</span></button>
                                <button type="button" class="pen-choice" data-pen-choice="pen-fountain" data-pen-label="Füllfederhalter" aria-pressed="false"><i data-lucide="pen-line"></i><span>Füllfederhalter</span></button>
                                <button type="button" class="pen-choice" data-pen-choice="highlighter" data-pen-label="Textmarker" aria-pressed="false"><i data-lucide="highlighter"></i><span>Textmarker</span></button>
                            </div>
                            <div id="penSettingsPanel" class="pen-settings-panel">
                                <h3 id="penSettingsTitle">Stifteinstellungen</h3>
                                <label for="penWidthSelect">Linienstärke</label>
                                <select id="penWidthSelect" class="toolbar-select" aria-label="Stiftstärke">
                                    <option value="1">Dünn</option>
                                    <option value="3" selected>Mittel</option>
                                    <option value="5">Dick</option>
                                </select>
                                <span class="toolbar-popover-divider"></span>
                                <span class="toolbar-menu-heading">Farbe</span>
                                <div class="toolbar-color-options" aria-label="Stiftfarbe wählen">
                                    <button type="button" class="pen-color is-color-selected" data-pen-color="#111111" aria-label="Schwarz"></button>
                                    <button type="button" class="pen-color" data-pen-color="#1685f8" aria-label="Blau"></button>
                                    <button type="button" class="pen-color" data-pen-color="#dc2626" aria-label="Rot"></button>
                                    <button type="button" class="pen-color" data-pen-color="#16a34a" aria-label="Grün"></button>
                                    <button type="button" class="pen-color pen-color-yellow" data-pen-color="#facc15" aria-label="Gelb"></button>
                                    <button type="button" class="pen-color pen-color-white" data-pen-color="#ffffff" aria-label="Weiß"></button>
                                    <button type="button" class="floating-tool toolbar-custom-color" data-editor-action="choose-color" title="Weitere Farben" aria-label="Weitere Farben"><i data-lucide="circle-plus"></i></button>
                                </div>
                                <button id="applyPenSelection" type="button" class="toolbar-apply-pen">Übernehmen</button>
                            </div>
                        </div>
                    </div>
                    <div class="toolbar-dropdown-group">
                        <button class="floating-tool" data-editor-tool="eraser" data-toolbar-dropdown-toggle="eraserOptions" aria-label="Radierer" aria-expanded="false" aria-controls="eraserOptions" title="Radierer"><i data-lucide="eraser"></i><i data-lucide="chevron-down" class="editor-caret"></i></button>
                        <div id="eraserOptions" class="toolbar-dropdown-menu">
                            <label for="eraserWidthSelect">Radierergröße</label>
                            <select id="eraserWidthSelect" class="toolbar-select" aria-label="Radierergröße">
                                <option value="1">Klein</option>
                                <option value="3" selected>Mittel</option>
                                <option value="5">Groß</option>
                            </select>
                        </div>
                    </div>
                    <div class="toolbar-dropdown-group">
                        <button class="floating-tool" data-editor-tool="shapes" data-toolbar-dropdown-toggle="shapeOptions" aria-label="Formen" aria-expanded="false" aria-controls="shapeOptions" title="Formen"><i data-lucide="shapes"></i><i data-lucide="chevron-down" class="editor-caret"></i></button>
                        <div id="shapeOptions" class="toolbar-dropdown-menu">
                            <label for="shapeKindSelect">Form</label>
                            <select id="shapeKindSelect" class="toolbar-select" aria-label="Form auswählen">
                                <option value="line">Linie</option>
                                <option value="rectangle" selected>Rechteck</option>
                                <option value="circle">Kreis</option>
                            </select>
                            <label for="shapeWidthSelect">Linienstärke</label>
                            <select id="shapeWidthSelect" class="toolbar-select" aria-label="Linienstärke der Form">
                                <option value="1">Dünn</option>
                                <option value="3" selected>Mittel</option>
                                <option value="5">Dick</option>
                            </select>
                        </div>
                    </div>
                    <div class="toolbar-dropdown-group">
                        <button class="floating-tool" data-editor-tool="objects" data-toolbar-dropdown-toggle="objectOptions" aria-label="Smileys" aria-expanded="false" aria-controls="objectOptions" title="Smileys"><i data-lucide="smile"></i><i data-lucide="chevron-down" class="editor-caret"></i></button>
                        <div id="objectOptions" class="toolbar-dropdown-menu">
                            <label for="objectEmojiSelect">Smiley auswählen</label>
                            <select id="objectEmojiSelect" class="toolbar-select" aria-label="Smiley auswählen">
                                <option value="⭐" selected>Stern</option>
                                <option value="❤️">Herz</option>
                                <option value="😊">Smiley</option>
                            </select>
                        </div>
                    </div>
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
                    <div id="notebookPage" class="notebook-page ${paperColorClass} ${paperPatternClass}">
                        <img id="notebookBackground" class="notebook-background hidden" alt="">
                        <textarea id="notebookContent" class="${paperTextClass}" aria-label="Notizen auf dieser Seite"></textarea>
                        <canvas id="notebookDrawing" aria-label="Zeichenfläche"></canvas>
                        <svg id="notebookShapes" aria-label="Formen auf dieser Seite"></svg>
                        <div id="selectionContextMenu" class="selection-context-menu hidden" role="menu" aria-label="Auswahl bearbeiten">
                            <button type="button" data-selection-action="copy" role="menuitem">Kopieren</button>
                            <button type="button" data-selection-action="cut" role="menuitem">Ausschneiden</button>
                            <button type="button" data-selection-action="duplicate" role="menuitem">Duplizieren</button>
                            <button type="button" data-selection-action="delete" role="menuitem">Löschen</button>
                            <button type="button" data-selection-action="edit-text" role="menuitem" disabled>Text bearbeiten</button>
                            <button type="button" data-selection-action="color" role="menuitem">Farbe ändern</button>
                            <button type="button" data-selection-action="export" role="menuitem">Als Bild exportieren</button>
                            <button type="button" data-selection-action="share" role="menuitem">Teilen</button>
                        </div>
                    </div>
                    <div id="editorLaserDot" class="editor-laser-dot" aria-hidden="true"></div>
                </div>
                <div id="pageCounter" class="page-counter"></div>
            </div>
            <div id="textBoxModal" class="editor-text-modal" role="dialog" aria-modal="true" aria-labelledby="textBoxModalTitle" aria-hidden="true">
                <section class="editor-text-modal-card">
                    <h2 id="textBoxModalTitle">Textfeld einfügen</h2>
                    <label for="textBoxContent">Text</label>
                    <textarea id="textBoxContent" rows="6" maxlength="10000" aria-label="Textfeldinhalt"></textarea>
                    <div class="editor-text-modal-actions">
                        <button type="button" data-textbox-action="cancel">Abbrechen</button>
                        <button type="button" data-textbox-action="save">Übernehmen</button>
                    </div>
                </section>
            </div>
            <div id="pageTemplateModal" class="editor-text-modal" role="dialog" aria-modal="true" aria-labelledby="pageTemplateModalTitle" aria-hidden="true">
                <section class="editor-text-modal-card page-template-modal-card">
                    <h2 id="pageTemplateModalTitle">Seiteneinstellungen</h2>
                    <label for="pageTemplateSelect">Vorlage</label>
                    <select id="pageTemplateSelect">${pageTemplateOptions}</select>
                    <label for="pagePaperColorSelect">Papierfarbe</label>
                    <select id="pagePaperColorSelect">
                        <option value="weiss">Weiß</option><option value="creme">Creme</option>
                        <option value="sepia">Sepia</option><option value="dunkel">Dunkel</option>
                        <option value="gelb">Gelb (ältere Notizbücher)</option>
                    </select>
                    <label for="pageSizeSelectEditor">Seitengröße</label>
                    <select id="pageSizeSelectEditor">
                        <option>Goodnotes Standard</option><option>A7</option><option>A6</option>
                        <option>A5</option><option>A4</option><option>A3</option>
                        <option>Letter-Format</option><option>Tabloid-Format</option>
                    </select>
                    <label for="pageOrientationSelect">Ausrichtung</label>
                    <select id="pageOrientationSelect">
                        <option value="portrait">Hochformat</option><option value="landscape">Querformat</option>
                    </select>
                    <div class="editor-text-modal-actions">
                        <button type="button" data-page-template-action="cancel">Abbrechen</button>
                        <button type="button" data-page-template-action="save">Übernehmen</button>
                    </div>
                </section>
            </div>
            <input id="editorColorPicker" type="color" value="#111111" class="hidden" aria-label="Stiftfarbe wählen">
            <input id="selectionColorPicker" type="color" value="#111111" class="hidden" aria-label="Auswahlfarbe wählen">
            <input id="editorImageInput" type="file" accept="image/*" class="hidden">
        </div>
    `;
    document.getElementById('notebookContent').value = pages[0].content || '';
    setNotebookBackground(pages[0]);
    document.getElementById('menuPageCounter').textContent = `1 von ${pages.length}`;
    attachEditorInteractions();
    setNotebookReadOnlyMode(false);
    void restorePageDrawing(pages[0].drawing || '').catch(reportDrawingRestoreError);
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
    if (isNotebookReadOnly) return;
    const nb = notebooks.find(item => item.id === id);
    if (!nb) return;
    const newTitle = prompt("Neuer Name für das Notizbuch:", nb.title);
    if (newTitle && newTitle.trim() !== "") {
        notebooks = notebooks.map(item => {
            if (item.id === id) item.title = newTitle.trim();
            return item;
        });
        saveNotebookMetadata(id);
        openNotebook(id);
    }
}

// Seite leeren
function clearNotebookContent(id) {
    closeMenu();
    if (isNotebookReadOnly) return;
    if (confirm("Möchtest du diese Seite wirklich leeren?")) {
        recordEditorHistory(captureEditorSnapshot(['content', 'drawing', 'shapes']));
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
        lastEditorText = '';
        setSelectedShapeIds([]);
        renderNotebookShapes();
        saveNotebookContent(id);
    }
}

function deleteNotebook(id) {
    closeMenu();
    if (isNotebookReadOnly) return;
    if (!confirm('Möchtest du dieses Notizbuch wirklich in den Papierkorb verschieben?')) return;
    const key = String(id);
    notebookTombstones[key] = new Date().toISOString();
    delete notebookPurgeTombstones[key];
    saveNotebookTombstones();
    saveNotebookPurgeTombstones();
    saveNotebookMetadata();
    location.reload();
}

function restoreNotebook(id) {
    const key = String(id);
    let notebook = notebooks.find(item => String(item.id) === key);
    if (!notebook) {
        notebook = {
            id: /^\d+$/.test(key) ? Number(key) : key,
            title: 'Wiederhergestelltes Notizbuch',
            template: 'Leer',
            date: new Date().toLocaleDateString('de-DE')
        };
        notebooks.push(notebook);
    }
    delete notebookTombstones[key];
    notebook.updatedAt = new Date().toISOString();
    saveNotebookTombstones();
    saveNotebookMetadata(notebook.id);
    renderTrash();
    loadNotebooksToDashboard();
}

async function permanentlyDeleteNotebook(id) {
    const key = String(id);
    if (!confirm('Dieses Notizbuch und alle Seiten endgültig löschen?')) return;

    notebookPurgeTombstones[key] = new Date().toISOString();
    delete notebookTombstones[key];
    notebooks = notebooks.filter(item => String(item.id) !== key);
    saveNotebookTombstones();
    saveNotebookPurgeTombstones();
    saveNotebookMetadata();
    renderTrash();

    try {
        await ensureNotebookStorage();
        const hasCloudData = Boolean(localStorage.getItem('mynotes_cloud_owner') || (cloudClient && cloudSession));
        if (!hasCloudData) {
            await notebookDb.pages.where('notebookId').equals(key).delete();
            await notebookDb.pdfOriginals.delete(key);
            delete notebookPurgeTombstones[key];
            saveNotebookPurgeTombstones();
        } else if (cloudClient && cloudSession && navigator.onLine) {
            await syncCloudData();
        } else {
            setCloudStatus('Endgültige Löschung vorgemerkt. Bitte verbinde dich mit deinem Konto und dem Internet, um sie auch in der Cloud abzuschließen.');
        }
    } catch (error) {
        console.error('Notizbuch konnte nicht endgültig gelöscht werden:', error);
        alert(`Das Notizbuch bleibt zur Sicherheit vorgemerkt, konnte aber noch nicht endgültig gelöscht werden: ${error.message || error}`);
    }
    renderTrash();
}

function saveNotebookContent(id) {
    closeMenu();
    if (isNotebookReadOnly) return;
    const contentElement = document.getElementById('notebookContent');
    if (!contentElement) return;
    persistNotebookPages();
    alert('Notizen erfolgreich gespeichert!');
}

function getNotebookFolderNames() {
    return [...new Set([
        ...notebookFolders,
        ...notebooks.map(notebook => notebook.folderName)
    ].map(folder => String(folder || '').trim()).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second, 'de', { sensitivity: 'base' }));
}

function saveNotebookFolders() {
    localStorage.setItem('mynotes_folders', JSON.stringify(notebookFolders));
}

function createNotebookFolder() {
    const name = prompt('Name für den neuen Ordner:')?.trim();
    if (!name) return;
    if (getNotebookFolderNames().some(folder => folder.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        alert('Ein Ordner mit diesem Namen existiert bereits.');
        return;
    }
    notebookFolders.push(name);
    try {
        saveNotebookFolders();
    } catch (error) {
        notebookFolders = notebookFolders.filter(folder => folder !== name);
        console.error('Ordner konnte nicht gespeichert werden:', error);
        alert('Der Ordner konnte lokal nicht gespeichert werden.');
        return;
    }
    activeDashboardFolder = name;
    showMainView('folder');
}

function renderFolderNavigation() {
    const list = document.getElementById('folderNavList');
    if (!list) return;
    list.replaceChildren();
    getNotebookFolderNames().forEach(folder => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'folder-nav-item';
        button.textContent = folder;
        button.setAttribute('aria-current', String(
            activeDashboardFilter === 'folder' && activeDashboardFolder === folder
        ));
        button.classList.toggle('is-active', activeDashboardFilter === 'folder' && activeDashboardFolder === folder);
        button.addEventListener('click', () => {
            activeDashboardFolder = folder;
            showMainView('folder');
        });
        list.appendChild(button);
    });
}

function toggleNotebookFavorite(notebookId) {
    const notebook = notebooks.find(item => String(item.id) === String(notebookId));
    if (!notebook) return;
    notebook.favorite = !notebook.favorite;
    saveNotebookMetadata(notebook.id);
    loadNotebooksToDashboard();
}

function moveNotebookToFolder(notebookId, folderName) {
    const notebook = notebooks.find(item => String(item.id) === String(notebookId));
    if (!notebook) return;
    const previousFolderName = notebook.folderName || '';
    notebook.folderName = folderName;
    if (folderName && !notebookFolders.includes(folderName)) {
        notebookFolders.push(folderName);
        try {
            saveNotebookFolders();
        } catch (error) {
            notebookFolders = notebookFolders.filter(folder => folder !== folderName);
            notebook.folderName = previousFolderName;
            console.error('Ordnerzuordnung konnte nicht gespeichert werden:', error);
            alert('Die Ordnerzuordnung konnte lokal nicht gespeichert werden.');
            return;
        }
    }
    saveNotebookMetadata(notebook.id);
    renderFolderNavigation();
    loadNotebooksToDashboard();
}

function renameNotebookFromDashboard(notebookId) {
    const notebook = notebooks.find(item => String(item.id) === String(notebookId));
    if (!notebook) return;
    const title = prompt('Neuer Name für das Notizbuch:', notebook.title);
    if (!title?.trim()) return;
    notebook.title = title.trim();
    saveNotebookMetadata(notebook.id);
    loadNotebooksToDashboard();
}

async function duplicateNotebook(notebookId) {
    const source = notebooks.find(item => String(item.id) === String(notebookId));
    if (!source) return;
    try {
        await ensureNotebookStorage();
        if (String(currentNotebookId) === String(source.id) && !isNotebookReadOnly) {
            persistNotebookPages();
            const currentPage = getNotebookPages(source)[currentPageIndex];
            if (currentPage) await writeNotebookPage(source.id, currentPageIndex, currentPage);
        }
        const storedPages = await notebookDb.pages
            .where('notebookId')
            .equals(String(source.id))
            .sortBy('pageIndex');
        const sourcePdf = await notebookDb.pdfOriginals.get(String(source.id));
        const sourcePages = storedPages.length
            ? storedPages.map(({ notebookId, pageIndex, ...page }) => page)
            : getNotebookPages(source);
        const pages = sourcePages.map(page => JSON.parse(JSON.stringify(page)));
        let id = Date.now();
        while (notebooks.some(notebook => String(notebook.id) === String(id))) id += 1;
        const now = new Date().toISOString();
        const copy = {
            ...source,
            id,
            title: `${source.title || 'Notizbuch'} (Kopie)`,
            favorite: false,
            date: new Date().toLocaleDateString('de-DE'),
            pageCount: pages.length,
            pages,
            createdAt: now,
            updatedAt: now
        };
        try {
            await notebookDb.transaction('rw', notebookDb.pages, notebookDb.pdfOriginals, async () => {
                await notebookDb.pages.bulkPut(pages.map((page, pageIndex) => ({
                    ...page,
                    notebookId: String(id),
                    pageIndex
                })));
                if (sourcePdf) {
                    await notebookDb.pdfOriginals.put({
                        ...sourcePdf,
                        notebookId: String(id)
                    });
                }
            });
            notebooks.push(copy);
            saveNotebookMetadata(id);
        } catch (error) {
            notebooks = notebooks.filter(notebook => String(notebook.id) !== String(id));
            try {
                await notebookDb.transaction('rw', notebookDb.pages, notebookDb.pdfOriginals, async () => {
                    await notebookDb.pages.where('notebookId').equals(String(id)).delete();
                    await notebookDb.pdfOriginals.delete(String(id));
                });
            } catch (cleanupError) {
                console.error('Unvollständige Kopie konnte nicht bereinigt werden:', cleanupError);
            }
            throw error;
        }
        loadNotebooksToDashboard();
    } catch (error) {
        console.error('Notizbuch konnte nicht dupliziert werden:', error);
        alert(`Das Notizbuch konnte nicht dupliziert werden: ${error.message || error}`);
    }
}

function loadNotebooksToDashboard() {
    const section = document.getElementById('userNotebooksSection');
    const list = document.getElementById('notebooksList');
    if (!section || !list) return;

    const availableNotebooks = notebooks.filter(notebook =>
        !notebookTombstones[String(notebook.id)] && !notebookPurgeTombstones[String(notebook.id)]
    );
    const activeNotebooks = availableNotebooks.filter(notebook => {
        if (activeDashboardFilter === 'favorites') return Boolean(notebook.favorite);
        if (activeDashboardFilter === 'folder') return notebook.folderName === activeDashboardFolder;
        return true;
    });
    const sortSelect = document.getElementById('notebookSortSelect');
    if (sortSelect) sortSelect.value = notebookSortMode;
    if (notebookSortMode === 'title') {
        activeNotebooks.sort((first, second) =>
            String(first.title || '').localeCompare(String(second.title || ''), 'de', { sensitivity: 'base' })
        );
    } else {
        activeNotebooks.sort((first, second) => {
            const firstTime = notebookSortMode === 'created'
                ? (Date.parse(first.createdAt || '') || Number(first.id) || 0)
                : (Date.parse(first.updatedAt || '') || Number(first.id) || 0);
            const secondTime = notebookSortMode === 'created'
                ? (Date.parse(second.createdAt || '') || Number(second.id) || 0)
                : (Date.parse(second.updatedAt || '') || Number(second.id) || 0);
            return secondTime - firstTime;
        });
    }
    list.replaceChildren();
    const emptyState = document.getElementById('notebooksEmptyState');
    const hasFilterWithoutResults = activeDashboardFilter !== 'documents' && activeNotebooks.length === 0;
    section.classList.toggle('hidden', activeNotebooks.length === 0);
    if (emptyState) {
        emptyState.classList.toggle('hidden', !hasFilterWithoutResults);
        emptyState.textContent = activeDashboardFilter === 'favorites'
            ? 'Noch keine Favoriten. Markiere ein Notizbuch mit dem Stern.'
            : `Der Ordner „${activeDashboardFolder}“ enthält noch keine Notizbücher.`;
    }
    renderFolderNavigation();

    activeNotebooks.forEach(nb => {
        const card = document.createElement('article');
        card.className = 'notebook-card';
        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'notebook-card-open';
        openButton.setAttribute('aria-label', `Notizbuch ${nb.title} öffnen`);
        openButton.addEventListener('click', () => openNotebook(nb.id));

        const coverStage = document.createElement('span');
        coverStage.className = 'notebook-cover-stage';
        const cover = document.createElement('span');
        cover.className = `notebook-cover-preview ${getCoverClass(nb.cover)}`;
        cover.setAttribute('aria-hidden', 'true');
        const brand = document.createElement('span');
        brand.className = 'notebook-cover-brand';
        brand.textContent = 'MYNOTES';
        const coverLabel = document.createElement('span');
        coverLabel.className = 'notebook-cover-label';
        coverLabel.textContent = 'NOTIZBUCH';
        const coverTitle = document.createElement('span');
        coverTitle.className = 'notebook-cover-title';
        coverTitle.textContent = nb.title;
        cover.append(brand, coverLabel, coverTitle);
        coverStage.appendChild(cover);

        const details = document.createElement('span');
        details.className = 'notebook-card-details';
        const title = document.createElement('span');
        title.className = 'notebook-card-title';
        title.textContent = nb.title;
        const metadata = document.createElement('span');
        metadata.className = 'notebook-card-metadata';
        const template = document.createElement('span');
        template.className = 'notebook-card-template';
        template.textContent = nb.template || 'Notizbuch';
        const format = document.createElement('span');
        format.className = 'notebook-card-format';
        format.textContent = !nb.pageSize || nb.pageSize === 'Standard' ? 'Goodnotes Standard' : nb.pageSize;
        const pageCount = document.createElement('span');
        pageCount.className = 'notebook-card-page-count';
        pageCount.textContent = `${nb.pageCount || (Array.isArray(nb.pages) ? nb.pages.length : 1)} Seiten`;
        metadata.append(template, format, pageCount);
        details.append(title, metadata);

        openButton.append(coverStage, details);
        const actions = document.createElement('div');
        actions.className = 'notebook-card-actions';
        const favoriteButton = document.createElement('button');
        favoriteButton.type = 'button';
        favoriteButton.className = `notebook-card-action${nb.favorite ? ' is-favorite' : ''}`;
        favoriteButton.textContent = nb.favorite ? '★ Favorit' : '☆ Favorit';
        favoriteButton.setAttribute('aria-pressed', String(Boolean(nb.favorite)));
        favoriteButton.setAttribute('aria-label', nb.favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen');
        favoriteButton.addEventListener('click', () => toggleNotebookFavorite(nb.id));
        const duplicateButton = document.createElement('button');
        duplicateButton.type = 'button';
        duplicateButton.className = 'notebook-card-action';
        duplicateButton.textContent = 'Duplizieren';
        duplicateButton.addEventListener('click', () => void duplicateNotebook(nb.id));
        const renameButton = document.createElement('button');
        renameButton.type = 'button';
        renameButton.className = 'notebook-card-action';
        renameButton.textContent = 'Umbenennen';
        renameButton.addEventListener('click', () => renameNotebookFromDashboard(nb.id));
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'notebook-card-action is-destructive';
        deleteButton.textContent = 'Papierkorb';
        deleteButton.setAttribute('aria-label', `${nb.title} in den Papierkorb verschieben`);
        deleteButton.addEventListener('click', () => deleteNotebook(nb.id));
        const folderSelect = document.createElement('select');
        folderSelect.className = 'notebook-card-folder';
        folderSelect.setAttribute('aria-label', `Ordner für ${nb.title}`);
        const noFolder = document.createElement('option');
        noFolder.value = '';
        noFolder.textContent = 'Ohne Ordner';
        folderSelect.appendChild(noFolder);
        getNotebookFolderNames().forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            folderSelect.appendChild(option);
        });
        folderSelect.value = nb.folderName || '';
        folderSelect.addEventListener('change', () => moveNotebookToFolder(nb.id, folderSelect.value));
        actions.append(favoriteButton, duplicateButton, renameButton, deleteButton);
        card.append(openButton, actions, folderSelect);
        list.appendChild(card);
    });
}

function renderTrash() {
    const list = document.getElementById('trashNotebookList');
    const emptyState = document.getElementById('trashEmptyState');
    if (!list || !emptyState) return;

    const deletedIds = Object.keys(notebookTombstones)
        .filter(id => !notebookPurgeTombstones[id])
        .sort((first, second) => Date.parse(notebookTombstones[second]) - Date.parse(notebookTombstones[first]));
    list.replaceChildren();
    emptyState.classList.toggle('hidden', deletedIds.length > 0);

    deletedIds.forEach(id => {
        const notebook = notebooks.find(item => String(item.id) === id);
        const card = document.createElement('article');
        card.className = 'trash-notebook-card';

        const details = document.createElement('div');
        const title = document.createElement('h3');
        title.className = 'trash-notebook-title';
        title.textContent = notebook?.title || 'Gelöschtes Notizbuch';
        const date = document.createElement('p');
        date.className = 'trash-notebook-date';
        const deletedDate = new Date(notebookTombstones[id]);
        date.textContent = `Gelöscht am ${Number.isNaN(deletedDate.getTime()) ? 'unbekannten Datum' : deletedDate.toLocaleDateString('de-DE')}`;
        details.append(title, date);

        const actions = document.createElement('div');
        actions.className = 'trash-notebook-actions';
        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.className = 'trash-restore-button';
        restoreButton.textContent = 'Wiederherstellen';
        restoreButton.addEventListener('click', () => restoreNotebook(id));
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'trash-delete-button';
        deleteButton.textContent = 'Endgültig löschen';
        deleteButton.addEventListener('click', () => void permanentlyDeleteNotebook(id));
        actions.append(restoreButton, deleteButton);
        card.append(details, actions);
        list.appendChild(card);
    });
}

