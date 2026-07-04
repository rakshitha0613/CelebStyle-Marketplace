// ─── Notification abstraction ─────────────────────────────────────────────────
//
// Authentication code depends ONLY on NotificationProvider.
// It never knows whether the underlying transport is console, SMTP,
// Resend, SendGrid, SES, or anything else.
// To swap providers: replace the exported `notificationService` instance.

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

// ─── Development provider ─────────────────────────────────────────────────────
// Logs verification and password-reset links to the console.
// Never used in production — swap out by replacing `notificationService` below.

class DevelopmentNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<void> {
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

    if (payload.type === "EMAIL_VERIFICATION") {
      const link = `${baseUrl}/auth/verify-email?token=${payload.token}`;
      console.log(
        `\n[DEV NOTIFICATION] Email verification for ${payload.to}\n  Link: ${link}\n`
      );
    } else if (payload.type === "PASSWORD_RESET") {
      const link = `${baseUrl}/auth/reset-password?token=${payload.token}`;
      console.log(
        `\n[DEV NOTIFICATION] Password reset for ${payload.to}\n  Link: ${link}\n`
      );
    }
  }
}

// ─── Future email provider interface ─────────────────────────────────────────
// Implement this with your preferred email provider (SendGrid, Resend, SES…).
// Optional bulk method for batched sends.
//
// export class ProductionEmailProvider implements FutureEmailProvider {
//   async send(payload: NotificationPayload): Promise<void> { ... }
//   async sendBulk(payloads: NotificationPayload[]): Promise<void> { ... }
// }

export interface FutureEmailProvider extends NotificationProvider {
  sendBulk?(payloads: NotificationPayload[]): Promise<void>;
}

// ─── Active provider ──────────────────────────────────────────────────────────
// Replace this instance with a ProductionEmailProvider when a mailer is wired.
export const notificationService: NotificationProvider =
  new DevelopmentNotificationProvider();
