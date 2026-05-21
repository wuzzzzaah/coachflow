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
  branch_on_low_score: z.boolean(),
  branch_score_threshold: z.number().nullable(),
  branch_step_index: z.number().int().nullable(),
  media_url: z.string().nullable().optional(),
  media_type: z.enum(['image', 'document', 'audio', 'video']).nullable().optional(),
  deleted_at: z.string().nullable().optional(),
});

export const journeySchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  title: z.string(),
  description: z.string(),
  estimated_minutes: z.number().int().min(0),
  version_number: z.number().int().min(1),
  parent_journey_id: z.string().nullable(),
  status: z.enum(['draft', 'published']),
  is_template: z.boolean(),
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
  version_number: z.number().int().min(1).optional(),
  parent_journey_id: z.string().nullable().optional(),
  status: z.enum(['draft', 'published']).optional(),
  is_template: z.boolean().optional(),
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
  branch_on_low_score: z.boolean().optional(),
  branch_score_threshold: z.number().nullable().optional(),
  branch_step_index: z.number().int().nullable().optional(),
  media_url: z.string().nullable().optional(),
  media_type: z.enum(['image', 'document', 'audio', 'video']).nullable().optional(),
});

export const updateJourneyStepSchema = z.object({
  mode: z.enum(['coaching', 'roleplay', 'reflection', 'assessment']).optional(),
  title: z.string().optional(),
  opening_message: z.string().optional(),
  min_turns: z.number().int().min(0).optional(),
  step_guidance: z.string().optional(),
  scoring_criteria: z.array(z.string()).nullable().optional(),
  branch_on_low_score: z.boolean().optional(),
  branch_score_threshold: z.number().nullable().optional(),
  branch_step_index: z.number().int().nullable().optional(),
  media_url: z.string().nullable().optional(),
  media_type: z.enum(['image', 'document', 'audio', 'video']).nullable().optional(),
});

export const reorderStepsSchema = z.object({
  order: z.array(z.string()),
});

export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  phone_number_id: z.string().nullable(),
  webhook_verify_token: z.string().nullable(),
  whatsapp_token_secret_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
});

export const tenantWebhookSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  url: z.string().url(),
  secret: z.string(),
  events: z.array(z.string()),
  enabled: z.boolean(),
  created_at: z.string(),
});

export type InboundMessageInput = z.infer<typeof inboundMessageSchema>;
export type AIResponseInput = z.infer<typeof aiResponseSchema>;
export type JourneyInput = z.infer<typeof journeySchema>;
export type JourneyStepInput = z.infer<typeof journeyStepSchema>;
export type TenantInput = z.infer<typeof tenantSchema>;
export type TenantWebhookInput = z.infer<typeof tenantWebhookSchema>;

export const createTenantSchema = z.object({
  name: z.string().min(1),
  phone_number_id: z.string().optional(),
  webhook_verify_token: z.string().optional(),
});

export const updateTenantSchema = createTenantSchema.partial();

export const createTenantWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string(),
  events: z.array(z.string()),
});

export const promptKeySchema = z.enum(['system', 'coaching', 'roleplay', 'reflection', 'scoring']);
export type PromptKey = z.infer<typeof promptKeySchema>;

export const cohortSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  journey_id: z.string(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  created_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});

export const cohortMemberSchema = z.object({
  cohort_id: z.string().uuid(),
  user_id: z.string().uuid(),
  enrolled_at: z.string(),
});

export type Cohort = z.infer<typeof cohortSchema>;
export type CohortMember = z.infer<typeof cohortMemberSchema>;

export const notificationConfigSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  email_to: z.string().nullable().optional(),
  notify_journey_complete: z.boolean(),
  notify_low_score: z.boolean(),
  low_score_threshold: z.number().min(0).max(10),
  notify_idle_user: z.boolean(),
  resend_api_key: z.string().nullable().optional(),
  slack_webhook_url: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type NotificationConfig = z.infer<typeof notificationConfigSchema>;

export const alertRuleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  metric: z.enum(['drop_off', 'idle_user', 'low_score']),
  threshold: z.number().positive(),
  channel: z.enum(['slack', 'email']),
  enabled: z.boolean(),
  last_fired_at: z.string().nullable().optional(),
  created_at: z.string(),
});

export type AlertRule = z.infer<typeof alertRuleSchema>;

export const createAlertRuleSchema = z.object({
  metric: z.enum(['drop_off', 'idle_user', 'low_score']),
  threshold: z.number().positive(),
  channel: z.enum(['slack', 'email']),
  enabled: z.boolean().optional(),
});

export const updateAlertRuleSchema = createAlertRuleSchema.partial();
