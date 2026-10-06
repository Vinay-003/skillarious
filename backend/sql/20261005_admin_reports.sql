-- Apply explicitly after inspecting target project. No DROP or destructive migration.
CREATE TABLE IF NOT EXISTS public.admin_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.users(id),
  target_type text NOT NULL CHECK (target_type IN ('user', 'course', 'content', 'review')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution text,
  resolved_by uuid REFERENCES public.users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp
);
CREATE INDEX IF NOT EXISTS admin_reports_status_created_idx ON public.admin_reports(status, created_at DESC);
ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;
