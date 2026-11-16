# Whiteboard-Implementierungsstatus

> Hinweis zum aktuellen Projektstand: Die Anmeldung liegt in `index.html`, die Übersicht in `dashboard.html`; Whiteboard, Notizbuch-Editor und PDF-Arbeitsbereich liegen auf eigenen HTML-Seiten. Die folgenden Verweise auf `index.html` als App-Einstieg dokumentieren den damaligen Stand.

> Die Whiteboard-UI-Vorlage ist inzwischen in `whiteboard.html` integriert; `whiteboard.js` und `whiteboardEngine.js` behalten die lokale Speicherung und Synchronisierung. Die untenstehende Roadmap ist ein historischer Stand vor dieser Integration.

## Aktuelle Entwicklungsphase
Phase 3 – Whiteboard-Design und Whiteboard-Layout

## Abgeschlossene Aufgaben
- Grundstruktur der Web-App analysiert: Single-Page-Anwendung mit Dashboard, Editor, PDF-Workspace und Whiteboard.
- Startpunkte in `index.html`, `app.js` und `appInit.js` identifiziert.
- Bestehende Notebook-/Storage-Architektur im Dexie/IndexedDB-Stack untersucht.
- Whiteboard-Basis-Implementierung in `whiteboard.js` und `whiteboardEngine.js` erkannt.
- Gemeinsam genutzte Rendering- und Save-Mechanismen für Whiteboard gefunden.

## Geänderte Dateien
- `WHITEBOARD-IMPLEMENTATION-STATUS.md` neu erstellt (Dokumentationsstatus)

## Neu erstellte Dateien
- `WHITEBOARD-IMPLEMENTATION-STATUS.md`

## Testergebnisse
- Keine funktionalen Änderungen, nur Analyse / Dokumentation.
- Syntaxprüfung der JavaScript-Dateien bisher erfolgreich (`node --check` für alle `.js`-Dateien in der App).

## Bekannte Fehler / Risiken
- Die derzeitige Whiteboard-Implementierung ist funktional vorhanden, aber noch nicht als vollständiges Multi-Board-System nach Goodnotes-Architektur ausgebaut.
- Notizbuch-, PDF- und Whiteboard-Teile sind weitgehend getrennte Module statt einer gemeinsamen Ink-Engine.
- Die Whiteboard-Objekte, Speichermodelle und UI-Komponenten sind noch nicht vollständig in das vorhandene Dokument-/Board-Modell der App integriert.

## Offene Aufgaben
- Phase 2: konkreter Integrationsplan mit betroffenen Dateien und Schnittstellen.
- Gemeinsame Stift-/Ink-Engine definieren und auf alle Editoren verlagern.
- Whiteboard-Dokument-, Board- und Objektmodell gemäß Multi-Board-System ausbauen.
- Board-Seitenleiste, Navigation, Drag-and-Drop und Dokumentverwaltung ergänzen.
- PDF-Integration, Board-Transfer und Undo/Redo auf gemeinsame Engine abstrahieren.

## Nächste Phase
Phase 2 – Integrationsplan

## Phase 2 – Konkreter Integrationsplan

### 2.1 Zielbild
Die vorhandenen Module sollen nicht ersetzt, sondern in eine gemeinsame, zukunftssichere Architektur integriert werden:
- Eine zentrale Pointer- und Ink-Engine dient allen drei Hauptbereichen: Notizbuch-Editor, PDF-Editor und Whiteboard.
- Whiteboard wird als dokumentbasiertes Multi-Board-System mit eigenständigen Boards und einem gemeinsamen Rendering-/Canvas-Layer-Stack modelliert.
- Die heute vorhandenen Dexie/IndexedDB- und Supabase-Speichermechaniken bleiben der primäre Speicherungspfad; nur die Anbindung und Datenstrukturen werden konsolidiert.

### 2.2 Bestehende Architektur und betroffene Dateien

#### A. UI-/Dashboard-Schicht
- `index.html`: Seitenstruktur, CSS/JS-Assets, Modal- und Container-Elemente.
- `app.js`: Navigation, „Neu“-Menüs, Dashboard-Interaktionen, Backup/Import.
- `appInit.js`: Bootstrapping und App-Initialisierung.

