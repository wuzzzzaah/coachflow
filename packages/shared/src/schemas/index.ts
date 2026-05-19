import { z } from 'zod';

export const inboundMessageSchema = z.object({
  whatsappNumber: z.string(),
  whatsappMessageId: z.string(),
  displayName: z.string().optional(),
  kind: z.enum(['text', 'button', 'list', 'unsupported']),
  text: z.string().optional(),
  replyId: z.string().optional(),
  replyTitle: z.string().optional(),
  unsupportedType: z.string().optional(),
});

export const scoreDimensionSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(10),
  feedback: z.string(),
});

export const aiScoreSchema = z.object({
  dimensions: z.array(scoreDimensionSchema),
  overall: z.number().min(0).max(10),
  summary: z.string(),
  developmentFocus: z.string(),
});

export const aiResponseSchema = z.object({
  message: z.string(),
  intent: z.string(),
  shouldAdvance: z.boolean(),
  score: aiScoreSchema.nullable().optional(),
  suggestedQuickReplies: z.array(z.string()).nullable().optional(),
});

export const journeyStepSchema = z.object({
  id: z.string(),
  journey_id: z.string(),
  tenant_id: z.string(),
  step_index: z.number().int().min(0),
  mode: z.enum(['coaching', 'roleplay', 'reflection', 'assessment']),
  title: z.string(),
  opening_message: z.string(),
  min_turns: z.number().int().min(0),
  step_guidance: z.string(),
  scoring_criteria: z.array(z.string()).nullable(),
  deleted_at: z.string().nullable().optional(),
});

export const journeySchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  title: z.string(),
  description: z.string(),
  estimated_minutes: z.number().int().min(0),
  version: z.number().int().min(1),
  created_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});

export const createJourneySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  estimated_minutes: z.number().int().min(0).optional(),
});

export const updateJourneySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  estimated_minutes: z.number().int().min(0).optional(),
});

export const createJourneyStepSchema = z.object({
  id: z.string(),
  step_index: z.number().int().min(0),
  mode: z.enum(['coaching', 'roleplay', 'reflection', 'assessment']),
  title: z.string(),
  opening_message: z.string(),
  min_turns: z.number().int().min(0).optional(),
  step_guidance: z.string().optional(),
  scoring_criteria: z.array(z.string()).nullable().optional(),
});

export const updateJourneyStepSchema = z.object({
  mode: z.enum(['coaching', 'roleplay', 'reflection', 'assessment']).optional(),
  title: z.string().optional(),
  opening_message: z.string().optional(),
  min_turns: z.number().int().min(0).optional(),
  step_guidance: z.string().optional(),
  scoring_criteria: z.array(z.string()).nullable().optional(),
});

export const reorderStepsSchema = z.object({
  order: z.array(z.string()),
});

export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  phone_number_id: z.string().nullable(),
  webhook_verify_token: z.string().nullable(),
  created_at: z.string(),
});

export type InboundMessageInput = z.infer<typeof inboundMessageSchema>;
export type AIResponseInput = z.infer<typeof aiResponseSchema>;
export type JourneyInput = z.infer<typeof journeySchema>;
export type JourneyStepInput = z.infer<typeof journeyStepSchema>;
export type TenantInput = z.infer<typeof tenantSchema>;

export const createTenantSchema = z.object({
  name: z.string().min(1),
  phone_number_id: z.string().optional(),
  webhook_verify_token: z.string().optional(),
});

export const updateTenantSchema = createTenantSchema.partial();

export const promptKeySchema = z.enum(['system', 'coaching', 'roleplay', 'reflection', 'scoring']);
export type PromptKey = z.infer<typeof promptKeySchema>;
