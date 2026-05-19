# Bulunur PRD

## 1. Ürün Özeti

Bulunur, Türk e-ticaret işletmeleri için geliştirilen bir GEO (Generative Engine Optimization) platformudur. Amaç, ürün sayfalarını yalnızca klasik SEO için değil, LLM tabanlı arama, AI alışveriş asistanları ve cevap motorları için de daha anlaşılır, güvenilir ve cevaplanabilir hale getirmektir.

Bulunur bir "AI sıralama garantisi" vermez. Bunun yerine ürün verisinin AI sistemleri tarafından okunabilir, yapılandırılabilir, karşılaştırılabilir ve güvenli şekilde cevap içinde kullanılabilir olup olmadığını analiz eder. Daha sonra ürünün zayıf alanlarına göre iyileştirme stratejileri üretir.

## 2. Hackathon Bağlamı

Bulunur, BTK 2026 hackathon bağlamı için tasarlanmıştır. Proje özellikle Türkiye'deki e-ticaret KOBİ'lerine odaklanır.

MVP'nin göstermesi gereken ana fikir:

- Kullanıcı ürünlerini dashboard'a getirebilir.
- Sistem seçilen ürünü GEO açısından analiz edebilir.
- Sistem Türkçe ürün içeriği ve structured data için iyileştirme önerileri üretebilir.
- Kullanıcı önerileri inceleyip onaylayabilir.
- Shopify ile giriş yapan kullanıcılar onaylanan değişiklikleri güvenli şekilde mağazaya geri gönderebilir.

## 3. Problem

Kullanıcıların ürün keşfetme davranışı değişiyor. İnsanlar artık yalnızca Google'da link listesi gezmiyor; ChatGPT, Gemini, Perplexity ve Google AI Overviews gibi AI cevap sistemlerine doğrudan ürün soruları soruyor.

Örnek sorgular:

- "Küçük mutfak için airfryer öner."
- "Bu ürün alınır mı?"
- "Hediye için doğal sabun önerisi."
- "Bu ürün benzerlerinden neden farklı?"
- "En iyi fiyat performans kahve makinesi hangisi?"

Türk e-ticaret sitelerinin büyük kısmı bu yeni discovery katmanına hazır değildir. Yaygın problemler:

- Zayıf veya çok genel ürün başlıkları
- Kısa ve alıcı niyetini karşılamayan açıklamalar
- Eksik ürün attribute bilgileri
- Eksik veya hatalı Schema.org Product JSON-LD
- Stok, fiyat, marka, görsel veya kategori sinyallerinde tutarsızlık
- FAQ eksikliği
- Ürün sayfasının AI cevabı içinde güvenli özetlenememesi
- Doğrulanmamış iddialar nedeniyle hallucination riski

Bulunur bu problemi çözmek için ürünleri GEO açısından analiz eder ve güvenli iyileştirme çıktıları üretir.

## 4. Hedef Kullanıcılar

- Türkiye'deki e-ticaret KOBİ'leri
- Shopify kullanan yerel markalar
- Kendi web sitesi üzerinden satış yapan Türk markaları
- E-ticaret içeriklerini yöneten ajanslar
- Ürün sayfalarını AI arama çağına hazırlamak isteyen satıcılar

## 5. Ürün Hedefleri

- Türkçe ürün sayfalarının AI-readiness seviyesini ölçmek
- Ürünleri dört katmanlı GEO skoru ile analiz etmek
- Eksik schema, attribute, FAQ ve içerik sinyallerini belirlemek
- Gemini destekli semantik değerlendirme ile ürünün Türkçe alıcı niyetlerine uygunluğunu ölçmek
- AgenticGEO mantığıyla zayıf katmana göre iyileştirme stratejisi seçmek
- Kullanıcıya güvenli, doğrulanabilir ve review edilebilir öneriler sunmak
- Shopify ile bağlı kullanıcıların onaylanan değişiklikleri mağazaya geri göndermesini sağlamak

## 6. Kapsam Dışı

- Belirli bir AI cevabında kesin görünürlük garantisi verilmez.
- Kullanıcı onayı olmadan ürün sayfası otomatik değiştirilmez.
- Bulunur genel amaçlı bir SEO aracı değildir.
- Bulunur tam kapsamlı bir e-ticaret CMS'i değildir.
- MVP çoklu dil veya global pazar hedeflemez; odak Türkçe e-ticarettir.
- MVP'de her platform entegrasyonu desteklenmez; ana entegrasyon akışı Shopify odaklıdır.

## 7. Temel Kullanıcı Akışı

