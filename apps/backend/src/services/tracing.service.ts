import { randomBytes } from "node:crypto";

export type SpanStatus = "unset" | "ok" | "error";
export type SpanKind = "internal" | "server" | "client" | "producer" | "consumer";

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface Trace {
  traceId: string;
  spans: Span[];
  rootSpan?: Span;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  correlationId?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

const MAX_TRACES = 500;
const TRACEPARENT_VERSION = "00";

function generateId(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

export class TracingService {
  private traces = new Map<string, Trace>();
  private activeSpans = new Map<string, Span>();
  private traceOrder: string[] = [];

  startSpan(
    name: string,
    options: {
      parentSpanId?: string;
      traceId?: string;
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
      correlationId?: string;
    } = {}
  ): Span {
    const spanId = generateId(8);
    const traceId = options.traceId ?? generateId(16);
    const { parentSpanId, kind = "internal", attributes = {}, correlationId } = options;

    const span: Span = {
      spanId,
      traceId,
      parentSpanId,
      name,
      kind,
      startTime: Date.now(),
      status: "unset",
      attributes: { ...attributes },
      events: [],
    };

    this.activeSpans.set(spanId, span);

    if (!this.traces.has(traceId)) {
      const trace: Trace = {
        traceId,
        spans: [],
        startTime: span.startTime,
        correlationId,
      };
      this.traces.set(traceId, trace);
      this.traceOrder.push(traceId);
      if (this.traceOrder.length > MAX_TRACES) {
        const oldest = this.traceOrder.shift()!;
        this.traces.delete(oldest);
      }
    }

    const trace = this.traces.get(traceId)!;
    trace.spans.push(span);
    if (!parentSpanId) trace.rootSpan = span;

    return span;
  }

  endSpan(
    spanId: string,
    options: {
      status?: SpanStatus;
      attributes?: Record<string, string | number | boolean>;
      error?: string;
    } = {}
  ): Span | null {
    const span = this.activeSpans.get(spanId);
    if (!span) return null;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = options.status ?? (options.error ? "error" : "ok");

    if (options.attributes) {
      Object.assign(span.attributes, options.attributes);
    }
    if (options.error) {
      span.attributes["error.message"] = options.error;
    }

    this.activeSpans.delete(spanId);

    // Close the trace if all spans are done
    const trace = this.traces.get(span.traceId);
    if (trace) {
      const allDone = trace.spans.every((s) => s.endTime !== undefined);
      if (allDone) {
        trace.endTime = span.endTime;
        trace.durationMs = trace.endTime - trace.startTime;
      }
    }

    return span;
  }

  addSpanEvent(spanId: string, name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push({ name, timestamp: Date.now(), attributes });
    }
  }

  setSpanAttribute(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }

  getTrace(traceId: string): Trace | null {
    return this.traces.get(traceId) ?? null;
  }

  getActiveSpans(): Span[] {
    return [...this.activeSpans.values()];
  }

  getRecentTraces(limit = 20): Trace[] {
    const ids = this.traceOrder.slice(-limit).reverse();
    return ids.map((id) => this.traces.get(id)!).filter(Boolean);
  }

  // W3C Trace Context: traceparent header injection
  injectContext(headers: Record<string, string>, spanId: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    headers["traceparent"] = `${TRACEPARENT_VERSION}-${span.traceId}-${span.spanId}-01`;
    headers["tracestate"] = `celebstyle=00`;
  }

  // W3C Trace Context: extract context from incoming headers
  extractContext(headers: Record<string, string>): TraceContext | null {
    const traceparent = headers["traceparent"];
    if (!traceparent) return null;

    const parts = traceparent.split("-");
    if (parts.length < 4) return null;
    const [, traceId, spanId, flags] = parts;
    if (!traceId || !spanId) return null;

    return {
      traceId,
      spanId,
      traceFlags: parseInt(flags ?? "00", 16),
    };
  }

  getCorrelationId(traceId: string): string | undefined {
    return this.traces.get(traceId)?.correlationId;
  }

  getSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  clear(): void {
    this.traces.clear();
    this.activeSpans.clear();
    this.traceOrder = [];
  }
}
