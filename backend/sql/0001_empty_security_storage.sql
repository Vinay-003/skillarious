-- Empty-project-only companion to 0000_empty_schema.sql. Backend uses trusted DB role.
ALTER TABLE public.paypal_orders ADD CONSTRAINT paypal_orders_amount_positive CHECK (amount > 0);
ALTER TABLE public.paypal_orders ADD CONSTRAINT paypal_orders_currency_usd CHECK (currency = 'USD');
ALTER TABLE public.admin_reports ADD CONSTRAINT admin_reports_target_type_valid CHECK (target_type IN ('user','course','content','review'));
ALTER TABLE public.admin_reports ADD CONSTRAINT admin_reports_status_valid CHECK (status IN ('open','resolved'));
ALTER TABLE public.playlists ADD CONSTRAINT playlists_name_nonempty CHECK (length(btrim(name)) BETWEEN 1 AND 120);
CREATE UNIQUE INDEX transactions_paypal_capture_unique ON public.transactions(payment_id) WHERE payment_id LIKE 'PAYPAL:%';
CREATE UNIQUE INDEX transactions_one_active_enrollment ON public.transactions(user_id, course_id) WHERE status = 'completed';
CREATE INDEX admin_reports_status_created_idx ON public.admin_reports(status, created_at DESC);
CREATE INDEX playlists_user_id_idx ON public.playlists(user_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educator_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role operates through the backend; no anon/authenticated table privileges.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Supabase-provisioned storage schema is expected; no policies permit client uploads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('public-assets', 'public-assets', true, 52428800, ARRAY['image/png','image/jpeg','image/webp']),
       ('course-content', 'course-content', false, 52428800, ARRAY['application/pdf','text/plain','image/png','image/jpeg','image/webp','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;
