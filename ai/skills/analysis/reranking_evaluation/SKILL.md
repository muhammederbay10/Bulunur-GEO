# Reranking Evaluation Skill

## Amaç

Bu skill, ürünün benzer ürünler arasından AI sistemleri tarafından güçlü bir aday olarak seçilip seçilemeyeceğini değerlendirir.

Reranking katmanında hedef şudur: Ürün sadece bulunabilir değil, aynı zamanda alıcıya önerilecek kadar spesifik, güvenilir, karşılaştırılabilir ve faydalı mı?

Bu skill yalnızca semantik kalite kısmını değerlendirir. Kategoriye özgü attribute sayımı, gerçek yorum/rating varlığı ve doğrulanmış trust sinyalleri kod tarafında kontrol edilmelidir.

## Ne Zaman Kullanılır

GEO Analysis Agent, Reranking Strength skorunu hesaplarken bu skill kullanılır.

Özellikle şu sorulara cevap verir:

- Açıklama spesifik mi, yoksa genel pazarlama dili mi?
- Ürün hangi kullanıcı veya kullanım senaryosu için iyi olduğunu anlatıyor mu?
- Karşılaştırma için önemli özellikler açık mı?
- Güven sinyalleri doğal ve doğrulanabilir şekilde verilmiş mi?
- Üründe çelişkili veya desteklenmeyen iddialar var mı?

## Girdiler

Aşağıdaki veriler sağlanabilir:

- product title
- short description
- long description
- category
- attributes
- known facts
- missing facts
- trust signals
- Turkish buyer intent variants
- category-specific expected attributes

Eksik veri varsa ürünü cezalandırabilirsin, fakat eksik bilgiyi uydurma.

## Değerlendirme Kuralları

0 ile 14 arasında semantik reranking puanı ver.

Puan verirken şunlara bak:

- Açıklama ürünün gerçek özelliklerini söylüyor mu?
- Ürün hangi problem, ihtiyaç veya kullanım bağlamı için uygun?
- Kategoriye göre karşılaştırma yapılabilecek özellikler var mı?
- "En iyi", "kaliteli", "mükemmel" gibi boş iddialar kanıtsız mı?
- Türkçe ifade doğal ve alıcı odaklı mı?
- Ürün alternatiflerle kıyaslanabilecek kadar net mi?
- Trust sinyalleri varsa doğrulanmış gerçeklere dayanıyor mu?
- Eksik önemli özellikler reranking gücünü düşürüyor mu?

Zayıf örnek:

```text
Modern tasarımı ile mutfağınıza şıklık katar.
```

Daha iyi örnek:

```text
5 litrelik kapasitesiyle 3-4 kişilik aileler için uygundur. Kompakt tasarımı küçük mutfaklarda az yer kaplar.
```

## Anti-Hallucination Kuralları

- Eksik özellikleri tamamlamış gibi yazma.
- Gerçek olmayan trust sinyali üretme.
- Yorum, rating, garanti, iade, kargo, sertifika veya orijinallik iddialarını yalnızca doğrulanmışsa kullan.
- Ürünü olduğundan daha güçlü göstermek için unsupported claim ekleme.
- Reranking puanı verirken kanıtlanabilir bilgi yoğunluğunu esas al.

## Çıktı Formatı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.
`reasons` en fazla 3 madde ve her madde kısa olmalı.
`missingSignals` en fazla 3 madde ve her madde kısa olmalı.

```json
{
  "score": 0,
  "maxScore": 14,
  "reasons": [
    "Açıklama ürünün kullanım senaryosunu anlatıyor.",
    "Karşılaştırma için önemli kategori özellikleri eksik."
  ],
  "missingSignals": [
    "Hedef kullanıcı",
    "Kategoriye özgü karşılaştırma attribute'ları"
  ],
  "recommendedNextAction": "Ürün açıklamasını doğrulanmış özellikler, kullanım senaryoları ve karşılaştırma sinyalleriyle güçlendir."
}
```

`score` değeri 0 ile 14 arasında olmalıdır.
