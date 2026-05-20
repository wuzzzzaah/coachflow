interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  resendApiKey: string;
}

/**
 * Sends an email via Resend API using fetch.
 * Fire-and-forget: logs errors but never throws.
 */
export async function sendEmail({ to, subject, html, resendApiKey }: SendEmailParams): Promise<void> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'CoachFlow <notifications@coachflow.ai>', // In production, this would be a verified domain
        to: to.split(',').map((email) => email.trim()),
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[email] Resend API error: ${response.status}`, errorData);
    }
  } catch (err) {
    console.error(`[email] sendEmail failed: ${(err as Error).message}`);
  }
}
