lucide.createIcons();

const toggleMenuBtn = document.getElementById('toggleMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const newBtn = document.getElementById('newBtn');
const newDropdown = document.getElementById('newDropdown');
const mobileNewBtn = document.getElementById('mobileNewBtn');
const mobileNewDropdown = document.getElementById('mobileNewDropdown');
const notebookModal = document.getElementById('notebookModal');

const newMenuItems = `
    <button class="new-dropdown-item" data-new-action="notebook">
        <i data-lucide="book"></i><span>Notizbuch</span>
    </button>
    <button class="new-dropdown-item" data-new-action="text-document">
        <i data-lucide="file-text"></i><span>Text Document</span><span class="new-dropdown-badge">BETA</span>
    </button>
    <button class="new-dropdown-item" data-new-action="whiteboard">
        <i data-lucide="grid-3x3"></i><span>Whiteboard</span><span class="new-dropdown-badge new-dropdown-badge-new">NEW</span>
    </button>
    <button class="new-dropdown-item" data-new-action="quick-note">
        <i data-lucide="square-pen"></i><span>Schnellnotiz</span>
    </button>
    <button class="new-dropdown-item" data-new-action="image">
        <i data-lucide="image"></i><span>Bild</span>
    </button>
    <button class="new-dropdown-item" data-new-action="folder">
        <i data-lucide="folder"></i><span>Ordner</span>
    </button>
    <div class="new-dropdown-divider"></div>
    <button class="new-dropdown-item" data-new-action="import">
        <i data-lucide="download"></i><span>Import</span>
    </button>
    <div class="new-dropdown-divider"></div>
    <button class="new-dropdown-item new-dropdown-connect" data-new-action="Google Drive freischalten">
        <i data-lucide="hard-drive" class="text-emerald-600"></i><span>Google Drive</span><span class="new-dropdown-badge">BETA</span><span class="connect-label">Freischalten</span>
    </button>
    <button class="new-dropdown-item new-dropdown-connect" data-new-action="OneDrive freischalten">
        <i data-lucide="cloud" class="text-sky-600"></i><span>OneDrive (Persönlich)</span><span class="connect-label">Freischalten</span>
    </button>
    <button class="new-dropdown-item new-dropdown-connect" data-new-action="Dropbox freischalten">
        <i data-lucide="boxes" class="text-blue-600"></i><span>Dropbox</span><span class="connect-label">Freischalten</span>
    </button>
    <button class="new-dropdown-item new-dropdown-connect" data-new-action="Box freischalten">
        <i data-lucide="box" class="text-blue-700"></i><span>Box</span><span class="connect-label">Freischalten</span>
    </button>
`;

document.querySelectorAll('.new-dropdown-items').forEach(menu => {
    menu.innerHTML = newMenuItems;
});
lucide.createIcons();

function toggleMobileSidebar() {
    sidebar.classList.toggle('-translate-x-full');
    sidebarBackdrop.classList.toggle('hidden');
}

if (toggleMenuBtn) toggleMenuBtn.addEventListener('click', toggleMobileSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', toggleMobileSidebar);

function closeNewMenus() {
    [newDropdown, mobileNewDropdown].forEach(menu => {
        if (menu) menu.classList.add('hidden');
    });
    [newBtn, mobileNewBtn].forEach(button => {
        if (button) button.setAttribute('aria-expanded', 'false');
    });
}

function toggleNewMenu(button, menu) {
    const shouldOpen = menu.classList.contains('hidden');
    closeNewMenus();
    if (shouldOpen) {
        menu.classList.remove('hidden');
        button.setAttribute('aria-expanded', 'true');
    }
}

function handleNewButtonClick(event, button, menu) {
    event.stopPropagation();
    toggleNewMenu(button, menu);
}

function handleNewButtonDoubleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    createQuickNote();
}

if (newBtn) {
    newBtn.addEventListener('click', event => handleNewButtonClick(event, newBtn, newDropdown));
    newBtn.addEventListener('dblclick', handleNewButtonDoubleClick);
}
if (mobileNewBtn) {
    mobileNewBtn.addEventListener('click', event => handleNewButtonClick(event, mobileNewBtn, mobileNewDropdown));
    mobileNewBtn.addEventListener('dblclick', handleNewButtonDoubleClick);
}

document.querySelectorAll('.new-dropdown').forEach(menu => {
    menu.addEventListener('click', event => {
        const actionButton = event.target.closest('[data-new-action]');
        if (actionButton) handleNewAction(actionButton.dataset.newAction);
        event.stopPropagation();
    });
});

function handleNewAction(action) {
    closeNewMenus();
    if (action === 'notebook') {
        openNotebookModal();
    } else if (action === 'quick-note') {
        createQuickNote();
    } else {
        alert(`${action[0].toUpperCase()}${action.slice(1)} ist in MyNotes noch nicht verfügbar.`);
    }
}

function createQuickNote() {
    closeNewMenus();
    const quickNote = {
        id: Date.now(),
        title: 'Schnellnotiz',
        template: 'Leer',
        date: new Date().toLocaleDateString('de-DE'),
        content: ''
    };
    notebooks.push(quickNote);
    localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
    loadNotebooksToDashboard();
    openNotebook(quickNote.id);
}

// Globaler Klick-Handler zum Schließen von Dropdowns
window.addEventListener('click', (e) => {
    if (![newBtn, mobileNewBtn, newDropdown, mobileNewDropdown].some(element => element && element.contains(e.target))) {
        closeNewMenus();
    }
    
    const nbMenu = document.getElementById('notebookOptionsMenu');
    const menuBtn = document.getElementById('menuTriggerBtn');
    if (nbMenu && menuBtn && !nbMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        nbMenu.classList.add('hidden');
    }
});

function openNotebookModal() {
    closeNewMenus();
    notebookModal.classList.remove('hidden');
    renderTemplateOptions('gelb');
}

function closeNotebookModal() {
    notebookModal.classList.add('hidden');
}

let selectedTemplate = { name: "Gepunktet" };
let notebooks = JSON.parse(localStorage.getItem('mynotes_notebooks')) || [];

const standardTemplatesData = [
    { name: "Leer" }, { name: "Gepunktet" }, { name: "Liniert" }, { name: "Kariert" }
];

function renderTemplateOptions(colorTheme) {
    const stdContainer = document.getElementById('standardTemplates');
    if (!stdContainer) return;
    stdContainer.innerHTML = '';

    let bgClass = "bg-amber-50";
    if (colorTheme === 'weiss') bgClass = "bg-white";

    standardTemplatesData.forEach(tpl => {
        const isSelected = selectedTemplate.name === tpl.name;
        const card = document.createElement('div');
        card.className = `cursor-pointer p-2 rounded-xl border text-center transition-all ${isSelected ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-100 hover:border-slate-300'}`;
        card.innerHTML = `
            <div class="h-20 ${bgClass} border border-slate-200 rounded-lg shadow-sm mb-1 flex items-center justify-center">
                <span class="text-[9px] text-slate-400">${tpl.name}</span>
            </div>
            <span class="text-xs font-medium text-slate-700">${tpl.name}</span>
        `;
        card.onclick = () => {
            selectedTemplate = tpl;
            renderTemplateOptions(colorTheme);
        };
        stdContainer.appendChild(card);
    });
}

function updatePaperColorFilter() {
    const val = document.getElementById('colorSelect').value;
    renderTemplateOptions(val);
}

function createNotebook() {
    const titleInput = document.getElementById('nbTitle');
    const title = titleInput ? titleInput.value : 'Unbenanntes Notizbuch';
    const newNb = {
        id: Date.now(),
        title: title,
        template: selectedTemplate.name,
        date: new Date().toLocaleDateString('de-DE'),
        content: ''
    };

    notebooks.push(newNb);
    localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));

    closeNotebookModal();
    loadNotebooksToDashboard();
}

