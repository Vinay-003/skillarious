-- Additive migration. Review against the target database before applying manually.
CREATE TABLE IF NOT EXISTS course_history (
  user_id uuid NOT NULL REFERENCES users(id), course_id uuid NOT NULL REFERENCES courses(id),
  viewed_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS course_history_recent_idx ON course_history (user_id, viewed_at);
CREATE TABLE IF NOT EXISTS course_likes (
  user_id uuid NOT NULL REFERENCES users(id), course_id uuid NOT NULL REFERENCES courses(id),
  created_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (user_id, course_id)
);
CREATE TABLE IF NOT EXISTS playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL, created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT playlists_name_nonempty CHECK (length(btrim(name)) BETWEEN 1 AND 120)
);
CREATE INDEX IF NOT EXISTS playlists_user_id_idx ON playlists (user_id);
CREATE TABLE IF NOT EXISTS playlist_courses (
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id), created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, course_id)
);
CREATE TABLE IF NOT EXISTS educator_subscriptions (
  user_id uuid NOT NULL REFERENCES users(id), educator_id uuid NOT NULL REFERENCES educators(id),
  created_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (user_id, educator_id)
);
ALTER TABLE course_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE educator_subscriptions ENABLE ROW LEVEL SECURITY;
-- No browser-facing policies: backend uses trusted server credentials and enforces user ownership.
