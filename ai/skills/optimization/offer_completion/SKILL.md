# Offer Completion Skill

## Purpose

Bu skill, ürünün satış bilgileri için hangi Offer alanlarının güvenle oluşturulabileceğini veya eksik bırakılması gerektiğini belirler.

Amaç AI sistemlerinin fiyat, para birimi ve stok bilgilerini daha iyi anlamasını sağlamak; fakat görünmeyen ticari bilgileri uydurmamaktır.

## Ne Zaman Kullanılır

Schema veya satış verisi tarafında Offer eksikleri olduğunda bu skill kullanılır.

Özellikle şu durumlarda:

- fiyat var ama para birimi belirsiz
- stok durumu görünür ama schema içinde yok
- ürün satılabilir görünüyor ama Offer sinyalleri eksik
- mevcut Offer verisi tutarsız veya çok zayıf

## Gerekli Girdiler

- visible price
- visible currency
- visible availability or stock wording
- existing offer/schema summary
- raw extracted commerce facts
- known facts
- missing facts

## Kurallar

Offer alanlarını yalnızca görünür veya platformdan gelen doğrulanmış ticari verilere göre değerlendir.

Şunları belirle:

- hangi Offer alanları güvenle doldurulabilir
- hangi alanlarda normalizasyon gerekir
- hangi alanlar kullanıcı onayı olmadan boş kalmalıdır
- görünür satış bilgisi ile schema arasında çelişki var mı

Para birimi, fiyat ve availability konusunda ihtiyatlı ol.

Metin üretmekten çok alan kararı ver.

## Anti-Hallucination Kuralları

- Fiyat uydurma.
- İndirim, ücretsiz kargo, taksit, aynı gün teslimat, kampanya veya stok var/yok bilgisi uydurma.
- Görünür veri yoksa `missingCommercialFacts` içine yaz.
- Belirsiz ticari metni kesin ticari iddiaya çevirme.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.
`offerActions` içindeki `field` yalnızca Offer ile ilgili alanlar olmalıdır. Örnek:

- `price`
- `priceCurrency`
- `availability`
- `url`

`action` yalnızca şu değerlerden biri olmalıdır:

- `set_if_verified`
- `normalize`
- `remove`
- `leave_empty`

`safeSource` yalnızca şu değerlerden biri olmalıdır:

- `visible_price`
- `visible_currency`
- `visible_availability`
- `platform_commerce_data`
- `existing_offer`
- `known_facts`

```json
{
  "offerActions": [
    {
      "field": "priceCurrency",
      "action": "set_if_verified",
      "safeSource": "visible_currency",
      "reason": "Para birimi görünür fiyatla birlikte doğrulanabiliyor."
    }
  ],
  "verifiedCommercialFacts": [
    "Görünür fiyat mevcut"
  ],
  "missingCommercialFacts": [
    "Doğrulanmış availability değeri"
  ],
  "conflicts": [],
  "recommendedNextAction": "Kod tarafında yalnızca doğrulanmış fiyat ve availability alanlarını kur."
}
```
