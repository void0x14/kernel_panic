# Kernel Panic — llama.cpp Entegrasyonu Debug Raporu

## Proje Öznesi

- **Frontend:** Plain browser JS
- **LLM endpoint hedefi:** `http://localhost:8080/completion`
- **Server:** llama.cpp local HTTP server
- **Model:** `/home/void0x14/İndirilenler/LLM/Qwen3.5-2B-UD-Q2_K_XL.gguf`

---

## Bugünkü Yapılan İşlemler

### 1. Kod İncelemesi

- **`gfx/llm.js`:** LLM_PORT=8080, LLM_PATH=/completion, LLM_TIMEOUT_MS=15000. getEndpointCandidates() döndürüyor: [pageHost, '127.0.0.1', 'localhost']. requestCompletion() fetch POST yapar, content alanını parse eder. llm_analyze_memory(text) endpoint'leri dener, ilk başarılı scene'i döndürür.
- **`gfx/parser.js`:** buildSceneData() llm_analyze_memory çağırır, parseLlmSceneData ile SceneData üretir. source='llm' veya 'fallback' olur. injectText() ana girdi kanalıdır.
- **`gfx/gfx.js`:** WASM init, scene debug paneli.
- **`gfx/index.html`:** Script sıralaması: gfx.js → llm.js → parser.js.

### 2. Shell Testleri (Gerçek Sonuçlar)

- `ps aux | grep llama-server`: Server çalışıyor, `--host 0.0.0.0 --port 8080`
- `ss -tlnp | grep 8080`: `LISTEN 0.0.0.0:8080` (sadece IPv4)
- `curl http://localhost:8080/completion POST`: 200 OK (curl IPv4 fallback yapıyor)
- `curl http://127.0.0.1:8080/completion POST`: 200 OK
- `curl http://[::1]:8080/completion POST`: Connection refused (IPv6 dinlenmiyor)
- `curl OPTIONS localhost:8080 Origin:...`: 200 OK, Access-Control-Allow-Origin header var
- `curl OPTIONS 127.0.0.1:8080 Origin:...`: 200 OK

### 3. codesearch Bulguları

- llama.cpp dokümantasyonundaki Node.js test örneği `127.0.0.1` kullanıyor, `localhost` değil
- Server crash GitHub issue'su mevcut (#20129)

### 4. Tutarlı Davranış

- **Browser log:** `POST http://localhost:8080/completion net::ERR_CONNECTION_REFUSED`
- **Server log:** `OPTIONS /completion 200`, `POST /completion 200`

> Yani bazen server çalışıyor, bazen browser bağlanamıyor.

### 5. Olası Kök Nedenler (Kesin Sonuç VERİLMEDİ)

1. **IPv6/IPv4 Fallback Sorunu:** `localhost` resolve edilirken IPv6 (`::1`) denenebilir → fail → browser fallback yapmıyor.
2. **Server Crash:** Server crash oluyor / kapanıyor (kullanıcı söyledi: "kendı kendıne kapanıyor").
3. **Startup Timing:** Browser fetch atarken server henüz hazır değil.

### 6. Neden Çözülmedi

- Henüz kod değişikliği yapılmadı.
- Server crash nedeni araştırılmadı.
- Gerçek browser testi yapılmadı (sadece curl).
- Manuel server başlatma + browser test döngüsü çalıştırılmadı.

### 7. Bir Sonraki Adımlar

- `llm.js`: `localhost` kaldır, `127.0.0.1` kullan (llama.cpp dokümantasyonuna uygun).
- Server crash nedenini bul (stderr log, GPU memory, timeout).
- Manuel test döngüsü: server başlat → browser'da `inject()` → log kontrol.
