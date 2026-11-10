
(() => {
"use strict";

const $ = id => document.getElementById(id);
const STORAGE_KEY = "mynotes_notebooks";

let notebooks = [];
let selectedTemplate = { name: "Gepunktet" };
let currentNotebookId = null;
let editorMode = "text";
let history = [];
let historyIndex = -1;
let historyTimer = null;

const standardTemplatesData = [
  { name: "Leer" },
  { name: "Gepunktet" },
  { name: "Liniert" },
  { name: "Kariert" }
];

function safeLoad() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Ladefehler:", err);
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(notebooks)
    );
    return true;
  } catch (err) {
    console.error("Speicherfehler:", err);
    alert("Speichern nicht möglich. Gerätespeicher prüfen.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function refreshIcons(root = document) {
  if (window.lucide &&
      typeof window.lucide.createIcons === "function") {
    try {
      window.lucide.createIcons();
    } catch (error) {
      console.warn("Icons konnten nicht geladen werden:", error);
    }
  }
}

/* INITIALISIERUNG */

function init() {
  notebooks = safeLoad();

  refreshIcons();

  $("toggleMenuBtn")?.addEventListener(
    "click",
    toggleMobileSidebar
  );

  $("sidebarBackdrop")?.addEventListener(
    "click",
    toggleMobileSidebar
  );

  $("newBtn")?.addEventListener("click", event => {
    event.stopPropagation();
    $("newDropdown")?.classList.toggle("hidden");
  });

  document.addEventListener("click", handleDocumentClick);

  $("notebookModal")?.addEventListener("click", event => {
    if (event.target === $("notebookModal")) {
      closeNotebookModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeNotebookModal();
      closeMenu();
      $("newDropdown")?.classList.add("hidden");
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "s" &&
      currentNotebookId !== null
    ) {
      event.preventDefault();
      saveNotebookContent(currentNotebookId);
    }
  });

  loadNotebooksToDashboard();
}

function handleDocumentClick(event) {
  const dropdown = $("newDropdown");
  const newButton = $("newBtn");

  if (
    dropdown &&
    !dropdown.contains(event.target) &&
    !newButton?.contains(event.target)
  ) {
    dropdown.classList.add("hidden");
  }

  const menu = $("notebookOptionsMenu");
  const trigger = $("menuTriggerBtn");

  if (
    menu &&
    !menu.contains(event.target) &&
    !trigger?.contains(event.target)
  ) {
    menu.classList.add("hidden");
  }
}

function toggleMobileSidebar() {
  $("sidebar")?.classList.toggle("-translate-x-full");
  $("sidebarBackdrop")?.classList.toggle("hidden");
}

/* NOTIZBUCH-MODAL */

function openNotebookModal() {
  $("newDropdown")?.classList.add("hidden");

  const modal = $("notebookModal");
  if (!modal) return;

  modal.classList.remove("hidden");

  renderTemplateOptions(
    $("colorSelect")?.value || "gelb"
  );
}

function closeNotebookModal() {
  $("notebookModal")?.classList.add("hidden");
}

function renderTemplateOptions(colorTheme) {
  const container = $("standardTemplates");
  if (!container) return;

  container.innerHTML = "";

  const paperClass =
    colorTheme === "weiss"
      ? "bg-white"
      : "bg-amber-50";

  standardTemplatesData.forEach(template => {
    const selected =
      selectedTemplate.name === template.name;

    const card = document.createElement("button");

    card.type = "button";

    card.className =
      `cursor-pointer p-2 rounded-xl border text-center
      transition-all ${
        selected
          ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20"
          : "border-slate-100 hover:border-slate-300"
      }`;

    card.setAttribute("aria-pressed", String(selected));

    card.innerHTML = `
      <div class="h-20 ${paperClass}
        border border-slate-200 rounded-lg shadow-sm
        mb-1 flex items-center justify-center">
        <span class="text-[9px] text-slate-400">
          ${escapeHTML(template.name)}
        </span>
      </div>

      <span class="text-xs font-medium text-slate-700">
        ${escapeHTML(template.name)}
      </span>
    `;

    card.addEventListener("click", () => {
      selectedTemplate = template;
      renderTemplateOptions(colorTheme);
    });

    container.appendChild(card);
  });
}

function updatePaperColorFilter() {
  renderTemplateOptions(
    $("colorSelect")?.value || "gelb"
  );
}

/* NOTIZBUCH ERSTELLEN */

function createNotebook() {
  const title =
    ($("nbTitle")?.value ||
      "Unbenanntes Notizbuch").trim() ||
    "Unbenanntes Notizbuch";

  const notebook = {
    id: Date.now(),
    title: title,
    template: selectedTemplate.name,
    date: new Date().toLocaleDateString("de-DE"),
    content: ""
  };

  notebooks.push(notebook);

  if (!persist()) return;

  closeNotebookModal();
  loadNotebooksToDashboard();
  openNotebook(notebook.id);
}

/* DASHBOARD */

function loadNotebooksToDashboard() {
  const section = $("userNotebooksSection");
  const list = $("notebooksList");

  if (!section || !list) return;

  if (notebooks.length === 0) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  list.innerHTML = "";

  notebooks.forEach(nb => {
    const card = document.createElement("button");

    card.type = "button";

    card.className =
      "text-left bg-white border border-slate-200 " +
      "rounded-xl md:rounded-2xl p-2.5 " +
      "hover:shadow-md transition-all cursor-pointer " +
      "flex flex-col justify-between";

    card.innerHTML = `
      <div class="h-24 md:h-32 bg-amber-50
        border border-amber-200/60 rounded-lg
        md:rounded-xl shadow-sm mb-2 p-2
        flex flex-col justify-between">

        <span class="text-[8px] md:text-[10px]
          font-bold text-amber-900/60 uppercase">
          MyNotes
        </span>

        <span class="text-xs font-semibold
          text-slate-700 truncate">
          ${escapeHTML(nb.title)}
        </span>
      </div>

      <div>
        <h4 class="text-xs font-bold
          text-slate-800 truncate">
          ${escapeHTML(nb.title)}
        </h4>

        <p class="text-[9px] md:text-[10px]
          text-slate-400">
          ${escapeHTML(nb.template || "Leer")}
        </p>
      </div>
    `;

    card.addEventListener("click", () => {
      openNotebook(nb.id);
    });

    list.appendChild(card);
  });
}

/* EDITOR ÖFFNEN */

function openNotebook(id) {
  const nb = notebooks.find(
    item => String(item.id) === String(id)
  );

  if (!nb) return;

  currentNotebookId = nb.id;
  editorMode = "text";

  history = [String(nb.content || "")];
  historyIndex = 0;

  document.querySelector(
    ".md\\:hidden.bg-white"
  )?.classList.add("hidden");

  const pattern = {
    "Gepunktet": "paper-dotted",
    "Liniert": "paper-lined",
    "Kariert": "paper-grid"
  }[nb.template] || "";

  const main = document.querySelector("main");
  if (!main) return;

  main.innerHTML = `
    <div class="flex flex-col h-full w-full
      bg-slate-300 overflow-hidden relative">

      <header class="h-12 bg-[#2b59a2]
        text-white px-3 flex items-center
        justify-between shrink-0 z-30 shadow-sm">

        <div class="flex items-center gap-2">

          <button data-action="home"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Zurück">
            <i data-lucide="home" class="w-5 h-5"></i>
          </button>

          <button data-action="toggle-sidebar"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Navigation">
            <i data-lucide="panel-left" class="w-5 h-5"></i>
          </button>

          <span class="text-xs font-semibold truncate
            max-w-[100px] md:max-w-xs">
            ${escapeHTML(nb.title)}
          </span>
        </div>

        <div class="flex items-center gap-1">

          <button data-tool="lasso"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Auswahl">
            <i data-lucide="mouse-pointer-2"
              class="w-5 h-5"></i>
          </button>

          <button data-tool="pen"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Schreibmodus">
            <i data-lucide="pen-tool"
              class="w-5 h-5"></i>
          </button>

          <button data-tool="eraser"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Radierer">
            <i data-lucide="eraser"
              class="w-5 h-5"></i>
          </button>

          <button data-tool="text"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Text bearbeiten">
            <i data-lucide="type"
              class="w-5 h-5"></i>
          </button>
        </div>

        <div class="flex items-center gap-1 relative">

          <button data-action="save"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Speichern">
            <i data-lucide="save" class="w-5 h-5"></i>
          </button>

          <button data-action="export"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Exportieren">
            <i data-lucide="download"
              class="w-5 h-5"></i>
          </button>

          <button id="menuTriggerBtn"
            data-action="toggle-menu"
            class="p-1.5 hover:bg-white/10 rounded-lg"
            title="Weitere Optionen">
            <i data-lucide="more-horizontal"
              class="w-5 h-5"></i>
          </button>

          <div id="notebookOptionsMenu"
            class="hidden absolute right-0 top-12
            w-64 bg-white text-slate-800
            rounded-2xl shadow-2xl border
            border-slate-200 py-2 z-50">

            <div class="px-4 py-2 border-b
              border-slate-100 font-bold text-xs">
              ${escapeHTML(nb.title)}
            </div>

            <button data-action="save"
              class="menu-item">
              <i data-lucide="save"></i>
              Notizen speichern
            </button>

            <button data-action="rename"
              class="menu-item">
              <i data-lucide="edit-3"></i>
              Umbenennen
            </button>

            <button data-action="import"
              class="menu-item">
              <i data-lucide="file-up"></i>
              Textdatei importieren
            </button>

            <div class="border-t border-slate-100 my-1"></div>

            <button data-action="delete"
              class="menu-item text-red-600">
              <i data-lucide="trash-2"></i>
              In den Papierkorb
            </button>
          </div>
        </div>
      </header>

      <div class="py-1.5 px-2 flex justify-center
        z-20 shrink-0 bg-slate-300/50">

        <div class="bg-white/95 rounded-2xl
          shadow-md border border-slate-200
          px-3 py-1.5 flex items-center gap-2
          overflow-x-auto max-w-full">

          <div class="flex items-center gap-1
            border-r border-slate-200 pr-2">

            <button data-action="undo"
              class="tool-button" title="Rückgängig">
              <i data-lucide="undo-2"></i>
            </button>

            <button data-action="redo"
              class="tool-button" title="Wiederholen">
              <i data-lucide="redo-2"></i>
            </button>
          </div>

          <div class="flex items-center gap-1">

            <button data-tool="pen"
              class="tool-button" title="Schreiben">
              <i data-lucide="pen-tool"></i>
            </button>

            <button data-tool="text"
              class="tool-button" title="Text">
              <i data-lucide="type"></i>
            </button>

            <button data-action="highlight"
              class="tool-button" title="Hervorheben">
              <i data-lucide="highlighter"></i>
            </button>

            <button data-action="sticky"
              class="tool-button" title="Textnotiz">
              <i data-lucide="sticky-note"></i>
            </button>

            <button data-action="shape"
              class="tool-button" title="Form einfügen">
              <i data-lucide="shapes"></i>
            </button>
          </div>

          <div class="h-4 w-px bg-slate-200"></div>

          <div class="flex items-center gap-2">

            <button data-action="font-size"
              class="tool-button font-bold"
              title="Schriftgröße">
              A±
            </button>

            <button data-color="#111827"
              class="w-5 h-5 rounded-full bg-black"
              title="Schwarz"></button>

            <button data-color="#2563eb"
              class="w-5 h-5 rounded-full bg-blue-600"
              title="Blau"></button>

            <button data-color="#dc2626"
              class="w-5 h-5 rounded-full bg-red-600"
              title="Rot"></button>
          </div>
        </div>
      </div>

      <div id="editorStatus"
        class="px-3 text-center text-[10px]
        text-slate-600 shrink-0"
        aria-live="polite">
        Textmodus – Notizen werden lokal gespeichert.
      </div>

      <div class="flex-1 overflow-y-auto
        p-3 md:p-6 flex justify-center items-start">

        <div class="w-full max-w-xl md:max-w-2xl
          bg-amber-50/60 min-h-[75vh]
          md:min-h-[85vh] shadow-2xl rounded-sm
          p-6 md:p-12 border border-slate-300
          relative ${pattern}">

          <textarea id="notebookContent"
            spellcheck="true"
            class="w-full h-full min-h-[70vh]
            resize-none bg-transparent border-none
            focus:outline-none text-slate-800
            leading-relaxed font-sans text-sm
            md:text-base"
            placeholder="Schreibe hier deine Notizen...">${escapeHTML(nb.content || "")}</textarea>
        </div>
      </div>

      <div class="absolute bottom-3 left-3 z-20
        bg-white/90 border border-slate-200
        px-2.5 py-0.5 rounded-full
        text-[11px] text-slate-600 shadow-sm">
        Seite 1 von 1
      </div>

      <input id="importFileInput"
        type="file"
        accept=".txt,.md,.csv,text/plain"
        class="hidden">
    </div>
  `;

  $("notebookContent")?.addEventListener(
    "input",
    scheduleHistory
  );

  $("importFileInput")?.addEventListener(
    "change",
    importTextFile
  );

  refreshIcons(main);
}

/* EDITOR STATUS */

function status(message) {
  const element = $("editorStatus");
  if (element) element.textContent = message;
}

/* RÜCKGÄNGIG / WIEDERHOLEN */

function scheduleHistory() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(pushHistory, 350);
}

