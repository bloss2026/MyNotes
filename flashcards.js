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

export function attachFlashcardManager({ db, onError = console.error, onChange = () => {} }) {
    if (!db?.flashcardDecks || !db?.flashcards) {
        throw new Error('Die Lernkarten-Datenbanktabellen fehlen.');
    }

    const modal = document.getElementById('flashcardsModal');
    const status = document.getElementById('flashcardStatus');
    const cardList = document.getElementById('flashcardCardList');
    const topicList = document.getElementById('flashcardTopicList');
    const topicStudy = document.getElementById('flashcardTopicStudy');
    const studyTopic = document.getElementById('flashcardStudyTopic');
    const studyCounter = document.getElementById('flashcardStudyCounter');
    const reviewCard = document.getElementById('flashcardReviewCard');
    const question = document.getElementById('flashcardQuestion');
    const answer = document.getElementById('flashcardAnswer');
    const sideLabel = document.getElementById('flashcardSideLabel');
    const showAnswerButton = document.getElementById('flashcardShowAnswer');
    const ratings = document.getElementById('flashcardRatings');
    const previousButton = document.getElementById('flashcardPreviousCard');
    const nextButton = document.getElementById('flashcardNextCard');
    const backToTopicsButton = document.getElementById('flashcardBackToTopics');
    const deleteButton = document.getElementById('flashcardDeleteCurrent');
    const closeButton = document.getElementById('flashcardsClose');
    const openButton = document.getElementById('flashcardsNav');
    let topicGroups = new Map();
    let activeTopicKey = null;
    let activeCards = [];
    let activeCardIndex = 0;
    let showingAnswer = false;

    const reportError = error => {
        onError(error);
        status.textContent = `Fehler: ${error.message || 'Lernkarten konnten nicht gespeichert werden.'}`;
    };

    function sourceGroupKey(card) {
        if (card.sourceGroupId) return String(card.sourceGroupId);
        const sourceId = String(card.sourceId || '');
        const lastSeparator = sourceId.lastIndexOf(':');
        return lastSeparator > sourceId.indexOf(':')
            ? sourceId.slice(0, lastSeparator)
            : sourceId || `deck:${card.deckId || 'unassigned'}`;
    }

    function formatTopicTitle(title) {
        return String(title || '')
            .replace(/\.pdf$/i, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async function renderTopics() {
        const cards = (await db.flashcards.toArray())
            .filter(card => !card.deletedAt)
            .sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')));
        const [decks, pdfOriginals] = await Promise.all([
            db.flashcardDecks.toArray(),
            db.pdfOriginals?.toArray() || Promise.resolve([])
        ]);
        const deckNames = new Map(decks.map(deck => [String(deck.id), deck.name]));
        const pdfNames = new Map(pdfOriginals.map(pdf => [String(pdf.notebookId), pdf.fileName || pdf.title || '']));
        topicGroups = new Map();

        cards.forEach(card => {
            const key = sourceGroupKey(card);
            let group = topicGroups.get(key);
            if (!group) {
                const sourceParts = key.split(':');
                const documentId = sourceParts[0] === 'pdf-workspace' ? sourceParts.slice(1).join(':') : '';
                const title = formatTopicTitle(card.sourceTitle) ||
                    formatTopicTitle(pdfNames.get(documentId)) ||
                    (deckNames.get(String(card.deckId)) !== 'Allgemein' ? deckNames.get(String(card.deckId)) : '') ||
                    'Meine Lernkarten';
                group = { title, cards: [] };
                topicGroups.set(key, group);
            }
            group.cards.push(card);
        });
        topicGroups.forEach(group => {
            group.cards.sort((first, second) => {
                const byDate = String(first.createdAt || '').localeCompare(String(second.createdAt || ''));
                return byDate || (Number(first.position) || 0) - (Number(second.position) || 0);
            });
        });

        cardList.replaceChildren();
        status.textContent = `${cards.length} gespeicherte ${cards.length === 1 ? 'Lernkarte' : 'Lernkarten'} in ${topicGroups.size} ${topicGroups.size === 1 ? 'Thema' : 'Themen'}.`;
        if (!cards.length) {
            const empty = document.createElement('p');
            empty.className = 'flashcard-empty';
            empty.textContent = 'Hier erscheinen Themen, sobald du Lernkarten speicherst.';
            cardList.append(empty);
            return;
        }

        topicGroups.forEach((group, key) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'flashcard-topic-button';
            button.setAttribute('aria-label', `${group.title}, ${group.cards.length} ${group.cards.length === 1 ? 'Lernkarte' : 'Lernkarten'}`);
            const title = document.createElement('strong');
            title.textContent = group.title;
            const count = document.createElement('span');
            count.className = 'flashcard-topic-count';
            count.textContent = String(group.cards.length);
            button.append(title, count);
            button.addEventListener('click', () => openTopic(key));
            cardList.append(button);
        });
    }

    function renderCurrentCard() {
        const card = activeCards[activeCardIndex];
        if (!card) return;
        reviewCard.hidden = false;
        studyTopic.textContent = topicGroups.get(activeTopicKey)?.title || 'Lernkarten';
        studyCounter.textContent = `Karte ${activeCardIndex + 1} von ${activeCards.length}`;
        question.textContent = card.front;
        answer.textContent = card.back;
        answer.hidden = true;
        sideLabel.textContent = 'Vorderseite';
        showAnswerButton.hidden = false;
        ratings.classList.add('hidden');
        previousButton.disabled = activeCardIndex === 0;
        nextButton.textContent = activeCardIndex === activeCards.length - 1 ? 'Thema beenden' : 'Nächste Karte';
        showingAnswer = false;
    }

    function openTopic(key) {
        const group = topicGroups.get(key);
        if (!group) return;
        activeTopicKey = key;
        activeCards = [...group.cards];
        activeCardIndex = 0;
        topicList.hidden = true;
        topicStudy.hidden = false;
        status.textContent = `Thema „${group.title}“: ${activeCards.length} ${activeCards.length === 1 ? 'Lernkarte' : 'Lernkarten'}.`;
        renderCurrentCard();
    }

    async function showTopics() {
        activeTopicKey = null;
        activeCards = [];
        activeCardIndex = 0;
        topicStudy.hidden = true;
        topicList.hidden = false;
        await renderTopics();
    }

    async function advanceCard() {
        if (activeCardIndex + 1 < activeCards.length) {
            activeCardIndex += 1;
            renderCurrentCard();
            return;
        }
        status.textContent = `Thema „${topicGroups.get(activeTopicKey)?.title || 'Lernkarten'}“ abgeschlossen.`;
        await showTopics();
    }

    async function deleteCurrentCard() {
        const card = activeCards[activeCardIndex];
        if (!card) return;
        try {
            const now = new Date().toISOString();
            await db.flashcards.update(card.id, { deletedAt: now, updatedAt: now });
            onChange();
            activeCards.splice(activeCardIndex, 1);
            if (!activeCards.length) {
                await showTopics();
                return;
            }
            if (activeCardIndex >= activeCards.length) activeCardIndex -= 1;
            await renderTopics();
            renderCurrentCard();
        } catch (error) {
            reportError(error);
        }
    }

    async function rateCurrentCard(rating) {
        const card = activeCards[activeCardIndex];
        if (!card || !showingAnswer) return;
        try {
            const schedule = getFlashcardReviewSchedule(card.box, rating);
            await db.flashcards.update(card.id, {
                ...schedule,
                reviewCount: (card.reviewCount || 0) + 1,
                updatedAt: new Date().toISOString(),
                lastRating: rating
            });
            Object.assign(card, schedule, {
                reviewCount: (card.reviewCount || 0) + 1,
                lastRating: rating
            });
            onChange();
            await renderTopics();
            await advanceCard();
        } catch (error) {
            reportError(error);
        }
    }

    async function refresh() {
        await renderTopics();
    }

    openButton?.addEventListener('click', async () => {
        modal.classList.remove('hidden');
        topicStudy.hidden = true;
        topicList.hidden = false;
        activeTopicKey = null;
        activeCards = [];
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

    showAnswerButton.addEventListener('click', () => {
        const card = activeCards[activeCardIndex];
        if (!card) return;
        showingAnswer = true;
        answer.hidden = false;
        sideLabel.textContent = 'Rückseite';
        showAnswerButton.hidden = true;
        ratings.classList.remove('hidden');
    });

    previousButton.addEventListener('click', () => {
        if (activeCardIndex === 0) return;
        activeCardIndex -= 1;
        renderCurrentCard();
    });

    nextButton.addEventListener('click', () => {
        advanceCard().catch(reportError);
    });
    backToTopicsButton.addEventListener('click', () => {
        showTopics().catch(reportError);
    });
    deleteButton.addEventListener('click', deleteCurrentCard);
    ratings.addEventListener('click', event => {
        const button = event.target.closest('[data-rating]');
        if (button) rateCurrentCard(button.dataset.rating);
    });
}
