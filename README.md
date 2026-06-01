<div align="center">
  <img src="assets/bulunur_x_starq_logo.png" alt="Bulunur x Starq Logo" width="460" />

  <h1>Bulunur: A GEO Optimization Platform for Turkish E-Commerce</h1>

  <p>
    Bulunur is a GEO platform that analyzes, scores, and safely improves product pages
    for AI search engines and LLM-generated answers.
  </p>
  <p>
    The system combines Gemini-powered semantic evaluation, LangGraph-based agent workflows,
    Schema.org Product JSON-LD improvements, and Turkish buyer-intent-focused content generation.
  </p>
  <p>
    <a href="https://bulunur.shop"><strong>bulunur.shop</strong></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python 3.11+" />
    <img src="https://img.shields.io/badge/FastAPI-API-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/LangChain-LLM%20Orchestration-1C3C3C" alt="LangChain" />
    <img src="https://img.shields.io/badge/LangGraph-Agent%20Workflow-1C3C3C" alt="LangGraph" />
    <img src="https://img.shields.io/badge/Gemini-AI-4285F4?logo=google&logoColor=white" alt="Google Gemini" />
    <img src="https://img.shields.io/badge/Next.js-Web-000000?logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Docker-Deployment-2496ED?logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/Vercel-Web%20Deploy-000000?logo=vercel&logoColor=white" alt="Vercel" />
    <img src="https://img.shields.io/badge/Railway-AI%20Deploy-0B0D0E?logo=railway&logoColor=white" alt="Railway" />
  </p>

  <p>
    <a href="#what-is-bulunur"><strong>What Is Bulunur?</strong></a> ·
    <a href="#features"><strong>Features</strong></a> ·
    <a href="#how-the-system-works"><strong>How The System Works</strong></a> ·
    <a href="#docker-compose-quickstart"><strong>Quickstart</strong></a> ·
    <a href="#contributors"><strong>Contributors</strong></a>
  </p>
</div>

## What Is Bulunur?

Bulunur helps Turkish e-commerce businesses make their products easier to understand not only for traditional SEO, but also for AI-powered search and answer engines.

The platform analyzes a product page and measures how accessible, machine-understandable, comparable, and ready for AI answers the product is. It then identifies problems such as missing schema fields, weak product descriptions, insufficient attributes, missing FAQ content, and gaps in Turkish buyer-intent coverage.

During the improvement phase, Bulunur does not invent product facts. It generates safe recommendations using only existing product data, crawler output, and user-confirmed facts. This helps merchants strengthen their products for Schema.org Product JSON-LD, Turkish buyer questions, comparison signals, and AI answer readiness.

<p align="center">
  <img src="assets/analysis_example.jpeg" alt="Bulunur GEO analysis example" width="860" />
</p>

<p align="center">
  <img src="assets/optimization_example.jpeg" alt="Bulunur GEO optimization example" width="860" />
</p>

## Why Bulunur?

Product discovery behavior is changing. People no longer rely only on browsing ranked link lists in traditional search engines; they now ask direct questions to AI-powered answer systems such as ChatGPT, Gemini, Perplexity, and Google AI Overviews.

This shift matters deeply for e-commerce: product visibility is no longer only about SEO ranking. LLMs need to understand the product, verify it from reliable sources, compare it with alternatives, and recommend it clearly inside an answer.

Gartner predicts that traditional search engine volume may drop by 25% by 2026 because of AI chatbots and virtual agents. Google has also stated that AI Overviews reaches billions of users monthly. These signals show that search behavior is moving from classic link lists toward AI-generated answers.

In the SEO era, websites invested in titles, meta descriptions, content structure, internal links, and technical optimization to become easier for search engines to understand. In the new era, the same need is emerging for GEO:

- Product data should be easy for LLMs to understand.
- Schema.org Product data should be complete and consistent.
- Product descriptions should match Turkish buyer intents.
- FAQ, attributes, trust signals, and comparison information should be verifiable.
- AI systems should be able to answer about the product without misunderstanding it or hallucinating facts.

Bulunur's algorithm is optimized specifically for Turkish e-commerce. The system considers Turkish product descriptions, local buyer question patterns, purchase-intent phrases such as "is it worth buying?", "recommendation", "comparison", "shipping", and "return", and the product-page habits of the Turkish market.

Bulunur was built for this reason: to help Turkish e-commerce businesses make their products more discoverable, understandable, and answer-ready in the AI era.

## Features

Bulunur's GEO algorithm is not a mock scoring system. It is designed around Google Product structured data and merchant listing documentation, the Schema.org Product model, and research ideas from the GEO field.

The main idea we take from [SAGEO Arena](docs/research_papers/SAGEO%20Arena.pdf) is that GEO should not be evaluated as a single generic "content quality" score. Instead, it should be evaluated through layers that resemble the pipeline of AI answer systems. For this reason, Bulunur evaluates each product in four stages: whether it can be retrieved by an AI/crawler, whether it can be structurally understood by machines, whether it has comparison and reranking signals among similar products, and whether it can be safely and clearly used inside an AI answer.

