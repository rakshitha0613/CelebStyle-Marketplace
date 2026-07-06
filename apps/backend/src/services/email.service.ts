import nodemailer from "nodemailer";
import { config } from "../env.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.email.enabled) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host:   config.email.host!,
    port:   config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user!,
      pass: config.email.pass!,
    },
  });
  return transporter;
}

export interface EmailOptions {
  to:      string | string[];
  subject: string;
  html:    string;
  text?:   string;
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const mailer = getTransporter();
  if (!mailer) return; // Email not configured — silently skip

  await mailer.sendMail({
    from:    config.email.from,
    to:      Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  });
}

// ── Transactional email templates ─────────────────────────────────────────────

export async function sendOrderConfirmation(to: string, orderNumber: string, total: number): Promise<void> {
  await sendEmail({
    to,
    subject: `Order Confirmed – #${orderNumber}`,
    html: `
      <h2>Your order has been confirmed!</h2>
      <p>Order <strong>#${orderNumber}</strong> for <strong>₹${total.toLocaleString("en-IN")}</strong> has been placed successfully.</p>
      <p>You can track your order at <a href="https://celebstyle.in/orders/${orderNumber}">celebstyle.in/orders/${orderNumber}</a>.</p>
    `,
    text: `Order #${orderNumber} confirmed. Total: ₹${total.toLocaleString("en-IN")}.`,
  });
}

export async function sendOrderShipped(to: string, orderNumber: string, trackingCode: string): Promise<void> {
  await sendEmail({
    to,
    subject: `Your order #${orderNumber} has shipped`,
    html: `
      <h2>On its way!</h2>
      <p>Order <strong>#${orderNumber}</strong> has been shipped.</p>
      <p>Tracking code: <strong>${trackingCode}</strong></p>
    `,
    text: `Order #${orderNumber} shipped. Tracking: ${trackingCode}.`,
  });
}

export async function sendPasswordReset(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Reset your CelebStyle password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you did not request this, please ignore this email.</p>
    `,
    text: `Reset your password: ${resetUrl}`,
  });
}

export async function sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Verify your CelebStyle email",
    html: `
      <h2>Welcome to CelebStyle!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}">Verify Email</a></p>
    `,
    text: `Verify your email: ${verifyUrl}`,
  });
}

export async function sendReturnApproved(to: string, orderNumber: string): Promise<void> {
  await sendEmail({
    to,
    subject: `Return approved for order #${orderNumber}`,
    html: `
      <h2>Return Approved</h2>
      <p>Your return request for order <strong>#${orderNumber}</strong> has been approved.</p>
      <p>A pickup will be arranged within 2 business days.</p>
    `,
    text: `Return approved for order #${orderNumber}.`,
  });
}

export async function sendRefundProcessed(to: string, orderNumber: string, amount: number): Promise<void> {
  await sendEmail({
    to,
    subject: `Refund processed for order #${orderNumber}`,
    html: `
      <h2>Refund Processed</h2>
      <p>A refund of <strong>₹${amount.toLocaleString("en-IN")}</strong> for order <strong>#${orderNumber}</strong> has been initiated.</p>
      <p>It will appear in your account within 5–7 business days.</p>
    `,
    text: `Refund of ₹${amount.toLocaleString("en-IN")} processed for order #${orderNumber}.`,
  });
}
