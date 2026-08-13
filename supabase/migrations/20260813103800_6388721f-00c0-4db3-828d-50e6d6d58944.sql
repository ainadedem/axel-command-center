CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('ar-escalation-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ar-escalation-alerts');

SELECT cron.schedule(
  'ar-escalation-alerts',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6d852ac6-4d80-4857-bc8c-05e21302d63c.lovable.app/api/public/hooks/ar-escalation-alerts',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZHpsdnR0dmJob2RvbGhha2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTE0NTgsImV4cCI6MjA5NTI2NzQ1OH0.buQ3GgQfw7nDbLg9xQ0amevKtgAEuqNn3nE_Jp_b6Bo"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);