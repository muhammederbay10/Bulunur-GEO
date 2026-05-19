# API Contract

This document defines the contract between the web/backend layer and the AI/GEO engine.

The backend owns authentication, dashboard, product discovery, crawling, platform connectors, persistence, and publishing. The AI/GEO engine owns product analysis, GEO scoring, strategy selection, Turkish content improvements, Schema.org JSON-LD generation, and validation.

## Public AI Functions

The backend should call the AI engine through two main functions:

```python
analyze_product(product_input: ProductInput) -> GeoAnalysisOutput

improve_product(
    product_input: ProductInput,
    analysis: GeoAnalysisOutput,
    user_facts: dict | None = None,
) -> GeoImprovementOutput
```

The same contract can later be exposed through backend API routes such as:

```text
POST /ai/analyze-product
POST /ai/improve-product
```

## Service Authentication

Authentication between the backend server and the AI/GEO server should be server-to-server authentication.

The backend should not forward the user's JWT token to the AI/GEO engine. User authentication and authorization remain the backend's responsibility.

Recommended approach for the MVP:

```text
Backend -> AI/GEO service
Authorization: Bearer <internal-service-secret>
```

The AI/GEO service should verify only the internal service credential before accepting requests.

The backend should include user/store/product identifiers in the request body when the AI engine needs context, but the AI engine should treat them as application data, not authentication proof.

This keeps the boundary simple:

```text
Frontend user auth: handled by backend
Backend-to-AI auth: handled by internal server-to-server secret
AI/GEO engine: validates internal service access and processes product payloads
```

Future production versions may replace the shared internal secret with signed service tokens, mTLS, or cloud IAM service identity. For the hackathon MVP, an internal service secret is enough.

## ProductInput

`ProductInput` is the main object sent from the backend to the AI/GEO engine.

It should include normalized product fields, raw extracted page data, detected schema, and crawler retrieval metadata.

Example shape:

```json
{
  "productId": "local-or-platform-product-id",
  "storeId": "store-id",
  "source": "shopify",
  "url": null,
  "language": "tr",
  "market": "TR",
  "title": "X500 Airfryer",
  "description": "Current product description...",
  "shortDescription": "Optional short description...",
  "price": "2499",
  "currency": "TRY",
  "availability": "in_stock",
  "brand": "ExampleBrand",
  "category": "Airfryer",
  "imageUrls": [
    "https://example.com/image.jpg"
  ],
  "attributes": {
    "capacity": "5 litre"
  },
  "rawExtracted": {
    "pageTitle": "X500 Airfryer | Example Store",
    "metaDescription": "Example meta description",
    "headings": {
      "h1": ["X500 Airfryer"],
      "h2": ["Ürün Özellikleri"]
    },
    "bodyText": "Extracted visible product page text...",
    "detectedSchema": []
  },
  "crawlMetadata": {
    "crawlStatus": "success",
    "httpStatusCode": 200,
    "accessible": true,
    "blocked": false,
    "contentExtracted": true,
    "canonicalUrl": null,
    "robotsAllowed": true,
    "imagesAccessible": true,
    "crawledAt": "2026-05-10T19:00:00+03:00"
  }
}
```

URL rule:

- `shopify` products may omit `url` or send it as `null`, because Shopify catalog data does not always provide a stable public product URL during the hackathon flow.
- `native` products must include `url`, because native URL imports depend on crawled page metadata.

## CrawlMetadata

Crawler output must include retrieval metadata.

The GEO engine should not crawl the same product page again during normal scoring if the product discovery/crawler layer already fetched it.

Required or strongly recommended metadata:

- product URL
- crawl status
- HTTP status code
- whether the page was accessible
- whether the page was blocked
- whether useful product content was extracted
- canonical URL, if available
- robots/indexability signal, if available
- page title, if available
- meta description, if available
- headings, if available
- detected structured data, if available
- image URLs and image accessibility status, if available
- crawl timestamp

The GEO Retrieval Score should evaluate the crawl result instead of blindly re-crawling the page.

Future versions may add targeted re-checks for missing or stale data, such as checking schema, image URLs, robots.txt, or page freshness.

## GeoAnalysisOutput

`GeoAnalysisOutput` is returned after the user clicks Analyze.

It should explain the current state of the product page. It should not rewrite the product yet.

Example shape:

```json
{
  "overallScore": 64,
  "scores": {
    "retrieval": {
      "score": 72,
      "maxScore": 100,
      "weightedPoints": 18,
      "maxWeightedPoints": 25,
      "reasons": [],
      "missingSignals": []
    },
    "machineUnderstanding": {
      "score": 48,
      "maxScore": 100,
      "weightedPoints": 14.4,
      "maxWeightedPoints": 30,
      "reasons": [],
      "missingSignals": []
    },
    "rerankingStrength": {
      "score": 66,
      "maxScore": 100,
      "weightedPoints": 16.5,
      "maxWeightedPoints": 25,
      "reasons": [],
      "missingSignals": []
    },
    "aiAnswerReadiness": {
      "score": 70,
      "maxScore": 100,
      "weightedPoints": 14,
      "maxWeightedPoints": 20,
      "reasons": [],
      "missingSignals": []
    }
  },
  "detectedCategory": "airfryer",
  "buyerIntentVariants": [
    "küçük mutfak için airfryer",
    "az yer kaplayan hava fritözü",
    "3-4 kişilik airfryer"
  ],
  "knownFacts": {
    "title": "X500 Airfryer",
    "price": "2499",
    "currency": "TRY",
    "availability": "in_stock"
  },
  "missingFacts": [
    "capacity",
    "dimensions",
    "warranty"
  ],
  "mainProblems": [
    "Product schema is missing Offer availability.",
    "No Turkish buyer-intent FAQ exists."
  ],
  "recommendedAction": "Repair schema, complete important product attributes, and add Turkish buyer-intent FAQ."
}
```

