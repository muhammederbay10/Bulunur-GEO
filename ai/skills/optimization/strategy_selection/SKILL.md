# Strategy Selection Skill

## Purpose

Bu skill, mevcut GEO analiz sonucuna bakarak hangi optimizasyon stratejilerinin neden seçilmesi gerektiğini belirler.

Amaç tek bir genel "rewrite" kararı vermek değil, en zayıf GEO katmanlarını hedefleyen açıklanabilir ve sıralı bir strateji planı üretmektir.

## Ne Zaman Kullanılır

GEO Optimization Agent, iyileştirme akışını başlatırken bu skill kullanılır.

Özellikle şu kararları destekler:

- Hangi zayıflıklar önce ele alınmalı?
- Hangi skill veya strateji gerçekten gerekli?
- Önce eksik bilgi mi toplanmalı, yoksa doğrudan iyileştirme yapılabilir mi?
- Schema, offer, attribute, FAQ, trust veya comparison alanlarından hangileri en yüksek etkiyi sağlar?

## Gerekli Girdiler

Aşağıdaki veriler sağlanabilir:

- GEO analysis output
- layer scores and reasons
- missing signals
- known facts
- missing facts
- visible title and descriptions
- extracted attributes
- detected schema summary
- trust-signal summary
- comparison-readiness summary

Eksik bilgi varsa strateji seç ama doğrulanmamış detay uydurma.

## Kurallar

Yalnızca gerçekten ihtiyaç duyulan stratejileri seç.

Karar verirken şunlara bak:

- En düşük skorlu katmanlar hangileri?
- Eksik sinyaller yapısal mı, içeriksel mi, güven odaklı mı?
- Schema/offer eksikleri kod veya yapı odaklı mı?
- Buyer-intent rewrite gerçekten gerekli mi, yoksa önce attribute/FAQ eksikleri mi çözülmeli?
- Trust veya comparison sinyalleri zayıfsa hangi somut içerik türü bunu güçlendirir?
- Bilgi eksikliği yüksekse önce kullanıcıdan sorulması gereken alanları ayır.

Stratejileri önem sırasına koy.

Her strateji için:

- neden seçildiğini açıkla
- hangi zayıflığı hedeflediğini söyle
- kullanıcıdan ek bilgi gerekip gerekmediğini belirt
- beklenen çıktıyı tarif et

Gereksiz strateji seçme. Zaten güçlü görünen alanlara boş yere müdahale etme.

## Anti-Hallucination Kuralları

- Ürün gerçeği üretme.
- Eksik marka, garanti, sertifika, kapasite, kargo, malzeme veya performans iddiası uydurma.
- Bilinmeyen bir bilgiye dayanarak strateji seçme; bunu `requiredUserQuestions` veya `missingFactsToConfirm` içine yaz.
- "Şunu ekle" önerisinde bulunurken doğrulanmamış kesin değer verme.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.
`selectedStrategies` en fazla 6 öğe olmalı.
`requiredUserQuestions` en fazla 5 öğe olmalı.
`priority` 1 ile 6 arasında tam sayı olmalı.

```json
{
  "selectedStrategies": [
    {
      "strategyKey": "schema_repair",
      "priority": 1,
      "targetLayer": "machine_understanding",
      "reason": "Schema ile görünür ürün bilgileri arasında eksik Offer alanları var.",
      "expectedImpact": "Makinenin ürünü ve satış bilgisini daha güvenli anlamasını sağlar.",
      "requiresUserInput": false
    }
  ],
  "missingFactsToConfirm": [
    "Garanti süresi",
    "Teslimat veya kargo bilgisi"
  ],
  "requiredUserQuestions": [
    "Ürünün resmi garanti bilgisi var mı?",
    "Kargo veya teslimat avantajı doğrulanmış mı?"
  ],
  "strategySummary": "Önce yapısal eksikleri kapat, ardından buyer-intent ve FAQ iyileştirmesi yap."
}
```

`strategyKey` yalnızca şu değerlerden biri olmalıdır:

- `schema_repair`
- `offer_completion`
- `attribute_completion`
- `turkish_buyer_intent_rewrite`
- `turkish_faq_enrichment`
- `trust_signal_enrichment`
- `comparison_readiness`
- `anti_hallucination_validation`

`targetLayer` yalnızca şu değerlerden biri olmalıdır:

- `retrieval`
- `machine_understanding`
- `reranking_strength`
- `ai_answer_readiness`
