import { GoogleGenAI } from '@google/genai';
import { systemPrompt } from './prompts/system';
import { coachingModeGuidance } from './prompts/coaching';
import { roleplayModeGuidance } from './prompts/roleplay';
import { reflectionModeGuidance } from './prompts/reflection';
import { assessmentModeGuidance } from './prompts/scoring';
import { CoachingMode, ConversationTurn } from '@coachflow/shared';

function modeGuidance(mode: CoachingMode): string {
  switch (mode) {
    case 'coaching':
      return coachingModeGuidance;
    case 'roleplay':
      return roleplayModeGuidance;
    case 'reflection':
      return reflectionModeGuidance;
    case 'assessment':
      return assessmentModeGuidance;
  }
}

export interface GenerateInput {
  mode: CoachingMode;
  stepGuidance: string;
  history: ConversationTurn[];
  latestUserMessage: string;
  turnCount: number;
  promptOverrides?: Record<string, string>;
}

export async function generate(input: GenerateInput): Promise<string> {
  const overrides = input.promptOverrides ?? {};
  const effectiveSystem = overrides['system'] ?? systemPrompt;
  const effectiveModeGuidance = overrides[input.mode] ?? modeGuidance(input.mode);

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey: key });

  const header = `${effectiveModeGuidance}\n\nSTEP CONTEXT:\n${input.stepGuidance}\n\nTURN COUNT IN THIS STEP: ${input.turnCount}\n`;

  const contents = [
    { role: 'user' as const, parts: [{ text: header }] },
    ...input.history.map((t) => ({
      role: (t.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: t.content }],
    })),
    { role: 'user' as const, parts: [{ text: input.latestUserMessage }] },
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents,
    config: {
      systemInstruction: effectiveSystem,
      responseMimeType: 'application/json',
    },
  });
  return response.text || '';
}
