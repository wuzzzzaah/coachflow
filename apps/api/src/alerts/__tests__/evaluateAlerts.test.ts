/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateAlerts } from '../evaluateAlerts';
import { supabase } from '../../db/supabaseClient';
import * as metrics from '../../db/metrics';
import * as analytics from '../../db/analytics';
import * as alertRules from '../../db/alertRules';
import * as notifications from '../../db/notifications';
import * as email from '../../notifications/email';
import * as journeyLoader from '../../db/journeyLoader';
import axios from 'axios';

vi.mock('../../db/supabaseClient');
vi.mock('../../db/metrics');
vi.mock('../../db/analytics');
vi.mock('../../db/alertRules');
vi.mock('../../db/notifications');
vi.mock('../../notifications/email');
vi.mock('../../db/journeyLoader');
vi.mock('axios');

describe('evaluateAlerts', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fire a Slack notification when drop-off threshold is breached', async () => {
    const mockRule = {
      id: 'rule-1',
      tenant_id: tenantId,
      metric: 'drop_off',
      threshold: 20,
      channel: 'slack',
      enabled: true,
    };

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [mockRule], error: null }),
    };
    (supabase as any).mockReturnValue(mockSupabase);

    vi.spyOn(journeyLoader, 'listJourneys').mockResolvedValue([
      { id: 'j1', title: 'Journey 1' },
    ] as any);
    vi.spyOn(metrics, 'getStepDropOff').mockResolvedValue([{ stepIndex: 0, dropRate: 25 }] as any);
    vi.spyOn(notifications, 'getSlackWebhookUrl').mockResolvedValue('https://slack.com/webhook');
    vi.spyOn(notifications, 'getNotificationConfig').mockResolvedValue({} as any);

    await evaluateAlerts(tenantId);

    expect(axios.post).toHaveBeenCalledWith('https://slack.com/webhook', {
      text: expect.stringContaining('Drop-off rate for journey "Journey 1" reached 25%'),
    });
    expect(alertRules.markAlertFired).toHaveBeenCalledWith('rule-1');
  });

  it('should fire an email notification when idle-user threshold is breached', async () => {
    const mockRule = {
      id: 'rule-2',
      tenant_id: tenantId,
      metric: 'idle_user',
      threshold: 5,
      channel: 'email',
      enabled: true,
    };

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [mockRule], error: null }),
    };
    (supabase as any).mockReturnValue(mockSupabase);

    vi.spyOn(metrics, 'getStuckUsers').mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' },
      { userId: 'u4' },
      { userId: 'u5' },
      { userId: 'u6' },
    ] as any);
    vi.spyOn(notifications, 'getNotificationConfig').mockResolvedValue({
      email_to: 'admin@test.com',
    } as any);
    vi.spyOn(notifications, 'getResendApiKey').mockResolvedValue('api-key');

    await evaluateAlerts(tenantId);

    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@test.com',
        subject: expect.stringContaining('Alert Breach: idle_user'),
        html: expect.stringContaining('6 users are currently stuck'),
      }),
    );
    expect(alertRules.markAlertFired).toHaveBeenCalledWith('rule-2');
  });

  it('should not fire if threshold is not reached', async () => {
    const mockRule = {
      id: 'rule-3',
      tenant_id: tenantId,
      metric: 'low_score',
      threshold: 5,
      channel: 'email',
      enabled: true,
    };

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [mockRule], error: null }),
    };
    (supabase as any).mockReturnValue(mockSupabase);

    vi.spyOn(analytics, 'getScoreDistribution').mockResolvedValue([
      { dimension: 'D1', avg_score: 8 },
    ] as any);

    await evaluateAlerts(tenantId);

    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(alertRules.markAlertFired).not.toHaveBeenCalled();
  });
});
