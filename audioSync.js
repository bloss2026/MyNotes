// Audio recording, local storage, and note timeline synchronization
let audioRecorder = null;
let audioStream = null;
let audioChunks = [];
let audioContext = null;
let audioTimelineEvents = [];
let audioRecordingStartPage = 0;
let audioTimelineStartTime = 0;
let audioFallbackStartTime = 0;
let audioPauseStartedAt = null;
let audioPausedDuration = 0;

function openAudioDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('mynotes-audio', 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('recordings', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Audiodatenbank konnte nicht geöffnet werden.'));
    });
}

async function saveAudioRecording(blob, metadata) {
    const database = await openAudioDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction('recordings', 'readwrite');
        transaction.objectStore('recordings').put({
            id: `${currentNotebookId}-${Date.now()}`,
            notebookId: currentNotebookId,
            createdAt: new Date().toISOString(),
            pageIndex: metadata.pageIndex,
            duration: metadata.duration,
            events: metadata.events,
            blob
        });
        transaction.oncomplete = () => {
            database.close();
            resolve();
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error('Aufnahme konnte nicht gespeichert werden.'));
        };
    });
}

function getAudioTimelineTime() {
    if (audioContext && Number.isFinite(audioContext.currentTime)) {
        return Math.max(0, audioContext.currentTime - audioTimelineStartTime);
    }
    const now = audioPauseStartedAt === null ? performance.now() : audioPauseStartedAt;
    return Math.max(0, (now - audioFallbackStartTime - audioPausedDuration) / 1000);
}

function recordAudioNoteEvent(kind, shapeId = null) {
    if (audioRecorder?.state !== 'recording') return;
    const time = getAudioTimelineTime();
    const previous = audioTimelineEvents[audioTimelineEvents.length - 1];
    if (kind === 'text' && previous?.kind === 'text' &&
        previous.pageIndex === currentPageIndex && time - previous.time < 0.75) return;
    audioTimelineEvents.push({
        time,
        pageIndex: currentPageIndex,
        kind,
        ...(shapeId ? { shapeId } : {})
    });
}

function updateAudioRecordingStatus(message) {
    const status = document.getElementById('recordingStatus');
    if (status) status.textContent = message;
    const pauseButton = document.querySelector('[data-editor-action="pause-recording"]');
    if (pauseButton) {
        pauseButton.disabled = !audioRecorder || audioRecorder.state === 'inactive';
        pauseButton.textContent = audioRecorder?.state === 'paused' ? 'Aufnahme fortsetzen' : 'Aufnahme pausieren';
        pauseButton.setAttribute('aria-label', pauseButton.textContent);
    }
    document.getElementById('recordingStatus')?.classList.toggle('is-recording', audioRecorder?.state === 'recording');
}