### 7.1 Kullanıcı Giriş Yapar

Kullanıcı Bulunur'a giriş yapar veya kayıt olur. Web uygulaması kullanıcı profilini, mağaza bağlantı durumunu ve ürün akışlarını yönetir.

### 7.2 Kullanıcı Ürün Kaynağı Bağlar

MVP'de ana kaynak Shopify'dır. Kullanıcı Shopify mağazasını bağladıysa ürünler API üzerinden dashboard'a getirilebilir. Native URL/import akışı ise ürünleri URL veya import kaynaklarından dashboard'a almak için kullanılabilir.

### 7.3 Dashboard Ürünleri Gösterir

Dashboard'da ürünler kartlar halinde listelenir. Her kart ürün başlığı, görsel, fiyat, kaynak ve analiz aksiyonunu gösterir.

### 7.4 Kullanıcı Analiz Başlatır

Kullanıcı bir ürün seçip analiz başlatır. Web uygulaması ürün verisini AI contract formatına normalize eder ve AI servisine gönderir.

### 7.5 GEO Analysis Agent Çalışır

AI servisi ürünü dört katmanda analiz eder:

- Retrieval
- Machine Understanding
- Reranking Strength
- AI Answer Readiness

Analiz sonucu toplam GEO skoru, katman skorları, nedenler, eksik sinyaller ve önerilen aksiyonları içerir.

### 7.6 Kullanıcı İyileştirme Başlatır

Kullanıcı "Improve" aksiyonunu başlatır. Web uygulaması ürünü, analiz çıktısını ve varsa kullanıcı tarafından doğrulanan bilgileri AI servisine gönderir.

### 7.7 GEO Optimization Agent Çalışır

Optimization Agent analiz sonucunu okur, en zayıf katmanları belirler ve strateji seçer. Eksik kritik gerçekler varsa kullanıcıdan bilgi ister. Yeterli bilgi varsa schema, FAQ, attribute önerileri ve içerik iyileştirmeleri üretir.

### 7.8 Kullanıcı İnceler ve Onaylar

Kullanıcı dashboard'da üretilen iyileştirmeleri inceler. Before/after görünümü, generated content, FAQ, schema ve tahmini yeni GEO skoru gösterilir.

### 7.9 Onaylanan Değişiklikler Yayınlanır

Kullanıcı Shopify mağazasıyla giriş yapmış ve mağazasını bağlamışsa, onaylanan değişiklikler Shopify entegrasyonu üzerinden güvenli şekilde mağazaya geri gönderilebilir. Kullanıcı mağaza bağlamadıysa çıktı copy/export olarak kullanılabilir.

## 8. Sistem Mimarisi

Bulunur monorepo yapısında iki ana uygulamadan oluşur:

```text
btk-2026-hackathon/
├── web/  # Next.js dashboard ve backend route katmanı
└── ai/   # FastAPI, GEO scoring, LangGraph agents ve Gemini entegrasyonu
```

### 8.1 Web Katmanı

Web katmanı kullanıcı deneyimini ve ürün operasyonlarını yönetir.

Sorumluluklar:

- Authentication ve onboarding
- Dashboard
- Shopify bağlantı akışı
- Ürün listeleme
- Ürün verisini AI contract formatına normalize etme
- Analiz ve optimizasyon sonuçlarını veritabanına kaydetme
- Kullanıcı onay akışı
- Onaylanan değişiklikleri Shopify'a geri gönderme

Teknolojiler:

- Next.js
- TypeScript
- Supabase
- Shopify API
- Vercel deployment

### 8.2 AI/GEO Servisi

AI servisi, web uygulamasından bağımsız çalışan FastAPI servisidir.

Sorumluluklar:

- GEO Analysis Agent
- GEO Optimization Agent
- Dört katmanlı scoring engine
- Gemini semantic judgment
- Skill loading
- Schema.org Product JSON-LD build/validate
- Missing fact question generation
- Anti-hallucination validation
- Improved score estimation

Teknolojiler:

- Python
- FastAPI
- LangChain
- LangGraph
- Google Gemini
- Pydantic
- Docker
- Railway deployment

### 8.3 Servisler Arası İletişim

Web ve AI iki ayrı servis olarak çalışır. Web, AI servisine server-to-server istek gönderir.

AI endpointleri:

```text
GET  /health
POST /ai/analyze-product
POST /ai/improve-product
```

Güvenlik:

