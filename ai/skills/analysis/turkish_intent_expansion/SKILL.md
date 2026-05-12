# Turkish Intent Expansion Skill

## Amaç

Bu skill, bir ürün için Türkçe e-ticaret alıcılarının doğal arama ve soru niyetlerini üretir.

Amaç SEO anahtar kelime listesi yazmak değildir. Amaç, GEO scoring ve optimization akışında kullanılacak gerçekçi Türkçe buyer-intent varyantları oluşturmaktır.

Bu varyantlar retrieval, reranking ve answer readiness değerlendirmelerinde referans olarak kullanılır.

## Ne Zaman Kullanılır

GEO Analysis Agent, ürün kategorisi ve temel ürün bilgileri hazırlandıktan sonra bu skill kullanılır.

Özellikle şu durumlarda faydalıdır:

- Ürün başlığı çok kısa veya belirsizse
- Kategori için Türkçe kullanıcı sorguları çıkarılacaksa
- Yerel kullanım dili, ödünç kelimeler ve kategori eş anlamlıları gerekiyorsa
- Daha sonra retrieval ve reranking judge promptlarına niyet listesi verilecekse

## Girdiler

Aşağıdaki veriler sağlanabilir:

- product title
- category
- brand
- description
- attributes
- known facts
- missing facts
- source platform
- visible page text summary

Girdi içinde olmayan teknik özellikleri niyet varyantlarına kesin bilgi gibi ekleme.

## Üretim Kuralları

8 ile 12 arasında Türkçe buyer-intent varyantı üret.

Varyantlar şu türleri kapsamalıdır:

- ürün tipi araması
- kategori araması
- kullanım amacı
- hedef kullanıcı veya bağlam
- problem çözme niyeti
- karşılaştırma niyeti
- tavsiye niyeti
- güven veya satın alma öncesi soru niyeti
- kategoriye uygunsa ödünç kelime veya yaygın Türkçe alternatif

Örnek airfryer varyantları:

```text
5 litre airfryer
küçük mutfak için hava fritözü
3-4 kişilik aile için airfryer
kolay temizlenen airfryer önerisi
airfryer mı fırın mı
```

Kategoriye göre ödünç kelimeleri doğal kullan:

- airfryer / hava fritözü
- smartwatch / akıllı saat
- blender seti / el blenderı
- sneaker / spor ayakkabı

Fakat ödünç kelimeyi sırf çeşitlilik olsun diye ekleme. Türkiye e-ticaret dilinde gerçekten kullanılıyorsa ekle.

## Anti-Hallucination Kuralları

- Bilinmeyen kapasite, materyal, garanti, kargo, sertifika veya teknik özelliği sorgu varyantına kesin gerçek gibi ekleme.
- Eğer bir varyant kategoriye dayalı genel niyetse bunu ürün gerçeği gibi yazma.
- Marka veya model bilgisi yoksa uydurma.
- Ürünle ilgisiz popüler anahtar kelimeler ekleme.
- Keyword stuffing yapma.

## Çıktı Formatı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.

```json
{
  "detectedCategory": "Airfryer",
  "buyerIntentVariants": [
    "5 litre airfryer",
    "küçük mutfak için hava fritözü"
  ],
  "borrowedTermVariants": [
    "airfryer",
    "hava fritözü"
  ],
  "intentGroups": {
    "productType": [
      "airfryer"
    ],
    "useCase": [
      "küçük mutfak için hava fritözü"
    ],
    "comparison": [
      "airfryer mı fırın mı"
    ],
    "prePurchaseQuestions": [
      "airfryer alırken nelere dikkat edilmeli"
    ]
  },
  "missingSignals": [
    "Kapasite bilgisi bilinmediği için kapasite odaklı niyetler sınırlı tutuldu."
  ],
  "reasoningSummary": "Varyantlar ürün kategorisi, görünen ürün bilgileri ve Türkiye'deki doğal e-ticaret sorgu dili dikkate alınarak üretildi."
}
```

`buyerIntentVariants` içinde yalnızca ürünle ilgili ve doğal Türkçe ifadeler bulunmalıdır.
