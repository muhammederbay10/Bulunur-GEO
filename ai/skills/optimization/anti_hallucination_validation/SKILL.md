# Anti-Hallucination Validation Skill

## Purpose

Bu skill, üretilen optimizasyon çıktılarında doğrulanmamış ürün iddiası olup olmadığını kontrol eder.

Amaç yaratıcı metni ödüllendirmek değil, son içeriklerin bilinen ürün gerçeklerine sıkı şekilde bağlı kaldığını doğrulamaktır.

## Ne Zaman Kullanılır

Optimization Agent, başlık/açıklama/FAQ/schema önerileri üretildikten sonra bu skill kullanılır.

Özellikle şu kontrolleri yapar:

- yeni içerikte görünmeyen ürün iddiası var mı
- FAQ cevapları desteklenmeyen detay ekliyor mu
- trust veya comparison metni abartılı vaat içeriyor mu
- schema veya offer önerileri doğrulanmamış alan taşıyor mu

## Gerekli Girdiler

- known facts
- missing facts
- original visible content
- generated title
- generated descriptions
- generated FAQ
- generated trust/comparison copy
- generated schema suggestions

## Kurallar

Her öneriyi şu sınıflardan biriyle değerlendir:

- supported
- unsupported
- uncertain

Değerlendirirken:

- iddia doğrudan girdide var mı
- iddia girdiden güvenli biçimde yeniden ifade edilmiş mi
- iddia için ek kullanıcı doğrulaması gerekiyor mu

Çıktıda:

- sorunlu iddiaları açıkça listele
- hangi çıktının güvenli olduğunu belirt
- kaldırılması veya yumuşatılması gereken ifadeleri göster

## Anti-Hallucination Kuralları

- Bilinmeyen bilgiyi "muhtemelen" gibi sözlerle bile gerçek gibi sunma.
- Eksik teknik veya ticari detayı desteklenmiş sayma.
- Güçlü sağlık, performans, güven veya teslimat iddialarına daha sıkı yaklaş.
- Emin değilsen `uncertainClaims` içine yaz.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.

```json
{
  "validationStatus": "needs_revision",
  "supportedClaims": [
    "Bluetooth bağlantı bilgisi görünür içerikte mevcut"
  ],
  "unsupportedClaims": [
    {
      "claim": "24 saat pil ömrü",
      "location": "improvedLongDescription",
      "reason": "Girdi içinde doğrulanmış batarya süresi yok.",
      "fixSuggestion": "Batarya süresi bilinmiyorsa bu ifadeyi kaldır."
    }
  ],
  "uncertainClaims": [
    {
      "claim": "Hızlı teslimat",
      "location": "trustCopySuggestions",
      "reason": "Teslimat bilgisi doğrulanmamış."
    }
  ],
  "recommendedSafeNextAction": "Unsupported claim içeren metinleri kaldır veya doğrulanmış genel ifadeye çevir."
}
```

`validationStatus` yalnızca şu değerlerden biri olmalıdır:

- `pass`
- `needs_revision`
