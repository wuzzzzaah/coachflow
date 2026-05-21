export type FlowState =
  | 'onboarding'
  | 'menu'
  | 'journey_intro'
  | 'coaching'
  | 'roleplay'
  | 'reflection'
  | 'assessment'
  | 'step_complete'
  | 'journey_complete'
  | 'paused';

export type CoachingMode = 'coaching' | 'roleplay' | 'reflection' | 'assessment';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ScoreDimension {
  name: string;
  score: number;
  feedback: string;
}

export interface AIScore {
  dimensions: ScoreDimension[];
  overall: number;
  summary: string;
  developmentFocus: string;
}

export interface AIResponse {
  message: string;
  intent: string;
  shouldAdvance: boolean;
  score?: AIScore | null;
  suggestedQuickReplies?: string[] | null;
}

export interface Session {
  tenantId: string;
  userId: string;
  whatsappNumber: string;
  provider: 'whatsapp' | 'slack' | 'web';
  currentJourneyId: string | null;
  currentStepIndex: number;
  currentMode: FlowState;
  currentSessionId: string | null;
  conversationHistory: ConversationTurn[];
  stepStartedAt: Date;
  lastActivityAt: Date;
  turnCount: number;
  metadata: Record<string, unknown>;
}

export interface JourneyStep {
  id: string;
  index: number;
  mode: CoachingMode;
  title: string;
  openingMessage: string;
  minTurns: number;
  scoringCriteria?: string[];
  stepGuidance: string;
  branchOnLowScore: boolean;
  branchScoreThreshold: number | null;
  branchStepIndex: number | null;
  mediaUrl: string | null;
  mediaType: 'image' | 'document' | 'audio' | 'video' | null;
}

export interface JourneyConfig {
  id: string;
  title: string;
  description: string;
  totalSteps: number;
  estimatedDuration: string;
  status: 'draft' | 'published';
  is_template: boolean;
  schedule_type: 'manual' | 'daily' | 'weekly';
  schedule_hour?: number;
  schedule_day?: number;
  steps: JourneyStep[];
}

export interface UserRecord {
  id: string;
  whatsapp_number: string;
  display_name: string | null;
  current_journey_id: string | null;
  current_step_index: number;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── DB row types (added for multi-tenant schema) ─────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  phone_number_id: string | null;
  webhook_verify_token: string | null;
  whatsapp_token_secret_id: string | null;
  slack_team_id: string | null;
  slack_team_name: string | null;
  slack_bot_token_secret_id: string | null;
  created_at: string;
}

export interface JourneyRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  version_number: number;
  parent_journey_id: string | null;
  status: 'draft' | 'published';
  is_template: boolean;
  schedule_type: 'manual' | 'daily' | 'weekly';
  schedule_hour: number | null;
  schedule_day: number | null;
  created_at: string;
}

export interface JourneyStepRow {
  id: string;
  journey_id: string;
  tenant_id: string;
  step_index: number;
  mode: CoachingMode;
  title: string;
  opening_message: string;
  min_turns: number;
  step_guidance: string;
  scoring_criteria: string[] | null;
  branch_on_low_score: boolean;
  branch_score_threshold: number | null;
  branch_step_index: number | null;
  media_url: string | null;
  media_type: 'image' | 'document' | 'audio' | 'video' | null;
}

export interface JourneyPromptRow {
  id: string;
  journey_id: string;
  tenant_id: string;
  prompt_key: string;
  content: string;
}

export interface TenantWebhook {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string | null;
  actor_id: string;
  actor_email: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Normalised inbound message that the engine consumes. */
export interface InboundMessage {
  whatsappNumber: string;
  whatsappMessageId: string;
  displayName?: string;
  kind: 'text' | 'button' | 'list' | 'unsupported';
  provider: 'whatsapp' | 'slack' | 'web';
  text?: string;
  replyId?: string;
  replyTitle?: string;
  unsupportedType?: string;
}

export interface ButtonOption {
  id: string;
  title: string;
}

export interface ListSection {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

// ── Adapter interfaces ────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IWhatsAppAdapter {
  sendTextMessage(to: string, text: string, creds?: any): Promise<void>;
  sendButtonMessage(to: string, body: string, buttons: ButtonOption[], creds?: any): Promise<void>;
  sendListMessage(
    to: string,
    body: string,
    buttonLabel: string,
    sections: ListSection[],
    creds?: any,
  ): Promise<void>;
  sendMediaMessage(
    to: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    mediaUrl: string,
    caption?: string,
    creds?: any,
  ): Promise<void>;
  markAsRead(messageId: string, creds?: any): Promise<void>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ISessionStore {
  get(whatsappNumber: string): Promise<Session | null>;
  set(session: Session): Promise<void>;
  delete(whatsappNumber: string): Promise<void>;
  size(): Promise<number>;
}

export interface UserProgress {
  journey_id: string;
  journey_title: string;
  completed_steps: number;
  total_steps: number;
  last_active_at: string | null;
}

export interface UserScore {
  id: string;
  session_id: string;
  journey_id: string;
  step_id: string;
  score: number;
  max_score: number;
  criteria: ScoreDimension[];
  feedback: string;
  created_at: string;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface UserDataExport {
  user: {
    id: string;
    whatsapp_number: string;
    name: string | null;
    created_at: string;
  };
  journeyProgress: UserProgress[];
  sessionScores: UserScore[];
  sessionMessages: { sessionId: string; messages: SessionMessage[] }[];
  reminders: { sent_at: string }[];
  exportedAt: string;
}

/** Normalised inbound message that the engine consumes. */
export interface InboundMessage {
  whatsappNumber: string;
  whatsappMessageId: string;
  displayName?: string;
  kind: 'text' | 'button' | 'list' | 'unsupported';
  text?: string;
  replyId?: string;
  replyTitle?: string;
  unsupportedType?: string;
}

export interface ButtonOption {
  id: string;
  title: string;
}

export interface ListSection {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

export interface IWhatsAppAdapter {
  sendTextMessage(to: string, text: string): Promise<void>;
  sendMediaMessage(
    to: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    mediaUrl: string,
    caption?: string,
  ): Promise<void>;
  sendButtonMessage(to: string, body: string, buttons: ButtonOption[]): Promise<void>;
  sendListMessage(
    to: string,
    body: string,
    buttonLabel: string,
    sections: ListSection[],
  ): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
}
