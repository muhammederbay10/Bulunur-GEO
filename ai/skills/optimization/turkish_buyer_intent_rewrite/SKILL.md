# Turkish Buyer Intent Rewrite Skill

## Purpose

Bu skill, ürün başlığı ve açıklamalarını Türkçe alıcı niyetine daha uygun hale getirir.

Amaç ana ürün gerçeklerini bozmadan, ürünün ne olduğu, kim için uygun olduğu ve hangi ihtiyacı çözdüğünü daha açık anlatan Türkçe metin üretmektir.

## Ne Zaman Kullanılır

Retrieval, reranking veya answer-readiness katmanında içerik netliği zayıf olduğunda bu skill kullanılır.

Özellikle şu durumlarda:

- başlık fazla kısa, belirsiz veya model kodu ağırlıklıysa
- açıklama ürünün kullanım amacını anlatmıyorsa
- metin doğal Türkçe buyer-intent sinyali taşımıyorsa
- ürün faydası var ama metin dağınıkysa

## Gerekli Girdiler

- current title
- short description
- long description
- known facts
- extracted attributes
- category
- buyer intent variants
- missing facts

## Kurallar

Metni sade, doğal ve Türkçe e-ticaret diline uygun yaz.

Çıktıda şunlar üretilebilir:

- improvedTitle
- improvedShortDescription
- improvedLongDescription

Yazarken şunlara dikkat et:

- Ürünün ne olduğunu ilk bakışta anlaşılır kıl
- Doğrulanmış ana özellikleri öne çıkar
- Kullanım bağlamını doğal şekilde ekle
- Aşırı iddia, tekrar ve keyword stuffing yapma
- Uzun açıklamada net paragraflar veya kısa bölümler kullan
- Bilinmeyen ticari veya teknik bilgileri metne sokma

## Anti-Hallucination Kuralları

- Garanti, kargo, sertifika, kampanya, malzeme, kapasite, teknik performans veya sağlık iddiası uydurma.
- Buyer-intent varyantlarını ürün gerçeği gibi kullanma.
- Bilinmeyen özellikleri "ideal", "profesyonel", "premium" gibi belirsiz abartılarla maskeleme.
- Eksik bilgi önemliyse `blockedByMissingFacts` içine yaz.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.

```json
{
  "improvedTitle": "Kablosuz Bluetooth Kulaklık - USB-C Şarj Kutulu Günlük Kullanım Modeli",
  "improvedShortDescription": "Günlük kullanım için pratik bağlantı ve taşınabilir şarj kutusu sunan kablosuz kulaklık.",
  "improvedLongDescription": "Ürünün doğrulanmış özelliklerine dayanan, doğal Türkçe ile yazılmış açıklama",
  "preservedFacts": [
    "Bluetooth bağlantı",
    "USB-C şarj kutusu"
  ],
  "blockedByMissingFacts": [
    "Batarya süresi"
  ],
  "recommendedNextAction": "Metni doğrulanmış teknik ve kullanım gerçekleriyle yayın öncesi yeniden kontrol et."
}
```
