import { sendEmailVerification, sendPasswordReset } from "../services/email.service.js";
import { config } from "../env.js";

export type NotificationType = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

export interface NotificationPayload {
  type: NotificationType;
  to: string;
  name: string;
  token: string;
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<void>;
}

export interface FutureEmailProvider extends NotificationProvider {
  sendBulk?(payloads: NotificationPayload[]): Promise<void>;
}

// ─── SMTP provider (production) ───────────────────────────────────────────────

class SmtpNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<void> {
    const baseUrl = process.env.APP_BASE_URL ?? "https://celebstyle.in";

    if (payload.type === "EMAIL_VERIFICATION") {
      const link = `${baseUrl}/verify-email?token=${encodeURIComponent(payload.token)}`;
      await sendEmailVerification(payload.to, link);
    } else if (payload.type === "PASSWORD_RESET") {
      const link = `${baseUrl}/reset-password?token=${encodeURIComponent(payload.token)}`;
      await sendPasswordReset(payload.to, link);
    }
  }
}

// ─── Console fallback (when SMTP not configured) ──────────────────────────────

class ConsoleNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<void> {
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    if (payload.type === "EMAIL_VERIFICATION") {
      const link = `${baseUrl}/verify-email?token=${payload.token}`;
      console.log(`\n[AUTH] Email verification for ${payload.to}\n  Link: ${link}\n`);
    } else if (payload.type === "PASSWORD_RESET") {
      const link = `${baseUrl}/reset-password?token=${payload.token}`;
      console.log(`\n[AUTH] Password reset for ${payload.to}\n  Link: ${link}\n`);
    }
  }
}

export const notificationService: NotificationProvider = config.email.enabled
  ? new SmtpNotificationProvider()
  : new ConsoleNotificationProvider();
