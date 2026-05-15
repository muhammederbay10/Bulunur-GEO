# Attribute Completion Skill

## Purpose

Bu skill, ürünün eksik veya zayıf anlatılmış niteliklerini belirler ve yalnızca doğrulanmış gerçeklerden türetilebilecek attribute önerileri üretir.

Amaç ürün sayfasını kategoriye uygun, karşılaştırılabilir ve makinece anlaşılır hale getirmektir.

## Ne Zaman Kullanılır

Reranking veya machine understanding katmanında attribute eksikleri görüldüğünde bu skill kullanılır.

Özellikle şu durumlarda:

- ürün tipi belli ama temel nitelikler eksikse
- görünür açıklama var fakat özellikler dağınık veya belirsizse
- karşılaştırma için önemli alanlar görünmüyorsa
- kullanıcı sorularını cevaplamak için yeterli ürün gerçeği yoksa

## Gerekli Girdiler

- title
- description
- short description
- extracted attributes
- known facts
- category
- missing facts
- buyer intent context

## Kurallar

Kategoriye göre yüksek etkili attribute alanlarını düşün.

Şunları üret:

- zaten doğrulanmış ve görünür olan attribute adayları
- eksik ama kullanıcıdan sorulması gereken attribute alanları
- yalnızca açık kaynağı olan güvenli attribute etiketleri

Attribute önerileri:

- kısa olmalı
- karşılaştırılabilir olmalı
- ürün gerçeğine dayanmalı
- pazarlama sloganı olmamalı
- `confirmedAttributes` yalnızca doğrudan desteklenen alanlardan oluşmalı
- `attributeSuggestions` yalnızca açık `source` verilebiliyorsa üretilmeli
- yalnızca kategoriye tipik diye yeni değer önerme
- desteklenmeyen bir alan gerekiyorsa bunu `missingAttributesToConfirm` içine yaz

## Anti-Hallucination Kuralları

- Teknik değer, ölçü, kapasite, malzeme, uyumluluk veya sertifika uydurma.
- Açıklamada ima edildi diye kesin attribute üretme.
- Bilinmeyen attribute alanlarını `missingAttributesToConfirm` içine yaz.
- Kategoriye tipik diye ürün için kesin gerçekmiş gibi yazma.

## Beklenen JSON Çıktısı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.

```json
{
  "confirmedAttributes": [
    {
      "name": "Ürün tipi",
      "value": "Kablosuz kulaklık",
      "source": "visible_title"
    }
  ],
  "attributeSuggestions": [
    {
      "name": "Bağlantı tipi",
      "value": "Bluetooth",
      "source": "visible_description",
      "reason": "Alıcı karşılaştırmalarında yüksek etkili."
    }
  ],
  "missingAttributesToConfirm": [
    "Batarya süresi",
    "Suya dayanıklılık seviyesi"
  ],
  "recommendedNextAction": "Doğrulanmış nitelikleri öne çıkar ve eksik teknik alanlar için hedefli soru sor."
}
```