// Öffnet das Notizbuch im Editor mit dem exakten Goodnotes-Dreipunkt-Menü
function openNotebook(id) {
    const nb = notebooks.find(item => item.id === id);
    if (!nb) return;

    const mobileHeader = document.querySelector('.md\\:hidden.bg-white');
    if (mobileHeader) mobileHeader.classList.add('hidden');

    let paperPatternClass = "";
    if (nb.template === "Gepunktet") paperPatternClass = "paper-dotted";
    if (nb.template === "Liniert") paperPatternClass = "paper-lined";
    if (nb.template === "Kariert") paperPatternClass = "paper-grid";

    const mainContainer = document.querySelector('main');
    mainContainer.innerHTML = `
        <div class="flex flex-col h-full w-full bg-slate-300 overflow-hidden relative">
            
            <!-- 1. Obere Blaue Hauptleiste -->
            <header class="h-12 bg-[#2b59a2] text-white px-3 flex items-center justify-between shrink-0 z-30 shadow-sm select-none">
                <div class="flex items-center gap-2 md:gap-3">
                    <button onclick="location.reload()" class="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Zurück">
                        <i data-lucide="home" class="w-5 h-5"></i>
                    </button>
                    <button class="p-1.5 hover:bg-white/10 rounded-lg">
                        <i data-lucide="panel-left" class="w-5 h-5"></i>
                    </button>
                    <button class="p-1.5 hover:bg-white/10 rounded-lg text-amber-300">
                        <i data-lucide="sparkles" class="w-5 h-5"></i>
                    </button>
                </div>

                <div class="flex items-center gap-1 md:gap-2">
                    <button class="p-1.5 hover:bg-white/10 rounded-lg"><i data-lucide="lasso" class="w-5 h-5"></i></button>
                    <button class="p-1.5 bg-white/20 rounded-xl"><i data-lucide="pen-tool" class="w-5 h-5"></i></button>
                    <button class="p-1.5 hover:bg-white/10 rounded-lg"><i data-lucide="eraser" class="w-5 h-5"></i></button>
                    <button class="p-1.5 hover:bg-white/10 rounded-lg"><i data-lucide="type" class="w-5 h-5"></i></button>
                    <button class="p-1.5 hover:bg-white/10 rounded-lg"><i data-lucide="mic" class="w-5 h-5"></i></button>
                </div>

                <!-- Rechte Aktionen & Drei-Punkte-Menü -->
                <div class="flex items-center gap-1 md:gap-2 relative">
                    <button onclick="saveNotebookContent(${nb.id})" class="p-1.5 hover:bg-white/10 rounded-lg" title="Speichern"><i data-lucide="file-plus" class="w-5 h-5"></i></button>
                    <button class="p-1.5 hover:bg-white/10 rounded-lg"><i data-lucide="upload" class="w-5 h-5"></i></button>
                    
                    <!-- Trigger Button -->
                    <button id="menuTriggerBtn" onclick="toggleNotebookMenu(event)" ontouchend="toggleNotebookMenu(event)" class="p-1.5 hover:bg-white/10 rounded-lg relative">
                        <i data-lucide="more-horizontal" class="w-5 h-5"></i>
                    </button>

                    <!-- Das Goodnotes-Original-Menü (Standardmäßig ausgeblendet) -->
                    <div id="notebookOptionsMenu" class="hidden absolute right-0 top-12 w-72 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 select-none text-xs max-h-[80vh] overflow-y-auto">
                        
                        <!-- Header / Titel -->
                        <div class="px-4 py-2.5 font-bold text-slate-800 border-b border-slate-100 truncate">
                            ${nb.title}
                        </div>

                        <!-- Suchen / Nur lesen -->
                        <div class="grid grid-cols-2 border-b border-slate-100 py-1 text-center">
                            <button onclick="alert('Suche-Funktion'); closeMenu();" class="py-2 hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700 border-r border-slate-100">
                                <i data-lucide="search" class="w-4 h-4"></i> Suchen
                            </button>
                            <button onclick="alert('Nur-Lesen Modus'); closeMenu();" class="py-2 hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700">
                                <i data-lucide="book-open" class="w-4 h-4"></i> Nur lesen
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
                            Seite 1
                        </div>
                        <div class="py-1 border-b border-slate-100">
                            <button onclick="alert('Lesezeichen hinzugefügt'); closeMenu();" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="bookmark" class="w-4 h-4 text-slate-500"></i> Lesezeichen hinzufügen
                            </button>
                            <button onclick="alert('Seite kopiert'); closeMenu();" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="copy" class="w-4 h-4 text-slate-500"></i> Seite kopieren
                            </button>
                            <button onclick="alert('Seite dupliziert'); closeMenu();" class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
                                <i data-lucide="files" class="w-4 h-4 text-slate-500"></i> Seite duplizieren
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
                            <button onclick="saveNotebookContent(${nb.id})" class="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 text-slate-700 font-medium">
                                <i data-lucide="save" class="w-4 h-4 text-blue-600"></i> Notizen speichern
                            </button>
                        </div>

                    </div>
                </div>
            </header>

            <!-- 2. Weiße Schwebende Werkzeugleiste (Floating Bar) -->
            <div class="py-1.5 px-2 flex justify-center z-20 shrink-0 bg-slate-300/50">
                <div class="bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/80 px-3 py-1.5 flex items-center gap-2 md:gap-4 overflow-x-auto max-w-full">
                    <div class="flex items-center gap-1 border-r border-slate-200 pr-2">
                        <button class="p-1 text-slate-400 hover:text-slate-700"><i data-lucide="undo-2" class="w-4 h-4"></i></button>
                        <button class="p-1 text-slate-400 hover:text-slate-700"><i data-lucide="redo-2" class="w-4 h-4"></i></button>
                    </div>

                    <div class="flex items-center gap-1 md:gap-2">
                        <button class="p-1.5 bg-blue-50 text-blue-600 rounded-xl font-bold"><i data-lucide="pen-tool" class="w-4 h-4"></i></button>
                        <button class="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                        <button class="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"><i data-lucide="highlighter" class="w-4 h-4"></i></button>
                        <button class="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"><i data-lucide="sticky-note" class="w-4 h-4"></i></button>
                        <button class="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"><i data-lucide="shapes" class="w-4 h-4"></i></button>
                    </div>

                    <div class="h-4 w-px bg-slate-200"></div>

                    <div class="flex items-center gap-2">
                        <button class="p-1 text-slate-600 hover:bg-slate-100 rounded"><i data-lucide="sliders" class="w-4 h-4"></i></button>
                        <button class="w-5 h-5 rounded-full bg-black ring-2 ring-slate-300"></button>
                        <button class="w-5 h-5 rounded-full bg-blue-500"></button>
                        <button class="w-5 h-5 rounded-full bg-white border border-slate-300"></button>
                    </div>
                </div>
            </div>

            <!-- 3. Haupt-Arbeitsbereich -->
            <div class="flex-1 overflow-y-auto p-3 md:p-6 flex justify-center items-start">
                <div class="w-full max-w-xl md:max-w-2xl bg-amber-50/60 min-h-[75vh] md:min-h-[85vh] shadow-2xl rounded-sm p-6 md:p-12 border border-slate-300 relative transition-all ${paperPatternClass}">
                    <textarea id="notebookContent" class="w-full h-full min-h-[70vh] resize-none bg-transparent border-none focus:outline-none text-slate-800 leading-relaxed font-sans text-sm md:text-base z-10" placeholder="Schreibe hier deine Notizen...">${nb.content || ''}</textarea>
                </div>
            </div>

            <!-- 4. Seitenzahl-Pille unten links -->
            <div class="absolute bottom-3 left-3 z-20 bg-white/90 backdrop-blur border border-slate-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-slate-600 shadow-sm">
                1 von 1
            </div>

        </div>
    `;
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
    if (menu) menu.classList.add('hidden');
}

