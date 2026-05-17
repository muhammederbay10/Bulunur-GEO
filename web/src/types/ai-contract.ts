import { z } from "zod";

const crawlStatusSchema = z.enum([
  "success",
  "partial",
  "failed",
  "blocked",
  "timeout",
]);
const availabilityStatusSchema = z.enum([
  "in_stock",
  "out_of_stock",
  "preorder",
  "backorder",
  "unknown",
]);
const supportedAiSourceSchema = z.enum(["shopify", "native"]);
const headingsSchema = z
  .record(z.string(), z.array(z.string()))
  .default({});

export const crawlMetadataSchema = z.object({
  crawlStatus: crawlStatusSchema,
  crawledAt: z.string().min(1),
  accessible: z.boolean(),
  blocked: z.boolean(),
  contentExtracted: z.boolean(),
  productUrl: z.string().url().optional(),
  httpStatusCode: z.number().int().min(100).max(599).optional(),
  canonicalUrl: z.string().url().optional(),
  robotsAllowed: z.boolean().optional(),
  indexable: z.boolean().optional(),
  pageTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  headings: headingsSchema,
  detectedStructuredData: z.array(z.record(z.string(), z.unknown())).default([]),
  imageUrls: z.array(z.string().url()).default([]),
  imagesAccessible: z.boolean().optional(),
}).superRefine((metadata, context) => {
  if (metadata.crawlStatus === "success" && !metadata.accessible) {
    context.addIssue({
      code: "custom",
      message: "Successful crawls must be accessible.",
      path: ["accessible"],
    });
  }

  if (metadata.crawlStatus === "success" && !metadata.contentExtracted) {
    context.addIssue({
      code: "custom",
      message: "Successful crawls must have extracted content.",
      path: ["contentExtracted"],
    });
  }

  if (
    metadata.blocked &&
    !["blocked", "failed", "partial"].includes(metadata.crawlStatus)
  ) {
    context.addIssue({
      code: "custom",
      message: "Blocked crawls must use blocked, failed, or partial status.",
      path: ["crawlStatus"],
    });
  }

  if (metadata.contentExtracted && !metadata.accessible) {
    context.addIssue({
      code: "custom",
      message: "Content cannot be extracted from an inaccessible page.",
      path: ["contentExtracted"],
    });
  }
});

export const rawExtractedSchema = z.object({
  pageTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  headings: headingsSchema,
  bodyText: z.string().optional(),
  detectedSchema: z.array(z.record(z.string(), z.unknown())).default([]),
});

const scoreValueSchema = z.number().min(0).max(100);

export const productInputSchema = z.object({
  productId: z.string(),
  storeId: z.string().optional(),
  source: supportedAiSourceSchema,
  url: z.string().url(),
  language: z.literal("tr").default("tr"),
  market: z.literal("TR").default("TR"),
  title: z.string(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  availability: availabilityStatusSchema.default("unknown"),
  brand: z.string().optional(),
  category: z.string().optional(),
  imageUrls: z.array(z.string().url()).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  rawExtracted: rawExtractedSchema.default({
    headings: {},
    detectedSchema: [],
  }),
  crawlMetadata: crawlMetadataSchema,
});

export const geoScoreLayerSchema = z.object({
  score: scoreValueSchema,
  maxScore: scoreValueSchema,
  weightedPoints: z.number(),
  maxWeightedPoints: z.number(),
  reasons: z.array(z.string()).default([]),
  missingSignals: z.array(z.string()).default([]),
});

export const geoAnalysisOutputSchema = z.object({
  overallScore: scoreValueSchema,
  scores: z.object({
    retrieval: geoScoreLayerSchema,
    machineUnderstanding: geoScoreLayerSchema,
    rerankingStrength: geoScoreLayerSchema,
    aiAnswerReadiness: geoScoreLayerSchema,
  }),
  detectedCategory: z.string().optional(),
  buyerIntentVariants: z.array(z.string()).default([]),
  knownFacts: z.record(z.string(), z.unknown()).default({}),
  missingFacts: z.array(z.string()).default([]),
  mainProblems: z.array(z.string()).default([]),
  recommendedAction: z.string().optional(),
});

export const userFactQuestionSchema = z.object({
  field: z.string(),
  question: z.string(),
  reason: z.string(),
  requiredFor: z.array(z.string()).default([]),
});

export const geoImprovementOutputSchema = z.object({
  selectedStrategies: z
    .array(
      z.object({
        name: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
  needsUserInput: z.array(userFactQuestionSchema).default([]),
  userConfirmedFacts: z.record(z.string(), z.unknown()).default({}),
  generated: z.record(z.string(), z.unknown()).default({}),
  validation: z
    .object({
      passed: z.boolean(),
      warnings: z.array(z.string()).default([]),
    })
    .optional(),
  scoreEstimate: z.record(z.string(), z.unknown()).optional(),
  beforeAfter: z.record(z.string(), z.unknown()).optional(),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type GeoAnalysisOutput = z.infer<typeof geoAnalysisOutputSchema>;
export type GeoImprovementOutput = z.infer<typeof geoImprovementOutputSchema>;
export type UserFactQuestion = z.infer<typeof userFactQuestionSchema>;