#### B. Dokument-, Notizbuch- und Seitenverwaltung
- `notebookManager.js`: Editor-UI und Seitenlogik.
- `templateManager.js`: Papier-/Vorlagenlogik.
- `backupManager.js`: Backup/Restore, inklusive Array-/Storage-Migrationen.

#### C. PDF-/Workspace-/Dokumente
- `pdfWorkspace.js`: PDF-Arbeitsbereich und interaktive Dokumentansichten.
- `pdfManager.js`: PDF-Administration und Seiten-/Dokumentfunktionen.
- `ocrManager.js`: OCR-Prozesse.
- `crossLinker.js`: Link-/Mapping- und Annotation-Verknüpfungen.

#### D. Whiteboard-/Canvas-Subsystem
- `whiteboard.js`: State, History, Render-Loop, Board-Lifecycle, Benutzerinteraktionen.
- `whiteboardEngine.js`: Zeichnen, Objekthit-Testing, Grid/Background, Auswahl-/Viewport-Elemente.

#### E. Storage / Sync / Cloud
- `syncManager.js`: Konflikterkennung, Upload/Download, Sync-Queue.
- Dexie/IndexedDB: lokale Datenpersistenz.
- Supabase: Cloud-Synchronisierung und gemeinsame User-/Kooperationsdaten.

### 2.3 Neue Module und Erweiterungen
Die vorhandene Architektur soll durch gezielte Module ergänzt werden, ohne den aktuellen Stack zu wechseln:

#### Central Stylus / Ink layer
- `stylus/PointerInputManager.js`: zentrale Pointer-Event-Erfassung; pointerdown/move/up/cancel; pressure, tilt, twist, width/height; capture.
- `stylus/StylusDetector.js`: Gerät-/Tool-Erkennung (Pen, Touch, Mouse), Palm-Rejection-Filter und aktive Stiftfähigkeit.
- `stylus/InkProcessingEngine.js`: Strichverarbeitung, Druckkurven, Smoothing, Interpolation, Stabilisierung.
- `stylus/PressureEngine.js`: Drucknormalisierung und Druckkurvenprofil.
- `stylus/TiltEngine.js`: tiltX/tiltY/twist-Interpretation.
- `stylus/StrokeSmoother.js`: Glättung und Linienfluss.
- `stylus/StrokeRenderer.js`: Canvas-Darstellung und low-latency rendering.
- `stylus/PalmRejection.js`: Handballenfilterung, Touch-/Pen-Priorisierung.
- `stylus/GestureManager.js`: Two-finger zoom/pan, pinch, pan, selection gestures.
- `stylus/StylusSettings.js`: Werkzeugprofile, Settings/Calibration, Persistenz.
- `stylus/StylusDiagnostics.js`: Geräte- und Pointer-Diagnose.
- `stylus/StrokeModel.js`: Strukturmodell für Strichdaten.
- `stylus/StrokeRepository.js`: lokale Speicherung und Lade-Mechaniken.

#### Whiteboard / board layer
- `whiteboard/WhiteboardManager.js`: Dokument-, Board- und Dokumentzustand.
- `whiteboard/WhiteboardDocument.js`: Dokumentmodell mit Boards und Metadaten.
- `whiteboard/WhiteboardBoard.js`: Board-Zustand, Hintergrund, Viewport, Objekte.
- `whiteboard/WhiteboardCanvas.js`: Reservoir/Viewport-/Canvas-Management.
- `whiteboard/WhiteboardToolbar.js`: Werkzeuge, Toolbar, Einstellungen.
- `whiteboard/WhiteboardSidebar.js`: Board-Seitenleiste, Sortierung, Board-Metadaten.
- `whiteboard/WhiteboardObjects.js`: Formen, Text, Sticky Notes, Bilder, Layer, Selection.
- `whiteboard/WhiteboardLayers.js`: Layer- und Sichtbarkeitslogik.
- `whiteboard/WhiteboardViewport.js`: Pan/Zoom/Center/MiniMap.
- `whiteboard/WhiteboardTransfer.js`: Cut/Copy/Paste/Board-transfer/drag-and-drop.
- `whiteboard/WhiteboardExport.js`: PDF/PNG export; object export.

