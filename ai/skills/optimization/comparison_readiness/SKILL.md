# Comparison Readiness Skill

## Purpose

Bu skill, ürünün benzer ürünlerle karşılaştırılırken hangi doğrulanmış farkları kullanabileceğini belirler ve güvenli karşılaştırma anlatımı üretir.

Amaç rakip uydurmak veya desteklenmeyen üstünlük iddiaları yazmak değil; ürünün kendi doğrulanmış özelliklerini karşılaştırma bağlamında daha net sunmaktır.

## Ne Zaman Kullanılır

Reranking strength zayıfsa veya ürün karşılaştırma bağlamında yetersiz görünüyorsa bu skill kullanılır.

Özellikle şu durumlarda:

- ürünün ayırt edici yönleri görünmüyor
- ürün, kullanım senaryosu içinde konumlanmıyor
- alıcı "hangi durumda bunu seçmeliyim" sorusuna net cevap alamıyor

## Gerekli Girdiler

- title
- descriptions
- extracted attributes
- known facts
- category
- buyer intent variants
- missing facts

## Kurallar

Ürünü kendi doğrulanmış özellikleri üzerinden konumlandır.

Şunları üret:

- ayırt edici ama doğrulanmış özellikler
- hangi kullanım bağlamında anlamlı olduğu
- karşılaştırma için eksik kalan kritik bilgiler

Rakip marka veya rakip model adı verme gerekmez. Gerekli değilse verme.

"En iyi", "daha güçlü", "daha dayanıklı" gibi karşılaştırmalı üstünlük ifadelerini ancak açık doğrulanmış dayanak varsa kullan.

## Anti-Hallucination Kuralları

- Rakip ürün bilgisi uydurma.
- Ürünün üstünlüğünü veri olmadan ilan etme.
- Bilinmeyen performans, dayanıklılık, kalite veya kullanım sonucu üretme.
- Eksik karşılaştırma verilerini `missingComparisonFacts` içine yaz.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.

```json
{
  "comparisonAngles": [
    {
      "angle": "Günlük kullanım kolaylığı",
      "supportedBy": [
        "USB-C şarj kutusu",
        "Kablosuz kullanım"
      ],
      "safePositioning": "Pratik günlük kullanım arayan kullanıcılar için uygun bir seçenek olarak konumlanabilir."
    }
  ],
  "distinctiveFacts": [
    "Kablosuz kullanım",
    "Taşınabilir şarj kutusu"
  ],
  "missingComparisonFacts": [
    "Batarya süresi",
    "Suya dayanıklılık"
  ],
  "recommendedNextAction": "Karşılaştırma anlatımını yalnızca doğrulanmış ayırt edici özellikler üzerine kur."
}
```
