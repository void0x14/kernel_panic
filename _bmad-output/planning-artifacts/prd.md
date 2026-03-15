---
stepsCompleted:
  - step-01-init
  - step-01b-continue
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
inputDocuments: []
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 0
classification:
  projectType: web_app
  domain: scientific
  complexity: high
  projectContext: greenfield
workflowType: 'prd'
workflow: 'edit'
lastEdited: '2026-03-11T14:30:22+03:00'
editHistory:
  - date: '2026-03-10T15:27:34+03:00'
    changes: 'Hardened success criteria, clarified scope boundaries, strengthened FR/NFR measurability, added scientific accuracy contract'
  - date: '2026-03-11T14:30:22+03:00'
    changes: 'Realigned PRD to immutable system context, removed narrative drift, hardened raw TCP, 17-byte binary protocol, std.posix, per-session arena, client-only Wasm simulation, and fixed module boundaries'
---

# Product Requirements Document - kernel_panic

**Author:** Void0x14
**Date:** 2026-03-11T14:30:22+03:00

## Executive Summary

Kernel Panic, ChatGPT ve Gemini sohbet dışa aktarımlarını append-only event log'a dönüştüren, bu event geçmişini 3D bilişsel durum uzayında temsil eden ve kullanıcıya aynı karar noktasından alternatif fork'lar üretme imkanı veren bir Cognitive Operating System'dir. Ürün, productivity aracı değildir. Amaç, travma döngüleri, başarısız karar çatalları ve entropi kaynaklı state collapse anlarını replay edilebilir, ölçülebilir ve karşılaştırılabilir hale getirmektir.

Sistem iki katmanlıdır. Sunucu yalnızca oturum kabulü, binary frame taşıma, append-only saklama ve replay sağlar. Bilişsel simülasyon sunucuda çalışmaz. Tüm state evolution, fork traversal, attractor stability hesabı ve panic threshold analizi istemcide çalışan `wasm32-freestanding` Zig modülündedir. Runtime veri yolu yalnızca raw TCP ve özel binary framedir. Header sabittir: `[TYPE:u8][TIMESTAMP:u64][SESSION_ID:u32][PAYLOAD_SIZE:u32]`. Toplam 17 byte, little-endian, paddingsizdir. Wire üzerinde JSON, HTTP, CBOR, MessagePack ve Protobuf yoktur.

Ürün mimarisi sabit modül sınırlarına dayanır: `/kernel`, `/net`, `/gfx`, `/sim`, `/store`. `/kernel` oturum yaşam döngüsünü ve accept loop'u yürütür. `/net` binary frame sözleşmesini taşır. `/gfx` WebGPU render katmanıdır. `/sim` istemci tarafı Wasm simülasyon çekirdeğidir. `/store` append-only event log ve replay/checkpoint altyapısını taşır. Modüller birbirine yalnızca açık arayüzlerden bağlanır; sibling modül iç detaylarına doğrudan bağımlılık kabul edilmez.

## Project Classification

- Proje Tipi: Desktop-first web uygulaması
- Domain: Bilişsel simülasyon ve replay tabanlı state-space analiz
- Karmaşıklık: Yüksek
- Proje Bağlamı: Greenfield
- Ticari Model: Open Core + SaaS
- Teknik Omurga: Zig 0.16.0, Linux x86_64, `std.posix`, `wasm32-freestanding`, Vanilla JS, WebGPU, WGSL, özel binary protokol, sıfır harici bağımlılık

## Success Criteria

### User Success

Kullanıcı, desteklenen sohbet export dosyasını içeri alıp aynı oturum içinde event timeline'ı, 3D state-space görünümünü ve en az bir fork karşılaştırmasını görebilmelidir. İlk değer anı; import tamamlandıktan sonra kullanıcının belirli bir karar noktasını seçmesi, aynı noktadan alternatif branch üretmesi ve panic threshold'a yaklaşım farkını karşılaştırabilmesidir. Ürün, kullanıcıya "neden burada collapse oldu?" sorusuna event provenance ve branch divergence üzerinden tekrar oynatılabilir bir yanıt üretmelidir.

