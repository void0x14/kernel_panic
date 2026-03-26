# KERNEL PANIC PROJESİ — KAPSAMLI DEBUG RAPORU

**Oluşturulma Tarihi:** 2026-03-23  
**Rapor Amacı:** Tüm debug sürecini, yapılan değişiklikleri, test sonuçlarını ve yanlış söylenenleri açıkça belgelemek.

---

## BÖLÜM 1: MEVCUT DURUM ÖZETİ

### Hangi Phase'deyiz
**Phase 5 — LLM Sahne Çıkarımı** (`gfx/llm.js`)

### Tamamlanan Phase'ler
| Phase | Açıklama | Durum |
|-------|----------|-------|
| 1 | Cognitive Core (sim.zig) |  TAMAMLANDI |
| 2 | WebGPU Temel Pipeline (gfx/index.html) |  TAMAMLANDI |
| 3 | WASM + GFX Bağlantısı (gfx/gfx.js) |  TAMAMLANDI |
| 4 | Anı Input Pipeline (gfx/parser.js) |  TAMAMLANDI |
| 5 | LLM Sahne Çıkarımı (gfx/llm.js) |  DEVAM EDİYOR |

### Dosya Yapısı ve İşlevleri

| Dosya | Satır | İşlev | Durum |
|-------|-------|-------|-------|
| `sim/sim.zig` | ~300 | OU SDE simülasyon motoru, WASM export |  Çalışıyor |
| `gfx/gfx.js` | 397 | WebGPU render pipeline, WASM yükleme, kamera |  Çalışıyor |
| `gfx/parser.js` | 525 | Anı input pipeline, keyword scoring, LLM entegrasyonu |  DEĞİŞTİRİLDİ |
| `gfx/llm.js` | 172 | LLM iletişim, health check, JSON extraction |  DEĞİŞTİRİLDİ |
| `gfx/index.html` | 215 | UI, script yükleme sırası |  Çalışıyor |
| `zig-out/bin/kernel-panic-sim.wasm` | - | Derlenmiş WASM modülü |  Mevcut |

---

## BÖLÜM 2: ORİJİNAL DEBUG RAPORUNDAN BULGULAR

### 2.1 Browser-Server Uyumsuzluğu

**Browser Log:**
```
POST http://localhost:8080/completion net::ERR_CONNECTION_REFUSED
```

**Server Log:**
```
OPTIONS /completion 200
POST /completion 200
```

**Gözlem:** Server bazen çalışıyor, bazen browser bağlanamıyor.

### 2.2 Shell Test Sonuçları

| Test | Sonuç | Açıklama |
|------|-------|----------|
| `ps aux \| grep llama-server` |  Çalışıyor | `--host 0.0.0.0 --port 8080` |
| `ss -tlnp \| grep 8080` |  Dinleniyor | `LISTEN 0.0.0.0:8080` (sadece IPv4) |
| `curl http://localhost:8080/completion POST` |  200 OK | curl IPv4 fallback yapıyor |
| `curl http://127.0.0.1:8080/completion POST` |  200 OK | |
| `curl http://[::1]:8080/completion POST` |  Connection refused | IPv6 dinlenmiyor |
| `curl OPTIONS localhost:8080` |  200 OK | CORS header mevcut |

### 2.3 Kök Neden Hipotezleri

1. **IPv6/IPv4 Fallback Sorunu:** `localhost` resolve edilirken IPv6 (`::1`) denenebilir → fail → browser fallback yapmıyor.
2. **Server Crash:** Model-specific crash (Qwen3.5-2B).
3. **Startup Timing:** Browser fetch atarken server henüz hazır değil.

---

## BÖLÜM 3: KOD ANALİZİ — llm.js (172 satır, DEĞİŞTİRİLDİ)

### 3.1 Endpoint Yapılandırma (Satır 1-33)

