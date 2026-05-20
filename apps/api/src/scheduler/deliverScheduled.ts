import { getScheduledJourneys, getEnrolledUsers, hasDeliveredToday, logDelivery } from '../db/scheduler';
import { getJourney, getStep } from '../db/journeyLoader';
import { getTenantById, getTenantWhatsAppToken } from '../db/tenants';
import { sendTextMessage } from '../whatsapp/sender';
import {
  createSession,
  getSession,
  updateSession,
  appendTurn
} from '../engine/sessionManager';
import {
  startSession as dbStartSession,
  endSession as dbEndSession,
  logMessage
} from '../db/sessions';
import {
  ensureUserJourney,
  advanceUserJourney,
  completeUserJourney
} from '../db/journeys';
import { updateUserProgress } from '../db/users';
import { deliverEvent } from '../webhooks/deliver';

export async function deliverScheduledSteps(tenantId: string) {
  const journeys = await getScheduledJourneys(tenantId);
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay(); // 0 = Sunday

  const token = await getTenantWhatsAppToken(tenantId);
  const tenant = await getTenantById(tenantId);
  if (!token || !tenant?.phone_number_id) {
    console.warn(`[scheduler] Tenant ${tenantId} not configured for WhatsApp, skipping.`);
    return { sent: 0, skipped: 0 };
  }
  const creds = { accessToken: token, phoneNumberId: tenant.phone_number_id };

  let sent = 0;
  let skipped = 0;

  for (const journey of journeys) {
    // Check if it's the right time to send
    if (journey.schedule_hour !== null && journey.schedule_hour !== currentHour) {
      continue;
    }

    if (journey.schedule_type === 'weekly' && journey.schedule_day !== null && journey.schedule_day !== currentDay) {
      continue;
    }

    const enrolledUsers = await getEnrolledUsers(tenantId, journey.id);
    const journeyConfig = await getJourney(tenantId, journey.id);
    if (!journeyConfig) continue;

    for (const user of enrolledUsers) {
      const stepIndex = user.current_step_index;

      // If we're at the end of the journey, nothing to drip
      if (stepIndex >= journeyConfig.totalSteps) continue;

      try {
        const delivered = await hasDeliveredToday(
          tenantId,
          user.id,
          journey.id,
          stepIndex,
          journey.schedule_type as 'daily' | 'weekly'
        );

        if (!delivered) {
          const step = await getStep(tenantId, journey.id, stepIndex);
          if (!step) continue;

          // 1. Send the message
          await sendTextMessage(user.whatsapp_number, step.openingMessage, creds);

          // 2. Manage the session (similar to beginStep in flowRouter)
          let session = await getSession(user.whatsapp_number);
          if (session && session.currentSessionId) {
            await dbEndSession(session.currentSessionId, 'scheduled drip').catch(() => undefined);
          }

          const dbSessionId = await dbStartSession({
            userId: user.id,
            journeyId: journey.id,
            stepId: step.id,
            mode: step.mode,
          });

          if (!session) {
            session = await createSession({
              tenantId,
              userId: user.id,
              whatsappNumber: user.whatsapp_number,
              initialMode: step.mode,
            });
          }

          await updateSession(user.whatsapp_number, {
            currentJourneyId: journey.id,
            currentStepIndex: stepIndex,
            currentMode: step.mode,
            currentSessionId: dbSessionId,
            conversationHistory: [{ role: 'assistant', content: step.openingMessage }],
            turnCount: 0,
            stepStartedAt: new Date(),
          });

          await logMessage({
            sessionId: dbSessionId,
            userId: user.id,
            role: 'assistant',
            content: step.openingMessage,
          }).catch(() => undefined);

          // 3. Increment the user's progress for the NEXT drip (if applicable)
          // Wait, actually the drip should happen for the CURRENT step index.
          // After delivery, we should probably prepare for the NEXT one.
          // In manual mode, we only advance after the step is complete.
          // For scheduled delivery, we deliver the current step opening,
          // then the user interacts. If they DON'T interact, the NEXT scheduled
          // run should ideally deliver the NEXT step.

          const nextIndex = stepIndex + 1;
          const uj = await ensureUserJourney(user.id, journey.id);

          if (nextIndex >= journeyConfig.totalSteps) {
            await completeUserJourney(uj.id).catch(() => undefined);
            await updateUserProgress(user.id, journey.id, nextIndex).catch(() => undefined);
            deliverEvent(tenantId, 'journey_completed', {
              userId: user.id,
              tenantId,
              journeyId: journey.id,
            });
            // We don't send scorecard here because they just got the opening of the last step?
            // No, if they just finished the last step, we should send it.
            // But here they just STARTED the step.
          } else {
            await advanceUserJourney(uj.id, nextIndex).catch(() => undefined);
            await updateUserProgress(user.id, journey.id, nextIndex).catch(() => undefined);
            deliverEvent(tenantId, 'step_completed', {
              userId: user.id,
              tenantId,
              journeyId: journey.id,
              stepId: step.id,
            });
          }

          await logDelivery(tenantId, user.id, journey.id, stepIndex);
          sent++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[scheduler] Failed delivery for user ${user.id} in journey ${journey.id}:`, err);
        skipped++;
      }
    }
  }

  return { sent, skipped };
}
