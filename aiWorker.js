const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

const MODELS = {
    text: {
        task: 'text-generation',
        id: 'onnx-community/Qwen2.5-0.5B-Instruct',
        webgpuDtype: 'q4f16',
        wasmDtype: 'q8'
    },
    embeddings: {
        task: 'feature-extraction',
        id: 'Xenova/all-MiniLM-L6-v2',
        webgpuDtype: 'q8',
        wasmDtype: 'q8'
    },
    image: {
        task: 'image-to-text',
        id: 'Xenova/trocr-small-handwritten',
        webgpuDtype: 'q8',
        wasmDtype: 'q8'
    },
    speech: {
        task: 'automatic-speech-recognition',
        id: 'Xenova/whisper-tiny',
        webgpuDtype: 'q8',
        wasmDtype: 'q8'
    }
};

let transformersPromise;
const pipelines = new Map();
let activeRequestId = null;

async function getTransformers() {
    if (!transformersPromise) {
        transformersPromise = import(TRANSFORMERS_URL).then(module => {
            module.env.useBrowserCache = true;
            module.env.useWasmCache = true;
            module.env.allowRemoteModels = true;
            module.env.backends.onnx.wasm.numThreads = Math.min(
                4,
                Math.max(1, (navigator.hardwareConcurrency || 2) - 1)
            );
            return module;
        });
    }
    return transformersPromise;
}

function reportProgress(modelKey, info) {
    if (activeRequestId === null) return;
    self.postMessage({
        id: activeRequestId,
        type: 'progress',
        modelKey,
        progress: Number(info?.progress) || 0,
        loaded: Number(info?.loaded) || 0,
        total: Number(info?.total) || 0,
        status: String(info?.status || ''),
        file: String(info?.file || '')
    });
}

async function chooseDevice() {
    if (!navigator.gpu?.requestAdapter) return 'wasm';
    try {
        return await navigator.gpu.requestAdapter() ? 'webgpu' : 'wasm';
    } catch {
        return 'wasm';
    }
}

async function getPipeline(modelKey) {
    if (pipelines.has(modelKey)) return pipelines.get(modelKey);
    const model = MODELS[modelKey];
    if (!model) throw new Error('Unbekannter lokaler KI-Modelltyp.');

    const { pipeline } = await getTransformers();
    const preferredDevice = await chooseDevice();
    let activeDevice = preferredDevice;
    const create = device => pipeline(model.task, model.id, {
        device,
        dtype: device === 'webgpu' ? model.webgpuDtype : model.wasmDtype,
        progress_callback: info => reportProgress(modelKey, info)
    });

    let instance;
    try {
        instance = await create(preferredDevice);
    } catch (error) {
        if (preferredDevice !== 'webgpu') throw error;
        activeDevice = 'wasm';
        console.warn('WebGPU konnte das lokale Modell nicht initialisieren; verwende WASM.', error);
        self.postMessage({
            id: activeRequestId,
            type: 'backend',
            backend: 'wasm',
            message: 'WebGPU konnte dieses Modell nicht initialisieren; wechsle auf WASM.'
        });
        instance = await create('wasm');
    }

    pipelines.set(modelKey, instance);
    self.postMessage({
        id: activeRequestId,
        type: 'backend',
        backend: activeDevice,
        message: activeDevice === 'webgpu' ? 'WebGPU aktiv.' : 'WASM aktiv.'
    });
    return instance;
}

async function generateText(prompt, maxNewTokens) {
    const { TextStreamer } = await getTransformers();
    const model = await getPipeline('text');
    const chatPrompt = [
        '<|im_start|>system',
        'Du bist ein sorgfältiger deutschsprachiger Lernassistent. Antworte klar und knapp. Verwende nur Informationen aus dem Material.',
        '<|im_end|>',
        '<|im_start|>user',
        prompt,
        '<|im_end|>',
        '<|im_start|>assistant'
    ].join('\n');
    const streamer = new TextStreamer(model.tokenizer, {
        skip_prompt: true,
        callback_function: text => {
            if (activeRequestId !== null && text) {
                self.postMessage({ id: activeRequestId, type: 'token', text });
            }
        }
    });
    const output = await model(chatPrompt, {
        max_new_tokens: maxNewTokens,
        do_sample: false,
        repetition_penalty: 1.1,
        no_repeat_ngram_size: 3,
        streamer
    });
    const result = Array.isArray(output) ? output[0] : output;
    const generated = String(result?.generated_text || '').trim();
    const text = generated.startsWith(chatPrompt)
        ? generated.slice(chatPrompt.length).trim()
        : generated;
    return { text };
}

async function embedText(text) {
    const model = await getPipeline('embeddings');
    const output = await model(text, { pooling: 'mean', normalize: true });
    if (!output?.data) throw new Error('Das Embedding-Modell lieferte kein Ergebnis.');
    return { vector: Array.from(output.data) };
}

async function recognizeImage(image) {
    const model = await getPipeline('image');
    const output = await model(image);
    const result = Array.isArray(output) ? output[0] : output;
    return { text: String(result?.generated_text || '').trim() };
}

async function transcribeAudio(audio, samplingRate) {
    const model = await getPipeline('speech');
    const output = await model(
        { raw: audio, sampling_rate: samplingRate },
        { language: 'german', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 }
    );
    const result = Array.isArray(output) ? output[0] : output;
    return { text: String(result?.text || '').trim() };
}

async function preloadModels() {
    const loadedModels = [];
    for (const modelKey of Object.keys(MODELS)) {
        await getPipeline(modelKey);
        loadedModels.push(modelKey);
    }
    return { models: loadedModels };
}

self.addEventListener('message', async event => {
    const { id, action, payload = {} } = event.data || {};
    if (id === undefined) return;
    activeRequestId = id;
    try {
        let result;
        if (action === 'generate') {
            result = await generateText(String(payload.prompt || ''), Number(payload.maxNewTokens) || 256);
        } else if (action === 'embed') {
            result = await embedText(String(payload.text || ''));
        } else if (action === 'image') {
            result = await recognizeImage(String(payload.image || ''));
        } else if (action === 'speech') {
            result = await transcribeAudio(payload.audio, Number(payload.samplingRate) || 16000);
        } else if (action === 'preload') {
            result = await preloadModels();
        } else {
            throw new Error('Diese KI-Funktion wird nicht unterstützt.');
        }
        self.postMessage({ id, type: 'done', result });
    } catch (error) {
        const detail = {
            type: typeof error,
            name: error?.name || '',
            message: error?.message || '',
            stack: error?.stack || '',
            value: String(error)
        };
        console.error('Lokale Modellaktion fehlgeschlagen:', detail);
        const message = error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error || 'Unbekannter Fehler im lokalen KI-Worker.');
        self.postMessage({
            id,
            type: 'error',
            message,
            detail
        });
    } finally {
        activeRequestId = null;
    }
});