```javascript
// Satır 4-6: Sabitler
const LLM_PORT = 8080;
const LLM_PATH = '/completion';
const LLM_TIMEOUT_MS = 15000;

// Satır 8-12: Kullanıcı tarafından yapılandırılabilir endpoint
function getConfiguredEndpoint() {
    return typeof window.KP_LLM_ENDPOINT === 'string' && window.KP_LLM_ENDPOINT.trim().length > 0
        ? window.KP_LLM_ENDPOINT.trim()
        : null;
}

// Satır 18-33: Endpoint aday listesi
function getEndpointCandidates() {
    const configuredEndpoint = getConfiguredEndpoint();
    if (configuredEndpoint) return [configuredEndpoint];

    const candidates = [];
    const pageHost = window.location && window.location.hostname ? window.location.hostname : '';

    if (pageHost) {
        candidates.push(buildEndpointUrl(pageHost));
    }

    candidates.push(buildEndpointUrl('127.0.0.1'));
    candidates.push(buildEndpointUrl('localhost'));

    return [...new Set(candidates)];
}
```

**Not:** `localhost` hala listede, ancak `127.0.0.1` önce deneniyor.

### 3.2 Prompt Oluşturma (Satır 35-57)

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

### 3.3 JSON Extraction (Satır 59-72)

```javascript
function extractJsonObject(responseText) {
    const start = responseText.indexOf('{');
    const end = responseText.lastIndexOf('}');

    if (start === -1 || end === -1 || end < start) {
        return null;
    }

    try {
        return JSON.parse(responseText.slice(start, end + 1));
    } catch (_error) {
        return null;
    }
}
```

### 3.4 YENİ — Health Check Fonksiyonu (Satır 74-98)

**Önceki durum:** Health check yoktu.  
**Sonraki durum:** OPTIONS request ile server sağlık kontrolü eklendi.

```javascript
let serverHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 5000; // 5 saniye

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

**Neden eklendi:** Server crash durumunda gereksiz POST request göndermemek için.

### 3.5 requestCompletion() (Satır 100-136)

**Önemli satırlar:**

```javascript
// Satır 109-114: Request body
body: JSON.stringify({
    prompt: buildPrompt(text),
    n_predict: 512,
    temperature: 0.1,
    stop: ['\n\n'],  // RESMİ LLAMA.CPP DOKÜMANTASYONUNA GÖRE DOĞRU
}),

// Satır 117-120: Response kontrol
if (!response.ok) {
    console.warn(`[LLM] Request failed for ${endpoint}:`, response.status, response.statusText);
    return null;  // DEĞİŞTİRİLDİ: throw error → return null
}

// Satır 131: Error handling
console.warn('[LLM] Unexpected error:', error && error.message ? error.message : error);
return null;  // DEĞİŞTİRİLDİ: throw error → return null + console.warn
```

**Değişiklik:** `throw error` yerine `return null` + `console.warn`. Neden: Kullanıcı deneyimini bozmamak için.

### 3.6 llm_analyze_memory() (Satır 138-167)

**DEĞİŞTİRİLDİ — Health check entegre edildi:**

```javascript
async function llm_analyze_memory(text) {
    const endpoints = getEndpointCandidates();

    for (let index = 0; index < endpoints.length; index += 1) {
        const endpoint = endpoints[index];

        // Health check: server sağ mı?
        const healthy = await checkServerHealth(endpoint);
        if (!healthy) {
            console.warn(`[LLM] Server unhealthy at ${endpoint}, skipping`);
            if (index === endpoints.length - 1) {
                serverHealthy = true; // Reset for next attempt
                return null;
            }
            continue;
        }

        try {
            const scene = await requestCompletion(endpoint, text);
            if (scene) return scene;
            if (index === endpoints.length - 1) return null;
        } catch (error) {
            console.warn(`[LLM] Network request failed for ${endpoint}:`, error.message || error);
            serverHealthy = false;
            if (index === endpoints.length - 1) return null;
        }
    }

    return null;
}
```

**Değişiklikler:**
1. Health check eklendi (satır 145)
2. Unhealthy server → skip (satır 146-153)
3. Son endpoint → `return null` (satır 148-151, 158, 162)
4. Error handling iyileştirildi

---

## BÖLÜM 4: KOD ANALİZİ — parser.js (525 satır, DEĞİŞTİRİLDİ)

### 4.1 injectText() — DEĞİŞTİRİLDİ (Satır 258-306)

**Önceki durum:** LLM çağrısı yok, sadece keyword scoring.  
**Sonraki durum:** LLM entegrasyonu eklendi.

```javascript
// Satır 264-267: YENİ — UI feedback
const sceneEl = document.getElementById('kp-scene-data');
const sourceEl = sceneEl ? sceneEl.querySelector('.scene-row:first-child .scene-value') : null;
if (sourceEl) sourceEl.textContent = 'QUERYING...';

