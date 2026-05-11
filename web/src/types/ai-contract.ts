import { z } from "zod";

export const crawlMetadataSchema = z.object({
  crawlStatus: z.string(),
  httpStatusCode: z.number().optional(),
  accessible: z.boolean().optional(),
  blocked: z.boolean().optional(),
  contentExtracted: z.boolean().optional(),
  canonicalUrl: z.string().url().optional(),
  robotsAllowed: z.boolean().optional(),
  imagesAccessible: z.boolean().optional(),
  crawledAt: z.string().optional(),
});

export const productInputSchema = z.object({
  productId: z.string(),
  storeId: z.string(),
  source: z.string(),
  url: z.string().url().optional(),
  language: z.string().default("tr"),
  market: z.string().default("TR"),
  title: z.string(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.string().optional(),
  currency: z.string().optional(),
  availability: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  imageUrls: z.array(z.string().url()).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  rawExtracted: z.record(z.string(), z.unknown()).optional(),
  crawlMetadata: crawlMetadataSchema.optional(),
});

export const geoScoreLayerSchema = z.object({
  score: z.number(),
  maxScore: z.number(),
  weightedPoints: z.number(),
  maxWeightedPoints: z.number(),
  reasons: z.array(z.string()).default([]),
  missingSignals: z.array(z.string()).default([]),
});

export const geoAnalysisOutputSchema = z.object({
  overallScore: z.number(),
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
