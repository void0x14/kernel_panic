// parser.js — Memory Input Pipeline for Kernel Panic
// Three channels: free text, ChatGPT JSON, Gemini JSON
// Zero dependencies. Browser-native only.

(function () {
    'use strict';

    // MemoryEvent layout: 84 bytes total
    // offset 0:  timestamp         u64 (8 bytes)
    // offset 8:  location          [64]u8 (64 bytes)
    // offset 72: emotion_valence   f32 (4 bytes)
    // offset 76: emotion_intensity f32 (4 bytes)
    // offset 80: sigma             f32 (4 bytes)
    const MEMORY_EVENT_SIZE = 84;
    const SCRATCH_OFFSET = 8192;

    const NEGATIVE_PHRASES = [
        'hayal kırıklığı', 'işe yaramaz',
    ];

    // Keyword dictionaries — negative
    const NEGATIVE_KEYWORDS = [
        'kötü', 'sinir', 'sinirlen', 'korku', 'öfke', 'öfkelen', 'öfkeli', 'nefret',
        'ağla', 'panik', 'kaybet', 'başarısız', 'yıkıl', 'üzgün', 'üzül', 'acı',
        'keder', 'yas', 'yalnız', 'terk', 'terked', 'kaybol', 'sahipsiz', 'stres',
        'tartış', 'kavga', 'kırgın', 'kızgın', 'kızar', 'endişe', 'kaygı', 'mutsuz',
        'boş', 'anlamsız', 'değersiz', 'beceriksiz', 'bitkin', 'tüken', 'çaresiz',
        'mahvol', 'berbat', 'kabus', 'bad', 'angry', 'fear', 'hate', 'panic',
        'fail', 'sad', 'cry', 'lost', 'terrible', 'awful', 'horrible', 'depressed',
        'anxious', 'stress', 'pain', 'lonely', 'miserable', 'hopeless', 'despair',
        'rage', 'fury', 'grief', 'frustrat', 'overwhelm', 'broken', 'empty',
        'worthless', 'abandon', 'furious', 'devastat', 'crush', 'shatter', 'upset',
        'hurt', 'numb', 'isolat', 'guilt',
    ];

    // Keyword dictionaries — positive
    const POSITIVE_KEYWORDS = [
        'iyi', 'mutlu', 'güzel', 'sevgi', 'umut', 'rahat', 'başar', 'huzur',
        'sevinç', 'neşe', 'barış', 'keyif', 'coşku', 'eğlen', 'gülümse', 'tatlı',
        'harika', 'muhteşem', 'gurur', 'güvenli', 'şefkat', 'minnet', 'destek', 'sakin',
        'dingin', 'ferah', 'konfor', 'güvende', 'değerli', 'anlamlı', 'umutlu', 'heyecan',
        'başard', 'başarı', 'güçlü', 'iyileş', 'rahatla', 'sev', 'aidiyet', 'huzurlu',
        'good', 'happy', 'love', 'hope', 'calm', 'success', 'joy', 'peaceful',
        'wonderful', 'great', 'fantastic', 'amazing', 'beautiful', 'excellent', 'perfect',
        'brilliant', 'delightful', 'cheerful', 'grateful', 'relieved', 'comfort', 'secure',
        'meaningful', 'valued', 'confident', 'proud', 'thrill', 'optim', 'bright',
    ];

    // Known city names for location extraction
    const KNOWN_CITIES = [
        'istanbul', 'ankara', 'izmir', 'antalya', 'bursa', 'adana', 'konya',
        'gaziantep', 'mersin', 'kayseri', 'diyarbakır', 'samsun', 'trabzon',
        'london', 'paris', 'berlin', 'tokyo', 'new york', 'los angeles',
        'rome', 'madrid', 'amsterdam', 'vienna', 'prague', 'barcelona',
        'moscow', 'dubai', 'singapore', 'sydney', 'toronto', 'san francisco',
        'boston', 'chicago', 'seattle', 'miami', 'denver', 'austin',
        'athens', 'lisbon', 'stockholm', 'oslo', 'helsinki', 'copenhagen',
        'warsaw', 'budapest', 'bucharest', 'sofia', 'zagreb', 'belgrade',
        'taipei', 'bangkok', 'seoul', 'beijing', 'shanghai', 'mumbai',
        'delhi', 'cairo', 'nairobi', 'cape town', 'rio', 'buenos aires',
        'mexico city', 'havana', 'bali', 'jeju', 'kyoto', 'osaka',
    ];

    // Place type keywords for location extraction
    const PLACE_TYPES = [
        'okul', 'ev', 'iş', 'ofis', 'hastane', 'park', 'sahil', 'deniz',
        'dağ', 'orman', 'nehir', 'göl', 'plaj', 'restoran', 'kafe', 'bar',
        'sinema', 'tiyatro', 'müze', 'kütüphane', 'havaalanı', 'istasyon',
        'school', 'home', 'office', 'hospital', 'park', 'beach', 'sea',
        'mountain', 'forest', 'river', 'lake', 'restaurant', 'cafe',
        'cinema', 'theater', 'museum', 'library', 'airport', 'station',
        'church', 'temple', 'mosque', 'mall', 'market', 'stadium',
        'üniversite', 'fakülte', 'kampüs', 'sokak', 'cadde', 'meydan',
        'apartman', 'bina', 'oda', 'salon', 'bahçe', 'teras', 'balkon',
    ];

    function normalizeText(text) {
        return text.toLowerCase().replace(/[.,!?;:()"']/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function tokenize(text) {
        const normalized = normalizeText(text);
        if (normalized.length === 0) return [];
        return normalized.split(' ');
    }

    function scoreEmotion(text) {
        const normalizedText = normalizeText(text);
        const tokens = tokenize(text);
        if (tokens.length === 0) return { valence: 0.0, intensity: 0.0, sigma: 0.0 };

        let posCount = 0;
        let negCount = 0;
        let keywordHits = 0;

        for (const phrase of NEGATIVE_PHRASES) {
            if (normalizedText.includes(phrase)) {
                negCount++;
                keywordHits++;
            }
        }

        for (const token of tokens) {
            let matched = false;
            for (const kw of NEGATIVE_KEYWORDS) {
                if (token.includes(kw)) {
                    negCount++; keywordHits++; matched = true; break;
                }
            }
            if (!matched) {
                for (const kw of POSITIVE_KEYWORDS) {
                    if (token.includes(kw)) { posCount++; keywordHits++; matched = true; break; }
                }
            }
        }

        const valence = (posCount - negCount) / (posCount + negCount + 1);
        const clampedValence = Math.max(-1.0, Math.min(1.0, valence));
        const keywordDensity = keywordHits / tokens.length;
        const intensity = keywordHits === 0 ? 0.05 : Math.abs(clampedValence) * keywordDensity;
        const clampedIntensity = Math.max(0.0, Math.min(1.0, intensity));
        const sigma = keywordHits === 0 ? 0.075 : Math.min(clampedIntensity * 1.5, 1.5);

        return { valence: clampedValence, intensity: clampedIntensity, sigma: sigma };
    }

    function sigmaFromIntensity(intensity) {
        if (intensity <= 0) return 0.075;
        return Math.min(intensity * 1.5, 1.5);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function isStringArray(value) {
        return Array.isArray(value) && value.every((item) => typeof item === 'string');
    }

    function isUsableString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function hasUsableEmotion(scene) {
        return typeof scene.emotion_valence === 'number' && typeof scene.emotion_intensity === 'number';
    }

    function parseLlmSceneData(scene) {
        if (!scene || typeof scene !== 'object') return null;
        const hasLocation = isUsableString(scene.location);
        const hasEmotion = hasUsableEmotion(scene);

        if (!hasLocation && !hasEmotion) return null;

        return {
            location: hasLocation ? scene.location.trim() : null,
            time_of_day: isUsableString(scene.time_of_day) ? scene.time_of_day.trim() : 'unknown',
            weather: isUsableString(scene.weather) ? scene.weather.trim() : 'unknown',
            atmosphere: isUsableString(scene.atmosphere) ? scene.atmosphere.trim() : 'unknown',
            emotion_valence: hasEmotion ? clamp(scene.emotion_valence, -1.0, 1.0) : null,
            emotion_intensity: hasEmotion ? clamp(scene.emotion_intensity, 0.0, 1.0) : null,
            persons: isStringArray(scene.persons) ? scene.persons : [],
            hidden_context_candidates: isStringArray(scene.hidden_context_candidates) ? scene.hidden_context_candidates : [],
        };
    }

    function buildSceneData(text, rawLlmScene) {
        const llmScene = parseLlmSceneData(rawLlmScene);
        const hasLlmEmotion = llmScene && hasUsableEmotion(llmScene);
        const fallbackEmotion = hasLlmEmotion ? null : scoreEmotion(text);
        const location = llmScene && llmScene.location ? llmScene.location : extractLocation(text);
        const emotionValence = hasLlmEmotion ? llmScene.emotion_valence : fallbackEmotion.valence;
        const emotionIntensity = hasLlmEmotion ? llmScene.emotion_intensity : fallbackEmotion.intensity;

        return {
            source: llmScene ? 'llm' : 'fallback',
            location,
            time_of_day: llmScene ? llmScene.time_of_day : 'unknown',
            weather: llmScene ? llmScene.weather : 'unknown',
            atmosphere: llmScene ? llmScene.atmosphere : 'unknown',
            emotion_valence: emotionValence,
            emotion_intensity: emotionIntensity,
            persons: llmScene ? llmScene.persons : [],
            hidden_context_candidates: llmScene ? llmScene.hidden_context_candidates : [],
            sigma: llmScene ? sigmaFromIntensity(emotionIntensity) : fallbackEmotion.sigma,
        };
    }

    function extractLocation(text) {
        const lowerText = text.toLowerCase();
        const words = text.split(/\s+/);

        // Check known cities first
        for (const city of KNOWN_CITIES) {
            if (lowerText.includes(city)) return city;
        }

        // Check place types
        for (const place of PLACE_TYPES) {
            if (lowerText.includes(place)) return place;
        }

        // Fall back to capitalized words (potential proper nouns)
        for (const word of words) {
            const clean = word.replace(/[.,!?;:()"']/g, '');
            if (clean.length > 2 && clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase()) {
                return clean.toLowerCase();
            }
        }

        return 'unknown';
    }

    function writeMemoryEvent(wasm, mem, branchId, timestamp, locationStr, valence, intensity, sigma) {
        // Grow memory if needed — ensure scratch area is accessible
        const neededPages = Math.ceil((SCRATCH_OFFSET + MEMORY_EVENT_SIZE) / 65536);
        const currentPages = wasm.memory.buffer.byteLength / 65536;
        if (neededPages > currentPages) {
            wasm.memory.grow(neededPages - currentPages);
            // DataView must be recreated after grow
        }
        // Re-acquire DataView after potential growth
        const view = new DataView(wasm.memory.buffer);
        const ptr = SCRATCH_OFFSET;

        // timestamp: u64 little-endian
        view.setBigUint64(ptr + 0, BigInt(timestamp), true);

        // location: [64]u8, UTF-8 encoded, zero-padded
        const encoded = new TextEncoder().encode(locationStr);
        const locLen = Math.min(encoded.length, 63);
        for (let i = 0; i < 64; i++) {
            view.setUint8(ptr + 8 + i, i < locLen ? encoded[i] : 0);
        }

        // emotion_valence: f32
        view.setFloat32(ptr + 72, valence, true);

        // emotion_intensity: f32
        view.setFloat32(ptr + 76, intensity, true);

        // sigma: f32
        view.setFloat32(ptr + 80, sigma, true);

        // Call WASM
        wasm.sim_apply_event(branchId, ptr);

        return { timestamp, location: locationStr, valence, intensity, sigma };
    }

    function logParsed(result) {
        console.log(`[PARSED] location="${result.location}" valence=${result.valence.toFixed(3)} intensity=${result.intensity.toFixed(3)} sigma=${result.sigma.toFixed(3)}`);
    }

    function nextInjectToken() {
        const token = (window._kpInjectToken || 0) + 1;
        window._kpInjectToken = token;
        return token;
    }

    function isActiveInjectToken(token) {
        return window._kpInjectToken === token;
    }

    function applySceneDataToRuntime(wasm, timestamp, sceneData) {
        window._kpSceneData = sceneData;

        if (!wasm) {
            console.log(`[SIM] skip (no wasm) location="${sceneData.location}" valence=${sceneData.emotion_valence.toFixed(3)} intensity=${sceneData.emotion_intensity.toFixed(3)}`);
            return;
        }

        const result = writeMemoryEvent(
            wasm,
            null,
            0,
            timestamp,
            sceneData.location,
            sceneData.emotion_valence,
            sceneData.emotion_intensity,
            sceneData.sigma,
        );
        logParsed(result);
    }

    function annotateLlmSceneData(sceneData, source, mode, status, latencyMs) {
        sceneData.source = source;
        sceneData.llm_mode = mode;
        sceneData.llm_status = status;
        sceneData.llm_latency_ms = Math.round(latencyMs);
        return sceneData;
    }

    async function requestDetailedScene(text, mode) {
        if (typeof window.llm_analyze_memory_detailed === 'function') {
            return await window.llm_analyze_memory_detailed(text, { mode });
        }

        if (typeof window.llm_analyze_memory !== 'function') {
            return {
                status: 'unreachable',
                sceneData: null,
                mode,
            };
        }

        const sceneData = await window.llm_analyze_memory(text, { mode });
        return {
            status: sceneData && typeof sceneData === 'object' ? 'ok' : 'invalid_json',
            sceneData,
            mode,
        };
    }

    // ============================================================
    // CHANNEL 1: Free Text
    // ============================================================
    async function injectText(text) {
        const wasm = window._kpWasm;

        const timestamp = BigInt(Date.now()) * 1000000n;
        const startTime = performance.now();
        const injectToken = nextInjectToken();

        const sceneData = buildSceneData(text, null);

        applySceneDataToRuntime(wasm, timestamp, sceneData);

        const latency = performance.now() - startTime;
        console.log(`[LLM] status=fallback latency_ms=${Math.round(latency)} source=fallback mode=fallback`);

        if (typeof window.llm_analyze_memory !== 'function' && typeof window.llm_analyze_memory_detailed !== 'function') {
            return;
        }

        const fastStartTime = performance.now();
        let fastResult;

        try {
            fastResult = await requestDetailedScene(text, 'fast');
        } catch (err) {
            fastResult = {
                status: err && err.name === 'AbortError' ? 'timeout' : 'http_error',
                sceneData: null,
                mode: 'fast',
            };
        }

        const fastLatency = performance.now() - fastStartTime;

        if (fastResult.status === 'ok' && fastResult.sceneData && isActiveInjectToken(injectToken)) {
            const fastSceneData = annotateLlmSceneData(
                buildSceneData(text, fastResult.sceneData),
                'llm_fast',
                'fast',
                fastResult.status,
                fastLatency
            );
            applySceneDataToRuntime(wasm, timestamp, fastSceneData);
            console.log(`[LLM] status=${fastResult.status} latency_ms=${Math.round(fastLatency)} source=llm_fast mode=fast`);
        } else {
            sceneData.llm_mode = 'fast';
            sceneData.llm_status = fastResult.status;
            sceneData.llm_latency_ms = Math.round(fastLatency);
            sceneData.fallback_reason = fastResult.status === 'ok' ? '' : fastResult.status;

            console.log(`[LLM] status=${fastResult.status} latency_ms=${Math.round(fastLatency)} source=fallback mode=fast`);
        }

        void (async () => {
            const deepStartTime = performance.now();
            let deepResult;

            try {
                deepResult = await requestDetailedScene(text, 'deep');
            } catch (err) {
                deepResult = {
                    status: err && err.name === 'AbortError' ? 'timeout' : 'http_error',
                    sceneData: null,
                    mode: 'deep',
                };
            }

            const deepLatency = performance.now() - deepStartTime;

            if (deepResult.status === 'ok' && deepResult.sceneData && isActiveInjectToken(injectToken)) {
                const deepSceneData = annotateLlmSceneData(
                    buildSceneData(text, deepResult.sceneData),
                    'llm_deep',
                    'deep',
                    deepResult.status,
                    deepLatency
                );
                applySceneDataToRuntime(wasm, timestamp, deepSceneData);
                console.log(`[LLM] status=${deepResult.status} latency_ms=${Math.round(deepLatency)} source=llm_deep mode=deep`);
                return;
            }

            console.log(`[LLM] status=${deepResult.status} latency_ms=${Math.round(deepLatency)} source=background_skip mode=deep`);
        })();
    }



    async function llmTest(text) {
        if (typeof window.llm_analyze_memory !== 'function') {
            console.warn('[LLM] Analyzer not available');
            return null;
        }

        try {
            const rawLlmScene = await window.llm_analyze_memory(text);
            const sceneData = buildSceneData(text, rawLlmScene);
            console.log(JSON.stringify(sceneData, null, 2));
            return sceneData;
        } catch (err) {
            console.error('[LLM] Test failed:', err.message || err);
            return null;
        }
    }

    // ============================================================
    // CHANNEL 2: ChatGPT JSON Export
    // ============================================================
    function parseChatGPT(jsonStr) {
        if (!window._kpWasm) { console.error('WASM not ready'); return; }
        const wasm = window._kpWasm;

        let data;
        try {
            data = JSON.parse(jsonStr);
        } catch (e) {
            console.error('[ChatGPT] JSON parse failed:', e.message);
            return;
        }

        // ChatGPT export: array of conversations, each with .mapping
        const conversations = Array.isArray(data) ? data : (data.conversations || []);
        let eventIndex = 0;

        for (const conv of conversations) {
            const mapping = conv.mapping || {};
            for (const key in mapping) {
                const entry = mapping[key];
                if (!entry || !entry.message) continue;
                if (entry.message.author.role !== 'user') continue;
                if (!entry.message.content || !entry.message.content.parts) continue;

                const text = entry.message.content.parts.join(' ');
                if (text.trim().length === 0) continue;

                const createTime = entry.message.create_time || 0;
                const timestamp = BigInt(Math.floor(createTime * 1e9));
                const location = extractLocation(text);
                const emotion = scoreEmotion(text);

                setTimeout(() => {
                    const result = writeMemoryEvent(wasm, null, 0, timestamp, location, emotion.valence, emotion.intensity, emotion.sigma);
                    console.log(`[ChatGPT ${eventIndex}]`);
                    logParsed(result);
                }, eventIndex * 16);

                eventIndex++;
            }
        }

        console.log(`[ChatGPT] Queued ${eventIndex} events`);
    }

    // ============================================================
    // CHANNEL 3: Gemini JSON Export
    // ============================================================
    function parseGemini(jsonStr) {
        if (!window._kpWasm) { console.error('WASM not ready'); return; }
        const wasm = window._kpWasm;

        let data;
        try {
            data = JSON.parse(jsonStr);
        } catch (e) {
            console.error('[Gemini] JSON parse failed:', e.message);
            return;
        }

        // Gemini export format varies — try multiple structures
        let messages = [];
        const baseTimestamp = BigInt(Date.now()) * 1000000n;

        if (Array.isArray(data)) {
            // Format: array of conversations
            for (const conv of data) {
                if (conv.conversations && Array.isArray(conv.conversations)) {
                    for (const turn of conv.conversations) {
                        if (turn.parts && Array.isArray(turn.parts)) {
                            for (const part of turn.parts) {
                                if (part.text) messages.push(part.text);
                            }
                        }
                    }
                }
                if (conv.messages && Array.isArray(conv.messages)) {
                    for (const msg of conv.messages) {
                        if (msg.content && typeof msg.content === 'string') {
                            messages.push(msg.content);
                        } else if (msg.content && Array.isArray(msg.content)) {
                            for (const part of msg.content) {
                                if (part.text) messages.push(part.text);
                            }
                        }
                    }
                }
            }
        } else if (data.conversations && Array.isArray(data.conversations)) {
            for (const turn of data.conversations) {
                if (turn.parts && Array.isArray(turn.parts)) {
                    for (const part of turn.parts) {
                        if (part.text) messages.push(part.text);
                    }
                }
            }
        } else if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
                if (msg.content && typeof msg.content === 'string') {
                    messages.push(msg.content);
                }
            }
        }

        if (messages.length === 0) {
            console.warn('[Gemini] Format not recognized. Expected .conversations[].parts[].text or .messages[].content');
            return;
        }

        let eventIndex = 0;
        for (let i = 0; i < messages.length; i++) {
            const text = messages[i];
            if (text.trim().length === 0) continue;

            // Synthetic timestamp: index * 60 seconds
            const timestamp = baseTimestamp + BigInt(i * 60) * 1000000000n;
            const location = extractLocation(text);
            const emotion = scoreEmotion(text);

            setTimeout(() => {
                const result = writeMemoryEvent(wasm, null, 0, timestamp, location, emotion.valence, emotion.intensity, emotion.sigma);
                console.log(`[Gemini ${eventIndex}]`);
                logParsed(result);
            }, eventIndex * 16);

            eventIndex++;
        }

        console.log(`[Gemini] Queued ${eventIndex} events`);
    }

    function createAudioState() {
        return {
            mode: 'idle',
            source_type: null,
            file_name: '',
            mime_type: '',
            preview_url: '',
            blob: null,
            stream: null,
            recorder: null,
            chunks: [],
            error: '',
            submitted: false,
        };
    }

    const audioState = createAudioState();

    function getAudioElements() {
        return {
            fileInput: document.getElementById('kp-unified-file'),
            modeSelect: document.getElementById('kp-input-mode'),
            textArea: document.getElementById('kp-memory-text'),
            injectBtn: document.getElementById('kp-inject'),
            dropzone: document.getElementById('kp-dropzone'),
            recordBtn: document.getElementById('kp-audio-record'),
            stopBtn: document.getElementById('kp-audio-stop'),
            submitBtn: document.getElementById('kp-audio-submit'),
            resetBtn: document.getElementById('kp-audio-reset'),
            preview: document.getElementById('kp-audio-preview'),
            status: document.getElementById('kp-audio-status'),
        };
    }

    function revokeAudioPreviewUrl() {
        if (audioState.preview_url) {
            URL.revokeObjectURL(audioState.preview_url);
            audioState.preview_url = '';
        }
    }

    function stopAudioStreamTracks() {
        if (!audioState.stream || typeof audioState.stream.getTracks !== 'function') return;
        for (const track of audioState.stream.getTracks()) {
            track.stop();
        }
        audioState.stream = null;
    }

    function syncAudioUi() {
        const elements = getAudioElements();
        if (!elements.status || !elements.modeSelect || !elements.textArea || !elements.injectBtn) return;

        const hasPreview = Boolean(audioState.blob && audioState.preview_url);
        const inputMode = elements.modeSelect.value || 'auto';
        const textVisible = inputMode === 'auto' || inputMode === 'text';
        const audioVisible = inputMode === 'auto' || inputMode === 'audio_file' || inputMode === 'live_audio';
        const recordVisible = inputMode === 'auto' || inputMode === 'live_audio';

        elements.textArea.hidden = !textVisible;
        elements.injectBtn.hidden = !textVisible;
        elements.recordBtn.hidden = !audioVisible;
        elements.stopBtn.hidden = !audioVisible;
        elements.submitBtn.hidden = !audioVisible;
        elements.resetBtn.hidden = !audioVisible;
        elements.recordBtn.disabled = !recordVisible || audioState.mode === 'recording';
        elements.stopBtn.disabled = audioState.mode !== 'recording';
        elements.submitBtn.disabled = !hasPreview || audioState.mode === 'recording';
        elements.resetBtn.disabled = audioState.mode === 'idle' && !hasPreview && !audioState.error;

        if (elements.dropzone) {
            if (inputMode === 'text') {
                elements.dropzone.textContent = 'Text mode active. Write a memory or switch mode to attach a file.';
            } else if (inputMode === 'audio_file') {
                elements.dropzone.textContent = 'Audio file mode. Drop/select an audio file, review playback, then submit manually.';
            } else if (inputMode === 'live_audio') {
                elements.dropzone.textContent = 'Live audio mode. Start recording, stop to preview, then submit manually.';
            } else if (inputMode === 'chatgpt_json') {
                elements.dropzone.textContent = 'ChatGPT JSON mode. Drop/select a ChatGPT export file to import it.';
            } else if (inputMode === 'gemini_json') {
                elements.dropzone.textContent = 'Gemini JSON mode. Drop/select a Gemini export file to import it.';
            } else {
                elements.dropzone.textContent = 'Auto mode detects audio and JSON imports. Image/video slots will attach here next.';
            }
        }

        if (elements.preview) {
            if (hasPreview && audioVisible) {
                elements.preview.hidden = false;
                elements.preview.src = audioState.preview_url;
            } else {
                elements.preview.hidden = true;
                elements.preview.removeAttribute('src');
                elements.preview.load();
            }
        }

        let statusText = 'Idle. Load a file or record audio, preview it, then submit manually.';
        if (audioState.error) {
            statusText = `Error: ${audioState.error}`;
        } else if (audioState.mode === 'recording') {
            statusText = 'Recording live audio. Stop recording to create a preview.';
        } else if (audioState.mode === 'preview_ready') {
            statusText = `Preview ready (${audioState.source_type === 'live_audio' ? 'live recording' : 'audio file'}). Review playback, then submit manually.`;
        } else if (audioState.mode === 'submitted') {
            statusText = `Submitted ${audioState.source_type === 'live_audio' ? 'live recording' : 'audio file'} for later processing.`;
        }

        elements.status.textContent = statusText;
    }

    function setAudioPreview(blob, sourceType, fileName) {
        revokeAudioPreviewUrl();
        audioState.blob = blob;
        audioState.source_type = sourceType;
        audioState.file_name = fileName || '';
        audioState.mime_type = blob && blob.type ? blob.type : '';
        audioState.preview_url = URL.createObjectURL(blob);
        audioState.mode = 'preview_ready';
        audioState.error = '';
        audioState.submitted = false;
        syncAudioUi();
    }

    function resetAudioState() {
        revokeAudioPreviewUrl();
        stopAudioStreamTracks();
        audioState.mode = 'idle';
        audioState.source_type = null;
        audioState.file_name = '';
        audioState.mime_type = '';
        audioState.blob = null;
        audioState.recorder = null;
        audioState.chunks = [];
        audioState.error = '';
        audioState.submitted = false;

        const elements = getAudioElements();
        if (elements.fileInput) {
            elements.fileInput.value = '';
        }

        syncAudioUi();
    }

    function failAudioState(message) {
        stopAudioStreamTracks();
        audioState.mode = 'idle';
        audioState.recorder = null;
        audioState.chunks = [];
        audioState.error = message;
        syncAudioUi();
    }

    function handleAudioFile(file) {
        if (!file) return;
        setAudioPreview(file, 'audio_file', file.name || 'audio-file');
    }

    async function startAudioRecording() {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            failAudioState('Audio recording is unavailable in this browser.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioState.mode = 'recording';
            audioState.source_type = 'live_audio';
            audioState.stream = stream;
            audioState.recorder = recorder;
            audioState.chunks = [];
            audioState.error = '';
            audioState.submitted = false;

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioState.chunks.push(event.data);
                }
            };

            recorder.onerror = (event) => {
                const message = event.error && event.error.message ? event.error.message : 'Recording failed.';
                failAudioState(message);
            };

            recorder.onstop = () => {
                const blob = new Blob(audioState.chunks, { type: recorder.mimeType || 'audio/webm' });
                audioState.recorder = null;
                audioState.chunks = [];
                stopAudioStreamTracks();
                if (blob.size === 0) {
                    failAudioState('No audio data was captured.');
                    return;
                }
                setAudioPreview(blob, 'live_audio', 'live-recording.webm');
            };

            recorder.start();
            syncAudioUi();
        } catch (error) {
            failAudioState(error && error.message ? error.message : 'Microphone access failed.');
        }
    }

    function stopAudioRecording() {
        if (audioState.recorder && audioState.recorder.state !== 'inactive') {
            audioState.recorder.stop();
        }
    }

    function submitAudioPreview() {
        if (!audioState.blob) return null;

        const submission = {
            source_type: audioState.source_type,
            file_name: audioState.file_name,
            mime_type: audioState.mime_type,
            size_bytes: audioState.blob.size,
            submitted_at_ms: Date.now(),
            blob: audioState.blob,
        };

        window._kpAudioLastSubmission = submission;
        audioState.mode = 'submitted';
        audioState.error = '';
        audioState.submitted = true;
        syncAudioUi();
        console.log('[AUDIO] Preview submitted for later processing', {
            source_type: submission.source_type,
            file_name: submission.file_name,
            size_bytes: submission.size_bytes,
        });
        return submission;
    }

    function getAudioStateSnapshot() {
        return {
            mode: audioState.mode,
            source_type: audioState.source_type,
            file_name: audioState.file_name,
            mime_type: audioState.mime_type,
            has_preview: Boolean(audioState.blob && audioState.preview_url),
            submitted: audioState.submitted,
            error: audioState.error,
        };
    }

    function getSelectedInputMode() {
        const elements = getAudioElements();
        return elements.modeSelect && elements.modeSelect.value ? elements.modeSelect.value : 'auto';
    }

    function isAudioFile(file) {
        return Boolean(file && typeof file.type === 'string' && file.type.startsWith('audio/'));
    }

    function isJsonFile(file) {
        return Boolean(file && typeof file.name === 'string' && file.name.toLowerCase().endsWith('.json'));
    }

    function inferJsonImportKind(jsonStr, fileName) {
        const normalizedName = typeof fileName === 'string' ? fileName.toLowerCase() : '';
        if (normalizedName.includes('gemini')) return 'gemini_json';
        if (normalizedName.includes('chatgpt') || normalizedName.includes('openai')) return 'chatgpt_json';

        try {
            const data = JSON.parse(jsonStr);
            if (Array.isArray(data) && data.some((item) => item && item.mapping)) {
                return 'chatgpt_json';
            }
            if (data && Array.isArray(data.conversations)) {
                return 'chatgpt_json';
            }
        } catch (_error) {
            return 'unknown_json';
        }

        return 'gemini_json';
    }

    async function readFileAsText(file) {
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(typeof event.target.result === 'string' ? event.target.result : '');
            reader.onerror = () => reject(reader.error || new Error('File read failed.'));
            reader.readAsText(file);
        });
    }

    async function handleUnifiedFile(file, forcedMode) {
        if (!file) return;

        const selectedMode = forcedMode || getSelectedInputMode();

        if (selectedMode === 'audio_file' || (selectedMode === 'auto' && isAudioFile(file))) {
            handleAudioFile(file);
            return;
        }

        if (selectedMode === 'chatgpt_json' || selectedMode === 'gemini_json' || (selectedMode === 'auto' && isJsonFile(file))) {
            const jsonStr = await readFileAsText(file);
            const importKind = selectedMode === 'auto' ? inferJsonImportKind(jsonStr, file.name) : selectedMode;
            if (importKind === 'chatgpt_json') {
                parseChatGPT(jsonStr);
                return;
            }
            if (importKind === 'gemini_json') {
                parseGemini(jsonStr);
                return;
            }
            failAudioState('JSON import type could not be detected.');
            return;
        }

        if (selectedMode === 'auto') {
            failAudioState('Unsupported file type for auto mode.');
            return;
        }

        failAudioState(`Selected mode ${selectedMode} is not ready for this file yet.`);
    }

    function setDropzoneActive(isActive) {
        const elements = getAudioElements();
        if (elements.dropzone) {
            elements.dropzone.dataset.active = isActive ? 'true' : 'false';
        }
    }

    // ============================================================
    // UI BINDINGS — called after DOM ready
    // ============================================================
    function bindUI() {
        const injectBtn = document.getElementById('kp-inject');
        const textArea = document.getElementById('kp-memory-text');
        const inputMode = document.getElementById('kp-input-mode');
        const unifiedFileInput = document.getElementById('kp-unified-file');
        const dropzone = document.getElementById('kp-dropzone');
        const audioRecordBtn = document.getElementById('kp-audio-record');
        const audioStopBtn = document.getElementById('kp-audio-stop');
        const audioSubmitBtn = document.getElementById('kp-audio-submit');
        const audioResetBtn = document.getElementById('kp-audio-reset');

        if (injectBtn && textArea) {
            injectBtn.addEventListener('click', async () => {
                const text = textArea.value.trim();
                if (text.length === 0) return;
                await injectText(text);
                textArea.value = '';
            });

            textArea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    injectBtn.click();
                }
            });
        }

        if (inputMode) {
            inputMode.addEventListener('change', () => {
                syncAudioUi();
            });
        }

        if (unifiedFileInput) {
            unifiedFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                await handleUnifiedFile(file);
                unifiedFileInput.value = '';
            });
        }

        if (dropzone) {
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                setDropzoneActive(true);
            });

            dropzone.addEventListener('dragleave', () => {
                setDropzoneActive(false);
            });

            dropzone.addEventListener('drop', async (e) => {
                e.preventDefault();
                setDropzoneActive(false);
                const file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
                if (!file) return;
                await handleUnifiedFile(file);
            });
        }

        if (audioRecordBtn) {
            audioRecordBtn.addEventListener('click', async () => {
                await startAudioRecording();
            });
        }

        if (audioStopBtn) {
            audioStopBtn.addEventListener('click', () => {
                stopAudioRecording();
            });
        }

        if (audioSubmitBtn) {
            audioSubmitBtn.addEventListener('click', () => {
                submitAudioPreview();
            });
        }

        if (audioResetBtn) {
            audioResetBtn.addEventListener('click', () => {
                resetAudioState();
            });
        }

        syncAudioUi();
    }

    // Expose globally for gfx.js integration
    window._kpParser = {
        injectText,
        llmTest,
        parseChatGPT,
        parseGemini,
        parseLlmSceneData,
        buildSceneData,
        scoreEmotion,
        extractLocation,
        audioInput: {
            getState: getAudioStateSnapshot,
            startRecording: startAudioRecording,
            stopRecording: stopAudioRecording,
            submitPreview: submitAudioPreview,
            reset: resetAudioState,
        },
    };

    // Bind on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindUI);
    } else {
        bindUI();
    }
})();