### Business Success

İlk 3 ay başarısı, açık çekirdeğin teknik topluluk tarafından benimsenmesi ve hosted replay/history katmanına organik ilgi oluşmasıdır. 12 aylık başarı, hosted saklama ve fork-replay katmanlarının ücretli dönüşüm üretmesiyle tanımlanır. Ticari ölçüm; import başına fork oranı, 7 günlük replay geri dönüş oranı, ücretli history/replay yükseltme oranı ve saklanan session sayısı üzerinden yapılmalıdır.

### Technical Success

Sunucu, 10K eşzamanlı kullanıcı altında yalnızca kabul döngüsü, binary dispatch, append-only store ve replay işini taşımalıdır. Sunucu tarafında bilişsel simülasyon veya branch evrimi çalıştırmak başarısızlıktır. Oturum başına tek `ArenaAllocator(page_allocator)` kullanılmalı, hot path içinde nesne bazlı `free()` zinciri olmamalı, teardown tek `arena.deinit()` ile tamamlanmalıdır. Runtime taşıma katmanı `std.posix` ile raw TCP üzerinden çalışmalı, her frame 17 byte fixed header taşımalıdır.

### Measurable Outcomes

- İlk değer süresi: yeni kullanıcı ilk importtan ilk replay görünümüne 120 saniye altında ulaşmalıdır; ölçüm yöntemi uçtan uca senaryo testi olmalıdır.
- İlk fork eylemi: import edilen oturumların en az %40'ında kullanıcı ilk oturum içinde en az bir fork başlatmalıdır; ölçüm yöntemi ürün analitiği olmalıdır.
- Sunucu ölçeği: backend 10K eşzamanlı oturum ve 100K event/saniye relay yükünü simülasyon çalıştırmadan taşımalıdır; ölçüm yöntemi yük testi olmalıdır.
- Frame doğruluğu: tüm runtime mesajları 17 byte little-endian header ile serialize/parse edilmelidir; ölçüm yöntemi protocol conformance testi olmalıdır.
- Oturum teardown: 10K nesneli oturum kapanışında teardown süresi 5 ms altında kalmalıdır; ölçüm yöntemi benchmark testi olmalıdır.
- Simülasyon kararlılığı: aynı input, aynı seed ve aynı divergence coefficient ile çalışan replay'ler aynı stable/unstable sınıflandırmasını %99.5 oranında üretmelidir; panic score farkı +/-0.01 normalize puanı geçmemelidir.
- Event kompaktlığı: saklanan her event'in hedef boyutu 512 byte altında kalmalıdır; ölçüm yöntemi binary store benchmark testi olmalıdır.

## Product Scope

### MVP - Minimum Viable Product

MVP, beş çekirdek modülün birlikte çalışan ilk sürümüdür. Amaç, import edilen bir konuşma geçmişini immutable event log'a yazmak, aynı geçmişi istemcide Wasm ile simüle etmek ve WebGPU ile görselleştirmektir. MVP'de runtime taşıma raw TCP'dir. HTTP API, JSON runtime payload ve server-side cognition yoktur.

**MVP explicit in-scope items:**
- `/kernel`: `KERNEL_PORT` ile yapılandırılabilen raw TCP listener, `std.posix` accept loop, SIGINT ile clean shutdown, oturum başına arena allocator, thread-per-connection oturum işleyicisi
- `/net`: 17 byte custom binary header, little-endian frame parse/serialize, message dispatch, invalid frame rejection
- `/store`: append-only binary event log, immutable replay kaynağı, checkpoint referansları için temel zemin
- `/sim`: `wasm32-freestanding` Zig simülasyon çekirdeği, `StateVector(x,y,z)`, fork, divergence coefficient, attractor stability ve panic threshold hesabı
- `/gfx`: tek `index.html` ve `gfx.js` ile WebGPU pipeline, WGSL shader'ları, timeline ile senkronize 3D state-space görselleştirmesi
- ChatGPT ve Gemini JSON export importu
- Tek oturum içinde en az iki branch karşılaştırması
- Panic provenance görünürlüğü ve replay

