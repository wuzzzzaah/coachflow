import { getNotificationConfig, getResendApiKey } from '../db/notifications';
import { sendEmail } from './email';

export async function notifyJourneyComplete(
  tenantId: string,
  userId: string,
  journeyTitle: string
): Promise<void> {
  try {
    const config = await getNotificationConfig(tenantId);
    if (!config || !config.notify_journey_complete || !config.email_to) return;

    const resendApiKey = await getResendApiKey(tenantId);
    if (!resendApiKey) {
      console.warn(`[notify] Journey complete: No Resend API key for tenant ${tenantId}`);
      return;
    }

    await sendEmail({
      to: config.email_to,
      subject: `Journey Completed: ${journeyTitle}`,
      html: `<p>User <strong>${userId}</strong> has completed the journey <strong>${journeyTitle}</strong>.</p>`,
      resendApiKey,
    });
  } catch (err) {
    console.error(`[notify] notifyJourneyComplete failed: ${(err as Error).message}`);
  }
}

export async function notifyLowScore(
  tenantId: string,
  userId: string,
  journeyTitle: string,
  score: number
): Promise<void> {
  try {
    const config = await getNotificationConfig(tenantId);
    if (!config || !config.notify_low_score || !config.email_to) return;

    if (score >= config.low_score_threshold) return;

    const resendApiKey = await getResendApiKey(tenantId);
    if (!resendApiKey) {
      console.warn(`[notify] Low score: No Resend API key for tenant ${tenantId}`);
      return;
    }

    await sendEmail({
      to: config.email_to,
      subject: `Low Score Alert: ${journeyTitle}`,
      html: `<p>User <strong>${userId}</strong> received a low score of <strong>${score}/10</strong> in the journey <strong>${journeyTitle}</strong>.</p>`,
      resendApiKey,
    });
  } catch (err) {
    console.error(`[notify] notifyLowScore failed: ${(err as Error).message}`);
  }
}

export async function notifyIdleUser(
  tenantId: string,
  userId: string,
  phone: string
): Promise<void> {
  try {
    const config = await getNotificationConfig(tenantId);
    if (!config || !config.notify_idle_user || !config.email_to) return;

    const resendApiKey = await getResendApiKey(tenantId);
    if (!resendApiKey) {
      console.warn(`[notify] Idle user: No Resend API key for tenant ${tenantId}`);
      return;
    }

    await sendEmail({
      to: config.email_to,
      subject: `Idle User Alert`,
      html: `<p>User <strong>${userId}</strong> (Phone: ${phone}) has been idle and a reminder has been sent.</p>`,
      resendApiKey,
    });
  } catch (err) {
    console.error(`[notify] notifyIdleUser failed: ${(err as Error).message}`);
  }
}
