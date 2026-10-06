-- Only run on a disposable PostgreSQL database after both canonical baseline files.
-- Exercises real FK/CHECK/index enforcement, not real Supabase API/Storage delivery.
BEGIN;
INSERT INTO users (id,name,email,password) VALUES ('10000000-0000-4000-8000-000000000001','Fixture','fixture@example.test','not-a-login-hash');
INSERT INTO educators (id,user_id) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
INSERT INTO courses (id,name,start,"end",educator_id,price,thumbnail) VALUES ('30000000-0000-4000-8000-000000000001','Fixture',now(),now(),'20000000-0000-4000-8000-000000000001',19,'');
INSERT INTO modules (id,course_id,name) VALUES ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Fixture module');
INSERT INTO content (id,module_id,title,type,file_url) VALUES
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','PDF','material','storage://course-content/fixture.pdf'),
 ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Video','class','storage://course-content/fixture.mp4');
INSERT INTO doubts (id,message,class_id,date,user_id,content_id,title,description) VALUES
 ('60000000-0000-4000-8000-000000000001','Question','50000000-0000-4000-8000-000000000001',now(),'10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Title','Question');
INSERT INTO messages (doubt_id,text,is_response) VALUES ('60000000-0000-4000-8000-000000000001','Answer',true);
UPDATE doubts SET status='answered' WHERE id='60000000-0000-4000-8000-000000000001';
UPDATE doubts SET status='resolved', resolved=true WHERE id='60000000-0000-4000-8000-000000000001';
DO $$
DECLARE rejected integer := 0; table_count integer;
BEGIN
  BEGIN UPDATE doubts SET content_id='50000000-0000-4000-8000-000000000009',class_id=null; EXCEPTION WHEN foreign_key_violation THEN rejected:=rejected+1; END;
  BEGIN UPDATE doubts SET class_id='50000000-0000-4000-8000-000000000002'; EXCEPTION WHEN check_violation THEN rejected:=rejected+1; END;
  BEGIN UPDATE doubts SET status='nonsense'; EXCEPTION WHEN check_violation THEN rejected:=rejected+1; END;
  BEGIN UPDATE doubts SET resolved=false; EXCEPTION WHEN check_violation THEN rejected:=rejected+1; END;
  BEGIN UPDATE doubts SET message=''; EXCEPTION WHEN check_violation THEN rejected:=rejected+1; END;
  BEGIN UPDATE doubts SET title=repeat('x',201); EXCEPTION WHEN check_violation THEN rejected:=rejected+1; END;
  BEGIN UPDATE doubts SET description=repeat('x',10001); EXCEPTION WHEN check_violation THEN rejected:=rejected+1; END;
  BEGIN INSERT INTO messages (doubt_id,text) VALUES ('60000000-0000-4000-8000-000000000009','Orphan'); EXCEPTION WHEN foreign_key_violation THEN rejected:=rejected+1; END;
  IF rejected<>8 THEN RAISE EXCEPTION 'Expected eight invalid doubt/message writes to be rejected, got %',rejected; END IF;
  SELECT count(*) INTO table_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity;
  IF table_count<>22 THEN RAISE EXCEPTION 'Expected RLS on 22 app tables, got %', table_count; END IF;
  IF has_table_privilege('anon','public.users','SELECT') OR has_table_privilege('authenticated','public.doubts','SELECT') THEN RAISE EXCEPTION 'Client role has private table privileges'; END IF;
  IF NOT has_table_privilege('service_role','public.doubts','INSERT') THEN RAISE EXCEPTION 'Missing backend role privileges'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='course-content' AND NOT public AND 'application/pdf'=ANY(allowed_mime_types) AND 'video/mp4'=ANY(allowed_mime_types)) THEN RAISE EXCEPTION 'Private bucket configuration missing'; END IF;
END $$;
INSERT INTO transactions (user_id,amount,date,course_id,payment_id) VALUES ('10000000-0000-4000-8000-000000000001',19,now(),'30000000-0000-4000-8000-000000000001','PAYPAL:fixture');
DO $$ BEGIN
  BEGIN
    INSERT INTO transactions (user_id,amount,date,course_id,payment_id) VALUES ('10000000-0000-4000-8000-000000000001',19,now(),'30000000-0000-4000-8000-000000000001','PAYPAL:second');
    RAISE EXCEPTION 'Duplicate active enrollment unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: canonical SQL, doubt lifecycle/8 invalid writes, RLS/grants, bucket configuration and enrollment uniqueness' AS result;