### Growth Features (Post-MVP)

Growth fazı; hosted history retention, fork-replay paylaşımı, checkpoint restore, daha gelişmiş provenance analizi ve ücretli saklama katmanını içerir. Bu fazda da server-side cognition eklenmez; ücretli katman saklama, replay ve erişim kolaylığı satar.

### Out of Scope for MVP

- Server-side bilişsel simülasyon, SDE çözümü veya branch evrimi
- Runtime taşıma için JSON, HTTP, GraphQL, gRPC veya üçüncü taraf serialization formatları
- `std.os`, `std.os.linux.*`, npm, bundler, CDN scriptleri veya harici JS kütüphaneleri
- Mobil-first deneyim
- Çok kullanıcılı ortak düzenleme, annotation ve destek konsolu
- Diagnostik, terapi veya klinik karar desteği iddiası

### Vision (Future)

Uzun vadeli vizyon, kullanıcının bireysel karar geçmişini ve collapse anlarını replay edilebilir, fork edilebilir ve ölçülebilir bir bilişsel işletim sistemi olarak incelemesidir. Ücretli katman, daha uzun history saklama, daha hızlı replay açılışı ve gelişmiş branch karşılaştırma araçları sunar. Temel ilke değişmez: hesaplama istemcide, sunucu event log ve relay omurgasıdır.

## User Journeys

### Journey 1: Import ve İlk Replay

Kullanıcı ChatGPT veya Gemini export dosyasını yükler. Sistem export'u ortak event modeline normalize eder, append-only store'a yazar ve yeni bir oturum kimliği üretir. İstemci aynı oturumun event timeline'ını ve state-space görünümünü açar. Başarı ölçütü, kullanıcının manuel veri temizliği yapmadan ilk replay ekranına ulaşmasıdır.

Gerekli yetenekler: import parsing, event normalization, session bootstrap, immutable store write, timeline render, state-space render.

### Journey 2: Fork ve Divergence Karşılaştırması

Kullanıcı belirli bir karar noktasını seçer, divergence coefficient tanımlar ve yeni branch üretir. İstemci mevcut `StateVector` kopyasını kullanarak iki branch'i bağımsız olarak simüle eder. Kullanıcı branch'ler arasında panic threshold yaklaşımını, kritik event zincirini ve divergence farkını karşılaştırır.

Gerekli yetenekler: client-side Wasm simulation, fork creation, branch identity tracking, comparative replay, panic provenance.

### Journey 3: Bozuk veya Düşük Güvenli Import Recovery

Kullanıcı eksik veya bozuk segmentler içeren bir export yükler. Sistem parse edilemeyen segmentleri event aralığı ve hata nedeni ile işaretler. Kullanıcı sorunlu bölümleri dışlayarak veya kalan akışla devam ederek replay'i başlatır. Başarı ölçütü, belirsizliğin gizlenmemesi ve replay'in güvenli şekilde sınırlandırılmasıdır.

Gerekli yetenekler: parse warning görünürlüğü, segment isolation, replay reset, integrity-safe partial ingest.

### Journey 4: Saklanan Oturumu Yeniden Açma

Kullanıcı daha önce yazılmış bir oturumu oturum kimliği üzerinden yeniden açar. Sistem append-only event log'u aynı sıra ve branch kimlikleriyle replay eder. İstemci aynı geçmiş üzerinde tekrar fork deneyebilir veya önceki branch'leri karşılaştırabilir.

Gerekli yetenekler: session lookup, replay reader, deterministic rehydration, immutable history access.

### Journey Requirements Summary

