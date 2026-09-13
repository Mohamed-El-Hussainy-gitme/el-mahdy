-- =============================================================================
-- Migration 00014: Create audit_logs table for structured observability
-- Run in Supabase SQL Editor → New Query → Paste → Run
-- =============================================================================

-- ── Create audit_logs table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action        text NOT NULL,
  actor_id      uuid,
  actor_phone_hint text,
  target_id     uuid,
  target_type   text,
  metadata      jsonb,
  severity      text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error')),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by action type and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time
  ON public.audit_logs (action, created_at DESC);

-- Index for actor-specific audit trail
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_id, created_at DESC);

-- ── RLS: Only service role can read/write audit logs ─────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Anon/authenticated cannot read audit logs
CREATE POLICY "audit_logs_deny_anon"
  ON public.audit_logs
  FOR ALL
  TO anon, authenticated
  USING (false);

-- Service role bypasses RLS automatically (no policy needed)

-- ── Auto-cleanup: delete logs older than 90 days (via pg_cron if available) ──
-- NOTE: pg_cron must be enabled in Supabase for this to work.
-- If not available, set up a manual cleanup job or Supabase Edge Function.
-- Uncomment after enabling pg_cron:
/*
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 3 * * *',  -- runs daily at 03:00 UTC
  $$DELETE FROM public.audit_logs WHERE created_at < now() - interval '90 days';$$
);
*/

COMMENT ON TABLE public.audit_logs IS
  'Immutable audit trail for critical B2B business events. Written by service role only.';
