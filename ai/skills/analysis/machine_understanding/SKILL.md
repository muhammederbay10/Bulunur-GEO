# Machine Understanding Skill

## Amaç

Bu skill, ürün sayfasındaki görünür bilgiler ile yapılandırılmış verilerin aynı ürünü net ve tutarlı şekilde anlatıp anlatmadığını değerlendirir.

Machine Understanding katmanında hedef şudur: AI sistemleri ürünün ne olduğunu, hangi kategoriye ait olduğunu, hangi gerçek özelliklere sahip olduğunu ve satış bilgilerinin ne anlama geldiğini tahmin etmeden anlayabiliyor mu?

Bu skill yalnızca semantik tutarlılık kısmını değerlendirir. JSON-LD parse etme, Schema.org alan kontrolü, fiyat/para birimi/availability doğrulaması kod tarafında yapılmalıdır.

## Ne Zaman Kullanılır

GEO Analysis Agent, Machine Understanding skorunu hesaplarken bu skill kullanılır.

Özellikle şu sorulara cevap verir:

- Schema içindeki ürün adı görünür sayfadaki ürünle aynı mı?
- Schema açıklaması ürünü anlamlı şekilde anlatıyor mu?
- Kategori, marka, varyant ve özellikler görünür içerikle uyumlu mu?
- Yapılandırılmış veri görünür sayfada olmayan iddialar içeriyor mu?
- Görünür önemli ürün gerçekleri schema tarafında eksik mi?

## Girdiler

Aşağıdaki veriler sağlanabilir:

- visible product title
- visible description
- visible price, currency, availability
- visible brand and category
- extracted attributes
- detected Schema.org Product JSON-LD
- schema validation summary
- raw extracted facts
- known facts list

Eksik veya çelişkili veri varsa bunu açıkça belirt.

## Değerlendirme Kuralları

0 ile 6 arasında semantik tutarlılık puanı ver.

Puan verirken şunlara bak:

- Schema ürünü yanlış kategoriye koyuyor mu?
- Schema adı görünür başlıkla uyumlu mu?
- Schema açıklaması çok genel, boş veya başka ürüne ait gibi mi?
- Offer bilgisi görünür fiyat/stok bilgisiyle çelişiyor mu?
- Marka, SKU, GTIN, varyant veya kategori bilgileri biliniyorsa doğru bağlanmış mı?
- Görünür sayfada önemli olan bilgiler schema içinde yok mu?
- Schema tarafında görünür sayfada doğrulanmayan güçlü iddialar var mı?

Bu katmanda amaç güzel açıklama yazmak değil, makinelerin ürünü doğru anlamasını sağlamaktır.

## Anti-Hallucination Kuralları

- Eksik schema alanlarını doldurma; sadece eksik olduklarını raporla.
- Ürün için yeni marka, SKU, GTIN, fiyat, stok veya sertifika uydurma.
- Görünür veri ile schema çelişiyorsa bunu açıkça işaretle.
- Bilgi bilinmiyorsa `missingSignals` içine yaz.
- Sadece verilen ürün verisine dayan.

## Çıktı Formatı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.
`reasons` en fazla 3 madde ve her madde kısa olmalı.
`missingSignals` en fazla 3 madde ve her madde kısa olmalı.

```json
{
  "score": 0,
  "maxScore": 6,
  "reasons": [
    "Schema adı görünür ürün başlığıyla uyumlu.",
    "Schema açıklaması ürünün ana kullanım amacını anlatmıyor."
  ],
  "missingSignals": [
    "Offer availability",
    "Görünür sayfadaki kategori bilgisinin schema içinde karşılığı"
  ],
  "recommendedNextAction": "Schema açıklamasını görünür ürün gerçekleriyle uyumlu hale getir ve eksik Offer alanlarını kod tarafında tamamla."
}
```

`score` değeri 0 ile 6 arasında olmalıdır.