Bu yolculuklar dört zorunlu capability alanı üretir: güvenilir ingest, istemci tarafı simülasyon, açıklanabilir replay/fork ve immutable saklama. PRD'nin geri kalan tüm gereksinimleri bu dört capability alanına izlenebilir biçimde bağlanmalıdır.

## Domain-Specific Requirements

### Product Boundaries

- Ürün, tanı koyan veya terapi öneren bir sistem olarak konumlandırılamaz.
- Simülasyon çıktıları introspection ve model exploration amacıyla sunulmalıdır.
- Panic veya instability sonucu, event provenance olmadan tek başına gösterilmemelidir.

### Technical Constraints

- Hedef platform Linux x86_64'tür; referans geliştirme ortamı CachyOS/Arch'tur.
- Zig sürümü 0.16.0'dır.
- Socket ve syscall işlemlerinde yalnızca `std.posix` kullanılmalıdır.
- `std.os` ve `std.os.linux.*` kullanımı kabul edilmez.
- Hot path belleği oturum başına tek `std.heap.ArenaAllocator(std.heap.page_allocator)` ile yönetilmelidir.
- `GeneralPurposeAllocator` yalnızca init veya cold-path kurulumunda kullanılabilir.
- Runtime wire format özel binary framedir; JSON, CBOR, MessagePack ve Protobuf yasaktır.
- Simülasyon istemci tarafında Wasm olarak çalışmalıdır; sunucu bilişsel model yürütmez.
- JS katmanı loader ve GPU orchestration görevini taşır; simülasyon mantığını devralmaz.
- Modül sınırları `/kernel`, `/net`, `/gfx`, `/sim`, `/store` olarak sabittir.

### Integration Requirements

- Sistem, ChatGPT ve Gemini JSON export formatlarını kabul etmelidir.
- İçe alım formatı JSON olabilir; runtime wire formatı olamaz.
- Harici veri kaynağı entegrasyonları, ortak event modelini ve 17 byte frame sözleşmesini bozmadan eklenmelidir.

### Risk Mitigations

- Yanlış yorumlama riski, açık ürün sınırları ve provenance görünürlüğü ile azaltılmalıdır.
- Performans riski, simülasyonun istemciye offload edilmesi ve event boyutunun kompakt tutulması ile azaltılmalıdır.
- Mimari erozyon riski, modül sınırları ve sıfır bağımlılık kuralı ile azaltılmalıdır.
- Replay drift riski, versioned simulation metadata ve determinism testleri ile azaltılmalıdır.

## Innovation & Novel Patterns

### Detected Innovation Areas

Kernel Panic'in ana yeniliği, konuşma geçmişini pasif arşiv yerine immutable event log ve fork edilebilir state-space olarak işlemesidir. İkinci yenilik, collapse anını basit bir etiket değil attractor stability threshold aşımı olarak modellemesidir. Üçüncü yenilik, maliyet mimarisidir: sunucu simülasyonu reddeder, istemci tarafı Wasm ve WebGPU'yu zorunlu kılar.

### Competitive Context

Yakın kategoriler journaling, chat analytics ve memory tooling'dir. Bu ürün o kategorilerle aynı soruyu çözmez. Kernel Panic geçmişi geri getirmez; geçmişi yeniden yürütür. Olayları sınıflandırmaz; branch'ler arasında evrim farkını ölçer.

### Validation Approach

Yenilik üç eksende doğrulanmalıdır: kullanıcıların replay ve fork ile anlamlı içgörü üretmesi, aynı input üzerinde deterministik ve açıklanabilir sonuç alınması, 10K eşzamanlı kullanıcı hedefinin server-side cognition olmadan karşılanması.

## Web Application Specific Requirements

### Project-Type Overview

Kernel Panic, desktop-first bir web uygulamasıdır. Tarayıcı yalnızca görünüm katmanı değildir; Wasm simülasyonunu yükleyen ve WebGPU compute/render akışını yöneten çalışma ortamıdır. Bu nedenle web uygulaması gereksinimleri klasik CRUD yaklaşımından farklıdır.

