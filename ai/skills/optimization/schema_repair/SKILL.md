# Schema Repair Skill

## Purpose

Bu skill, görünür ürün gerçekleri ile yapılandırılmış veri arasındaki semantik boşlukları belirler ve Product JSON-LD için güvenli düzeltme önerileri üretir.

Amaç doğrulanmamış schema alanları icat etmek değil, mevcut ürün gerçeklerinden hangi alanların güvenle kurulabileceğini netleştirmektir.

## Ne Zaman Kullanılır

Makine anlama katmanında schema tarafı zayıf olduğunda bu skill kullanılır.

Özellikle şu durumlarda uygundur:

- Schema görünür ürünle tutarsızsa
- Product JSON-LD eksikse veya çok zayıfsa
- Description, brand, category veya offer alanları yetersizse
- Schema içinde görünen ürünü desteklemeyen boş/genel ifadeler varsa

## Gerekli Girdiler

- visible product title
- visible short and long description
- known facts
- extracted attributes
- visible brand/category
- existing schema summary
- schema validation summary
- missing facts

## Kurallar

Yalnızca görünür veya doğrulanmış ürün gerçeklerinden hareket et.

Şunları değerlendir:

- Hangi schema alanları görünür sayfadan güvenle beslenebilir?
- Hangi alanlar eksik ama tamamlanabilir?
- Hangi alanlar eksik ve kullanıcı onayı olmadan tamamlanmamalı?
- Mevcut schema içinde hangi alanlar görünür ürünle çelişiyor?
- Description alanı daha net ve makinece anlaşılır hale nasıl gelir?

Çıktıda:

- düzeltilecek alanları açık listele
- her alan için veri kaynağını belirt
- doğrulanamayan alanları ayrı işaretle
- kod tarafının kurabileceği alanları içerik tarafının yazacağı alanlardan ayır

## Anti-Hallucination Kuralları

- SKU, GTIN, MPN, brand, fiyat, stok, garanti, sertifika, varyant veya üretim bilgisi uydurma.
- Görünür sayfada olmayan bir özelliği schema alanına dönüştürme.
- Bilinmeyen Offer detaylarını doldurma.
- Eğer bir alan için güvenli veri yoksa bunu `cannotSafelyInfer` içine yaz.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.
`schemaActions` içindeki `action` yalnızca şu değerlerden biri olmalıdır:

- `add`
- `update`
- `rewrite`
- `remove`
- `leave_empty`

`safeSource` yalnızca şu değerlerden biri olmalıdır:

- `visible_title`
- `visible_short_description`
- `visible_description`
- `visible_attributes`
- `visible_brand`
- `visible_category`
- `existing_schema`
- `known_facts`

```json
{
  "schemaActions": [
    {
      "field": "description",
      "action": "rewrite",
      "safeSource": "visible_description",
      "reason": "Mevcut schema açıklaması fazla genel.",
      "suggestedValue": "Ürünün ne olduğunu ve temel kullanım amacını görünür gerçeklerden özetleyen kısa açıklama"
    }
  ],
  "safeFieldsToBuild": [
    "name",
    "description",
    "brand"
  ],
  "cannotSafelyInfer": [
    "gtin",
    "mpn"
  ],
  "validationFocus": [
    "Schema açıklaması görünür ürünle uyumlu olmalı",
    "Doğrulanmamış satış bilgisi eklenmemeli"
  ],
  "recommendedNextAction": "Kod tarafında güvenli alanları kur ve doğrulanamayan tanımlayıcıları boş bırak."
}
```