The idea we take from [AgenticGEO](docs/research_papers/AgenticGEO.pdf) is that optimization should not be a fixed checklist. Bulunur first finds the weakest GEO layers of a product, then the optimization agent selects strategies based on those weaknesses. For example, if schema is missing, `Schema Repair` is used; if product attributes are weak, `Attribute Completion` is selected; if the product lacks answer-ready question and answer content, `Turkish FAQ Enrichment` runs; and if the text is semantically weak, `Turkish Buyer Intent Rewrite` is applied.

Scoring has two parts: deterministic checks and Gemini semantic judgment. The deterministic side evaluates measurable signals such as URL/crawler accessibility, core product fields, JSON-LD schema structure, price and availability data, attribute coverage, and FAQ presence. The Gemini side evaluates how well the product content satisfies Turkish buyer intent, whether it can be safely used in AI answers, and how understandable it is for comparison and recommendation queries.

For this reason, Bulunur does not only ask "does this field exist?" It measures whether a product can be found, understood, ranked, and safely recommended by AI systems using a research-inspired four-layer GEO score, then selects an improvement strategy with the AgenticGEO logic.

- **GEO Analysis Score:** Scores products out of 100 and splits the result across four layers: retrieval, machine understanding, reranking strength, and AI answer readiness.
- **Four-Layer Evaluation:** Separately measures crawler accessibility, Schema.org compatibility, comparison signals, and AI answer usability.
- **Gemini-Powered Semantic Judgment:** Goes beyond checking field presence and semantically evaluates whether the product text really answers Turkish buyer questions.
- **Agentic GEO Optimization:** A LangGraph-based optimization agent selects the right strategies based on the product's weakest layers and produces actionable improvement outputs.
- **Schema.org Product JSON-LD Improvement:** Uses product, brand, price, availability, image, and attribute data to generate structured data that is easier for AI and search systems to understand.
- **Turkish Buyer-Intent Content:** Strengthens titles, descriptions, FAQ, and recommendations according to Turkish e-commerce search behavior.
- **Safe FAQ Generation:** Generates product questions that buyers may ask, but grounds the answers only in verified product information.
- **Missing-Fact Collection Flow:** If critical product information is missing, the system asks targeted questions instead of inventing facts.
- **Anti-Hallucination Checks:** Tries to prevent unsupported claims about warranty, certification, shipping, availability, organic content, or performance.
- **Before/After Optimization Output:** Shows which fields were improved and the estimated new GEO score.
- **FastAPI AI Service:** Runs as a separate AI service that the web application calls for analysis and optimization flows.
- **Docker and Railway Ready:** The AI service is containerized with Docker and can be deployed as a separate Railway service.

## How The System Works

Bulunur is designed as two separate layers: the web dashboard and the AI/GEO service. The web side collects products from a store or URL-based import flow, while the AI service analyzes the product and generates improvement outputs.

### 1. Product Data Is Collected

Merchants bring their products into the dashboard through a Shopify connection or a native URL/import flow. The web layer prepares the product title, description, price, availability, images, attributes, crawler metadata, and existing structured data signals when available.

### 2. GEO Analysis Runs

When the user starts analysis, the web application sends the product to the AI service. The GEO Analysis Agent scores the product across four layers:

- **Retrieval:** Can the product page be accessed and retrieved by an AI/crawler?
- **Machine Understanding:** Can the product be understood by machines through Schema.org Product and core fields?
- **Reranking Strength:** Does the product have concrete signals that allow it to be compared with similar products?
- **AI Answer Readiness:** Can the product be explained safely and clearly inside an AI answer?

### 3. Weak Layers Are Identified

The analysis result does not return only an overall score. It also returns reasons, missing signals, and a recommended next action for each layer. This allows the system to know exactly which problems are lowering the product's score.

### 4. The Optimization Agent Selects Strategies

When the user starts improvement, the GEO Optimization Agent reads the analysis result and selects strategies based on the weak layers. For example, schema repair runs when schema is missing, attribute completion runs when product attributes are weak, Turkish buyer intent rewrite runs when content is weak for AI answers, and Turkish FAQ enrichment runs when FAQ content is missing.

### 5. Missing Facts Are Asked From The User

If the system does not know a critical fact, it does not invent it. It asks the user targeted questions for facts such as availability, brand, use case, warranty, return policy, or shipping. This keeps generated improvements grounded in real product information.

### 6. Safe Improvement Output Is Generated

Based on the selected strategies, the system generates JSON-LD schema, FAQ, suggested attributes, Turkish content improvements, and outputs that improve AI answer readiness. The validation layer marks unsupported claims as warnings.

### 7. The Estimated New GEO Score Is Calculated

After the improvement output is applied, the product's estimated new GEO score is calculated. The system returns not only the total score, but also the new scores for the four layers. The web dashboard can show this data as a before/after comparison.

### 8. The User Reviews And Publishes

The merchant reviews the generated improvements in the dashboard. If the user signed in with a Shopify store and connected it to Bulunur, approved changes can be safely pushed back to the store through the Shopify integration.

For a deeper product and architecture explanation, read the [PRD document](docs/PRD.md).

