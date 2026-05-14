# Retrieval Evaluation Skill

## Amaç

Bu skill, bir ürün sayfasının Türkçe alıcı sorguları için bulunabilir olup olmadığını değerlendirir.

Retrieval katmanında hedef şudur: Ürün sayfası AI arama sistemlerinin aday havuzuna girebilecek kadar erişilebilir, anlaşılır ve ilgili mi?

Bu skill yalnızca semantik kalite kısmını değerlendirir. HTTP durumu, crawl başarısı, görsel erişilebilirliği, canonical/indexability gibi teknik sinyaller kod tarafında puanlanmalıdır.

## Ne Zaman Kullanılır

GEO Analysis Agent, ürün için retrieval skorunu hesaplarken bu skill kullanılır.

Özellikle şu sorulara cevap verir:

- Ürün başlığı Türkçe alıcı sorguları için yeterince açık mı?
- Meta açıklama ürünü ve kullanım niyetini anlatıyor mu?
- H1/H2 başlıkları ürün, kategori ve alıcı ihtiyacıyla uyumlu mu?
- Sayfa metni Türkçe arama niyetlerini doğal şekilde kapsıyor mu?
- Ürün/kategori terimleri belirsiz veya çok genel mi?

## Girdiler

Aşağıdaki veriler sağlanabilir:

- product title
- meta description
- H1/H2 headings
- visible page text
- product category
- brand
- extracted attributes
- Turkish buyer intent variants
- crawler metadata summary

Eksik veri varsa tahmin yapma. Eksik sinyali `missingSignals` alanına yaz.

## Değerlendirme Kuralları

0 ile 10 arasında semantik retrieval puanı ver.

Puan verirken şunlara bak:

- Başlık ürün tipini, ana özelliği ve kategoriyi açık söylüyor mu?
- Başlık sadece model kodu, marka adı veya belirsiz bir ifade mi?
- Meta açıklama alıcının ürünü neden arayacağını anlatıyor mu?
- Başlıklar ürün sayfasını destekliyor mu, yoksa genel pazarlama dili mi?
- Türkçe alıcı sorgularındaki doğal ifadeler kapsanıyor mu?
- Ürün, kategori ve kullanım amacı aynı sayfada tutarlı mı?
- Metin keyword stuffing yapmadan anlamlı sinyaller veriyor mu?
- Buyer-intent varyantları doğrulanmış ürün gerçeği değildir; sadece arama niyeti referansıdır.
- Önerilen aksiyonlarda bilinmeyen kapasite, teknik özellik veya ticari bilgiyi kesin değerle yazma.

Zayıf örnek:

```text
X12
```

Daha iyi örnek:

```text
X12 Kablosuz Kulaklık - Bluetooth Bağlantılı USB-C Şarj Kutulu Model
```

## Anti-Hallucination Kuralları

- Üründe olmayan özellikleri varmış gibi yazma.
- Kapasite, garanti, ücretsiz kargo, sertifika, organik içerik, bulaşık makinesinde yıkanabilirlik gibi bilgileri yalnızca girdi içinde varsa kullan.
- Teknik crawl sinyallerini tahmin etme.
- Eğer bilgi yoksa bunu eksik sinyal olarak belirt.
- Puanı güzel yazı stiline göre değil, retrieval için gerçek anlam sinyaline göre ver.
- Buyer-intent varyantlarında geçen ifadeleri ürün özelliği gibi kabul etme.
- Öneri yazarken bilinmeyen değerler için "kapasite bilgisini ekle" gibi genel ifade kullan; "5 litre ekle" gibi doğrulanmamış kesin değer yazma.

## Çıktı Formatı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.
`reasons` en fazla 3 madde ve her madde kısa olmalı.
`missingSignals` en fazla 3 madde ve her madde kısa olmalı.

```json
{
  "score": 0,
  "maxScore": 10,
  "reasons": [
    "Başlık ürün kategorisini açıkça söylüyor.",
    "Meta açıklama alıcı niyetini yeterince desteklemiyor."
  ],
  "missingSignals": [
    "Kullanım amacı",
    "Ürüne özgü ayırt edici özellik"
  ],
  "recommendedNextAction": "Başlığı ürün tipi, önemli özellik ve Türkçe alıcı niyetiyle yeniden yapılandır."
}
```

`score` değeri 0 ile 10 arasında olmalıdır.
