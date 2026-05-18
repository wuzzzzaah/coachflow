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
}

export interface JourneyConfig {
  id: string;
  title: string;
  description: string;
  totalSteps: number;
  estimatedDuration: string;
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
  created_at: string;
}

export interface JourneyRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  version: number;
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
}

export interface JourneyPromptRow {
  id: string;
  journey_id: string;
  tenant_id: string;
  prompt_key: string;
  content: string;
}

// ── Adapter interfaces ────────────────────────────────────────────────────────

export interface ISessionStore {
  get(whatsappNumber: string): Promise<Session | null>;
  set(session: Session): Promise<void>;
  delete(whatsappNumber: string): Promise<void>;
  size(): Promise<number>;
}