### Architecture Constraints

- `/kernel`: raw TCP accept loop, session lifecycle, signal handling, thread-per-connection çalışma modeli
- `/net`: packed binary frame tanımları, parse/serialize, handler dispatch
- `/gfx`: `index.html`, `gfx.js`, `kernel.wgsl`, WebGPU render loop, node buffer yönetimi
- `/sim`: Zig kaynaklı Wasm simülasyon çekirdeği, fork ve attractor hesapları
- `/store`: append-only event log, event bit-packing, checkpoint writer, replay reader
- Her modül sibling modüle yalnızca açık arayüz üzerinden bağlanır; iç dosya seviyesinde çapraz bağımlılık kabul edilmez.

### Browser Matrix

- Birincil hedef: WebGPU destekli güncel masaüstü Chromium tabanlı tarayıcılar
- İkincil hedef: WebGPU destekli diğer modern masaüstü tarayıcılar
- Mobil tarayıcılar MVP hedefi değildir

### Responsive Design

- Ana deneyim desktop-first tasarlanmalıdır.
- Dar ekranlarda import ve temel replay kontrolü erişilebilir olabilir; tam branch karşılaştırma deneyimi garanti edilmez.
- Görsel yoğunluk azaltılabilir ancak event doğruluğu düşürülemez.

### Performance Targets

- Fork sonrası güncellenmiş branch görünümü p95 500 ms altında açılmalıdır.
- Timeline scrub ve event seçimi p95 150 ms altında yanıt vermelidir.
- Büyük export importlarında kullanıcıya en geç her 2 saniyede bir ilerleme sinyali verilmelidir.

### Implementation Considerations

- Frontend dosya yapısı tek `index.html` ve tek `gfx.js` ile sınırlıdır.
- Harici paket yöneticisi, build aracı veya CDN tabanlı çalışma zamanı bağımlılığı kullanılmaz.
- WGSL shader'ları el yazımıdır; compute shader node simülasyonu, render shader görselleştirme içindir.

## Functional Requirements

### Import ve Session Lifecycle

- FR1: Kullanıcı, ChatGPT veya Gemini sohbet export dosyasını 100 MB'a kadar tek dosya halinde içeri alabilmelidir.
- FR2: Sistem, desteklenen export'u ortak immutable event modeline normalize edebilmelidir.
- FR3: Sistem, her başarılı import için benzersiz `session_id` üretmeli ve oturumu append-only store üzerinde başlatmalıdır.
- FR4: Sistem, parse edilemeyen veya düşük güvenli segmentleri event aralığı ve hata nedeni ile kullanıcıya gösterebilmelidir.
- FR5: Kullanıcı, daha önce oluşturulmuş bir oturumu `session_id` üzerinden yeniden açabilmelidir.

### Binary Transport ve Protocol

- FR6: Backend, runtime istemci trafiğini raw TCP üzerinden kabul etmelidir.
- FR7: Tüm runtime mesajları `[TYPE:u8][TIMESTAMP:u64][SESSION_ID:u32][PAYLOAD_SIZE:u32]` biçiminde 17 byte fixed header taşımalıdır.
- FR8: Sistem, header alanlarını little-endian olarak serialize ve parse etmelidir.
- FR9: Sistem, eksik header, geçersiz payload boyutu, bozuk timestamp veya oturum uyuşmazlığı içeren frame'leri reddetmelidir.
- FR10: Runtime veri taşıma katmanı JSON payload kabul etmemelidir.

### Simulation ve Fork Engine

- FR11: İstemci, `kernel_sim.wasm` modülünü yükleyip event geçmişini tarayıcıda simüle edebilmelidir.
- FR12: Kullanıcı, herhangi bir karar noktasından yeni fork oluşturabilmelidir.
- FR13: Kullanıcı, fork oluştururken divergence coefficient değerini `0.0` ile `1.0` arasında ayarlayabilmelidir.
- FR14: Sistem, fork anında mevcut `StateVector` durumunu kopyalayıp her branch'i bağımsız olarak evrimleştirmelidir.
- FR15: Sunucu, hiçbir kullanıcı oturumu için bilişsel simülasyon çalıştırmamalıdır.