async function startAudioRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        alert('Audioaufnahmen werden von diesem Browser nicht unterstützt.');
        return;
    }

    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        audioTimelineEvents = [];
        audioRecordingStartPage = currentPageIndex;
        audioPausedDuration = 0;
        audioPauseStartedAt = null;
        audioFallbackStartTime = performance.now();
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (AudioContextConstructor) {
            try {
                audioContext = new AudioContextConstructor();
                await audioContext.resume();
                if (audioContext.state !== 'running') {
                    await audioContext.close();
                    audioContext = null;
                    console.warn('AudioContext ist nicht aktiv; Schreibzeitpunkte nutzen die Browser-Uhr.');
                }
            } catch (error) {
                console.warn('AudioContext nicht verfügbar; Schreibzeitpunkte nutzen die Browser-Uhr:', error);
                const failedContext = audioContext;
                audioContext = null;
                if (failedContext && failedContext.state !== 'closed') {
                    try {
                        await failedContext.close();
                    } catch (closeError) {
                        console.error('Nicht verwendbarer Audiozeitgeber konnte nicht geschlossen werden:', closeError);
                    }
                }
            }
        }
        audioRecorder = new MediaRecorder(audioStream);
        audioRecorder.addEventListener('dataavailable', event => {
            if (event.data.size) audioChunks.push(event.data);
        });
        audioRecorder.addEventListener('stop', async () => {
            audioStream?.getTracks().forEach(track => track.stop());
            audioStream = null;
            const recorder = audioRecorder;
            const recording = new Blob(audioChunks, { type: recorder?.mimeType || 'audio/webm' });
            const metadata = {
                pageIndex: audioRecordingStartPage,
                duration: getAudioTimelineTime(),
                events: audioTimelineEvents.map(event => ({ ...event }))
            };
            audioRecorder = null;
            updateAudioRecordingStatus('Aufnahme wird gespeichert');
            if (audioContext && audioContext.state !== 'closed') {
                try {
                    await audioContext.close();
                } catch (error) {
                    console.error('Audiozeitgeber konnte nicht geschlossen werden:', error);
                }
            }
            audioContext = null;
            if (!recording.size) {
                updateAudioRecordingStatus('Bereit');
                return;
            }
            try {
                await saveAudioRecording(recording, metadata);
                updateAudioRecordingStatus('Aufnahme gespeichert');
            } catch (error) {
                console.error('Aufnahme konnte nicht gespeichert werden:', error);
                alert('Die Audioaufnahme konnte nicht gespeichert werden.');
                updateAudioRecordingStatus('Speichern fehlgeschlagen');
            } finally {
                audioTimelineEvents = [];
            }
        }, { once: true });
        audioRecorder.start();
        audioTimelineStartTime = audioContext?.currentTime || 0;
        updateAudioRecordingStatus(`Aufnahme läuft · Seite ${currentPageIndex + 1}`);
    } catch (error) {
        audioStream?.getTracks().forEach(track => track.stop());
        audioStream = null;
        audioRecorder = null;
        if (audioContext && audioContext.state !== 'closed') {
            try {
                await audioContext.close();
            } catch (closeError) {
                console.error('Audiozeitgeber konnte nach dem Aufnahmefehler nicht geschlossen werden:', closeError);
            }
        }
        audioContext = null;
        console.error('Mikrofonzugriff fehlgeschlagen:', error);
        alert('Mikrofonzugriff nicht möglich. Bitte erlaube den Mikrofonzugriff im Browser.');
    }
}

async function toggleAudioRecordingPause() {
    if (!audioRecorder) return;
    try {
        if (audioRecorder.state === 'recording') {
            audioRecorder.pause();
            audioPauseStartedAt = performance.now();
            if (audioContext?.state === 'running') await audioContext.suspend();
            updateAudioRecordingStatus('Aufnahme pausiert');
        } else if (audioRecorder.state === 'paused') {
            if (audioContext?.state === 'suspended') await audioContext.resume();
            if (audioPauseStartedAt !== null) {
                audioPausedDuration += performance.now() - audioPauseStartedAt;
                audioPauseStartedAt = null;
            }
            audioRecorder.resume();
            updateAudioRecordingStatus(`Aufnahme läuft · Seite ${currentPageIndex + 1}`);
        }
    } catch (error) {
        console.error('Aufnahme konnte nicht pausiert oder fortgesetzt werden:', error);
        alert('Die Aufnahme konnte nicht geändert werden.');
    }
}

function stopAudioRecording() {
    if (audioRecorder && audioRecorder.state !== 'inactive') audioRecorder.stop();
}

async function deleteAudioRecording(id) {
    const database = await openAudioDatabase();
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction('recordings', 'readwrite');
            transaction.objectStore('recordings').delete(id);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('Aufnahme konnte nicht gelöscht werden.'));
        });
    } finally {
        database.close();
    }
}

