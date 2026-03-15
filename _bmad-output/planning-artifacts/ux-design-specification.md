---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-core-experience
  - step-04-emotional-response
  - step-05-inspiration
  - step-06-design-system
  - step-07-defining-experience
  - step-08-visual-foundation
inputDocuments:
  - /home/void0x14/Belgeler/Vibe-coding/kernel_panic/_bmad-output/planning-artifacts/prd.md
  - /home/void0x14/Belgeler/Vibe-coding/kernel_panic/_bmad-output/planning-artifacts/prd-validation-report.md
---

# UX Design Specification kernel_panic

**Author:** Void0x14
**Date:** 2026-03-10T15:36:25+03:00

---

## Executive Summary

### Project Vision

Kernel Panic, insan anılarını yalnızca arşivleyen veya oynatan bir sistem değil; onları çağrılabilir, içine girilebilir, yeniden yaşanabilir ve nedensel olarak bozulabilir hale getiren bir Cognitive Operating System'dir. Sistem; metin, ses, görsel, video, manuel giriş ve gelecekte genişleyebilecek diğer kaynakları ortak bir memory-event modelinde toplar. Ürünün ana UX hedefi, kullanıcının herhangi bir tetikleyiciyle bir anıyı çağırması, o anıya kendi geçmiş benliği olarak girmesi ve o anın içindeki zaman sahnesini yaşayarak, gerekirse müdahale ederek, yeni nedensel sonuçlar üretmesidir.

### Target Users

Birincil kullanıcı, geçmişindeki belirli bir ana, kırılma noktasına veya yoğun duygusal deneyime geri dönmek isteyen kişidir. Kullanıcı anıyı tarih, kişi, yer, kelime, his, görsel parça, ses izi veya serbest çağrışım gibi herhangi bir tetikleyiciyle arayabilir. Temel beklenti yalnızca anıyı bulmak değil; o anın içine girmek, onu yeniden yaşamak, ilk yaşandığı anda fark edemediği şeyleri görmek ve isterse o anın akışını müdahalesiyle bozabilmektir. Daha ileri kullanıcılar ise bu müdahalelerin doğurduğu yeni timeline'ları izlemek, karşılaştırmak ve tekrar ziyaret etmek ister.

### Key Design Challenges

En büyük UX zorluğu, doğrusal olmayan ve çok formatlı insan hafızasını tek bir güçlü recall sistemiyle erişilebilir hale getirirken deneyimi yüzeyselleştirmemektir. İkinci zorluk, kullanıcının anıyı yalnız izlemesini değil, o anın içinde varlık hissiyle bulunmasını sağlamaktır. Üçüncü zorluk, anının içindeki dünyanın kullanıcıyı ne zaman ve nasıl algıladığına bağlı olarak değişen nedensel kırılmaları anlaşılır kılmaktır. Dördüncü zorluk ise hidden-context katmanını tasarlamaktır: sistem, kullanıcının ilk yaşadığı anda göremediği etkileri, bağlantıları ve baskıları sonradan görünür hale getirmelidir.

### Design Opportunities

Kernel Panic, herhangi bir tetikleyiciden anıya erişim sağlayan evrensel recall arayüzü ile ayrışabilir. Seçilen anının statik kayıt yerine yaşayan bir zaman sahnesi olarak açılması, ürüne eşsiz bir deneyim dili kazandırır. Kullanıcının kendi geçmiş benliği olarak sahneye girmesi ve müdahale yoğunluğuna göre timeline'ın bozulabilmesi, ürünü sıradan memory browser'lardan veya replay sistemlerinden ayıran ana farktır. Hidden-context reveal katmanı ile birlikte bu deneyim, kullanıcıya yalnız geçmişi izleme değil; geçmişin içinde bulunma, onu yeniden okuma ve onunla çatışma gücü verir.

## Core User Experience

### Defining Experience

Kernel Panic'in çekirdek deneyimi, kullanıcının herhangi bir tetikleyiciyle bir anıyı çağırması, o anıya kendi geçmiş benliği olarak girmesi ve o anıyı yaşayan bir zaman sahnesi olarak deneyimlemesidir. Bu sahne pasif bir replay değildir; kullanıcı ister düşük müdahale ile tanık kalabilir, ister aktif davranabilir, ister yüksek etkili müdahalelerle olay örgüsünü bozabilir. Dünyanın kullanıcıyı algılama düzeyi, müdahale yoğunluğuna, bağ gücüne ve sahnedeki ilişkilere göre değişir. Tek görünür run içinde geri sarma yoktur; yeniden deneme yeni timeline üretir.