### Replay ve Visualization

- FR16: Kullanıcı, event timeline'ı zaman damgası sırasına göre inceleyebilmelidir.
- FR17: Kullanıcı, timeline ile senkronize 3D state-space görünümünü WebGPU üzerinden görüntüleyebilmelidir.
- FR18: Sistem, panic threshold'a yaklaşan durumları branch kimliği, risk etiketi ve panic score ile gösterebilmelidir.
- FR19: Kullanıcı, en az iki branch'in divergence farkını ve kritik ayrışma noktalarını karşılaştırabilmelidir.
- FR20: Sistem, replay sırasında çöküşe en çok katkı veren en az son 5 event'i provenance listesi olarak gösterebilmelidir.

### Store ve Replay Persistence

- FR21: Sistem, tüm event'leri append-only mantıkla binary olarak saklamalıdır.
- FR22: Sistem, saklanan event akışını aynı sıra ve branch kimlikleriyle yeniden oynatabilmelidir.
- FR23: Sistem, checkpoint tabanlı geri dönüş için event aralığına bağlı snapshot referanslarını saklayabilmelidir.
- FR24: Ücretli katman, saklanan oturum geçmişini ve fork-replay artefact'larını daha uzun süre erişilebilir kılabilmelidir.

### Operations ve Observability

- FR25: Operasyon kullanıcısı, aktif oturum sayısını, import sonuçlarını ve oturum kapanış nedenlerini izleyebilmelidir.
- FR26: Sistem, import başlangıcı, import sonucu, fork oluşturma, replay başlatma ve session teardown olaylarını gözlemlenebilir log kaydı olarak üretmelidir.
- FR27: Sistem, modül bazında hata kaynağını en az `/kernel`, `/net`, `/gfx`, `/sim`, `/store` ayrımıyla teşhis edilebilir kılmalıdır.

## Non-Functional Requirements

### Platform ve Toolchain

- NFR1: Backend yalnızca Linux x86_64 üzerinde hedeflenmeli ve Zig 0.16.0 ile derlenmelidir; ölçüm yöntemi CI derleme doğrulaması olmalıdır.
- NFR2: Socket ve syscall erişimi yalnızca `std.posix` ile yapılmalıdır; `std.os` ve `std.os.linux.*` kullanımı statik kod incelemesinde sıfır olmalıdır.
- NFR3: Frontend, tek `index.html` ve tek `gfx.js` dosyasıyla çalışmalıdır; npm, bundler ve CDN bağımlılığı sıfır olmalıdır.
- NFR4: Simülasyon modülü `wasm32-freestanding` hedefi için üretilmelidir; ölçüm yöntemi build artifact doğrulaması olmalıdır.

### Protocol ve Wire Contract

- NFR5: Tüm runtime frame header'ları tam olarak 17 byte olmalıdır; ölçüm yöntemi binary fixture testi olmalıdır.
- NFR6: Header alanları little-endian ve paddingsiz olmalıdır; ölçüm yöntemi golden-byte testi olmalıdır.
- NFR7: Runtime taşıma katmanı JSON, CBOR, MessagePack, Protobuf veya metin tabanlı eşdeğerlerini kabul etmemelidir; ölçüm yöntemi negatif protokol testi olmalıdır.
- NFR8: Store'a yazılan event kaydı hedefte 512 byte altında kalmalıdır; ölçüm yöntemi store benchmark testi olmalıdır.

### Performance ve Scale

