import { prisma } from "./prisma.js";

export interface AuditEvent {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

// Fire-and-forget audit logging — never throws or blocks the request.
// Logs are written asynchronously; failures are printed to stderr but do not
// surface as HTTP errors.
export function writeAuditLog(event: AuditEvent): void {
  prisma.auditLog
    .create({
      data: {
        actorId:      event.actorId,
        actorEmail:   event.actorEmail,
        actorRole:    event.actorRole,
        action:       event.action,
        resourceType: event.resourceType,
        resourceId:   event.resourceId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        before:       event.before !== undefined ? (event.before as any) : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        after:        event.after  !== undefined ? (event.after  as any) : undefined,
        ipAddress:    event.ipAddress,
        userAgent:    event.userAgent,
      },
    })
    .catch((err: unknown) => {
      console.error("[AuditLog] Failed to write audit event:", err);
    });
}
