# KERNEL PANIC — TAM PROJE MASTER DOKÜMANI
Bu dokümanı her AI'a konuşma başında ver. Bağlam bu.

---

## MASTER CONTEXT — HER AI'A VER

```
PROJECT: Kernel Panic
TAGLINE: "Geçmişini izlemiyorsun, onun içine giriyorsun."

WHAT IT IS:
Kernel Panic, insan bilincinin, anılarının ve yaşanmışlığının
çalıştırılabilir bir modelidir. Bir memory OS. Kullanıcı bir anıyı
herhangi bir tetikleyiciyle çağırır (metin, ses, video, tarih, kişi,
his, fotoğraf). O anıya kendi geçmiş benliği olarak girer. Sahne
canlıdır — pasif/yarı-interaktif/interaktif modda ilerler. Geri sarma
yoktur; yeni deneme yeni timeline üretir, eski korunur. Sistem arka
planda LLM ile sahneyi sürekli tarar: o anda göremediğin baskıları,
bağlantıları, kaçırılan sinyalleri sessizce loglar. Kullanıcı hazır
olduğunda bunları "hidden context" olarak görür. Fork: herhangi bir
karar noktasında "başka seçseydim?" diye dallanır, iki timeline
bağımsız evrimleşir. Sistem entropi hesaplar; kaos eşiği aşılınca
"kernel panic" tetiklenir.

MODES:
- Pasif: kullanıcı ortamda var, kimse fark etmiyor (düşük ihtimal
  hariç — çevre onu düşük olasılıkla algılayabilir, bu probabilistik
  ve her frame hesaplanır)
- Yarı-interaktif: bazı müdahaleler mümkün, sınırlı world-response
- İnteraktif: tam müdahale, yüksek causal drift riski,
  varlığın sahneyi bozuyor

VISUAL TARGET:
Anının geçtiği ortam 3D olarak üretilir. Metin/ses/video/fotoğraf
inputtan LLM lokasyon+atmosfer çıkarır, görsel sahne üretilir.
WebGPU ile render. Yerel model ile görsel üretim hedefi.

TECHNICAL STACK:
- Backend: Zig 0.16.0, Linux x86_64, std.posix, sıfır bağımlılık
- Simulation: wasm32-freestanding Zig modülü, client-side
- Render: Vanilla JS + WebGPU + WGSL, sıfır bağımlılık
- LLM: yerel küçük model, edge çalışma, swap edilebilir interface
- Storage: append-only binary event log, arena allocator per session
- Protocol: custom binary, 17-byte header, WebSocket (TCP upgrade)

MATH MODEL:
Ornstein-Uhlenbeck SDE:
  dx = θ(0-x)dt + σ·dW  (aynısı y ve z için)
  θ=0.3 (attractor pull), σ=emotion_intensity×1.5 (max 1.5), dt=0.016
  panic_score = distance(state, origin) / 3.0
  is_panic = panic_score > 1.0
  fork: deep copy StateVector + forked.sigma *= (1 + divergence_coeff)
  Gaussian noise: Box-Muller + xorshift64(session_id XOR tick)

MEMORY EVENT MODEL:
  timestamp: u64
  location: [64]u8
  emotion_valence: f32  (-1.0 to 1.0)
  emotion_intensity: f32  (0.0 to 1.0)
  context_text: [512]u8
  sigma: f32  (derived: min(intensity * 1.5, 1.5))

DATA PHILOSOPHY:
- Append-only: hiçbir şey silinmez, her timeline korunur
- Deterministic: aynı seed = aynı replay
- Client-side simulation: sunucu sadece event relay + storage
- LLM interface swap edilebilir: şimdi küçük yerel model,
  ileride özel mimari
- Her modül CPU-only fallback taşımalı (Raspberry Pi hedefi)
- Karmaşıklık aptallıktır. Kod basit, okunabilir, düz olmalı.

BUSINESS:
- Open Core: simülasyon motoru + sahne motoru açık kaynak
- SaaS: hosted history, fork replay, lifetime abonelik
- Hedef: ilk 3 ayda $1000-2500

WHAT IT IS NOT:
- Video oynatıcı değil
- Journaling app değil
- n8n/node graph değil
- Dashboard değil
- 2D değil
- Sıradan replay değil — sahne canlı ve tepkisel
```

---

## TAMAMLANAN AŞAMALAR

### ✅ AŞAMA 1 — COGNİTİVE CORE (TAMAMLANDI)