### Platform Strategy

İlk hedef platform masaüstü öncelikli web deneyimi olmalıdır. Mouse ve klavye odaklı kontrol, yoğun bilgi katmanları ve çoklu bakış açısı geçişleri için uygun tabandır. Sistem, anıyı sadece 2D medya oynatımı gibi sunmamalı; first-person ana deneyim olarak korunurken third-person, yan bakış, kamera bakışı ve daha üst ölçekli perspektifler genişleme katmanı olarak açılmalıdır. İstemci tarafı deneyim, yüksek yoğunluklu bellek sahnesi ve nedensel bozulma hissini taşıyacak kadar zengin, fakat kontrol hissini kaybettirmeyecek kadar okunabilir kalmalıdır.

### Effortless Interactions

Anı çağırma, sistemdeki en effortless eylem olmalıdır; kullanıcı aklına gelen herhangi bir tetikleyiciyle anıya erişebilmelidir. Anının içine giriş, ek kurulum veya karmaşık filtre gerektirmeden doğal hissettirmelidir. Perspektif değiştirme, hidden-context katmanını açma, kritik kişi veya olay etkilerini görme ve mevcut run'ın nedensel sapmasını anlama da kullanıcıyı yormamalıdır. Sistem mümkün olduğunca görünmeyen işleri kendisi yapmalı; bağ analizi, gizli baskılar, kaçırılmış sinyaller ve olası timeline drift işaretleri otomatik olarak görünür hale gelmelidir.

### Critical Success Moments

Birinci başarı anı, kullanıcının yalnızca aradığı anıyı bulması değil; o anın içine gerçekten girdiğini hissetmesidir. İkinci kritik an, geçmişte fark etmediği bir etkiyi veya kişiyi sistemin görünür kılmasıdır. Üçüncü kritik an ise kullanıcının sahne içinde yaptığı bir müdahalenin zaman çizelgesini bozduğunu ve bunun sonuç doğurduğunu hissetmesidir. Eğer anı yalnız düz bir replay gibi hissedilirse veya müdahalenin sonuçları yapay görünürse deneyim başarısız olur.

### Experience Principles

- Anılar kayıt değil, yaşayan nedensel sahnelerdir.
- Kullanıcı izleyici değil, bedenlenmiş katılımcıdır.
- Müdahale serbesttir; sonuçlar geri alınamaz ve yeni timeline doğurur.
- Algılama her zaman binary değildir; yakın bağlar ve kritik temaslar daha yüksek kırılma yaratır.
- Hidden-context katmanı, kullanıcının geçmişte göremediği şeyi şimdi görünür hale getirmelidir.
- First-person varsayılandır; diğer bakış açıları çekirdeği destekleyen genişleme katmanlarıdır.

## Desired Emotional Response

### Primary Emotional Goals

Kernel Panic kullanıcıda öncelikle yoğun bir varlık hissi üretmelidir: "Ben bunu izlemiyorum, bunun içindeyim." İkinci ana duygu, keşif ve sarsılma karışımı olmalıdır; kullanıcı geçmişte göremediği bir etkiyi fark ettiğinde zihinsel olarak çarpılmalıdır. Üçüncü ana duygu ise güç ve korkunun birlikte var olmasıdır: kullanıcı müdahale edebildiğini hisseder ama her müdahalenin ciddi sonuç doğurabileceğini de bilir. Ürün rahatlatıcı olmaktan çok büyüleyici, ağır, tehlikeli ve takıntı yaratacak kadar merak uyandırıcı hissettirmelidir.

### Emotional Journey Mapping

İlk keşif anında kullanıcı merak, çekim ve hafif bir tedirginlik hissetmelidir. Anıyı çağırdığında sistemin "onu gerçekten bulduğu" hissi şaşkınlık ve güven üretmelidir. Anının içine girdiğinde temel duygu immersion ve gerilim olmalıdır; kullanıcı bunun sıradan replay olmadığını hemen anlamalıdır. Hidden-context ortaya çıktığında sarsılma, farkındalık ve bazen rahatsızlık doğmalıdır. Müdahale edip timeline'ı bozduğunda ise hayranlık, suçluluk, korku veya kontrol sarhoşluğu gibi daha yoğun duygular oluşabilir. Yeniden kullanımda ürün, kullanıcıda geri dönme arzusu ve "başka neyi kaçırdım?" hissi bırakmalıdır.

