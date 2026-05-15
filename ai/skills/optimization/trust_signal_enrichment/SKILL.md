# Trust Signal Enrichment Skill

## Purpose

Bu skill, ürün sayfasında güven oluşturan fakat doğrulanabilir olması gereken sinyalleri düzenler ve güvenli ifade önerileri üretir.

Amaç sahte güven iddiası üretmek değil, zaten bilinen teslimat, iade, garanti, malzeme, marka veya kullanım güveni sinyallerini daha açık sunmaktır.

## Ne Zaman Kullanılır

Reranking veya answer-readiness katmanında güven sinyalleri zayıf olduğunda bu skill kullanılır.

Özellikle şu durumlarda:

- ürün açıklaması güven vermiyor ama bazı doğrulanmış ticari gerçekler mevcut
- kullanıcı "neden güveneyim" sorusuna cevap zayıf
- marka, iade, garanti veya materyal bilgisi görünür ama iyi ifade edilmemiş

## Gerekli Girdiler

- known facts
- visible product copy
- extracted attributes
- trust-related facts
- missing facts
- category

## Kurallar

Yalnızca doğrulanmış trust signal alanlarını kullan.

Şunları üret:

- güvenli trust signal maddeleri
- kısa açıklama önerileri
- eksik olduğu için kullanılamayan güven alanları

İfadeler:

- net olmalı
- ticari abartı içermemeli
- kanıtı olmayan vaat oluşturmamalı

## Anti-Hallucination Kuralları

- Resmi garanti, ücretsiz kargo, hızlı teslimat, sertifika, dermatolojik test, yerli üretim veya orijinallik iddiası uydurma.
- Marka itibarı veya müşteri memnuniyeti hakkında veri yoksa iddia yazma.
- Güven sinyali bilinmiyorsa `unverifiedTrustSignals` içine yaz.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.

```json
{
  "trustSignals": [
    {
      "label": "USB-C şarj desteği",
      "supportingFact": "Görünür ürün açıklamasında belirtiliyor",
      "usageSuggestion": "Ürünün kullanım kolaylığı bağlamında kısa ve net şekilde vurgula"
    }
  ],
  "trustCopySuggestions": [
    "Doğrulanmış kullanım ve ürün gerçeklerini öne çıkaran kısa güven cümlesi"
  ],
  "unverifiedTrustSignals": [
    "Garanti süresi",
    "Kargo avantajı"
  ],
  "recommendedNextAction": "Sadece doğrulanmış güven sinyallerini içerikte ayrı bir blok halinde göster."
}
```