**Dosyalar:** `sim/sim.zig`, `build.zig`
**Çıktılar:** `zig-out/bin/kernel-panic-sim` (native), `zig-out/bin/kernel-panic-sim.wasm`

**Ne yapıldı:**
- OU SDE implementasyonu (xorshift64 + Box-Muller + Euler-Maruyama)
- StateVector, MemoryEvent, PanicEvent packed struct'ları
- sim_init / sim_step / sim_fork / sim_panic_score / sim_apply_event export'ları
- Arena semantics: MAX_BRANCHES=64 sabit slot, sıfır bireysel free()
- Determinizm doğrulandı: aynı seed=42 → aynı çıktı

**Test sonuçları:**
- Self-test PASS: forked panic (4.49) > original panic (3.13)
- Determinizm PASS: diff run1.txt run2.txt → boş çıktı
- WASM build PASS: kernel-panic-sim.wasm üretildi

---

### ✅ AŞAMA 2 — WEBGPU TEMEL PIPELINE (TAMAMLANDI)

**Dosya:** `gfx/index.html`

**Ne yapıldı:**
- WebGPU device + adapter init
- WGSL vertex + fragment shader
- GPUUniformBuffer ile kamera matrisi
- First-person kamera: pointer lock, yaw/pitch, WASD
- 20 hardcoded node render (5 kırmızı, 15 beyaz)
- requestAnimationFrame render loop

---

### ✅ AŞAMA 3 — WASM + GFX BAĞLANTISI (TAMAMLANDI)

**Dosyalar:** `gfx/gfx.js`, `gfx/index.html` güncellendi

**Ne yapıldı:**
- sim.wasm JS'de yüklendi: WebAssembly.instantiateStreaming()
- WASM linear memory'den StateVector DataView ile okunuyor
- sim_step() her frame çağrılıyor, x,y,z → GPU vertex buffer
- F tuşu: sim_fork(0, 0.6) çağırır, yeni branch render edilir
- panic_score > 1.0 → node kırmızıya döner
- Branch renk sistemi: branch0=beyaz, branch1=cyan, branch2=sarı

**Test:** WASM loaded, sim running. panic score attractor'a geri dönüyor.

---

### ✅ AŞAMA 4 — ANI INPUT PIPELINE (TAMAMLANDI)

**Dosya:** `gfx/parser.js`

**Ne yapıldı:**
- Kanal 1: serbest metin → keyword scoring → MemoryEvent → sim_apply_event()
- Kanal 2: ChatGPT JSON export parser (conversations.mapping)
- Kanal 3: Gemini JSON export parser (farklı format desteği)
- DataView ile WASM scratch buffer'a (offset 8192) yazma
- Keyword listesi Türkçe + İngilizce, genişletildi
- Fallback: keyword bulunamazsa baseline sigma=0.075

**Test:** "sinirliydim korku panik" → valence negatif, sigma artıyor ✅

---

### 🔄 AŞAMA 5 — LLM SAHNE ÇIKARIMI (SIRADA)