### Micro-Emotions

Kernel Panic için en kritik mikro-duygular şunlardır: güven yerine kontrollü güvensizlik, rahatlık yerine dikkat, memnuniyet yerine takıntılı merak, açıklıkla birlikte tedirginlik, güç hissiyle birlikte sonuç korkusu. Kullanıcı bazen şaşırmalı, bazen ürkmeli, bazen de kendi geçmişine karşı yabancılaşma hissetmelidir. Ancak bu duygular kaosa değil anlamlı yoğunluğa hizmet etmelidir; kafa karışıklığı, oyuncak hissi veya ucuz sci-fi etkisi yaratmamalıdır.

### Design Implications

Bu duyguları üretmek için deneyim, steril dashboard estetiğinden kaçınmalıdır. Anıya girişte kullanıcıda eşik geçme hissi yaratılmalı, sahneye girdikten sonra ortamın canlı ve tepkisel olduğu hissettirilmelidir. Hidden-context katmanı, düz tooltip mantığıyla değil; "o anda göremediğin şey şimdi açığa çıkıyor" hissiyle sunulmalıdır. Müdahalelerin etkisi küçük UI uyarılarıyla değil, dünyanın davranışındaki değişimle hissedilmelidir. Tasarım, kullanıcıya hem güç hem de bedel duygusunu aynı anda taşımalıdır.

### Emotional Design Principles

- Ürün güvenli oyuncak gibi değil, tehlikeli derecede gerçek bir eşik hissi vermelidir.
- Kullanıcı önce içine çekilmeli, sonra sarsılmalı, sonra etkisinin farkına varmalıdır.
- Hidden-context keşfi zihinsel ödül anı üretmelidir.
- Müdahale gücü heyecan verici olmalı, fakat sonuçları hafifletilmemelidir.
- Yoğunluk yüksek olabilir; ancak anlamsız karmaşa, cheap sci-fi veya arayüz gürültüsü olmamalıdır.
- Her önemli etkileşim, kullanıcıya "burada gerçekten bir şeyi değiştirebilirim" veya "burada gerçekten bir şeyi kaçırmışım" hissini vermelidir.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

Kernel Panic için ilham, aynı kategorideki klasik ürünlerden değil; farklı alanlardaki güçlü deneyim modellerinden alınmalıdır. Birinci ilham kaynağı, Flashpoint benzeri nedensel kırılma anlatılarıdır: burada değer, "zamana geri gittim" fantezisinden çok, küçük bir temasın bütün gerçekliği bozabilmesi hissidir. İkinci ilham kaynağı, güçlü first-person presence üreten immersive sim ve sinematik deneyimlerdir; kullanıcıya yalnız bilgi vermek değil, onu olayın içine almak gerekir. Üçüncü ilham kaynağı ise analiz ve keşif araçlarıdır; kullanıcı, yaşadığı sahnede kaybolurken aynı anda sahnenin ardındaki hidden-context katmanını da çözebilmelidir. Bu yüzden ürün hem sahnesel hem analitik olmalı; ne yalnız hikaye deneyimi ne de yalnız dashboard olmalıdır.

### Transferable UX Patterns

Taşınabilir ilk pattern, "presence-first entry" modelidir: kullanıcı sisteme menüyle değil, doğrudan çağrılmış bir anı ve onun sahnesiyle bağlanmalıdır. İkinci pattern, çok katmanlı gerçekliktir: ön planda yaşanan sahne varken, arka planda etkiler, baskılar, kaçırılmış sinyaller ve nedensel sapmalar ikinci katman olarak açılmalıdır. Üçüncü pattern, müdahalenin sonuçlarını doğrudan dünyanın davranışında hissettirmektir; küçük popup veya oyunlaştırılmış puan sistemi yerine, sahnenin, kişilerin ve akışın değişimi konuşmalıdır. Dördüncü pattern, çoklu bakış açısının çekirdeği bozmadan katmanlı açılmasıdır; first-person merkezde kalırken third-person, yan perspektif ve daha üst gözlem modları yardımcı araç olarak eklenebilir.

### Anti-Patterns to Avoid

