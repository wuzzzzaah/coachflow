# Meta WhatsApp Cloud API Setup

This walks you through getting a test WhatsApp number that talks to your local server via ngrok. End result: you message the test number on WhatsApp, your code receives the message, sends a reply.

## 1. Create a Meta Developer App

1. Go to <https://developers.facebook.com> and log in (or sign up).
2. Click **My Apps → Create App**.
3. App type: **Business**. Click **Next**.
4. Give the app a display name and an email. Click **Create app**.

## 2. Add the WhatsApp Product

1. From your app dashboard, click **Add Product**.
2. Find **WhatsApp** in the product list and click **Set up**.
3. You'll land on the **WhatsApp → API Setup** page.

## 3. Get Credentials

On the API Setup page:

- **Phone Number ID** — appears under "Send and receive messages". Copy it into `WHATSAPP_PHONE_NUMBER_ID` in `.env`.
- **Temporary access token** — copy it into `WHATSAPP_ACCESS_TOKEN`. This token expires in ~24 hours. Generate a permanent system-user token later from **Business Settings → Users → System Users**.

## 4. Add Your WhatsApp Number as a Test Recipient

Under **To**, click **Add phone number**. Enter your own WhatsApp number and verify the OTP. Until your app is reviewed by Meta, only test recipients can receive messages from your business number.

## 5. Configure the Webhook

1. In a terminal, run `ngrok http 3000` (make sure your `npm run dev` is also running).
2. Copy the `https://<hash>.ngrok-free.app` URL.
3. In Meta App Dashboard → **WhatsApp → Configuration → Webhook**, click **Edit**.
4. **Callback URL**: `https://<hash>.ngrok-free.app/webhook/whatsapp`
5. **Verify token**: must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env`. Use any string you like; it's only used for the initial handshake.
6. Click **Verify and save**. Meta sends a GET to your endpoint with `hub.mode=subscribe` and your verify token — the server responds with the challenge string. If your `.env` matches, you'll see a green check.
7. Under **Webhook fields**, subscribe to **messages**. (You don't need the others for the prototype.)

## 6. Send a Test Message

From your test WhatsApp number, send "hi" to the business number shown on the API Setup page. You should see:

- Your server logs an inbound message
- A "blue tick" (read receipt) appears on WhatsApp
- The bot replies with the welcome and journey picker

## Troubleshooting

| Problem                                               | Fix                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `403` on webhook verification                         | `WHATSAPP_WEBHOOK_VERIFY_TOKEN` doesn't match the value entered in Meta's dashboard         |
| `401` when sending messages                           | `WHATSAPP_ACCESS_TOKEN` expired (regenerate from API Setup) or is wrong                     |
| `131030` "Recipient phone number not in allowed list" | Add the recipient as a test number under **To**                                             |
| No webhook delivered                                  | Confirm ngrok is running, the URL in Meta matches, and the **messages** field is subscribed |
| Duplicate replies                                     | Verify `processed_messages` table exists in Supabase (dedup depends on it)                  |
