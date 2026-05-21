import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deliverScheduledSteps } from '../deliverScheduled';
import * as schedulerDb from '../../db/scheduler';
import * as journeyLoader from '../../db/journeyLoader';
import * as tenantsDb from '../../db/tenants';
import * as sender from '../../whatsapp/sender';
import * as journeysDb from '../../db/journeys';
import * as usersDb from '../../db/users';
import * as sessionsDb from '../../db/sessions';
import * as webhooks from '../../webhooks/deliver';

vi.mock('../../db/scheduler');
vi.mock('../../db/journeyLoader');
vi.mock('../../db/tenants');
vi.mock('../../whatsapp/sender');
vi.mock('../../db/journeys');
vi.mock('../../db/users');
vi.mock('../../db/sessions');
vi.mock('../../webhooks/deliver');

describe('deliverScheduledSteps', () => {
  const tenantId = 'tenant-123';
  const journeyId = 'journey-456';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tenantsDb.getTenantWhatsAppToken).mockResolvedValue('fake-token');
    vi.mocked(tenantsDb.getTenantById).mockResolvedValue({
      id: tenantId,
      name: 'Test Tenant',
      phone_number_id: 'phone-123',
      webhook_verify_token: null,
      whatsapp_token_secret_id: null,
      slack_team_id: null,
      slack_team_name: null,
      slack_bot_token_secret_id: null,
      created_at: new Date().toISOString()
    });
  });

  it('should deliver steps to enrolled users if not already delivered today', async () => {
    const now = new Date();
    const currentHour = now.getUTCHours();

    vi.mocked(schedulerDb.getScheduledJourneys).mockResolvedValue([
      {
        id: journeyId,
        tenant_id: tenantId,
        schedule_type: 'daily',
        schedule_hour: currentHour,
        schedule_day: null,
        title: 'Test Journey',
        description: '',
        estimated_minutes: 30,
      version_number: 1,
        status: 'published',
        is_template: false,
        created_at: new Date().toISOString()
      } as any
    ]);

    vi.mocked(schedulerDb.getEnrolledUsers).mockResolvedValue([
      { id: 'user-1', whatsapp_number: '123456', current_step_index: 0 }
    ]);

    vi.mocked(journeyLoader.getJourney).mockResolvedValue({
      id: journeyId,
      steps: [
        { index: 0, openingMessage: 'Hello Step 0' }
      ]
    } as any);

    vi.mocked(schedulerDb.hasDeliveredToday).mockResolvedValue(false);
    vi.mocked(journeysDb.ensureUserJourney).mockResolvedValue({ id: 'uj-1' } as any);
    vi.mocked(journeyLoader.getStep).mockResolvedValue({ id: 'step-0', index: 0, openingMessage: 'Hello Step 0', mode: 'coaching' } as any);
    vi.mocked(sessionsDb.startSession).mockResolvedValue('session-1');
    vi.mocked(sessionsDb.logMessage).mockResolvedValue({} as any);
    vi.mocked(journeysDb.advanceUserJourney).mockResolvedValue({} as any);
    vi.mocked(usersDb.updateUserProgress).mockResolvedValue({} as any);

    const result = await deliverScheduledSteps(tenantId);

    expect(result.sent).toBe(1);
    expect(sender.sendTextMessage).toHaveBeenCalledWith('123456', 'Hello Step 0', expect.anything());
    expect(schedulerDb.logDelivery).toHaveBeenCalledWith(tenantId, 'user-1', journeyId, 0);
    expect(journeysDb.advanceUserJourney).toHaveBeenCalled();
    expect(usersDb.updateUserProgress).toHaveBeenCalledWith('user-1', journeyId, 1);
  });

  it('should skip if already delivered today', async () => {
    const now = new Date();
    const currentHour = now.getUTCHours();

    vi.mocked(schedulerDb.getScheduledJourneys).mockResolvedValue([
      {
        id: journeyId,
        tenant_id: tenantId,
        schedule_type: 'daily',
        schedule_hour: currentHour,
        schedule_day: null,
        status: 'published'
      } as any
    ]);

    vi.mocked(schedulerDb.getEnrolledUsers).mockResolvedValue([
      { id: 'user-1', whatsapp_number: '123456', current_step_index: 0 }
    ]);

    vi.mocked(journeyLoader.getJourney).mockResolvedValue({
      id: journeyId,
      steps: [{ index: 0, openingMessage: 'Hello' }]
    } as any);

    vi.mocked(schedulerDb.hasDeliveredToday).mockResolvedValue(true);

    const result = await deliverScheduledSteps(tenantId);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(sender.sendTextMessage).not.toHaveBeenCalled();
  });

  it('should skip journeys with mismatched schedule_hour', async () => {
    const now = new Date();
    const wrongHour = (now.getUTCHours() + 1) % 24;

    vi.mocked(schedulerDb.getScheduledJourneys).mockResolvedValue([
      {
        id: journeyId,
        tenant_id: tenantId,
        schedule_type: 'daily',
        schedule_hour: wrongHour,
        status: 'published'
      } as any
    ]);

    const result = await deliverScheduledSteps(tenantId);

    expect(result.sent).toBe(0);
    expect(schedulerDb.getEnrolledUsers).not.toHaveBeenCalled();
  });
});