**Dosya:** `gfx/llm.js` (index.html'e inline edilecek)

**LLM backend:** llama.cpp server
**Endpoint:** `POST http://localhost:8080/completion`

**Ne yapılacak:**
- `llm_analyze_memory(text)` swap edilebilir interface
- metin → structured JSON (location, atmosphere, time_of_day, weather,
  emotion_valence, emotion_intensity, persons, hidden_context_candidates)
- JSON extraction: ilk `{` ile son `}` arası parse
- Fail durumu: keyword scoring fallback (parser.js)
- Sonuç → `window._kpSceneData` global'e yazılır

---

## DEVAM EDEN AŞAMALAR

---

### AŞAMA 2 — WEBGPU TEMEL PIPELINE

**Ne yapılıyor ve neden bu sırada:**
WASM çalışıyor ama göremiyorsun. Render pipeline olmadan simülasyonun
doğru çalışıp çalışmadığını gözle test edemezsin. Bu aşamada LLM yok,
WASM bağlantısı yok. Sadece WebGPU'nun çalıştığını kanıtlıyoruz.

**Dosya:** `gfx/index.html` (tek dosya, her şey inline)

**Bu aşamada yapılacaklar:**
- WebGPU device + adapter init
- WGSL vertex + fragment shader (hardcoded renkler)
- GPUUniformBuffer ile kamera matrisi (her frame güncellenir)
- Perspective projection matrix (4x4, sıfır bağımlılık, JS'de manuel)
- First-person kamera: mouse pointer lock, yaw/pitch, WASD hareket
- 20 hardcoded node, 3D uzayda sabit pozisyonlar
- 5 node kırmızı "PANIC" etiketi, 15 node beyaz
- requestAnimationFrame render loop
- Arka plan: #0a0a0a near-black

**Araştırman gereken kavramlar:**
- **WebGPU device init flow:** navigator.gpu → requestAdapter →
  requestDevice. Bu zincir başarısız olursa tarayıcı WebGPU
  desteklemiyor demektir, plain text hata göster.
- **GPUUniformBuffer:** CPU her frame yazar, GPU okur. Kamera matrisi
  burada. Buffer boyutu 64 byte (4x4 float32 matris).
- **GPUStorageBuffer:** Compute shader yazar, vertex shader okur.
  Node pozisyonları burada. Uniform'dan farkı: storage shader'dan
  yazılabilir.
- **WGSL:** WebGPU'nun shader dili. C'ye benzer ama tip sistemi daha
  katı. Vertex shader pozisyon alır, fragment shader renk döndürür.
- **Perspective projection:** FOV, aspect ratio, near/far plane.
  4x4 matris. Her frame kamera matrisiyle çarpılır.
- **Pointer Lock API:** Mouse'u yakala, sonsuz hareket al.
  `canvas.requestPointerLock()` — first-person kamera için zorunlu.

**Araştırma keyword listesi:**
- "WebGPU getting started 2025 vanilla js"
- "WebGPU perspective projection matrix javascript"
- "WebGPU uniform buffer update every frame"
- "WGSL vertex shader position builtin"
- "pointer lock API first person camera"
- "WebGPU render pipeline descriptor"
- "requestAnimationFrame WebGPU render loop"

**AI'a verilecek prompt:**
```
MASTER CONTEXT:
[master context'i buraya yapıştır]

COMPLETED: Phase 1 — sim.zig DONE. WASM compiled successfully.

CURRENT TASK: Phase 2 — WebGPU Base Pipeline
FILE: gfx/index.html (single file, ALL JS and WGSL inline, no imports)

Build a working WebGPU 3D scene. No simulation yet. No LLM.
Purpose: prove WebGPU pipeline works before wiring sim.wasm.

REQUIREMENTS:
- Zero external dependencies. No CDN. No npm.
- Single index.html. All JavaScript and WGSL inline.
- WebGPU only (navigator.gpu). If not available: show plain text error.
- No WebGL fallback.

SCENE:
- 20 nodes rendered as point sprites or small spheres in 3D space
- 5 nodes: color RED, label "PANIC" rendered near them
- 15 nodes: color WHITE
- Hardcoded positions: spread across (-5,-5,-5) to (5,5,5) range
- Background: #0a0a0a

CAMERA:
- First-person. WASD movement. Mouse look via Pointer Lock API.
- FOV: 75 degrees. Near: 0.1. Far: 100.0.
- Start position: (0, 0, -5) looking toward origin.
- Perspective projection matrix computed in JS, uploaded to
  GPUUniformBuffer every frame.

SHADERS (WGSL, inline as template literals):
- Vertex: reads position (vec3f) + color (vec3f) from vertex buffer.
  Applies view-projection matrix from uniform buffer.
- Fragment: outputs vertex color.
- No lighting calculations yet.

BUFFERS:
- GPUUniformBuffer (64 bytes): 4x4 view-projection matrix.
  Updated every frame via queue.writeBuffer().
  WHY uniform: small, read-only from shader, updated once per frame.
- GPUVertexBuffer: interleaved position+color for all 20 nodes.
  WHY vertex: per-node data, read once per draw call.

RENDER LOOP:
- requestAnimationFrame continuous loop.
- Each frame: update camera matrix → writeBuffer → encode → submit.

SELF-TEST:
- On successful pipeline init, console.log:
  "Kernel Panic GFX v0.1: WebGPU OK, 20 nodes, 5 panic"
- Press P key: log current camera position to console.

COMMENT STYLE: WHY not WHAT.
Example: "// GPUUniformBuffer: written once per frame by CPU,
         read many times by vertex shader — uniform semantics"
NOT: "// create buffer"
```

**Çıktıyı nasıl doğrularsın:**
1. `gfx/index.html` dosyasını Chrome veya Brave'de aç (file:// ile)
2. Ekranda noktalar görünüyor mu? 5 kırmızı, 15 beyaz?
3. Mouse ile bakabiliyorsun ve WASD ile hareket ediyor musun?
4. Console'da "Kernel Panic GFX v0.1: WebGPU OK, 20 nodes, 5 panic" var mı?
5. Hata yoksa PASS.

---

### AŞAMA 3 — WASM + GFX BAĞLANTISI

**Ne yapılıyor ve neden bu sırada:**
WebGPU çalışıyor, sim.wasm çalışıyor. Şimdi ikisini birleştiriyoruz.
Hardcoded node pozisyonları kaldırılıyor. StateVector'dan gelen
gerçek x,y,z koordinatları GPU buffer'a besleniyor.

**Dosyalar:** `gfx/index.html` güncellemesi + `gfx/gfx.js` (ayrılıyor)

**Bu aşamada yapılacaklar:**
- sim.wasm'ı JS'de yükle: `WebAssembly.instantiateStreaming()`
- WASM linear memory'den StateVector oku
- sim_init() çağır, sim_step() her frame çağır
- StateVector x,y,z → GPU vertex buffer güncelle
- panic_score > 1.0 ise o node kırmızıya dönsün
- 64 branch için 64 node render et
- Branch 0 beyaz, fork'lanmış branch'ler farklı renk

**Araştırman gereken kavramlar:**
- **WebAssembly.Memory:** WASM'ın linear memory'si. JS tarafından
  `new Uint8Array(instance.exports.memory.buffer)` ile okunur.
- **DataView:** WASM memory'den float32 okumak için.
  `new DataView(memory.buffer).getFloat32(offset, true)` —
  true = little-endian.
- **StateVector memory layout:** packed struct. x=offset 0 (f32,4b),
  y=4, z=8, sigma=12, theta=16, tick=20 (u64,8b), branch_id=28 (u32,4b).
  Toplam 32 byte per branch.
- **GPU buffer dynamic update:** Her frame vertex buffer'ı yeniden
  yaz. `queue.writeBuffer(vertexBuffer, 0, newData)`.

**Araştırma keyword listesi:**
- "WebAssembly instantiateStreaming javascript"
- "read float32 from wasm memory javascript DataView"
- "WebGPU writeBuffer every frame"
- "WASM linear memory layout struct"
- "WebAssembly exports memory javascript"

---

### AŞAMA 4 — ANI INPUT PIPELINE

**Ne yapılıyor ve neden bu sırada:**
Simülasyon görsel olarak çalışıyor. Şimdi gerçek veri girişi
yapıyoruz. Kullanıcı bir anıyı sisteme verebilmeli.

**Dosyalar:** `gfx/index.html` UI eklentisi + `net/parser.js` veya
inline JS

**Bu aşamada yapılacaklar:**

**Input kanalı 1 — Metin girişi:**
- Textarea: kullanıcı anısını yazar
- Parse: lokasyon kelimelerini, isimleri, tarihi çıkar
- MemoryEvent struct'ına dönüştür
- sim_apply_event() çağır

**Input kanalı 2 — ChatGPT JSON export:**
- File input ile JSON yükle
- ChatGPT export formatını parse et
  (`conversations[].mapping[].message.content.parts[]`)
- Her mesajı bir MemoryEvent'e dönüştür
- Timestamp, içerik, valence/intensity tahmini

**Input kanalı 3 — Gemini export:**
- Gemini'nin export formatı farklı, ayrı parser

**Araştırman gereken kavramlar:**
- **ChatGPT export format:** JSON. `conversations` array. Her
  conversation'da `mapping` object. Her mapping entry'sinde
  `message.author.role` (user/assistant) ve
  `message.content.parts` array.
- **FileReader API:** Tarayıcıda dosya okuma. `readAsText()`.
  Sıfır bağımlılık, browser native.
- **Valence estimation:** Metin → duygu skoru. LLM olmadan basit
  keyword matching yeterli bu aşamada. "kötü","korku","sinir" →
  negatif. "iyi","mutlu","rahat" → pozitif.

**Araştırma keyword listesi:**
- "ChatGPT export JSON format structure 2025"
- "Gemini conversation export format"
- "FileReader API readAsText javascript"
- "sentiment analysis without library javascript"
- "parse JSON file browser FileReader"

---

### AŞAMA 5 — LLM SAHNE ÇIKARIMI

**Ne yapılıyor ve neden bu sırada:**
Metin girişi çalışıyor. Şimdi yerel LLM bu metni parse edip
structured sahne verisi çıkaracak. Bu veriye dayanarak görsel
parametreler değişecek.

**Dosyalar:** `gfx/llm.js` (inline veya ayrı, CDN yok)

**LLM interface — swap edilebilir:**
```javascript
// Bu fonksiyonun içi değişir, dışarısı değişmez.
// Şimdi: yerel model HTTP API
// Sonra: özel model
async function llm_analyze_memory(text) {
  // returns: { location, atmosphere, persons,
  //            emotion_valence, emotion_intensity,
  //            hidden_context_candidates[] }
}
```

**Yerel model seçimi — test et:**
Önce şu iki modeli test et, hangisi daha temiz JSON döndürüyor gör:
- `qwen2.5:3b` — Türkçe metinde daha iyi
- `gemma3:4b` — genel amaç

Test promptu (bunu modele ver, hangisi daha iyi cevap verirse onu kullan):
```
Şu anı analiz et ve SADECE JSON döndür, başka hiçbir şey yazma:
"2019 yaz, İstanbul Kadıköy, arkadaşımla tartıştım.
Çok sinirliydim, haklı olduğumu düşünüyordum ama dinlemiyordu."

{
  "location": "şehir, semt, mekan tipi",
  "time_of_day": "morning/afternoon/evening/night",
  "weather": "clear/overcast/rain/fog",
  "atmosphere": "tense/calm/melancholic/euphoric/neutral",
  "emotion_valence": -1.0 ile 1.0 arası sayı,
  "emotion_intensity": 0.0 ile 1.0 arası sayı,
  "persons": ["isim veya rol listesi"],
  "hidden_context_candidates": [
    "o anda görülemeyen olası baskı veya sinyal"
  ]
}
```

**Araştırman gereken kavramlar:**
- **Ollama HTTP API:** `POST localhost:11434/api/generate`
  Body: `{ model, prompt, stream: false }`
  Response: `{ response: "..." }`
- **JSON mode / structured output:** Modele "SADECE JSON döndür"
  demek yeterli değil, bazen açıklama ekler. Çözüm: response'u
  parse et, ilk `{` ile son `}` arasını al.
- **Streaming vs non-streaming:** stream:false = tek seferde cevap.
  stream:true = token token gelir. Bu aşamada false yeterli.
- **fetch() API:** Browser native HTTP. CDN yok.

**Araştırma keyword listesi:**
- "Ollama API javascript fetch example"
- "Ollama local model JSON structured output"
- "qwen2.5 3b turkish language quality"
- "extract JSON from LLM response javascript"
- "Ollama stream false javascript"

---

### AŞAMA 6 — ATMOSFERİK SAHNE ÜRETİMİ

**Ne yapılıyor ve neden bu sırada:**
LLM sahne verisi veriyor. Bu veriyi görsel parametrelere çeviriyoruz.
Sahne artık anıya göre renk, ışık, sis, parçacık değiştiriyor.

**Dosyalar:** `gfx/index.html` + `gfx/kernel.wgsl` (WGSL güncellenir)

**Görsel eşleme sistemi:**
```
emotion_intensity  → sis yoğunluğu, parçacık sayısı
time_of_day        → ambient ışık rengi
  morning          → soğuk mavi (#8BAFC8)
  afternoon        → nötr beyaz (#D4D0C8)
  evening          → sıcak turuncu (#C87840)
  night            → derin koyu mavi (#1A2030)
weather            → gökyüzü rengi, atmosferik saçılım
  clear            → düşük sis
  overcast         → yüksek sis
  rain             → sis + parçacık efekti
atmosphere         → gölge renk tonu
  tense            → gölgelerde kırmızıya kayan pas tonu
  calm             → yumuşak yeşil-mavi
  melancholic      → soğuk gri-mor
panic_score > 0.7  → sahne doygunluğu azalır
panic_score > 1.0  → full kernel panic görsel efekti
```

**Kernel panic görsel efekti:**
- Ekran renk inversiyonu nabzı
- Sahne fragmentation (vertex pozisyonları bozuluyor)
- Scan line efekti (yatay çizgi geçişleri)
- Bunlar post-processing pass ile yapılır

**Bu aşamada yapılacaklar:**
- Ground plane procedural (WGSL'de hesaplanır, texture yok)
- Atmospheric fog (distance-based, rengi LLM'den gelir)
- Ambient particles (emotion_intensity ile count değişir)
- Sky color gradient (time_of_day'e göre)
- Panic post-processing pass

**Araştırma keyword listesi:**
- "WebGPU fog shader WGSL distance"
- "WebGPU post-processing render pass"
- "WGSL procedural ground plane"
- "WebGPU particle system compute shader"
- "screen space effects WebGPU"
- "color desaturation WGSL fragment shader"

---

### AŞAMA 7 — KARAKTER VE VARLIK SİSTEMİ

**Ne yapılıyor ve neden bu sırada:**
Sahne atmosferi çalışıyor. Şimdi anıdaki kişiler sahneye giriyor.
Bu aşamada fotorealistik değil — capsule geometry (silindir+küre).
İleride geliştirilir.

**Bu aşamada yapılacaklar:**
- Her kişi için capsule geometry (WGSL'de procedural)
- Kişi pozisyonları LLM'den gelen persons[] array'inden
- Kullanıcının "geçmiş benliği": ayrı bir capsule, hafif farklı renk
- Kişiler arası ilişki yoğunluğuna göre aralarında ışık bağı
- Pasif modda: kullanıcı capsule'ı yarı saydam
- İnteraktif modda: kullanıcı capsule'ı tam opak

**Perception threshold sistemi (pasif mod):**
Her frame şu hesap yapılır:
```
detection_prob = base_prob(0.02) 
              + proximity_factor 
              + relationship_strength
              + user_interaction_level
```
Eğer `random() < detection_prob` ise world_response tetiklenir.
Bu stochastik — her çalıştırmada farklı.

**Araştırma keyword listesi:**
- "WebGPU capsule geometry WGSL"
- "procedural cylinder sphere geometry javascript"
- "transparent rendering WebGPU alpha blending"
- "stochastic event trigger per frame gameloop"

---

### AŞAMA 8 — HİDDEN CONTEXT SİSTEMİ

**Ne yapılıyor ve neden bu sırada:**
Sahne ve karakterler çalışıyor. Şimdi LLM arka planda sürekli
sahneyi tarıyor ve o anda görülemeyen şeyleri loglıyor.

**Bu aşamada yapılacaklar:**
- LLM streaming: sahne sürekli background thread'de analiz ediliyor
  (Web Worker içinde — UI bloklamamak için)
- Her 5 saniyede LLM'e mevcut sahne state'i + son 10 event veriliyor
- LLM hidden_context_candidates döndürüyor
- Bunlar event log'a ekleniyor (append-only)
- Sahne içinde hidden context olan objeler/kişiler subtle cyan glow
  alıyor (diegetic UI — popup değil, sahne içi sinyal)
- Kullanıcı hazır olduğunda veya anıdan çıkınca: hidden context panel

**Diegetic UI prensibi:**
Bilgi popup veya HUD olarak değil, sahnede nesne olarak gösterilir.
Hidden context → o kişinin etrafında hafif cyan hale.
Causal drift → ortamda hafif renk kayması.
Panic yaklaşıyor → hava ağırlaşıyor, sis yoğunlaşıyor.

**Araştırma keyword listesi:**
- "Web Worker background fetch javascript"
- "diegetic UI game design implementation"
- "WebGPU glow effect bloom post processing"
- "streaming LLM response Web Worker"
- "append-only log javascript array"

---

### AŞAMA 9 — FORK VE TİMELINE UI

**Ne yapılıyor ve neden bu sırada:**
Tüm temel sistem çalışıyor. Şimdi projenin en kritik özelliği:
fork ve timeline karşılaştırması.

**Bu aşamada yapılacaklar:**
- Fork UI: kullanıcı herhangi bir anda F tuşuna basar
- Divergence coefficient slider: 0.0 - 1.0
- sim_fork() çağrılır, yeni branch başlar
- İki branch paralel ilerler (iki ayrı 3D kamera, split-screen veya
  toggle ile görüntülenir)
- Timeline visualization: alt panel, iki dal ayrılıyor, panic
  score'u her branch için sürekli gösteriyor
- Kritik ayrışma noktaları işaretlenir: iki branch'in panic score'u
  en çok farklandığı tick

**Araştırma keyword listesi:**
- "WebGPU split screen two viewports"
- "timeline branching visualization canvas"
- "two simultaneous WebGPU render passes"
- "divergence visualization game UI"

---

### AŞAMA 10 — MOD SİSTEMİ TAM İMPLEMENTASYONU

**Ne yapılıyor:**
Pasif / yarı-interaktif / interaktif modlar tam çalışıyor.

**Pasif mod:**
- Kullanıcı sahneye girer, kimse görmüyor
- Her frame: detection_prob hesaplanır, tetiklenirse world_response
- Kullanıcı hareket edebilir ama eylem yapamaz
- sigma hafif düşük tutulur (düşük müdahale = düşük entropi)

**Yarı-interaktif mod:**
- Kullanıcı bazı nesnelere yaklaşabilir, etkileşebilir
- Her etkileşim sigma'yı artırır
- Kişiler kullanıcıyı daha yüksek ihtimalle fark eder

**İnteraktif mod:**
- Tam müdahale
- Her eylem bir MemoryEvent olarak log'a girer
- Sigma dramatik şekilde artar
- World response güçlü tetiklenir
- Panic riski yüksek

---

### AŞAMA 11 — ÇOKLU INPUT PIPELINE

**Ne yapılıyor:**
Metin dışında diğer input kanalları.

**Ses input:**
- Web Audio API (browser native)
- Kullanıcı ses kaydeder veya dosya yükler
- Web Speech API ile transcript çıkar (browser native, CDN yok)
- Transcript → MemoryEvent pipeline'ına girer

**Fotoğraf input:**
- File input, FileReader
- EXIF metadata'dan tarih/lokasyon çıkar
- LLM'e görsel açıklama yaptır (multimodal model gerekir)
- Açıklama → MemoryEvent

**Video input:**
- Video dosyası yükle
- Her N saniyede bir frame al (Canvas 2D ile)
- Frame → LLM'e gönder → sahne verisi
- Audio track → Web Audio API

**Araştırma keyword listesi:**
- "Web Speech API transcript javascript"
- "EXIF metadata javascript FileReader"
- "video frame extraction canvas javascript"
- "Web Audio API javascript no library"
- "multimodal local LLM image input"

---

### AŞAMA 12 — BACKEND

**Ne yapılıyor ve neden en sona:**
Demo için backend gerekmez. Local dosyadan çalışır. Ama çok
kullanıcılı, hosted SaaS için backend şart.

**Dosyalar:** `kernel/main.zig`, `net/protocol.zig`,
`net/handler.zig`, `store/store.zig`, `store/event.zig`

**kernel/main.zig:**
- KERNEL_PORT env var ile yapılandırılabilir TCP listener
- std.posix accept loop
- Thread-per-connection
- Her connection için ArenaAllocator(page_allocator)
- SIGINT ile clean shutdown

**net/protocol.zig:**
Wire format: `[TYPE:u8][TIMESTAMP:u64][SESSION_ID:u32][PAYLOAD_SIZE:u32]`
= 17 byte, little-endian, padding yok.
NOT: Tarayıcı raw TCP açamaz. Zig backend WebSocket handshake yapacak
(RFC 6455), üstünden binary frame taşıyacak.

**store/store.zig:**
Append-only binary event log. Her event < 512 byte. Checkpoint
referansları. Replay: T=0'dan veya herhangi checkpoint'ten.

**Araştırma keyword listesi:**
- "Zig 0.16 std.posix socket accept"
- "WebSocket handshake RFC 6455 implementation"
- "Zig arena allocator per thread"
- "append-only binary file format"
- "Zig packed struct little-endian"
- "WebSocket binary frame framing"

---

### AŞAMA 13 — OPEN CORE + SAAS HAZIRLIĞI

**Ne yapılıyor:**
Proje ship edilmeye hazır. Açık çekirdek yayınlanır, SaaS satışa açılır.

**GitHub:**
- kernel/sim.zig + gfx/ = open core olarak yayınla
- README: projeyi anlatan, demo video'yu gösteren
- CONTRIBUTING.md
- Manifesto yazısı (sözünü tutman gereken)

**SaaS:**
- Gumroad veya Lemon Squeezy hesabı aç
- Lifetime erişim fiyatı belirle
- Hosted version: backend deploy (en ucuz VPS yeterli —
  simülasyon client-side, sunucu sadece relay+storage)

**Demo video:**
- Ekran kaydı: anı gir → sahneye gir → fork yap → iki timeline →
  panic tetikle
- YouTube + Twitter/X + Reddit (r/LocalLLaMA, r/selfhosted,
  r/MachineLearning)
- Hacker News "Show HN" post

---

## GENEL AI KULLANIM STRATEJİSİ

### Her konuşma başında ne ver

1. Master context'i yapıştır
2. Hangi aşamada olduğunu söyle
3. Hangi dosyalar tamamlandı, ne çalışıyor söyle
4. Bu aşamada ne yapılacak söyle

### Hata aldığında ne yap

```
MASTER CONTEXT: [master context]
MEVCUT DOSYA: [dosya adı]
ZIG VERSIYONU: 0.16.0-dev.2722+f16eb18ce
HATA:
[tam hata mesajı buraya]

Zig 0.16.0 için düzelt. Sadece değişen satırları göster.
Neden bu hata oluştu, tek cümle açıkla.
```

### Model seçimi

- Mimari karar, kavram açıklama, roadmap: Claude Sonnet/Opus
- Zig kodu: Antigravity Opus (agentic mod)
- JS/WGSL kodu: Antigravity Opus veya GPT-4.5
- Çapraz doğrulama: farklı model ile kontrol et
- Matematik: WolframAlpha veya manuel hesap

### Zig 0.16.0 bilinen farklılıklar

- `std.io.getStdErr()` → kullanma, yerine `std.debug.print`
- `packed struct` içinde array → `extern struct` kullan
- `u1`, `u2` parametre ismi olarak kullanılamaz (primitive tip)
- Build API: `b.createModule()` + `root_source_file: b.path(...)`
- WASM target: `b.resolveTargetQuery(.{ .cpu_arch = .wasm32, .os_tag = .freestanding })`

---

## MEVCUT DURUM

**Tamamlanan:** Aşama 1 ✅ Aşama 2 ✅ Aşama 3 ✅ Aşama 4 ✅
**Sıradaki:** Aşama 5 — LLM Sahne Çıkarımı (`gfx/llm.js`)
**LLM backend:** llama.cpp server, POST http://localhost:8080/completion
**Dosya hedefi:** `gfx/llm.js` (index.html'e script tag ile eklenir)

**Aşama 5 için Opus'a verilecek prompt:**
```
MASTER CONTEXT: [master context'i yapıştır]

COMPLETED:
- Phase 1: sim/sim.zig DONE. WASM compiled.
- Phase 2: gfx/index.html DONE. WebGPU pipeline working.
- Phase 3: gfx/gfx.js DONE. WASM wired to GPU.
- Phase 4: gfx/parser.js DONE. Text + ChatGPT + Gemini import working.

CURRENT TASK: Phase 5 — LLM Scene Extraction
NEW FILE: gfx/llm.js

LLM backend: llama.cpp server
Endpoint: POST http://localhost:8080/completion
Request: { "prompt": "...", "n_predict": 512, "temperature": 0.1 }
Response: { "content": "..." }

SWAP-ABLE INTERFACE — this function signature never changes:
async function llm_analyze_memory(text) → SceneData | null

SceneData:
{
  location: string,
  time_of_day: "morning"|"afternoon"|"evening"|"night",
  weather: "clear"|"overcast"|"rain"|"fog",
  atmosphere: "tense"|"calm"|"melancholic"|"euphoric"|"neutral",
  emotion_valence: float -1.0..1.0,
  emotion_intensity: float 0.0..1.0,
  persons: string[],
  hidden_context_candidates: string[]
}

PROMPT TEMPLATE:
"Analyze this memory and return ONLY valid JSON, no explanation, no markdown:
<memory>{USER_TEXT}</memory>

{
  \"location\": \"city or place\",
  \"time_of_day\": \"morning|afternoon|evening|night\",
  \"weather\": \"clear|overcast|rain|fog\",
  \"atmosphere\": \"tense|calm|melancholic|euphoric|neutral\",
  \"emotion_valence\": <-1.0 to 1.0>,
  \"emotion_intensity\": <0.0 to 1.0>,
  \"persons\": [\"person or role\"],
  \"hidden_context_candidates\": [\"hidden pressure or signal\"]
}"

JSON EXTRACTION:
Find first { and last } in response, parse that substring.
If JSON.parse fails: return null.

INTEGRATION with parser.js:
In window._kpParser.injectText():
  1. Call llm_analyze_memory(text) first
  2. If result != null: use result values instead of keyword scoring
  3. If null: fall back to existing scoreEmotion()
  4. Always write to window._kpSceneData for scene rendering

ERROR HANDLING:
- llama.cpp may not be running — catch fetch error, fall back silently
- Log warning: "[LLM] llama.cpp not reachable, using keyword fallback"
- Never block user action waiting for LLM

SELF-TEST:
console.log on load: "LLM module ready, endpoint: http://localhost:8080/completion"
Expose: window._kpLLM.test("2019 yaz Istanbul sinirliydim")
  → logs full SceneData JSON to console

HARD CONSTRAINTS:
- Zero dependencies. fetch() only. No CDN.
- Comments: WHY not WHAT.
```