function pushHistory() {
  const value = $("notebookContent")?.value ?? "";

  if (history[historyIndex] === value) return;

  history = history.slice(0, historyIndex + 1);
  history.push(value);

  if (history.length > 80) {
    history.shift();
  }

  historyIndex = history.length - 1;
}

function restoreHistory(index) {
  pushHistory();

  const next = Math.max(
    0,
    Math.min(history.length - 1, index)
  );

  historyIndex = next;

  const area = $("notebookContent");

  if (area) {
    area.value = history[historyIndex] || "";
  }

  status("Änderung wiederhergestellt.");
}

/* TEXTBEARBEITUNG */

function wrapSelection(before, after = before) {
  const area = $("notebookContent");
  if (!area) return;

  const start = area.selectionStart;
  const end = area.selectionEnd;

  if (start === end) {
    status("Bitte zuerst Text markieren.");
    area.focus();
    return;
  }

  const selected = area.value.slice(start, end);

  area.setRangeText(
    before + selected + after,
    start,
    end,
    "select"
  );

  area.dispatchEvent(
    new Event("input", { bubbles: true })
  );

  area.focus();
}

function insertAtCursor(text) {
  const area = $("notebookContent");
  if (!area) return;

  const start = area.selectionStart;
  const end = area.selectionEnd;

  area.setRangeText(
    text,
    start,
    end,
    "end"
  );

  area.dispatchEvent(
    new Event("input", { bubbles: true })
  );

  area.focus();
}