#### Storage / data layer
- `storage/WhiteboardRepository.js`: Whiteboard-Dokumente/Boards/Objekte.
- `storage/BoardRepository.js`: Board-/Board-Transfer-/Sortierungslogik.
- `storage/StrokeRepository.js`: Strichdatenpersistenz.
- `storage/StorageManager.js`: Dexie-Transaktionen, Migrationslogik, Save/Restore.
- `storage/SyncManager.js`: Supabase-Anbindung und Konflikterkennung.

### 2.4 Datenbank- und Speichermodell
Die bestehenden Dexie-Collections sollten erweitert werden statt komplett ersetzt zu werden.

#### Lokale Datenmodelle
- `whiteboardDocuments`
  - `id`, `title`, `description`, `createdAt`, `updatedAt`, `favorite`, `thumbnail`, `boardIds`, `syncMetadata`
- `whiteboardBoards`
  - `id`, `documentId`, `title`, `order`, `background`, `backgroundPattern`, `viewport`, `createdAt`, `updatedAt`
- `whiteboardObjects`
  - `id`, `boardId`, `documentId`, `type`, `x`, `y`, `width`, `height`, `rotation`, `layerId`, `properties`
- `whiteboardStrokes`
  - `id`, `boardId`, `documentId`, `tool`, `points`, `pressure`, `tiltX`, `tiltY`, `color`, `width`, `opacity`, `createdAt`, `boundingBox`
- `stylusProfiles`
  - `id`, `name`, `toolType`, `color`, `width`, `opacity`, `sensitivity`, `smoothing`, `stabilization`
- `whiteboardHistory`
  - `id`, `boardId`, `documentId`, `undoStack`, `redoStack`, `lastSavedAt`

#### Migration / Datenintegrität
- Versionierung von Dexie-Schema und optionalen Migrationsschritten.
- Fallback für bestehende Datensätze ohne neue Felder: default values + safe normalization.
- Keine Datenkorruption bei alten Notizbüchern; Import/Restore muss robust bei fehlenden `audioRecords`, etc., bleiben.

### 2.5 Schnittstellen und Abhängigkeiten
Die neue gemeinsame Ink/Gesture-Architektur muss mit den bestehenden Modulen kompatibel sein:

- `whiteboard.js` → ruft `PointerInputManager` und `GestureManager` auf.
- `whiteboardEngine.js` → rendert `StrokeRenderer`-Objekte und bildet Layer-/Selection-Modelle ab.
- `notebookManager.js` → nutzt dieselbe Ink-Engine für Stift-/Radierer-/Selector-Workflows im Notizbucheditor.
- `pdfWorkspace.js` und `pdfManager.js` → binden dieselben Pointer-/Ink- und PDF-Annotation-Mechanismen an.
- `syncManager.js` → synchronisiert `whiteboardDocuments`, `whiteboardBoards`, `whiteboardObjects`, `whiteboardStrokes` und profilbezogene Zustände.

### 2.6 Implementierungsstrategie nach Phasen

#### Phase 3 – Design und Whiteboard-Layout
- Goodnotes-Orientierung in CSS-Variablen und Layout.
- Obere Navigationsleiste, Hauptwerkzeugleiste, Floating Controls, Board-Sidebar, responsive UI.
- Kein Umbau des Gesamtsystems, nur Whiteboard-/UI-Integration.

#### Phase 4 – Dokumentverwaltung
- Whiteboard-Dokument- und Board-Modelle als Dokumenttypen im bestehenden Dashboard ergänzen.
- Neue Whiteboard-Dokumente anlegen, Boards erstellen, switchen, sortieren, duplizieren, löschen.
- Vorschaubilder und Board-Liste als lokale State-Struktur speichern.

#### Phase 5 – Canvas-Engine
- Unbegrenztes virtuellen Koordinatensystem.
- Zoom/Pan, Viewport-/World-Transformation, Layer-Stack, Culling, requestAnimationFrame.
- WhiteboardCanvas als zentrale Render-/Viewport-Klasse.

#### Phase 6 – Pointer- und Stifterkennung
- PointerEvent-Verarbeitung und Tool-Erkennung.
- pen/touch/mouse erkennen, pointer capture, coalesced/predicted events.

