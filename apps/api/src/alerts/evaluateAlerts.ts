import axios from 'axios';
import { supabase } from '../db/supabaseClient';
import { AlertRule } from '@coachflow/shared';
import { getStepDropOff, getStuckUsers } from '../db/metrics';
import { getScoreDistribution } from '../db/analytics';
import { markAlertFired } from '../db/alertRules';
import { getNotificationConfig, getResendApiKey, getSlackWebhookUrl } from '../db/notifications';
import { sendEmail } from '../notifications/email';
import { listJourneys } from '../db/journeyLoader';

export async function evaluateAlerts(tenantId: string) {
  const db = supabase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Load enabled rules for the tenant that haven't fired in the last hour
  const { data: rules, error } = await db
    .from('alert_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .or(`last_fired_at.is.null,last_fired_at.lt.${oneHourAgo}`);

  if (error) {
    console.error(`[alerts] Failed to fetch alert rules for tenant ${tenantId}: ${error.message}`);
    return;
  }

  if (!rules || rules.length === 0) return;

  for (const rule of rules as AlertRule[]) {
    try {
      let breached = false;
      let alertMessage = '';

      if (rule.metric === 'drop_off') {
        const journeys = await listJourneys(tenantId, false);
        for (const journey of journeys) {
          const dropOffData = await getStepDropOff(tenantId, journey.id);
          const maxDropRate = Math.max(...dropOffData.map((d) => d.dropRate), 0);
          if (maxDropRate >= rule.threshold) {
            breached = true;
            alertMessage = `Drop-off rate for journey "${journey.title}" reached ${maxDropRate}%, exceeding threshold of ${rule.threshold}%.`;
            break;
          }
        }
      } else if (rule.metric === 'idle_user') {
        const stuckUsers = await getStuckUsers(tenantId, 24); // Assuming 24h threshold for stuck
        if (stuckUsers.length >= rule.threshold) {
          breached = true;
          alertMessage = `${stuckUsers.length} users are currently stuck (idle > 24h), exceeding threshold of ${rule.threshold}. User IDs: ${stuckUsers.map(u => u.userId).join(', ')}`;
        }
      } else if (rule.metric === 'low_score') {
        const scores = await getScoreDistribution(tenantId);
        const overallAvg = scores.length > 0 ? scores.reduce((acc, s) => acc + s.avg_score, 0) / scores.length : 10;
        if (overallAvg <= rule.threshold) {
          breached = true;
          alertMessage = `Average score across all dimensions is ${overallAvg.toFixed(1)}, which is below or at the threshold of ${rule.threshold}.`;
        }
      }

      if (breached) {
        await fireNotification(tenantId, rule, alertMessage);
        await markAlertFired(rule.id);
        console.log(`[alerts] Alert fired for tenant ${tenantId}, rule ${rule.id}: ${alertMessage}`);
      }
    } catch (err) {
      console.error(`[alerts] Error evaluating rule ${rule.id} for tenant ${tenantId}:`, err);
    }
  }
}

async function fireNotification(tenantId: string, rule: AlertRule, message: string) {
  const config = await getNotificationConfig(tenantId);
  const slackUrl = await getSlackWebhookUrl(tenantId);

  if (rule.channel === 'slack' && slackUrl) {
    try {
      await axios.post(slackUrl, { text: `🚨 *Alert Breach* (${rule.metric})\n${message}` });
      return;
    } catch (err) {
      console.error(`[alerts] Failed to send Slack notification for tenant ${tenantId}:`, (err as Error).message);
      // Fallback to email if Slack fails
    }
  }

  // Fallback or explicit email
  if (config?.email_to) {
    const resendApiKey = await getResendApiKey(tenantId);
    if (!resendApiKey) {
      console.warn(`[alerts] Cannot send email fallback: No Resend API key for tenant ${tenantId}`);
      return;
    }

    await sendEmail({
      to: config.email_to,
      subject: `Alert Breach: ${rule.metric}`,
      html: `<p><strong>Alert Breach detected</strong></p><p>Metric: ${rule.metric}</p><p>${message}</p>`,
      resendApiKey,
    });
  }
}