// Notizbuch umbenennen
function renameNotebookPrompt(id) {
    closeMenu();
    const nb = notebooks.find(item => item.id === id);
    if (!nb) return;
    const newTitle = prompt("Neuer Name für das Notizbuch:", nb.title);
    if (newTitle && newTitle.trim() !== "") {
        notebooks = notebooks.map(item => {
            if (item.id === id) item.title = newTitle.trim();
            return item;
        });
        localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
        openNotebook(id);
    }
}

// Seite leeren
function clearNotebookContent(id) {
    closeMenu();
    if (confirm("Möchtest du diese Seite wirklich leeren?")) {
        const textarea = document.getElementById('notebookContent');
        if (textarea) textarea.value = '';
        saveNotebookContent(id);
    }
}

// Notizbuch löschen
function deleteNotebook(id) {
    closeMenu();
    if (confirm("Möchtest du dieses Notizbuch wirklich in den Papierkorb verschieben?")) {
        notebooks = notebooks.filter(item => item.id !== id);
        localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
        location.reload();
    }
}

function saveNotebookContent(id) {
    closeMenu();
    const contentElement = document.getElementById('notebookContent');
    if (!contentElement) return;
    
    const content = contentElement.value;
    notebooks = notebooks.map(nb => {
        if (nb.id === id) nb.content = content;
        return nb;
    });
    localStorage.setItem('mynotes_notebooks', JSON.stringify(notebooks));
    alert('Notizen erfolgreich gespeichert!');
}

