/**
 * src/lib/logger.ts
 *
 * Structured audit logger for critical business events.
 * - In production → writes to Supabase `audit_logs` table (async, non-blocking)
 * - In development → pretty-prints to console
 * - Never throws; all errors are silently caught to avoid crashing the caller
 */

import { supabase, isSupabaseConfigured } from './supabase';

export type AuditAction =
  | 'customer_login'
  | 'customer_login_failed'
  | 'customer_register'
  | 'order_created'
  | 'order_status_changed'
  | 'order_cancelled'
  | 'shortage_submitted'
  | 'staff_created'
  | 'staff_login'
  | 'staff_login_failed'
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'category_created'
  | 'category_deleted'
  | 'inventory_adjusted'
  | 'security_rate_limit';

export interface AuditContext {
  action: AuditAction;
  /** UUID or hashed identifier — NEVER store raw customer PII in plain text here */
  actorId?: string;
  /** Phone last 4 digits or SHA-256 prefix — never full phone */
  actorPhoneHint?: string;
  targetId?: string;           // order ID, product ID, etc.
  targetType?: string;         // 'order' | 'product' | 'category' | etc.
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'warn' | 'error';
  errorMessage?: string;
}

/** SHA-256 hash of a string, returned as hex (browser-safe). */
async function sha256Hex(text: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'hash-unavailable';
  }
}

/** Returns phone last-4 digits as a hint — not PII. */
export function phoneHint(phone?: string | null): string {
  if (!phone) return 'unknown';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 4 ? `****${digits.slice(-4)}` : '****';
}

/**
 * Log a business event to Supabase audit_logs table.
 * Fire-and-forget — never awaited by the caller.
 */
export function auditLog(ctx: AuditContext): void {
  const severity = ctx.severity || 'info';
  const payload = {
    action: ctx.action,
    actor_id: ctx.actorId || null,
    actor_phone_hint: ctx.actorPhoneHint || null,
    target_id: ctx.targetId || null,
    target_type: ctx.targetType || null,
    metadata: ctx.metadata || null,
    severity,
    error_message: ctx.errorMessage || null,
    created_at: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === 'development') {
    const icon = severity === 'error' ? '🔴' : severity === 'warn' ? '🟡' : '🟢';
    console.log(`${icon} [AUDIT] ${ctx.action}`, payload);
  }

  // Async write to Supabase — non-blocking
  if (isSupabaseConfigured()) {
    Promise.resolve(
      supabase.from('audit_logs').insert(payload)
    ).then(({ error }) => {
      if (error && process.env.NODE_ENV === 'development') {
        console.warn('[AUDIT] Failed to write audit log:', error.message);
      }
    }).catch(() => {
      // Silent fail — logger must never break the app
    });
  }
}

/**
 * Convenience wrapper to log an order status transition.
 */
export function logOrderTransition(params: {
  orderId: string;
  orderNumber: string;
  fromStatus: string;
  toStatus: string;
  actorId?: string;
  actorRole?: string;
}): void {
  auditLog({
    action: 'order_status_changed',
    actorId: params.actorId,
    targetId: params.orderId,
    targetType: 'order',
    metadata: {
      order_number: params.orderNumber,
      from: params.fromStatus,
      to: params.toStatus,
      actor_role: params.actorRole,
    },
    severity: 'info',
  });
}
