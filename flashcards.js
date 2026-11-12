const DAY = 24 * 60 * 60 * 1000;
const BOX_INTERVALS = [1, 3, 7, 14, 30];

export function getFlashcardReviewSchedule(box, rating, now = Date.now()) {
    const currentBox = Math.min(5, Math.max(1, Number(box) || 1));
    if (rating === 'again') {
        return { box: 1, dueAt: new Date(now + 10 * 60 * 1000).toISOString() };
    }

    const nextBox = rating === 'easy'
        ? Math.min(5, currentBox + 2)
        : rating === 'good'
            ? Math.min(5, currentBox + 1)
            : currentBox;
    const days = rating === 'hard' ? 1 : BOX_INTERVALS[nextBox - 1];
    return { box: nextBox, dueAt: new Date(now + days * DAY).toISOString() };
}

function createId() {
    return globalThis.crypto?.randomUUID?.()
        || `card-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function attachFlashcardManager({ db, onError = console.error, onChange = () => {} }) {
    if (!db?.flashcardDecks || !db?.flashcards) {
        throw new Error('Die Lernkarten-Datenbanktabellen fehlen.');
    }

    const modal = document.getElementById('flashcardsModal');
    const status = document.getElementById('flashcardStatus');
    const deckList = document.getElementById('flashcardDeckList');
    const deckForm = document.getElementById('flashcardDeckForm');
    const deckName = document.getElementById('flashcardDeckName');
    const cardForm = document.getElementById('flashcardForm');
    const cardFront = document.getElementById('flashcardFront');
    const cardBack = document.getElementById('flashcardBack');
    const cardList = document.getElementById('flashcardCardList');
    const dueCount = document.getElementById('flashcardDueCount');
    const reviewCard = document.getElementById('flashcardReviewCard');
    const reviewText = document.getElementById('flashcardReviewText');
    const sideLabel = document.getElementById('flashcardSideLabel');
    const showAnswerButton = document.getElementById('flashcardShowAnswer');
    const ratings = document.getElementById('flashcardRatings');
    const studyStart = document.getElementById('flashcardStudyStart');
    const closeButton = document.getElementById('flashcardsClose');
    const openButton = document.getElementById('flashcardsNav');
    const editor = document.getElementById('flashcardEditor');
    let activeDeckId = null;
    let studyQueue = [];
    let showingAnswer = false;

    const reportError = error => {
        onError(error);
        status.textContent = `Fehler: ${error.message || 'Lernkarten konnten nicht gespeichert werden.'}`;
    };

    async function renderDecks() {
        const decks = await db.flashcardDecks.toArray();
        if (!decks.length) {
            const id = createId();
            const now = new Date().toISOString();
            const defaultDeck = { id, name: 'Allgemein', createdAt: now, updatedAt: now };
            await db.flashcardDecks.add(defaultDeck);
            decks.push(defaultDeck);
            onChange();
        }
        if (!decks.some(deck => deck.id === activeDeckId)) activeDeckId = decks[0].id;
        const cards = (await db.flashcards.toArray()).filter(card => !card.deletedAt);
        const counts = cards.length;
        const deckCounts = new Map();
        cards.forEach(card => deckCounts.set(card.deckId, (deckCounts.get(card.deckId) || 0) + 1));
        deckList.replaceChildren();
        decks.sort((a, b) => a.name.localeCompare(b.name, 'de')).forEach(deck => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'flashcard-deck-button';
            button.classList.toggle('is-active', deck.id === activeDeckId);
            button.setAttribute('aria-pressed', String(deck.id === activeDeckId));
            const name = document.createElement('span');
            name.textContent = deck.name;
            const count = document.createElement('span');
            count.textContent = String(deckCounts.get(deck.id) || 0);
            button.append(name, count);
            button.addEventListener('click', async () => {
                activeDeckId = deck.id;
                await refresh();
            });
            deckList.append(button);
        });
        cardForm.querySelector('button[type="submit"]').disabled = !activeDeckId;
        status.textContent = `${counts} ${counts === 1 ? 'Karte' : 'Karten'} in deiner lokalen Sammlung.`;
    }

    async function renderCards() {
        const cards = (await db.flashcards.where('deckId').equals(activeDeckId).sortBy('createdAt'))
            .filter(card => !card.deletedAt);
        cardList.replaceChildren();
        if (!cards.length) {
            const empty = document.createElement('p');
            empty.className = 'flashcard-empty';
            empty.textContent = 'Noch keine Karten in diesem Stapel.';
            cardList.append(empty);
            return;
        }
        cards.forEach(card => {
            const row = document.createElement('article');
            row.className = 'flashcard-list-item';
            const title = document.createElement('span');
            title.textContent = card.front;
            const due = document.createElement('small');
            const dueDate = new Date(card.dueAt);
            due.textContent = Number.isNaN(dueDate.getTime())
                ? 'Fälligkeit unbekannt'
                : dueDate.getTime() <= Date.now()
                    ? 'Fällig'
                    : `Fällig am ${dueDate.toLocaleDateString('de-DE')}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Löschen';
            remove.setAttribute('aria-label', `Karte löschen: ${card.front.slice(0, 60)}`);
            remove.addEventListener('click', async () => {
                try {
                    const now = new Date().toISOString();
                    await db.flashcards.update(card.id, { deletedAt: now, updatedAt: now });
                    onChange();
                    await refresh();
                } catch (error) {
                    reportError(error);
                }
            });
            row.append(title, due, remove);
            cardList.append(row);
        });
    }

    async function updateDueCount() {
        const now = new Date().toISOString();
        const dueCards = await db.flashcards
            .where('deckId').equals(activeDeckId)
            .and(card => !card.deletedAt && (!card.dueAt || card.dueAt <= now))
            .count();
        dueCount.textContent = `${dueCards} ${dueCards === 1 ? 'Karte ist' : 'Karten sind'} fällig.`;
        studyStart.disabled = dueCards === 0;
    }

    async function refresh() {
        await renderDecks();
        await renderCards();
        await updateDueCount();
    }

    function renderCurrentReview() {
        const card = studyQueue[0];
        if (!card) {
            reviewCard.classList.add('hidden');
            status.textContent = 'Diese Wiederholungssitzung ist abgeschlossen.';
            return;
        }
        reviewCard.classList.remove('hidden');
        ratings.classList.add('hidden');
        showAnswerButton.classList.remove('hidden');
        showingAnswer = false;
        sideLabel.textContent = 'Vorderseite';
        reviewText.textContent = card.front;
    }

    async function startStudy() {
        const now = new Date().toISOString();
        studyQueue = await db.flashcards
            .where('deckId').equals(activeDeckId)
            .and(card => !card.deletedAt && (!card.dueAt || card.dueAt <= now))
            .sortBy('dueAt');
        if (!studyQueue.length) {
            status.textContent = 'In diesem Stapel sind keine Karten fällig.';
            return;
        }
        status.textContent = `${studyQueue.length} fällige Karten in dieser Sitzung.`;
        renderCurrentReview();
    }

    openButton?.addEventListener('click', async () => {
        modal.classList.remove('hidden');
        editor.classList.remove('hidden');
        document.getElementById('flashcardStudy').classList.remove('hidden');
        reviewCard.classList.add('hidden');
        studyQueue = [];
        try {
            await refresh();
        } catch (error) {
            reportError(error);
        }
    });

    const close = () => modal.classList.add('hidden');
    closeButton.addEventListener('click', close);
    modal.addEventListener('click', event => {
        if (event.target === modal) close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) close();
    });

    deckForm.addEventListener('submit', async event => {
        event.preventDefault();
        const name = deckName.value.trim();
        if (!name) return;
        try {
            const id = createId();
            const now = new Date().toISOString();
            await db.flashcardDecks.add({ id, name, createdAt: now, updatedAt: now });
            onChange();
            deckName.value = '';
            activeDeckId = id;
            await refresh();
            cardFront.focus();
        } catch (error) {
            reportError(error);
        }
    });

    cardForm.addEventListener('submit', async event => {
        event.preventDefault();
        const front = cardFront.value.trim();
        const back = cardBack.value.trim();
        if (!front || !back || !activeDeckId) return;
        const now = new Date().toISOString();
        try {
            await db.flashcards.add({
                id: createId(),
                deckId: activeDeckId,
                front,
                back,
                box: 1,
                dueAt: now,
                createdAt: now,
                updatedAt: now,
                reviewCount: 0
            });
            onChange();
            cardFront.value = '';
            cardBack.value = '';
            await refresh();
            cardFront.focus();
        } catch (error) {
            reportError(error);
        }
    });

    studyStart.addEventListener('click', async () => {
        try {
            await startStudy();
        } catch (error) {
            reportError(error);
        }
    });

    showAnswerButton.addEventListener('click', () => {
        const card = studyQueue[0];
        if (!card) return;
        showingAnswer = true;
        sideLabel.textContent = 'Rückseite';
        reviewText.textContent = card.back;
        showAnswerButton.classList.add('hidden');
        ratings.classList.remove('hidden');
    });

    ratings.addEventListener('click', async event => {
        const button = event.target.closest('[data-rating]');
        const card = studyQueue[0];
        if (!button || !card || !showingAnswer) return;
        try {
            const schedule = getFlashcardReviewSchedule(card.box, button.dataset.rating);
            await db.flashcards.update(card.id, {
                ...schedule,
                reviewCount: (card.reviewCount || 0) + 1,
                updatedAt: new Date().toISOString(),
                lastRating: button.dataset.rating
            });
            onChange();
            studyQueue.shift();
            renderCurrentReview();
            await updateDueCount();
            await renderCards();
        } catch (error) {
            reportError(error);
        }
    });
}