function loadNotebooksToDashboard() {
    const section = document.getElementById('userNotebooksSection');
    const list = document.getElementById('notebooksList');
    
    if (!section || !list) return;

    if (notebooks.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    list.innerHTML = '';

    notebooks.forEach(nb => {
        const card = document.createElement('div');
        card.className = "bg-white border border-slate-200 rounded-xl md:rounded-2xl p-2.5 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between";
        card.onclick = () => openNotebook(nb.id);
        card.innerHTML = `
            <div class="h-24 md:h-32 bg-amber-50 border border-amber-200/60 rounded-lg md:rounded-xl shadow-sm mb-2 p-2 flex flex-col justify-between">
                <span class="text-[8px] md:text-[10px] font-bold text-amber-900/60 uppercase">MyNotes</span>
                <span class="text-xs font-semibold text-slate-700 truncate">${nb.title}</span>
            </div>
            <div>
                <h4 class="text-xs font-bold text-slate-800 truncate">${nb.title}</h4>
                <p class="text-[9px] md:text-[10px] text-slate-400">${nb.template}</p>
            </div>
        `;
        list.appendChild(card);
    });
}

loadNotebooksToDashboard();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker erfolgreich registriert:', reg))
            .catch(err => console.log('Service Worker Fehler:', err));
    });
}