Kernel Panic'in kaçınması gereken ilk anti-pattern, her şeyi düz timeline, liste veya medya player mantığına indirgemektir. İkinci anti-pattern, ürünü ucuz sci-fi kontrol paneli veya dekoratif hologram şovu haline getirmektir; bu, yoğunluğu artırmaz, ciddiyeti düşürür. Üçüncü anti-pattern, müdahaleyi oyunlaştırıp sonucu hafifletmektir; kullanıcı güç hissederken bedel hissini de taşımalıdır. Dördüncü anti-pattern, hidden-context katmanını tooltip veya açıklama kutusu seviyesine indirgemektir; görünmeyen şeyler "okunan bilgi" değil, "fark edilen gerçek" gibi hissettirilmelidir. Beşinci anti-pattern ise kullanıcıyı sahne içinde tamamen kaybettirip kontrol hissini yok etmektir; ürün yoğun olabilir ama dağınık olmamalıdır.

### Design Inspiration Strategy

Benimsenmesi gereken strateji, sahnesel immersion ile analitik görünürlüğü birlikte taşımaktır. Ürün, first-person embodied memory entry modelini ana omurga olarak almalı; hidden-context reveal, perception thresholds ve causal drift katmanları bunun üstüne inşa edilmelidir. Uyarlanması gereken pattern, sinematik yoğunluğu UX okunabilirliğiyle dengeleyen hibrit modeldir; kullanıcı anının içindeyken hem yaşamalı hem de neyin değiştiğini anlayabilmelidir. Kaçınılması gereken yaklaşım ise ürünü sadece "etkileyici görünen" bir arayüze çevirmektir. Kernel Panic'in ilham stratejisi, film hissi ile sistem disiplini arasında dengeli ama sert bir çizgi kurmaktır: kullanıcı kendini bir sahnenin içinde hissetmeli, ama aynı anda o sahnenin nedensel yapısını okuyabilmelidir.

## Design System Foundation

### 1.1 Design System Choice

Kernel Panic için doğru temel, hazır bir UI framework'ü veya established component library değil; projeye özel, custom bir semantic primitive system'dir. Bu seçim yalnız görsel farklılaşma ihtiyacından doğmaz. Projenin teknik zemini Vanilla JS, WebGPU, sıfır bağımlılık ve bundlersız dağıtım olduğu için Material, Ant, Chakra veya benzeri sistemler doğrudan uyumlu değildir. Ayrıca ürünün embodied memory entry, hidden-context reveal, causal drift ve multi-POV yapısı standart component library kalıplarına sığmaz. Bu nedenle sistem; ürünün sahnesel ve analitik dilini taşıyan tasarım token'ları, durum semantikleri, katman primitives'leri ve etkileşim kurallarından oluşmalıdır.

### Rationale for Selection

Bu seçim üç nedenle zorunludur. Birincisi teknik neden: proje mevcut stack gereği üçüncü taraf UI sistemi üzerine kurulamaz. İkincisi deneyim nedeni: Kernel Panic'in çekirdek etkileşimleri sıradan dashboard veya SaaS component mantığına indirgenemez. Üçüncüsü kapsam nedeni: ürün bu aşamada tam teşekküllü bir component library değil, doğru deneyim dilini taşıyan minimum ama katı primitives setine ihtiyaç duyar. Amaç büyük bir design system envanteri oluşturmak değil; memory scene, hidden context ve causal drift davranışlarını tutarlı hale getiren temel sözlüğü kurmaktır.

### Implementation Approach

Sistem, framework mantığında değil; hafif ama katı bir primitive set olarak ele alınmalıdır. İlk katmanda semantic tokens bulunmalıdır: typography, state color, spacing, layer depth, threshold intensity ve motion states. İkinci katmanda scene primitives yer almalıdır: panel surfaces, overlays, POV controls, timeline markers, drift indicators, context reveal surfaces ve intervention controls. Üçüncü katman ise bu primitives'lerin birlikte nasıl davrandığını tanımlayan etkileşim kurallarından oluşmalıdır. Sistem önce çekirdek memory-incursion deneyimini taşıyan minimum set ile başlamalı, sonra ihtiyaç oldukça büyümelidir.

### Customization Strategy