/* WERKZEUGE */

function setTool(tool) {
  editorMode = tool;

  document.querySelectorAll("[data-tool]").forEach(btn => {
    const active = btn.dataset.tool === tool;

    btn.classList.toggle("bg-blue-100", active);
    btn.classList.toggle("text-blue-700", active);
  });

  const messages = {
    pen: "Schreibmodus ausgewählt.",
    text: "Textmodus ausgewählt.",
    eraser: "Radierer: Markiere Text und entferne die Hervorhebungszeichen.",
    lasso: "Auswahlmodus: Markiere Text mit Finger oder Cursor."
  };

  status(messages[tool] || "Werkzeug ausgewählt.");

  $("notebookContent")?.focus();
}

/* SPEICHERN */

function saveNotebookContent(id = currentNotebookId) {
  const area = $("notebookContent");

  const nb = notebooks.find(
    item => String(item.id) === String(id)
  );

  if (!nb || !area) return;

  nb.content = area.value;

  if (persist()) {
    status("Notizen erfolgreich gespeichert.");
  }
}

/* MENÜ */

function toggleNotebookMenu(event) {
  event?.stopPropagation();

  $("notebookOptionsMenu")?.classList.toggle("hidden");
}

function closeMenu() {
  $("notebookOptionsMenu")?.classList.add("hidden");
}