#### Phase 7 – Ink Engine
- Strichdatenmodell, Druckkurven, Glättung, Stabilisierung, Linienfluss, Rendering.
- Rohdatenbeibehaltung, temporäre Predicted-Points, redraw auf echte Events.

#### Phase 8 – Palm Rejection und Gesten
- Finger navigation vs. pen writing, pinch-to-zoom, pan, palm rejection.

#### Phase 9 – Werkzeuge und Objekte
- Formen, Text, Sticky Notes, Bilder, Layer, Auswahlen, Radierer.

#### Phase 10 – Integration in alle Editoren
- Gemeinsame Ink Engine für Notebook, PDF, Whiteboard.

#### Phase 11 – PDF-Transfer und Board-Transfer
- PDF-Seiten und Inhaltsobjekte zwischen Boards übertragen.

#### Phase 12 – Undo/Redo
- gemeinsame Actions- und History-Grundlage.

#### Phase 13 – IndexedDB und Supabase
- Migrationslogik, offline persistence, sync queue, conflict handling.

#### Phase 14 – Diagnose und Kalibrierung
- pen diagnostics, pressure curves, calibration, render latency tests.

#### Phase 15 – Performance
- Culling, caching, optimization passes, large document tests.

#### Phase 16 – Qualitätssicherung
- Browser-/Gerätekonformität, Pflicht-Checks mit Manual- und Selenium/Playwright-Checklisten.

#### Phase 17 – Abschlussprüfung
- Finaler QA-Lauf, Dokumentation, bekannte Einschränkungen.

### 2.7 Teststrategie
Die Teststrategie soll kleinschrittig und technisch verlässlich sein:

#### Automatisierte Prüfungen
- `node --check` für JavaScript-Syntaxvalidierung.
- Struktur-Tests für Backup-/Restore-Logik.
- Tests für Eingabemodellierung / Drucknormalisierung ohne Browser.
- Jest/Vitest-ähnliche Unit-Tests für StrokeSmoother / PressureEngine / Geometry-Helper.
- Dexie-/Storage-Tests für Migrations- und Restore-Scenarios.

#### Browser-/Geräte-Checks
- Chrome Desktop: Maus/Touch, Canvas-Rendering, undo/redo, board switch.
- iPadOS Safari: Pen input, pressure, palm rejection, pinch/pan.
- Samsung Internet / Android Chrome: pen/touch differentiation, gestures.
- Firefox: graceful fallback on unsupported pointer features.

#### Pflicht-Checkliste
1. Neues Whiteboard erstellen
2. Board erstellen und wechseln
3. Mehrere Boards schreiben und speichern
4. Druckempfindlichkeit und Glättung testen
5. Palm Rejection testen
6. Zoom/Pan testen
7. Formen/Text/Bilder importieren
8. PDF-Import und -Annotationslayer prüfen
9. Inhalte zwischen Boards verschieben
10. Undo/Redo und Restore testen
11. Offline- und Sync-Betrieb prüfen

### 2.8 Risiken und Gegenmaßnahmen
- Risiko: Drei getrennte Ink-Engines entstehen. Gegenmaßnahme: zentrale Stylus-/Pointer-Engine und gemeinsame Integration an alle Editoren.
- Risiko: Board-Modelle und Storage-Daten nicht kompatibel. Gegenmaßnahme: Dexie-Schema-Erweiterungen mit Minimal-Migrationen.
- Risiko: Performance auf großen Dokumenten. Gegenmaßnahme: Viewport-Culling, partial redraw, interne Event-Queues.
- Risiko: Browser- und Hardwareunterschiede. Gegenmaßnahme: graceful fallback und Diagnoseseite mit sauberem Feature-Detection-UI.

### 2.9 Ergebnis der Phase 2
Die App ist nach Analyse und Architektur-Review bereit für die eigentliche Implementierung: erste UI- und Whiteboard-Layout-Phase, danach Board-/Canvas-/Ink-Integrationsschritte. Keine unkontrollierten Änderungen, keine Architektur-Umstellung, keine bestehenden Funktionen zu entfernen.

## Architekturüberblick (Projektbestand)