Özelleştirme stratejisi, süsleme değil deneyim semantiği üzerinden ilerlemelidir. Renkler estetik için değil; stability, drift, hidden-context, perception threshold ve intervention severity gibi durumları taşıyan anlam katmanları olarak tanımlanmalıdır. Hareket dili, micro-animation seviyesinde tatlı efektler üretmek yerine eşik geçişi, sahne kırılması, algı değişimi ve nedensel sapma hissi yaratmalıdır. Görsel dil ucuz sci-fi veya dekoratif hologram estetiğine kaymamalı; yoğun, ciddi, okunabilir ve tehditkar bir sistem hissi vermelidir. Genişleme stratejisi, yeni komponent eklemekten çok mevcut primitives sözlüğünü daha derin hale getirmek olmalıdır.

## 2. Core User Experience

### 2.1 Defining Experience

Kernel Panic'in tanımlayıcı deneyimi şudur: kullanıcı bir anıyı çağırır, o anıya kendi geçmiş benliği olarak girer ve orada bulunmasının bile zaman sahnesini bozabildiği yaşayan bir memory run yaşar. Ürünün arkadaşına tek cümlede anlatılacak özü "geçmişini izlemiyorsun, onun içine giriyorsun" olmalıdır. Asıl fark, anının kayıt gibi oynatılmaması; çevresi, ilişkileri, algı eşikleri ve nedensel sonuçları olan tepkisel bir sahne olarak açılmasıdır. Eğer bu deneyim doğru kurulursa ürün sıradan replay, journaling veya media browsing kategorilerinden tamamen ayrılır.

### 2.2 User Mental Model

Kullanıcı ürüne ilk başta bir anıyı bulup tekrar görmek için gelir; yani başlangıç mental modeli arşiv veya replay mantığına yakındır. Ancak çekirdek deneyim çok hızlı biçimde bu modeli kırmalıdır. Kullanıcı, anının içine girdikten sonra yalnız gözlemci olmadığını, sahne içinde bir varlık olarak yer aldığını ve dünyayla ilişkisinin sonuç doğurabileceğini anlamalıdır. En kritik zihinsel sıçrama budur: "ben burada sadece hatırlamıyorum, bu şey beni ve benim etkimi hesaba katıyor." Mevcut çözümler geçmişi yazdırır, izletir veya etiketler; Kernel Panic ise geçmişi bedenlenmiş olarak tekrar yaşatır.

### 2.3 Success Criteria

Çekirdek deneyim dört koşulda başarılı sayılır. Birincisi, kullanıcı aradığı anıyı düşük sürtünmeyle çağırabilmelidir. İkincisi, anıya girdikten sonra ilk birkaç saniye içinde bunun düz replay değil, yaşayan bir sahne olduğunu hissetmelidir. Üçüncüsü, sistem en az bir hidden-context veya world-response anı göstererek ürünün sıradan playback olmadığını kanıtlamalıdır. Dördüncüsü, kullanıcı yaptığı veya yapmadığı bir şeyin timeline drift yarattığını anlayabilmelidir. Kullanıcı "ben bunu izlemiyorum, bunun içindeyim ve burada bir bedel var" diyorsa deneyim doğru çalışıyordur.

### 2.4 Novel UX Patterns

Bu ürün tamamen established pattern'lerle açıklanamaz; fakat tamamen yabancı da olmamalıdır. Recall girişi, sahneye eşik geçişi, first-person embodied entry, perception threshold, hidden-context reveal ve causal drift birlikte hibrit ama öğretilebilir bir pattern ailesi oluşturur. Yenilik, memory recall ile immersive incursion'u birleştirmesindedir. Kullanıcıya her şeyi sıfırdan öğretmek yerine tanıdık metaforlar kullanılmalıdır: anıya giriş bir eşik, world response bir bozulma, drift ise gerçekliğin kayması gibi hissedilmelidir. Ama bu metaforlar UI süsü değil, etkileşim mantığının taşıyıcısı olmalıdır.

### 2.5 Experience Mechanics

**Initiation:** Kullanıcı herhangi bir tetikleyiciyle bir anıyı çağırır. Sistem memory candidate'leri çıkarır ve seçilen anı için giriş eşiği sunar.

**Entry:** Kullanıcı anıya kendi geçmiş benliği olarak girer. Varsayılan bakış açısı first-person'dır. İlk saniyelerde sahnenin yaşayan bir world-state olduğu hissettirilir.

**Interaction:** Kullanıcı sahne içinde bakabilir, yaklaşabilir, bekleyebilir, temastan kaçınabilir, aktif davranabilir veya yüksek etkili müdahale yapabilir. Müdahale seviyesi arttıkça algılanma ve nedensel kırılma riski artar.