- NFR9: Sunucu, 10K eşzamanlı bağlı oturum altında yalnızca session, relay ve store yükünü taşımalı; ölçüm yöntemi yük testi olmalıdır.
- NFR10: Sistem, 100K event/saniye relay veya ingest akışında p95 işlem gecikmesini 250 ms altında tutmalıdır; ölçüm yöntemi sentetik yük testi olmalıdır.
- NFR11: Replay bootstrap gecikmesi p95 250 ms altında kalmalıdır; ölçüm yöntemi replay benchmark testi olmalıdır.
- NFR12: Fork sonrası ilk branch görünümü p95 500 ms altında oluşmalıdır; ölçüm yöntemi istemci performans telemetrisi olmalıdır.
- NFR13: Timeline scrub ve event seçimi p95 150 ms altında yanıt vermelidir; ölçüm yöntemi istemci etkileşim testi olmalıdır.

### Memory ve Session Lifecycle

- NFR14: Her kullanıcı oturumu hot path belleğini tek `std.heap.ArenaAllocator(std.heap.page_allocator)` ile yönetmelidir; ölçüm yöntemi kod incelemesi ve allocator entegrasyon testi olmalıdır.
- NFR15: `GeneralPurposeAllocator` yalnızca init veya cold-path kurulumunda kullanılmalıdır; hot path üzerinde sıfır kullanım hedeflenmelidir.
- NFR16: Session teardown yalnızca tek `arena.deinit()` ile tamamlanmalı, nesne bazlı `free()` zinciri içermemelidir; ölçüm yöntemi teardown benchmark testi olmalıdır.

### Reliability ve Determinism

- NFR17: Aynı input, aynı seed ve aynı divergence coefficient ile çalışan simülasyonlar aynı stable/unstable sınıflandırmasını %99.5 oranında üretmelidir; ölçüm yöntemi referans replay test seti olmalıdır.
- NFR18: Panic score farkı aynı build üzerinde +/-0.01 normalize puanı geçmemelidir; ölçüm yöntemi determinism testi olmalıdır.
- NFR19: Event log append-only olmalı; geçmiş event üzerinde update veya delete işlemi bulunmamalıdır; ölçüm yöntemi depolama davranışı testi olmalıdır.
- NFR20: Geçersiz frame, parse hatası veya import bozulması durumunda sistem 5 saniye içinde görünür hata durumu üretmelidir; ölçüm yöntemi hata senaryosu kabul testi olmalıdır.

### Frontend Runtime

- NFR21: İstemci görselleştirme katmanı yalnızca WebGPU (`navigator.gpu`) ve el yazımı WGSL shader'ları kullanmalıdır; ölçüm yöntemi runtime capability ve dosya incelemesi olmalıdır.
- NFR22: JS katmanı yalnızca loader, binary transport entegrasyonu ve GPU orchestration görevi taşımalıdır; simülasyon mantığının JS tarafına taşınması kabul edilmez.
- NFR23: Branch, panic ve instability göstergeleri yalnızca renkle ifade edilmemeli; en az bir etiket veya ikonografik işaret içermelidir; ölçüm yöntemi erişilebilirlik incelemesi olmalıdır.
- NFR24: Masaüstü hedef cihazlarda 15 dakikalık kullanımda render akışı ortalama 30 FPS altına düşmemelidir; ölçüm yöntemi tarayıcı benchmark testi olmalıdır.

### Architecture Integrity

- NFR25: `/kernel`, `/net`, `/gfx`, `/sim`, `/store` modül sınırları korunmalı; sibling modüle doğrudan iç dosya bağımlılığı sıfır olmalıdır; ölçüm yöntemi mimari inceleme olmalıdır.
- NFR26: Packed struct tanımları tüm wire formatları ve saklanan event kayıtları için kullanılmalıdır; ölçüm yöntemi kod incelemesi olmalıdır.
- NFR27: Sunucu tarafında bilişsel simülasyon, fork traversal veya attractor hesaplaması yapan kod yolu bulunmamalıdır; ölçüm yöntemi statik analiz ve entegrasyon testi olmalıdır.