- Web, AI servisine `Authorization: Bearer <secret>` header'ı ile istek atar.
- AI tarafındaki `SERVICE_AUTH_SECRET_KEY`, web tarafındaki `AI_SERVICE_SECRET` ile aynı olmalıdır.
- Bu secret browser'a gönderilmez; sadece server tarafında kullanılır.

### 8.4 Deployment Mimarisi

Production hedefi:

```text
Vercel  -> web uygulaması
Railway -> AI/GEO servisi
Supabase -> veritabanı ve auth
Shopify -> mağaza entegrasyonu
```

Local geliştirme:

```text
Docker Compose -> web + ai
```

## 9. AI Agent Mimarisi

AI tarafında iki ana agent vardır:

```text
1. GEO Analysis Agent
2. GEO Optimization Agent
```

Bu agentlar LangGraph ile stateful workflow olarak tasarlanır. Her agent, uzun ve karmaşık tek prompt yerine küçük node'lara bölünür.

### 9.1 GEO Analysis Agent

Amaç: Mevcut ürünü analiz etmek ve GEO skorunu üretmek.

State içinde taşınan ana veriler:

- ProductInput
- normalize edilmiş Türkçe metin
- product facts
- missing facts
- buyer intent variants
- schema summary
- layer scores
- final GeoAnalysisOutput

Node akışı:

```text
prepare_input
detect_category
expand_turkish_intents
score_retrieval
score_machine_understanding
score_reranking
score_answer_readiness
build_analysis_output
```

### 9.2 GEO Optimization Agent

Amaç: Analiz sonucuna göre güvenli iyileştirme üretmek.

State içinde taşınan ana veriler:

- ProductInput
- GeoAnalysisOutput
- known facts
- missing facts
- weakness list
- selected strategies
- user fact questions
- generated improvements
- validation results
- estimated score
- final GeoImprovementOutput

Node akışı:

```text
identify_weaknesses
select_strategies
collect_missing_facts
generate_improvements
build_schema
validate_improvements
estimate_improved_score
build_improvement_output
```

## 10. Skills, Strategies ve Tools

Bulunur'da bu kavramlar net şekilde ayrılır:

```text
Agent: Workflow'u yöneten ana orchestrator.
Skill: Gemini'ye verilen Türkçe markdown playbook.
Strategy: Python ile uygulanmış iyileştirme akışı.
Tool: Schema validation, Gemini call, normalization gibi odaklı yardımcı yetenek.
```

Örnek:

```text
GEO Optimization Agent
-> Turkish FAQ Enrichment Skill
-> TurkishFAQEnrichmentStrategy
-> Gemini + validation tools
```

Skill dosyaları Türkçe yazılır çünkü ürün çıktıları ve buyer intent analizi Türkçe e-ticaret için optimize edilir.

## 11. GEO Skorlama Algoritması

Bulunur'un skoru 100 puandır:

```text
Retrieval: 25
Machine Understanding: 30
Reranking Strength: 25
AI Answer Readiness: 20
```

### 11.1 Retrieval

Ürünün AI/crawler tarafından bulunabilir ve alınabilir olup olmadığını ölçer.

Sinyaller:

- crawl status
- accessible
- blocked
- robots allowed
- page title
- meta description
- headings
- visible body text
- Gemini semantic retrieval judgment

### 11.2 Machine Understanding

Ürünün makine tarafından yapısal olarak anlaşılabilir olup olmadığını ölçer.

Sinyaller:

- Product JSON-LD varlığı
- Schema.org Product uygunluğu
- Offer data
- price
- currency
- availability
- brand
- image
- schema-page consistency judgment

### 11.3 Reranking Strength

AI sistemlerinin benzer ürünler arasında bu ürünü seçebilmesi için yeterli karşılaştırma sinyali olup olmadığını ölçer.

Sinyaller:

- product attributes
- concrete features
- category-specific facts
- brand/category/use-case clarity
- trust signals
- comparison readiness
- Gemini reranking quality judgment

### 11.4 AI Answer Readiness

Ürünün AI cevabı içinde güvenli ve doğal şekilde açıklanabilir olup olmadığını ölçer.

Sinyaller:

- FAQ
- summary quality
- Turkish buyer intent coverage
- grounded answerability
- missing facts
- Gemini answer-readiness judgment

## 12. Araştırma Temeli

Bulunur'un algoritması mock değildir. Tasarımda üç ana kaynak kullanılır:

### 12.1 SAGEO Arena

SAGEO Arena yaklaşımından alınan fikir: GEO tek bir içerik puanı değildir; AI cevap sistemlerinin çalışma hattına benzer katmanlar halinde ele alınmalıdır.

Bulunur'a yansıması:

- Retrieval katmanı
- Reranking Strength katmanı
- AI Answer Readiness katmanı
- katman bazlı weakness analysis
- final cevap içinde kullanılabilirlik

### 12.2 AgenticGEO

AgenticGEO yaklaşımından alınan fikir: Optimizasyon sabit bir checklist olmamalı; agent, analiz sonucuna göre strateji seçmelidir.

Bulunur'a yansıması:

- weakest layer identification
- explainable strategy selection
- skill-based generation
- missing fact loop
- validation
- improved score estimation

### 12.3 Google Structured Data ve Schema.org

Google Product structured data, merchant listing dokümantasyonu ve Schema.org Product modeli ürünün makine tarafından anlaşılabilirliğini değerlendirmek için kullanılır.

Bulunur'a yansıması:

- Product JSON-LD build
- Offer validation
- price/currency/availability checks
- brand/image/category consistency
- schema warnings

## 13. Anti-Hallucination Politikası

Bulunur ürün gerçeği uydurmaz.

AI servisi yalnızca şu kaynakları kullanabilir:

- extracted product facts
- crawler metadata
- platform/connector facts
- user-confirmed facts

Eğer kritik bilgi eksikse:

- missing fact olarak işaretlenir
- suggested attribute olarak önerilir
- kullanıcıya soru olarak sorulur

Doğrulanmamış bilgiler ürün açıklamasına, FAQ'a veya JSON-LD schema'ya kesin gerçek gibi yazılamaz.

Özellikle dikkat edilen iddialar:

- garanti
- sertifika
- organik/doğal iddiaları
- ücretsiz kargo
- aynı gün teslimat
- orijinallik
- performans vaatleri
- stok durumu

## 14. API Contract

### 14.1 Analyze Product

```text
POST /ai/analyze-product
```

Input:

```text
ProductInput
```

Output:

```text
GeoAnalysisOutput
```

### 14.2 Improve Product

```text
POST /ai/improve-product
```

Input:

```text
product: ProductInput
analysis: GeoAnalysisOutput
userFacts?: dict
```

Output:

```text
GeoImprovementOutput
```

Improvement output şunları içerir:

- selected strategies
- missing user questions
- generated content
- validation warnings
- estimated after score
- estimated after layer scores
- before/after changes

## 15. MVP Kapsamı

MVP'de olması gerekenler:

- Kullanıcı giriş/onboarding akışı
- Ürün dashboard'u
- Shopify ürün akışı
- Native URL/import fallback
- Product cards
- Analyze action
- GEO score breakdown
- Improve action
- Strategy selection
- Missing fact questions
- Generated FAQ/schema/attribute output
- Estimated improved score
- User approval flow
- Shopify publish-back for connected users

## 16. Gelecek Kapsam

- Daha gelişmiş Shopify publish diff
- WooCommerce adapter
- ikas, Ticimax, IdeaSoft adapter'ları
- Batch product analysis
- GEO monitoring
- Team workspace
- Agency workspace
- AI answer simulation
- GEO trend tracking

## 17. Başarı Metrikleri

- Ürün analiz süresi
- Analiz edilen ürün sayısı
- Tespit edilen eksik attribute sayısı
- Kullanıcı tarafından onaylanan öneri oranı
- GEO score improvement
- Yayınlanan veya export edilen ürün sayısı
- Kullanıcıdan bilgi istenen akışlarda tamamlama oranı

## 18. Demo Hikayesi

Bir Türk e-ticaret satıcısı Bulunur'a giriş yapar ve Shopify mağazasını bağlar. Dashboard ürünleri otomatik gösterir. Satıcı bir ürün seçip GEO analizi başlatır. Bulunur ürünün AI sistemleri için ne kadar anlaşılır olduğunu dört katmanda puanlar ve eksikleri gösterir.

Satıcı "Improve" aksiyonunu başlatır. Optimization Agent zayıf katmanlara göre strateji seçer, gerekli ise kullanıcıdan eksik gerçekleri ister, ardından schema, FAQ, attribute önerileri ve tahmini yeni GEO skorunu üretir. Satıcı çıktıyı inceler ve Shopify mağazasına güvenli şekilde yayınlar.

## 19. Konumlandırma

Bulunur, Türk e-ticaret işletmeleri için AI görünürlük katmanıdır.

Klasik SEO araçları web sayfasını arama motorları için optimize eder. Bulunur ürün sayfasını AI sistemleri için daha bulunabilir, anlaşılabilir, karşılaştırılabilir ve cevaplanabilir hale getirir.
