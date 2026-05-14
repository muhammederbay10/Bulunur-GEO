# Answer Readiness Skill

## Amaç

Bu skill, bir AI asistanının ürün hakkında Türkçe alıcı sorularını güvenle cevaplayıp cevaplayamayacağını değerlendirir.

AI Answer Readiness katmanında hedef şudur: LLM bu ürünü özetleyebilir, tavsiye bağlamına koyabilir, sık soruları cevaplayabilir ve bunu tahmin yapmadan yapabilir mi?

Bu skill yalnızca semantik cevaplanabilirlik kısmını değerlendirir. FAQ varlığı, özet alanı varlığı ve temel alan kontrolleri kod tarafında puanlanmalıdır.

## Ne Zaman Kullanılır

GEO Analysis Agent, AI Answer Readiness skorunu hesaplarken bu skill kullanılır.

Özellikle şu sorulara cevap verir:

- Ürün tek cümlede doğru ve doğal şekilde özetlenebiliyor mu?
- Türkçe alıcıların soracağı temel sorular mevcut bilgilerle cevaplanabiliyor mu?
- FAQ varsa cevaplar gerçek ürün bilgilerine dayanıyor mu?
- Ürün tavsiye edilecek bağlam açık mı?
- AI cevap üretirken tahmin yapmak zorunda kalır mı?

## Girdiler

Aşağıdaki veriler sağlanabilir:

- title
- description
- attributes
- known facts
- missing facts
- FAQ content
- Turkish buyer intent variants
- category
- trust signals
- comparison signals

Eksik bilgi varsa cevap üretme; eksik sinyal olarak belirt.

## Değerlendirme Kuralları

0 ile 15 arasında semantik answer readiness puanı ver.

Puan verirken şunlara bak:

- Ürün hakkında kısa, doğru ve doğal Türkçe özet yapılabiliyor mu?
- Kullanıcı "Bu ürün kimler için uygun?" diye sorsa cevap var mı?
- Kullanıcı "Neden bunu almalıyım?" diye sorsa kanıtlı cevap var mı?
- Kullanıcı "Benzer ürünlerle farkı ne?" diye sorsa cevaplanabilir mi?
- FAQ cevapları bilinen gerçeklere dayanıyor mu?
- Eksik bilgiler yüzünden AI tahmin yapmak zorunda kalıyor mu?
- Türkçe metin doğal, sade ve alıcı odaklı mı?
- Cevaplar keyword stuffing veya abartılı satış dili içeriyor mu?

Bu katman akıcı metni değil, güvenli ve grounded cevap üretilebilirliğini ödüllendirir.

## Anti-Hallucination Kuralları

- Bilinmeyen sorulara cevap uydurma.
- FAQ cevaplarında doğrulanmamış teknik özellik, garanti, kargo, sertifika veya kullanım iddiası yazma.
- Eksik bilgi gerekiyorsa `missingSignals` alanına yaz.
- Ürünü tavsiye ederken sadece bilinen gerçeklere dayan.
- Eğer AI cevap verirken tahmin yapmak zorundaysa puanı düşür.

## Çıktı Formatı

Sadece geçerli JSON döndür. Markdown, açıklama yazısı veya code fence kullanma.
`reasons` en fazla 3 madde ve her madde kısa olmalı.
`missingSignals` en fazla 3 madde ve her madde kısa olmalı.

```json
{
  "score": 0,
  "maxScore": 15,
  "reasons": [
    "Ürün kısa şekilde özetlenebiliyor.",
    "Karşılaştırma ve sık sorular için yeterli doğrulanmış bilgi yok."
  ],
  "missingSignals": [
    "Kimler için uygun olduğu",
    "Sık sorular için doğrulanmış cevap gerçekleri"
  ],
  "recommendedNextAction": "Bilinen ürün gerçeklerinden buyer-intent FAQ üret ve eksik cevaplar için kullanıcıya hedefli sorular sor."
}
```

`score` değeri 0 ile 15 arasında olmalıdır.