/* UMBENENNEN */

function renameNotebookPrompt(id = currentNotebookId) {
  closeMenu();

  const nb = notebooks.find(
    item => String(item.id) === String(id)
  );

  if (!nb) return;

  const newTitle = prompt(
    "Neuer Name für das Notizbuch:",
    nb.title
  );

  if (newTitle && newTitle.trim()) {
    nb.title = newTitle.trim();

    persist();
    openNotebook(nb.id);
  }
}

/* LÖSCHEN */

function deleteNotebook(id = currentNotebookId) {
  closeMenu();

  if (!confirm(
    "Möchtest du dieses Notizbuch wirklich in den Papierkorb verschieben?"
  )) return;

  notebooks = notebooks.filter(
    item => String(item.id) !== String(id)
  );

  persist();

  currentNotebookId = null;
  location.reload();
}

/* EXPORTIEREN */

function exportNotebook() {
  const nb = notebooks.find(
    item => String(item.id) === String(currentNotebookId)
  );

  const content = $("notebookContent")?.value ?? "";

  if (!nb) return;

  nb.content = content;
  persist();

  const blob = new Blob(
    [content],
    { type: "text/plain;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;

  link.download =
    (nb.title || "Notizen")
      .replace(/[\\/:*?"<>|]/g, "_") + ".txt";

  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  status("Textdatei wurde exportiert.");
}

/* IMPORTIEREN */

function importTextFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    const area = $("notebookContent");

    if (area) {
      area.value = String(reader.result || "");
      pushHistory();
      status("Datei importiert. Bitte speichern.");
    }
  };

  reader.onerror = () => {
    status("Datei konnte nicht gelesen werden.");
  };

  reader.readAsText(file);
  event.target.value = "";
}

/* BUTTON-AKTIONEN */

function handleEditorAction(action) {
  switch (action) {

    case "home":
      saveNotebookContent();
      location.reload();
      break;

    case "toggle-sidebar":
      status("Zurück zum Dashboard über die Home-Schaltfläche.");
      break;

    case "toggle-menu":
      toggleNotebookMenu();
      break;

    case "save":
      saveNotebookContent();
      closeMenu();
      break;

    case "rename":
      renameNotebookPrompt();
      break;

    case "delete":
      deleteNotebook();
      break;

    case "undo":
      restoreHistory(historyIndex - 1);
      break;

    case "redo":
      restoreHistory(historyIndex + 1);
      break;

    case "highlight":
      wrapSelection("==");
      status("Textmarkierung eingefügt.");
      break;

    case "sticky":
      insertAtCursor("\n[Notiz: ] ");
      status("Textnotiz eingefügt.");
      break;

    case "shape":
      insertAtCursor("\n[ □ ] ");
      status("Form-Platzhalter eingefügt.");
      break;

    case "font-size": {
      const area = $("notebookContent");

      if (area) {
        const current =
          parseFloat(getComputedStyle(area).fontSize) || 16;

        area.style.fontSize =
          (current >= 22 ? 14 : current + 2) + "px";

        status("Schriftgröße angepasst.");
      }
      break;
    }

    case "export":
      exportNotebook();
      break;

    case "import":
      closeMenu();
      $("importFileInput")?.click();
      break;
  }
}

/* ZENTRALER BUTTON-HANDLER */

document.addEventListener("click", event => {

  const actionButton = event.target.closest("[data-action]");

  if (actionButton) {
    event.preventDefault();
    handleEditorAction(actionButton.dataset.action);
    return;
  }

  const toolButton = event.target.closest("[data-tool]");

  if (toolButton) {
    event.preventDefault();
    setTool(toolButton.dataset.tool);
    return;
  }

  const colorButton = event.target.closest("[data-color]");

  if (colorButton) {
    const area = $("notebookContent");

    if (area) {
      area.style.color = colorButton.dataset.color;
      area.focus();

      status("Textfarbe geändert.");
    }
  }
});

/* KOMPATIBILITÄT MIT INDEX.HTML */

window.openNotebookModal = openNotebookModal;
window.closeNotebookModal = closeNotebookModal;
window.createNotebook = createNotebook;
window.updatePaperColorFilter = updatePaperColorFilter;
window.toggleNotebookMenu = toggleNotebookMenu;
window.closeMenu = closeMenu;
window.renameNotebookPrompt = renameNotebookPrompt;
window.deleteNotebook = deleteNotebook;
window.saveNotebookContent = saveNotebookContent;

/* START */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

})();