// Satır 269-278: YENİ — try/catch wrapper for llm_analyze_memory
let rawLlmScene = null;
let llmError = null;

if (typeof window.llm_analyze_memory === 'function') {
    try {
        rawLlmScene = await window.llm_analyze_memory(text);
    } catch (err) {
        llmError = err;
        console.warn('[LLM] Analyze failed:', err.message || err);
    }
}

// Satır 283-288: YENİ — reason logging
if (sceneData.source === 'llm') {
    console.log('[LLM] SceneData accepted');
} else {
    const reason = llmError ? 'error' : (rawLlmScene === null ? 'unreachable' : 'invalid');
    console.log(`[LLM] Fallback to keyword scoring (reason: ${reason})`);
}
```

**Değişiklikler:**
1. UI feedback: "QUERYING..." state (satır 267)
2. try/catch wrapper for `llm_analyze_memory` (satır 273-278)
3. `llmError` tracking (satır 270, 276)
4. reason logging (error/unreachable/invalid) (satır 286)

### 4.2 llmTest() — DEĞİŞTİRİLDİ (Satır 308-323)

```javascript
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
        return null;  // DEĞİŞTİRİLDİ: error durumunda return null
    }
}
```

**Değişiklik:** try/catch wrapper eklendi, error durumunda `return null`.

---

## BÖLÜM 5: KOD ANALİZİ — gfx.js (DEĞİŞTİRİLMEDİ)

### 5.1 WASM Yükleme (Satır 188-190)

```javascript
const { instance } = await WebAssembly.instantiateStreaming(
    fetch('../zig-out/bin/kernel-panic-sim.wasm'),
);
```

### 5.2 Connection Pool Kontrolü

| Fetch | Zamanlama | Sonuç |
|-------|-----------|-------|
| WASM fetch | Page load |  Tek seferlik |
| LLM fetch | User action (inject) |  İstek üzerine |

**SONUÇ:** Connection pool sorunu YOK. WASM fetch page load'da, LLM fetch user action'da gerçekleşiyor. Aynı anda yapılmıyorlar.

---

## BÖLÜM 6: WEB ARAŞTIRMASI SONUÇLARI

### 6.1 llama.cpp Resmi Dokümantasyonu

**Kaynak:** `examples/server/README.md` (ggml-org/llama.cpp)

**stop parametresi:**
> `stop`: Specify a JSON array of stopping strings. These words will not be included in the completion, so make sure to add them to the prompt for the next iteration (default: []).

**Örnek (completion.js):**
```javascript
const paramDefaults = {
    stream: true,
    n_predict: 500,
    temperature: 0.2,
    stop: ["</s>"]  // ARRAY FORMATI
};
```

**SONUÇ:** `stop: ['\n\n']` array formatı **DOĞRU**.

### 6.2 Qwen3.5-2B Model Crash Raporları

| Issue # | Tarih | Durum | Açıklama |
|---------|-------|-------|----------|
| #20358 | 2026-03-10 | Açık | Qwen3.5-2b loading crash |
| #20222 | 2026-03-08 | Kapalı | "Chunk not found" crash under parallel load |
| #19863 | 2026-02-24 | Kapalı | Qwen 3.5 Inference Fails with Seg Fault |
| #20176 | 2026-03-06 | Açık | Loading checkpoints causes a crash |

**Ortak sorun:** Qwen3.5 modelleri hybrid attention (Gated DeltaNet) kullanıyor ve bu yapı llama.cpp'de crash'e neden olabiliyor.

### 6.3 Browser Connection Limitleri

| Browser | Connections per Domain | Max Connections |
|---------|------------------------|-----------------|
| Chrome 81 | 6 | 256 |
| Firefox 3+ | 6 | 256 |
| Safari 5 | 6 | - |
| IE 8+ | 6 | - |

**Not:** HTTP/1.1'de 6-8 connection limiti var. HTTP/2'de multiplexing ile theoretical limit kalkıyor.

---

## BÖLÜM 7: YANLIŞ SÖYLENENLER

### 7.1 "stop: ['\n\n'] wrong format" → YANLIŞ

**Gerçek:** Resmi llama.cpp dokümantasyonu ve completion.js örneği array formatını doğruluyor.

**Kanıt:**
- `examples/server/README.md`: "Specify a JSON array of stopping strings"
- `examples/server/public/completion.js`: `stop: ["</s>"]` — array format

### 7.2 "throw error fix" → DOĞRU

**Değişiklik:** `llm.js` satır 131: `throw error` → `return null` + `console.warn`

**Neden:** Server crash veya network error durumunda kullanıcı deneyimini bozmamak için.

### 7.3 "health check fix" → DOĞRU

**Değişiklik:** `llm.js` satır 74-98: Health check fonksiyonu eklendi.

**Neden:** Server crash durumunda gereksiz POST request göndermemek için.

### 7.4 "parser.js UI feedback" → DOĞRU

**Değişiklik:** `parser.js` satır 267: "QUERYING..." state eklendi.

**Neden:** Kullanıcıya LLM sorgusunun başladığını bildirmek için.

---

## BÖLÜM 8: TEST SONuçLARI

### 8.1 HTTP Server Test

```bash
python3 -m http.server 8000
```

**Sonuç:**  Çalışıyor

### 8.2 llm.js Test

**Senaryo:** HTTP server üzerinden llm.js yükleme  
**Sonuç:**  Yüklenebiliyor

### 8.3 llama.cpp Server Test

**Senaryo:** Port 8080'te llama.cpp server  
**Sonuç:**  Çalışmıyor (yanıt yok)

**Olası nedenler:**
1. Server crash (Qwen3.5-2B model-specific issue)
2. Server başlatılmamış
3. Port çakışması

---

## BÖLÜM 9: SONUÇ

### 9.1 Yapılan Değişiklikler

| Dosya | Satır | Değişiklik | Neden |
|-------|-------|------------|-------|
| `llm.js` | 74-98 | Health check fonksiyonu eklendi | Server crash durumunda gereksiz request göndermemek için |
| `llm.js` | 131 | `throw error` → `return null` + `console.warn` | Kullanıcı deneyimini bozmamak için |
| `llm.js` | 138-167 | Health check entegrasyonu | Her endpoint için sağlık kontrolü |
| `parser.js` | 264-267 | UI feedback: "QUERYING..." state | Kullanıcıya LLM sorgusunun başladığını bildirmek |
| `parser.js` | 269-278 | try/catch wrapper for `llm_analyze_memory` | Error handling |
| `parser.js` | 283-288 | reason logging (error/unreachable/invalid) | Debug kolaylığı |
| `parser.js` | 308-323 | try/catch wrapper for `llmTest` | Error handling |

### 9.2 Araç Kullanımları

| Araç | Kullanım Amacı |
|------|----------------|
| `read` | Dosya içeriklerini okumak |
| `websearch` | llama.cpp dokümantasyonu ve Qwen3.5 crash raporları araştırmak |
| `write` | Bu raporu oluşturmak |

### 9.3 Sonraki Adımlar

1. **llama.cpp server'ı başlat:** Qwen3.5-2B modeli ile test et
2. **Gerçek browser testi:** `inject()` fonksiyonunu çağır, console loglarını kontrol et
3. **Model değişikliği:** Daha kararlı bir model kullanılabilir (örn: qwen2.5:3b)
4. **IPv6 sorunu:** `localhost` yerine `127.0.0.1` kullanmayı dene

---

**Rapor Tamamlandı.**