## Tech Stack

Bulunur is a monorepo with two main parts: the web application and the AI/GEO service.

### Web

- **Next.js:** Dashboard, product flows, and backend route layer
- **TypeScript:** Type-safe frontend and server-side code
- **Supabase:** Database, authentication, and server-side workflow records
- **Shopify API:** Product import from connected stores and publishing improved outputs back to the store

### AI / GEO Service

- **Python:** GEO scoring, schema engine, and agent workflow code
- **FastAPI:** AI service endpoints called by the web application
- **LangChain:** Gemini calls, prompt/skill usage, and structured output flow
- **LangGraph:** Stateful workflow orchestration for the GEO Analysis Agent and GEO Optimization Agent
- **Google Gemini:** Semantic evaluation, Turkish buyer-intent analysis, and safe content generation
- **Pydantic:** API contract models and data validation
- **Schema.org Product JSON-LD:** Structured data layer that makes products easier for AI and search systems to understand

### Deployment

- **Docker Compose:** Local full-stack runtime
- **Docker:** Container packaging for the AI and web services
- **Vercel:** Production deployment target for the web application
- **Railway:** Production deployment target for the AI/GEO service

## Docker Compose Quickstart

To run the full system locally, Docker and Docker Compose must be installed. Compose starts two services together:

- `ai`: FastAPI-based GEO analysis and optimization service
- `web`: Next.js-based dashboard and backend route layer

First, prepare the required environment variables for the AI service. The `ai/.env` file should include at least:

```env
GOOGLE_API_KEY=your_gemini_api_key
SERVICE_AUTH_SECRET_KEY=your_internal_service_secret
```

For the web service, `web/.env.local` should include the Supabase, Shopify, and AI service variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
SUPABASE_SECRET_KEY=your-server-side-supabase-secret

AI_SERVICE_URL=http://ai:8001
AI_SERVICE_SECRET=your_internal_service_secret

SHOPIFY_CLIENT_ID=your-shopify-client-id
SHOPIFY_CLIENT_SECRET=your-shopify-client-secret
SHOPIFY_SCOPES=read_products,write_products
SHOPIFY_APP_URL=your-shopify-app-url
SHOPIFY_REDIRECT_URI=your-shopify-callback-url
SHOPIFY_API_VERSION=2026-04
SHOPIFY_TOKEN_ENCRYPTION_KEY=your-stable-token-encryption-key
```

Because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are also needed during build time, add them to the root `.env` file or to your terminal environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

Then run the full system from the repository root:

```bash
docker compose up --build
```

To run it in the background:

```bash
docker compose up --build -d
```

By default, the services run at:

```text
Web: http://localhost:3000
AI:  http://localhost:8001
```

To run only the AI service:

```bash
docker compose up --build ai
```

Health check endpoints:

```text
AI:  http://localhost:8001/health
Web: http://localhost:3000
```

To stop the full system:

```bash
docker compose down
```

## License

Licensed under the MIT License. See [LICENCE](LICENCE).

## Contributors

<table>
  <tr>
    <td align="center" width="50%">
      <img src="assets/muhammed%20erbay%20.jpg" alt="Muhammed Erbay" width="120" height="120" style="border-radius:50%; object-fit:cover;" /><br/><br/>
      <strong><a href="https://www.linkedin.com/in/muhammed-erbay-00811422a/">Muhammed Erbay</a></strong><br/>
      <sub>Contributor</sub><br/><br/>
      <a href="https://www.linkedin.com/in/muhammed-erbay-00811422a/">
        <img src="https://img.shields.io/badge/LinkedIn-Profile-0A66C2?logo=linkedin&logoColor=white" alt="Muhammed Erbay LinkedIn" />
      </a>
      <a href="https://github.com/muhammederbay10">
        <img src="https://img.shields.io/badge/GitHub-muhammederbay10-181717?logo=github&logoColor=white" alt="Muhammed Erbay GitHub" />
      </a>
    </td>
    <td align="center" width="50%">
      <img src="assets/%C3%B6mer%20mevl%C3%BCto%C4%9Flu.jpeg" alt="Ömer Mevlütoğlu" width="120" height="120" style="border-radius:50%; object-fit:cover;" /><br/><br/>
      <strong><a href="https://www.linkedin.com/in/%C3%B6mer-mevl%C3%BCto%C4%9Flu-ab7105257/">Ömer Mevlütoğlu</a></strong><br/>
      <sub>Contributor</sub><br/><br/>
      <a href="https://www.linkedin.com/in/%C3%B6mer-mevl%C3%BCto%C4%9Flu-ab7105257/">
        <img src="https://img.shields.io/badge/LinkedIn-Profile-0A66C2?logo=linkedin&logoColor=white" alt="Ömer Mevlütoğlu LinkedIn" />
      </a>
      <a href="https://github.com/Omer-Mevlutoglu">
        <img src="https://img.shields.io/badge/GitHub-Omer--Mevlutoglu-181717?logo=github&logoColor=white" alt="Ömer Mevlütoğlu GitHub" />
      </a>
    </td>
  </tr>
</table>
