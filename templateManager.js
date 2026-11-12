// Notebook creation and template selection
const coverOptions = [
    { name: "Einfach", className: "cover-simple" },
    { name: "Leinen", className: "cover-linen" },
    { name: "Leder", className: "cover-leather" },
    { name: "Dunkel", className: "cover-dark" }
];

function getCoverClass(coverName) {
    return coverOptions.find(option => option.name === coverName)?.className || 'cover-simple';
}

const templateGroups = [
    {
        name: "Herkömmlich",
        templates: [
            { name: "Leer", pattern: "" },
            { name: "Gepunktet", pattern: "paper-dotted" },
            { name: "Liniert schmal", pattern: "paper-lined-narrow" },
            { name: "Liniert breit", pattern: "paper-lined" },
            { name: "Kariert", pattern: "paper-grid" }
        ]
    },
    {
        name: "Schreibpapier",
        templates: [
            { name: "Cornell", pattern: "paper-cornell" },
            { name: "Notizblock", pattern: "paper-notepad" },
            { name: "Eine Spalte", pattern: "paper-column" },
            { name: "Eine Spalte gemischt", pattern: "paper-mixed" },
            { name: "Drei Spalten", pattern: "paper-three-columns" }
        ]
    },
    {
        name: "Planung",
        templates: [
            { name: "Buchhaltung", pattern: "paper-accounting" },
            { name: "Monatsplaner", pattern: "paper-month" },
            { name: "Wochenplaner", pattern: "paper-week" },
            { name: "Tagesplaner", pattern: "paper-day" },
            { name: "Monatsplaner C", pattern: "paper-month-dark" }
        ]
    },
    {
        name: "Musik",
        templates: [
            { name: "Noten für Gitarre", pattern: "paper-guitar" },
            { name: "Notenblatt", pattern: "paper-music" },
            { name: "Tabs für Gitarre", pattern: "paper-tabs" }
        ]
    }
];

function getPaperColor() {
    const color = document.getElementById('colorSelect')?.value || 'alle';
    return ['weiss', 'creme', 'sepia', 'dunkel'].includes(color) ? color : 'gelb';
}

function renderCoverOptions() {
    const container = document.getElementById('coverOptions');
    if (!container) return;
    container.innerHTML = '';
    coverOptions.forEach(cover => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `cover-choice ${selectedCover === cover.name ? 'is-selected' : ''}`;
        button.setAttribute('aria-pressed', String(selectedCover === cover.name));
        button.innerHTML = `<span class="cover-swatch ${cover.className}"></span><span>${cover.name}</span>`;
        button.addEventListener('click', () => {
            selectedCover = cover.name;
            renderCoverOptions();
            updateSelectedPaperPreview();
        });
        container.appendChild(button);
    });
}

function renderTemplateOptions() {
    const gallery = document.getElementById('templateGallery');
    if (!gallery) return;
    const paperColor = getPaperColor();
    const scrollTop = gallery.scrollTop;
    const rowScrollPositions = [...gallery.querySelectorAll('.template-row')].map(row => row.scrollLeft);
    gallery.innerHTML = '';

    templateGroups.forEach(group => {
        const section = document.createElement('section');
        section.className = 'template-group';
        section.innerHTML = `<h2 class="template-group-title"><span aria-hidden="true">▾</span>${group.name}</h2>`;
        const row = document.createElement('div');
        row.className = 'template-row';

        group.templates.forEach(template => {
            const isSelected = selectedTemplate.name === template.name;
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `template-choice ${isSelected ? 'is-selected' : ''}`;
            card.setAttribute('aria-pressed', String(isSelected));
            const pageShape = selectedOrientation === 'landscape' ? 'is-landscape' : '';
            card.innerHTML = `
                <span class="template-thumb paper-color-${paperColor} ${template.pattern} ${pageShape}"></span>
                <span class="template-choice-name">${template.name}</span>
            `;
            card.addEventListener('click', () => {
                selectedTemplate = template;
                renderTemplateOptions();
            });
            row.appendChild(card);
        });

        section.appendChild(row);
        gallery.appendChild(section);
    });

    gallery.scrollTop = scrollTop;
    gallery.querySelectorAll('.template-row').forEach((row, index) => {
        row.scrollLeft = rowScrollPositions[index] || 0;
    });
    updateSelectedPaperPreview();
}

function updateSelectedPaperPreview() {
    const preview = document.getElementById('selectedPaperPreview');
    const name = document.getElementById('selectedPaperName');
    if (!preview || !name) return;
    const orientationClass = selectedOrientation === 'landscape' ? 'is-landscape' : '';
    preview.className = `paper-preview paper-color-${getPaperColor()} ${selectedTemplate.pattern || ''} ${orientationClass}`;
    preview.dataset.coverClass = coverOptions.find(option => option.name === selectedCover)?.className || 'cover-simple';
    name.textContent = selectedTemplate.name;
}

function updatePaperColorFilter() {
    renderTemplateOptions();
}

function createNotebook() {
    const titleInput = document.getElementById('nbTitle');
    const title = titleInput?.value.trim() || 'Unbenanntes Notizbuch';
    const newNb = {
        id: Date.now(),
        title: title,
        template: selectedTemplate.name,
        pattern: selectedTemplate.pattern,
        paperColor: getPaperColor(),
        cover: selectedCover,
        pageSize: document.getElementById('pageSizeSelect').value,
        language: document.getElementById('languageSelect').value,
        orientation: selectedOrientation,
        pages: [{
            content: '',
            drawing: '',
            shapes: [],
            pattern: selectedTemplate.pattern,
            paperColor: getPaperColor(),
            pageSize: document.getElementById('pageSizeSelect').value,
            orientation: selectedOrientation
        }],
        date: new Date().toLocaleDateString('de-DE'),
        content: '',
        folderName: activeDashboardFilter === 'folder' ? activeDashboardFolder : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    notebooks.push(newNb);
    saveNotebookMetadata(newNb.id);

    closeNotebookModal();
    loadNotebooksToDashboard();
}

document.querySelectorAll('.orientation-button').forEach(button => {
    button.addEventListener('click', () => {
        selectedOrientation = button.dataset.orientation;
        document.querySelectorAll('.orientation-button').forEach(option => {
            const isSelected = option === button;
            option.classList.toggle('is-selected', isSelected);
            option.setAttribute('aria-pressed', String(isSelected));
        });
        renderTemplateOptions();
    });
});

// Öffnet das Notizbuch im Editor mit dem exakten Goodnotes-Dreipunkt-Menü