#### 1) App-Start und UI-Framework
- `index.html`: zentrale Struktur, Design-Assets, CSS-Links, Bibliotheks-Imports (Dexie, Supabase, PDF.js, Tesseract, PDF-lib).
- `app.js`: Dashboard-/Navigation-Logik, „Neu“-Menü, Dokument- und Backup-Import/Export.
- `appInit.js`: Initialisierung von IndexedDB, Service Worker, Cloud-Sync, Flashcards.

#### 2) Dokument-/Notizbuch-Architektur
- `notebookManager.js`: Hauptlogik für Notizbücher, Seiten, Editor-UI, Dokumentaktionen und Seitenmanagement.
- `backupManager.js`: Backup-/Restore-Logik für Notizbücher, Seiten, Flashcards, Audio, PDF-Originale, Sync-Queue.
- `templateManager.js`: Vorlagenlogik für Papier-/Layoutvorlagen.

#### 3) Whiteboard-Architektur (vorhanden, aber noch getrennt)
- `whiteboard.js`: Whiteboard-Zustand, Save-Mechanik, Rendering-Loop, Board-Logik, Text-/Cursor-/Zoom-Interaktionen.
- `whiteboardEngine.js`: Zeichen-/Rendering-Engine, Objekt- und Auswahl-Logik, Hit-Testing, Grid-Rendering, Stroke-/Shape-Draw-Logic.

#### 4) PDF-/OCR-/Dokument-Architektur
- `pdfManager.js`, `pdfWorkspace.js`, `ocrManager.js`: Dokument-/PDF-Integration und OCR.
- `crossLinker.js`: Verknüpfungen zwischen Dokumenten, Quellen und Annotationsdaten.

#### 5) Storage / Sync / Supabase
- IndexedDB über Dexie wird als primäre lokale Datenbank genutzt.
- `syncManager.js` steuert Synchronisierung, Konflikterkennung und Cloud-Operationen.
- Supabase ist bereits in der App vorhanden und wird für das Cloud-/Sync-Modell verwendet.

### Relevante Erkenntnisse für die Integrationsplanung
- Die App ist bereits eine starke Single-Page-Notiz- und Dokumenten-Anwendung mit mehreren Funktionsbuckets.
- Whiteboard ist in der App bereits als eigenständiges Subsystem vorhanden, aber noch nicht als vollständiges dokument-/board-basiertes System nach Goodnotes-Orientierung modelliert.
- Die zentrale Herausforderung ist nicht die UI-Implementierung allein, sondern die gemeinsame Illustrator-/Inking-Engine und die gemeinsame Daten/Board-Architektur über alle Editoren hinweg.
- Die App nutzt bereits Dexie + Supabase und eine Stateful UI-Logik; diese Architektur sollte erhalten bleiben.
- Keine Umstellung auf React/Vue/TS; die bestehende Vanilla-JS/Canvas-Struktur soll weiterverwendet werden.

### Geplanter Integrationsansatz (Phase 2)
1. Bestehende Module klassifizieren und konsolidieren.
2. Eine gemeinsame, zentrale Pointer-/Ink-Engine definieren.
3. Whiteboard-Dokument-/Board-Modelle in Dexie ergänzen bzw. sauber auf das bestehende `whiteboards`-Modell ausrichten.
4. Board-Interaktion und Render-Loop mit Notebook-/PDF-Editor gemeinsam nutzen.
5. Erfolgsprüfung in kleinen Schritten je Phase, ohne bestehende Funktionalität zu verdrängen.

### Geplante betroffene Dateien
- `whiteboard.js`
- `whiteboardEngine.js`
- `notebookManager.js`
- `pdfWorkspace.js`
- `syncManager.js`
- `app.js`
- `appInit.js`
- `index.html`
- evtl. neue Module unter `stylus/` und `whiteboard/` (nur falls die bestehende Struktur dies sinnvoll erfordert)

### Nicht vorgesehen
- Keine komplette Architektur-Umstellung.
- Keine neue Frontend-Stack-Implementierung.
- Keine Änderung der primären lokalen Datenbank-Strategie (IndexedDB/Dexie).
- Keine Entfernung vorhandener Funktionen.