## UserFactQuestion

If the Optimization Agent needs high-impact missing facts, it should return targeted user questions before final generation.

Example shape:

```json
{
  "field": "capacity",
  "question": "Bu airfryer kaç litre kapasiteye sahip?",
  "reason": "Kapasite, airfryer ürünlerinde karşılaştırma için kritik bir bilgidir.",
  "requiredFor": ["faq", "description", "comparisonReadiness"]
}
```

The backend should show these questions to the user and send the answers back as `user_facts`.

Example `user_facts`:

```json
{
  "capacity": "5 litre",
  "warranty": "2 yıl"
}
```

## GeoImprovementOutput

`GeoImprovementOutput` is returned after the user clicks Improve and any needed user facts are provided.

It should include selected strategies, generated improvements, validation warnings, and estimated score improvement.

For the hackathon MVP, improvement validation is non-blocking. Validation findings should be returned as `warnings` for user review, while `validation.passed` should stay `true` and `validation.errors` should stay empty so score estimation can still run.

Example shape:

```json
{
  "selectedStrategies": [
    {
      "name": "Schema Repair",
      "reason": "Product JSON-LD is missing Offer availability."
    },
    {
      "name": "Turkish FAQ Enrichment",
      "reason": "No buyer-intent FAQ exists."
    }
  ],
  "needsUserInput": [],
  "userConfirmedFacts": {
    "capacity": "5 litre",
    "warranty": "2 yıl"
  },
  "generated": {
    "title": "X500 5 Litre Airfryer - Küçük Mutfaklar İçin Kompakt Hava Fritözü",
    "shortDescription": "Generated Turkish short description...",
    "longDescription": "Generated Turkish long description...",
    "faq": [
      {
        "question": "Bu airfryer kaç kişilik kullanım için uygundur?",
        "answer": "5 litre kapasitesiyle 3-4 kişilik aileler için uygun bir seçenek olarak konumlandırılabilir.",
        "groundedIn": ["capacity"]
      }
    ],
    "suggestedAttributes": [
      {
        "name": "dimensions",
        "label": "Ürün ölçüleri",
        "reason": "Küçük mutfak kullanımı için önemli bir karşılaştırma bilgisidir.",
        "status": "missing"
      }
    ],
    "schemaJsonLd": {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "X500 5 Litre Airfryer"
    }
  },
  "validation": {
    "passed": true,
    "warnings": []
  },
  "scoreEstimate": {
    "after": 84,
    "expectedGainReasons": [
      "+14 from schema repair",
      "+4 from better attribute coverage",
      "+2 from Turkish FAQ"
    ]
  },
  "beforeAfter": {
    "title": {
      "before": "X500 Airfryer",
      "after": "X500 5 Litre Airfryer - Küçük Mutfaklar İçin Kompakt Hava Fritözü"
    },
    "description": {
      "before": "Current product description...",
      "after": "Generated Turkish long description..."
    }
  }
}
```

`scoreEstimate.after` is the AI service's estimated score after applying the generated improvements. The AI service does not return the previous score in this object; the web/backend should read the before score from the stored analysis result in the database.

## Missing-Fact Flow

The backend should support a two-step improvement flow:

```text
1. User clicks Improve.
2. AI engine checks whether high-impact facts are missing.
3. If needed, AI engine returns needsUserInput questions.
4. Backend shows questions to user.
5. User answers what they know.
6. Backend calls improve_product again with user_facts.
7. AI engine generates final improvements.
```

If the user does not know an answer, the backend can omit that field or send `null`. The AI engine must not invent the missing fact.

## Anti-Hallucination Contract

The AI engine must only use:

- extracted product facts
- connector/platform facts
- user-confirmed facts

Unknown facts should be:

- marked as missing
- suggested as fields to add
- asked from the user when high-impact

Unknown facts must not be written into:

- Schema.org JSON-LD
- FAQ answers
- product descriptions
- trust signal claims

Examples of unsupported claims that require confirmation:

- organic
- certified
- dishwasher-safe
- two-year warranty
- same-day shipping
- free shipping
- original product

## Responsibilities

Backend owns:

- authentication
- user authorization before calling the AI/GEO service
- server-to-server authentication when calling the AI/GEO service
- dashboard UI
- product discovery
- crawling
- Shopify integration
- MongoDB persistence
- showing missing-fact questions
- showing before/after output
- export/publish actions

AI/GEO engine owns:

- Turkish buyer-intent expansion
- four-layer GEO scoring
- Gemini semantic judgments
- strategy selection
- missing-fact detection
- Turkish content improvements
- Schema.org Product JSON-LD building and validation
- anti-hallucination validation
- estimated improved score
