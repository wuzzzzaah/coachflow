# Zapier & Webhook Integration

CoachFlow supports outbound webhooks and a polling endpoint to facilitate integration with Zapier and other automation platforms.

## Webhook Architecture

All outbound webhooks are sent as `POST` requests with a JSON body and a security signature.

### Standard Payload Envelope

All events share a common top-level structure:

```json
{
  "id": "uuid",
  "created_at": "ISO 8601 timestamp",
  "type": "event_type",
  "data": { ... event-specific data ... }
}
```

- `id`: A unique UUID for each event (useful for deduplication in Zapier).
- `created_at`: The UTC timestamp when the event was generated.
- `type`: The event trigger name.
- `data`: The payload specific to that event type.

### Security (HMAC Signature)

Every webhook request includes an `X-CoachFlow-Signature` header. This is an HMAC-SHA256 hex digest of the raw request body, signed using the **Signing Secret** you configured in the Webhooks settings.

Verification format: `sha256=<hex_digest>`

---

## Trigger Catalog

### 1. User Created (`user_created`)
Triggered when a new user record is created in CoachFlow (usually upon their first inbound message).

**Payload Data:**
- `userId`: Internal CoachFlow user UUID.
- `tenantId`: Your tenant UUID.
- `whatsappNumber`: The user's WhatsApp number (E.164 format).
- `displayName`: The user's WhatsApp profile name (if available).

### 2. First Message (`first_message`)
Triggered only the very first time a user sends a message. Useful for triggering onboarding email sequences.

**Payload Data:**
- `userId`: User UUID.
- `tenantId`: Tenant UUID.
- `whatsappNumber`: User's WhatsApp number.

### 3. Step Completed (`step_completed`)
Triggered when a user finishes a journey step and is about to advance to the next.

**Payload Data:**
- `userId`: User UUID.
- `tenantId`: Tenant UUID.
- `journeyId`: The ID of the journey.
- `stepId`: The ID of the step just completed.

### 4. Journey Completed (`journey_completed`)
Triggered when a user completes the final step of a journey.

**Payload Data:**
- `userId`: User UUID.
- `tenantId`: Tenant UUID.
- `journeyId`: The ID of the completed journey.

### 5. Step Scored (`step_scored`)
Triggered when an assessment step is evaluated and a score is generated.

**Payload Data:**
- `userId`: User UUID.
- `tenantId`: Tenant UUID.
- `journeyId`: Journey ID.
- `stepId`: Step ID.
- `score`: The overall numerical score (0-10).
- `dimensions`: An array of score dimensions (name, score, feedback).

---

## Zapier Setup Guide

Zapier can connect to CoachFlow using the "Webhooks by Zapier" app. Follow these steps to set up a trigger:

### Step 1: Create a New Zap
1. Choose **Webhooks by Zapier** as the Trigger App.
2. Select **Catch Hook** as the Event.
3. Copy the **Webhook URL** provided by Zapier.

### Step 2: Configure CoachFlow Webhook
1. Go to **Settings > Webhooks** in the CoachFlow Admin UI.
2. Click **Add Webhook**.
3. Paste the Zapier URL into the **Payload URL** field.
4. Enter a **Signing Secret** (any secure string).
5. Select the events you want to send to this Zap.

### Step 3: Test the Trigger (Polling Pattern)
Zapier often needs sample data to map fields. Because live webhooks may not fire immediately during setup, CoachFlow provides a polling endpoint.

1. In the CoachFlow Webhooks settings, copy the **Zapier Polling URL** (e.g., `https://api.coachflow.ai/api/webhooks/test?type=step_scored`).
2. In Zapier, under the "Test" section of your trigger, you can temporarily use this URL if the catch hook hasn't received data yet, OR simply trigger a live event in WhatsApp.
3. Once Zapier "catches" a payload, you will see the standardized `id`, `created_at`, `type`, and `data` fields available for use in subsequent Zap steps.

### Step 4: Add Actions
Map the `data` fields from the webhook into your destination app (e.g., Google Sheets, Slack, or HubSpot).
