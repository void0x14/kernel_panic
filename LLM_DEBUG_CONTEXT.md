# Kernel Panic — Phase 5 LLM Debug Context

## Proje Nedir?
Kernel Panic, insan anılarını 3D sahneye çeviren bir memory OS. Kullanıcı anı metni girdiğinde LLM sahne verisi çıkarır (location, time, weather, emotion), WebGPU ile render edilir. Edge-first felsefe — küçük model, local çalışır.

## Mevcut Durum
- Phase 1-4: TAMAMLANDI (sim.zig, WebGPU pipeline, WASM+GFX, anı input pipeline)
- Phase 5: IMPLEMENT EDİLDİ ama ÇALIŞMIYOR
- LLM backend: llama.cpp server (port 8080)
- Model: Kullanıcının tercih ettiği modeller var, edge-first

## Kod Akışı
```
index.html → INJECT butonu → injectText(text) [parser.js:258]
  → llm_analyze_memory(text) [llm.js:138]
    → checkServerHealth(endpoint) [llm.js:78] — OPTIONS request
    → requestCompletion(endpoint, text) [llm.js:100] — POST /completion
      → buildPrompt(text) [llm.js:35] — prompt oluşturur
      → fetch(endpoint, body) — server'a gönderir
      → extractJsonObject(responseText) [llm.js:59] — JSON parse
  → parseLlmSceneData(raw) [parser.js:101] — SceneData validation
  → source: 'llm' veya 'fallback' [parser.js:283]
```

## İlgili Dosyalar
| Dosya | Satır | İşlev |
|-------|-------|-------|
| gfx/llm.js | 172 | LLM iletişim, health check, prompt, JSON extraction |
| gfx/parser.js | 525 | Anı pipeline, LLM entegrasyonu, keyword scoring fallback |
| gfx/gfx.js | 397 | WebGPU render, WASM yükleme (LLM ile ilgisi yok) |
| gfx/index.html | 215 | UI, script yükleme sırası |
| sim/sim.zig | 374 | OU SDE simülasyon motoru (LLM ile ilgisi yok) |

## Kritik Kod Parçaları

### buildPrompt() [llm.js:35-57]
```javascript
function buildPrompt(text) {
    return [
        'Return JSON only. No markdown. No explanation. No extra text.',
        'Analyze the memory text and return exactly this SceneData JSON shape:',
        '{',
        '  "location": "string",',
        '  "time_of_day": "string",',
        '  "weather": "string",',
        '  "atmosphere": "string",',
        '  "emotion_valence": number,',
        '  "emotion_intensity": number,',
        '  "persons": ["string"],',
        '  "hidden_context_candidates": ["string"]',
        '}',
        'Keep emotion_valence between -1 and 1.',
        'Keep emotion_intensity between 0 and 1.',
        'Use short strings for location, time_of_day, weather, and atmosphere.',
        'Use an empty array when persons or hidden_context_candidates are unknown.',
        '',
        'Memory text:',
        text,
    ].join('\n');
}
```

### requestCompletion() [llm.js:100-136]
```javascript
async function requestCompletion(endpoint, text) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: buildPrompt(text),
                n_predict: 512,
                temperature: 0.1,
                stop: ['\n\n'],
            }),
            signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn('[LLM] Request failed:', response.status, response.statusText);
            return null;
        }

        const payload = await response.json();
        const responseText = typeof payload.content === 'string' ? payload.content : '';
        const sceneData = extractJsonObject(responseText);
        if (!sceneData) {
            console.warn('[LLM] No valid JSON in response');
            return null;
        }
        return sceneData;
    } catch (error) {
        window.clearTimeout(timeoutId);
        console.warn('[LLM] Unexpected error:', error && error.message ? error.message : error);
        return null;
    }
}
```

### checkServerHealth() [llm.js:74-98]
```javascript
async function checkServerHealth(endpoint) {
    const now = Date.now();
    if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL && !serverHealthy) {
        return false;
    }
    lastHealthCheck = now;
    try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 3000);
        const response = await fetch(endpoint, {
            method: 'OPTIONS',
            signal: controller.signal,
        });
        window.clearTimeout(timeoutId);
        serverHealthy = response.ok;
        return serverHealthy;
    } catch (_e) {
        serverHealthy = false;
        return false;
    }
}
```

### parseLlmSceneData() [parser.js:101-124]
```javascript
function parseLlmSceneData(raw) {
    if (raw === null || typeof raw !== 'object') return null;
    const location = typeof raw.location === 'string' ? raw.location : null;
    const timeOfDay = timeOfDayValues.has(raw.time_of_day) ? raw.time_of_day : null;
    const weather = weatherValues.has(raw.weather) ? raw.weather : null;
    const atmosphere = atmosphereValues.has(raw.atmosphere) ? raw.atmosphere : null;
    if (!location && !timeOfDay && !weather && !atmosphere) return null;
    // ... validation continues
}
```

## Test Sonuçları

4 farklı model test edildi, 4'ü de başarısız:

| Model | Quant | Context | Sonuç |
|-------|-------|---------|-------|
| Qwen3.5-2B | Q2_K | 2000 | Input'u tekrarladı |
| Qwen3-4B-Thinking | Q4_K_S | 2000 | "kedi" kelimesini tekrarladı |
| Qwen3-4B-Thinking | Q4_K_S | 2000 | "Cok sinirliydim"i tekrarladı |
| Nanbeige4.1-3B | Q8_0 | 5096 | JSON döndürmedi |

Test komutu (her model için aynı):
```bash
curl -s --max-time 60 -X POST http://127.0.0.1:8080/completion \
  -H "Content-Type: application/json" \
  -d '{"prompt":"[buildPrompt çıktısı]", "n_predict":512, "temperature":0.1, "stop":["\\n\\n"]}'
```

Server bilgisi:
- Binary: `/home/void0x14/llama.cpp/build/bin/llama-server` (build 8495)
- Başlatma: `llama-server -m [model_path] -c [context] -ngl 10`
- GPU: Intel Graphics (RPL-P), Vulkan, ~9.5 GB VRAM
- OS: Linux x86_64

## Beklenen Çıktı Formatı
Server response: `{ "content": "..." }`
Kod `content` içinde JSON arar: ilk `{` ile son `}` arasını parse eder.
Beklenen JSON:
```json
{
  "location": "string",
  "time_of_day": "morning|afternoon|evening|night",
  "weather": "clear|overcast|rain|fog",
  "atmosphere": "tense|calm|melancholic|euphoric|neutral",
  "emotion_valence": -1.0..1.0,
  "emotion_intensity": 0.0..1.0,
  "persons": ["string"],
  "hidden_context_candidates": ["string"]
}
```

## Yapılan Değişiklikler (commit edildi)
- `llm.js`: checkServerHealth() eklendi (OPTIONS request), throw→return null, health check entegrasyonu
- `parser.js`: UI "QUERYING..." feedback, try/catch wrapper, reason logging

## Açık Sorular
1. `/completion` endpoint'i raw completion — model chat template gerektiriyor mu?
2. `stop: ['\n\n']` doğru format mı? Server'da `\\n\\n` string olarak mı gidiyor?
3. `repeat_penalty: 1.0` (default) repetition loop'a neden oluyor mu?
4. Prompt yapısı çok mu karmaşık? 2B model anlayamıyor olabilir.
5. Model JSON üretmesi gerektiğini biliyor mu? Instruction-following zayıf olabilir.