**World Response:** Yakın bağlar, kritik kişiler, güçlü temaslar ve belirli olaylar kullanıcıyı daha yüksek olasılıkla algılar. Pasif durumda bile düşük ihtimal sürpriz world-response anları olabilir. Sistem bu tepkiyi popup ile değil, sahnenin davranışıyla hissettirir.

**Feedback:** Hidden-context katmanı, kullanıcının o anda göremediği baskıları, bağları ve kırılma sinyallerini görünür hale getirir. Drift, perception threshold ve sahne sapmaları kullanıcıya etkisinin bedelini gösterir.

**Completion:** Tek görünür run içinde geri sarma yoktur. Kullanıcı sahneden çıktığında veya sahne yeni bir kararlı/kararsız hale geçtiğinde run tamamlanır. Yeniden deneme, eski run'ı silmez; yeni bir timeline üretir.

## Visual Design Foundation

### Color System

Kernel Panic için renk sistemi steril ürün gramerinden değil, durum semantiğinden türemelidir. Ana palet; derin kömür, oksit siyahı, soğuk çelik, kirli beyaz ve kontrollü pas tonları gibi ağır, ciddi ve düşük parlaklıkta yüzeylerden oluşmalıdır. Accent renkler dekoratif değil işlevsel olmalıdır: hidden-context için soğuk zehirli bir cyan/ice glow, causal drift için kırmızıya kayan paslı amber, stability için mat ve bastırılmış yeşil-gri, intervention severity için sert sıcak tonlar kullanılmalıdır. Sistem neon sirkine veya cheap sci-fi morlarına düşmemelidir. Renkler her zaman anlam taşımalı; "güzel görünmek" tek başına yeterli sebep olmamalıdır.

### Typography System

Tipografi, sıradan SaaS hissini kırmalı; ancak okunabilirliği kurban etmemelidir. Ana yazı karakteri ciddi, teknik ve yüksek yoğunluklu bir metin atmosferi kurmalıdır; grotesk veya neo-grotesk yerine daha karakterli, editoryal sertliği olan bir sans ya da dikkatli eşlenmiş bir serif-sans kombinasyonu düşünülebilir. Başlıklar sistemin ağırlığını ve ciddiyetini taşımalı, gövde metni ise uzun okuma ve yoğun kavramsal yük altında rahat kalmalıdır. Sayısal veriler, zaman işaretleri, threshold değerleri ve drift sinyalleri için ayrı bir mono veya semi-mono yardımcı tipografik katman kullanılmalıdır. Hiyerarşi keskin olmalı; kullanıcı bakınca hangi şeyin sahne, hangisinin sistem, hangisinin sapma sinyali olduğunu tipografiden de anlamalıdır.

### Spacing & Layout Foundation

Yerleşim sıkışık dashboard mantığıyla değil; katmanlı sahne mantığıyla kurulmalıdır. Ana sahne nefes almalı, ama çevresindeki bilgi katmanları boş lüks alanlar gibi hissettirmemelidir. 8px tabanlı modüler sistem uygun başlangıçtır; ancak scene-level layout için daha büyük ritim aralıkları kullanılmalıdır. Layout foundation üç seviyeli düşünülmelidir: primary scene area, secondary analysis layer ve tertiary system rail. Kullanıcı sahnenin içinde kaybolmamalı; fakat sahne her zaman merkez ağırlığı korumalıdır. Grid sistemi düz panel dağıtımı için değil, sahne ile sistem katmanları arasındaki hiyerarşiyi korumak için kullanılmalıdır.

### Accessibility Considerations

Yoğun ve tehditkar görsel dil erişilebilirliği bozmamalıdır. Stability, drift, hidden-context ve intervention gibi durumlar yalnız renkle ifade edilmemelidir; tipografi, ikonografi, motion ve yüzey davranışı da anlam taşımalıdır. Kontrast özellikle düşük parlak yüzeylerde dikkatle korunmalıdır. First-person yoğunluğu yüksek olduğundan, motion azaltma ve scene intensity düşürme seçenekleri ileride kritik olabilir. Görsel sistem ağır olabilir, ancak okunamaz, yorucu veya fiziksel olarak rahatsız edici olmamalıdır. Ürün kullanıcıyı sarsabilir; ama arayüz onu kör etmemelidir.
