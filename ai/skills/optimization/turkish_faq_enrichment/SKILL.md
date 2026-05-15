# Turkish FAQ Enrichment Skill

## Purpose

Bu skill, ürün için doğal Türkçe alıcı soruları ve yalnızca doğrulanmış gerçeklere dayanan cevaplar üretir.

Amaç AI answer-readiness ve kullanıcı güvenini artırmak; fakat eksik bilgileri hayal ederek FAQ doldurmak değildir.

## Ne Zaman Kullanılır

Ürün için sık sorular eksikse veya AI cevaplanabilirliği zayıfsa bu skill kullanılır.

Özellikle şu sorular için içerik üretir:

- Bu ürün ne işe yarar?
- Kimler için uygun?
- Hangi kullanım senaryosunda tercih edilir?
- Öne çıkan doğrulanmış farkı nedir?

## Gerekli Girdiler

- title
- description
- extracted attributes
- known facts
- missing facts
- buyer intent variants
- trust signals
- comparison signals

## Kurallar

FAQ soruları doğal Türkçe ile yazılmalı.

Cevaplar:

- kısa ve net olmalı
- yalnızca doğrulanmış ürün gerçeğine dayanmalı
- satış sloganı yerine açıklayıcı olmalı
- eksik gerçek varsa bunu örtmemeli

Soruları yüksek alıcı niyetiyle seç.

En fazla 6 FAQ üret.

## Anti-Hallucination Kuralları

- Doğrulanmamış teknik detay veya ticari vaat yazma.
- "Su geçirmez", "organik", "resmi garantili", "aynı gün kargo" gibi iddiaları yalnızca veri varsa kullan.
- Cevabı bilmiyorsan soru üretme veya bunu `blockedQuestions` içine koy.
- Buyer-intent varyantlarından ürün özelliği türetme.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.

```json
{
  "faqItems": [
    {
      "question": "Bu ürün kimler için uygundur?",
      "answer": "Cevap yalnızca doğrulanmış ürün özellikleri ve kullanım bağlamına dayanır.",
      "sourceFacts": [
        "görünür ürün tipi ifadesi",
        "görünür kullanım amacı veya doğrulanmış attribute değeri"
      ]
    }
  ],
  "blockedQuestions": [
    "Garanti süresi nedir?"
  ],
  "missingFactsToAnswerBetter": [
    "Garanti bilgisi"
  ],
  "recommendedNextAction": "Doğrulanmış ürün gerçeklerinden 3 ila 6 güvenli FAQ yayınla."
}
```

`sourceFacts` içine genel etiket değil, cevapta dayandığın somut doğrulanmış gerçek veya görünür ifade yaz.

Yanlış örnek:

- `Ürün tipi`
- `Doğrulanmış kullanım amacı`

Doğru örnek:

- `Çelik Su Isıtıcı`
- `Mutfak kullanımı`
- `5 litre kapasite`
