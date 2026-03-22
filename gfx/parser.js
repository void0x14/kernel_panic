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

    // ============================================================
    // CHANNEL 1: Free Text
    // ============================================================
    function injectText(text) {
        if (!window._kpWasm) { console.error('WASM not ready'); return; }
        const wasm = window._kpWasm;

        const timestamp = BigInt(Date.now()) * 1000000n;
        const location = extractLocation(text);
        const emotion = scoreEmotion(text);
        const result = writeMemoryEvent(wasm, null, 0, timestamp, location, emotion.valence, emotion.intensity, emotion.sigma);
        logParsed(result);

        // Update UI panic display
        if (window._kpUpdatePanic) window._kpUpdatePanic();
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
                    if (window._kpUpdatePanic) window._kpUpdatePanic();
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
                if (window._kpUpdatePanic) window._kpUpdatePanic();
            }, eventIndex * 16);

            eventIndex++;
        }

        console.log(`[Gemini] Queued ${eventIndex} events`);
    }

    // ============================================================
    // UI BINDINGS — called after DOM ready
    // ============================================================
    function bindUI() {
        const injectBtn = document.getElementById('kp-inject');
        const textArea = document.getElementById('kp-memory-text');
        const chatgptInput = document.getElementById('kp-chatgpt-file');
        const geminiInput = document.getElementById('kp-gemini-file');

        if (injectBtn && textArea) {
            injectBtn.addEventListener('click', () => {
                const text = textArea.value.trim();
                if (text.length === 0) return;
                injectText(text);
                textArea.value = '';
            });

            textArea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    injectBtn.click();
                }
            });
        }

        if (chatgptInput) {
            chatgptInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => parseChatGPT(ev.target.result);
                reader.readAsText(file);
                chatgptInput.value = '';
            });
        }

        if (geminiInput) {
            geminiInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => parseGemini(ev.target.result);
                reader.readAsText(file);
                geminiInput.value = '';
            });
        }
    }

    // Expose globally for gfx.js integration
    window._kpParser = {
        injectText,
        parseChatGPT,
        parseGemini,
        scoreEmotion,
        extractLocation,
    };

    // Bind on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindUI);
    } else {
        bindUI();
    }
})();