async function showAudioRecordings() {
    const list = document.getElementById('recordingsList');
    const panel = document.getElementById('recordingsPanel');
    if (!list || !panel) return;
    list.replaceChildren();

    try {
        const database = await openAudioDatabase();
        const records = await new Promise((resolve, reject) => {
            const request = database.transaction('recordings', 'readonly').objectStore('recordings').getAll();
            request.onsuccess = () => resolve(request.result.filter(item => item.notebookId === currentNotebookId));
            request.onerror = () => reject(request.error || new Error('Aufnahmen konnten nicht geladen werden.'));
        });
        database.close();
        records.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
        if (!records.length) {
            list.textContent = 'Noch keine Aufnahmen vorhanden.';
        } else {
            records.forEach(record => {
                const item = document.createElement('div');
                item.className = 'recording-item';
                const date = document.createElement('p');
                date.textContent = `${new Date(record.createdAt).toLocaleString('de-DE')} · Seite ${(Number(record.pageIndex) || 0) + 1}`;
                const player = document.createElement('audio');
                player.controls = true;
                player.preload = 'metadata';
                const recordingUrl = URL.createObjectURL(record.blob);
                player.src = recordingUrl;
                const timelineStatus = document.createElement('p');
                timelineStatus.className = 'recording-timeline-status';
                timelineStatus.textContent = (record.events || []).length
                    ? 'Schreibereignisse werden beim Abspielen angezeigt.'
                    : 'Für diese Aufnahme sind keine Schreibereignisse gespeichert.';
                let lastEventIndex = -1;
                const events = Array.isArray(record.events)
                    ? record.events.filter(event => Number.isFinite(event.time)).sort((first, second) => first.time - second.time)
                    : [];
                player.addEventListener('timeupdate', () => {
                    let eventIndex = -1;
                    events.forEach((event, index) => {
                        if (event.time <= player.currentTime) eventIndex = index;
                    });
                    if (eventIndex < 0 || eventIndex === lastEventIndex) return;
                    lastEventIndex = eventIndex;
                    const event = events[eventIndex];
                    const eventPageIndex = Number.isInteger(event.pageIndex)
                        ? event.pageIndex
                        : Number(record.pageIndex) || 0;
                    const eventLabel = event.kind === 'text'
                        ? 'Textnotiz'
                        : event.kind === 'textbox'
                            ? 'Textfeld'
                            : event.kind === 'erase'
                                ? 'Radieren'
                                : 'Zeichnung';
                    timelineStatus.textContent = `Seite ${eventPageIndex + 1} · ${eventLabel}`;
                    if (String(record.notebookId) === String(currentNotebookId) &&
                        eventPageIndex >= 0 && eventPageIndex < getNotebookPages(
                            notebooks.find(notebook => String(notebook.id) === String(currentNotebookId)) || { pages: [] }
                        ).length && eventPageIndex !== currentPageIndex) {
                        showNotebookPage(eventPageIndex);
                    }
                    document.querySelectorAll('.audio-sync-highlight').forEach(element => element.classList.remove('audio-sync-highlight'));
                    const target = event.shapeId
                        ? [...document.querySelectorAll('#notebookShapes [data-shape-id]')].find(element => element.dataset.shapeId === event.shapeId)
                        : document.getElementById('notebookContent');
                    target?.classList.add('audio-sync-highlight');
                });
                player.addEventListener('ended', () => {
                    document.querySelectorAll('.audio-sync-highlight').forEach(element => element.classList.remove('audio-sync-highlight'));
                });
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'recording-delete-button';
                deleteButton.textContent = 'Aufnahme löschen';
                deleteButton.addEventListener('click', async () => {
                    if (!confirm('Diese Audioaufnahme wirklich löschen?')) return;
                    try {
                        await deleteAudioRecording(record.id);
                        player.pause();
                        URL.revokeObjectURL(recordingUrl);
                        item.remove();
                        if (!list.children.length) list.textContent = 'Noch keine Aufnahmen vorhanden.';
                    } catch (error) {
                        console.error('Aufnahme konnte nicht gelöscht werden:', error);
                        alert('Die Audioaufnahme konnte nicht gelöscht werden.');
                    }
                });
                item.append(date, player, timelineStatus, deleteButton);
                list.appendChild(item);
            });
        }
        panel.classList.add('is-open');
    } catch (error) {
        console.error('Aufnahmen konnten nicht geladen werden:', error);
        alert('Die gespeicherten Aufnahmen konnten nicht geladen werden.');
    }
}
