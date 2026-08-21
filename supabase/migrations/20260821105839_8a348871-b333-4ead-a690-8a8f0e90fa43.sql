SELECT cron.unschedule('notification-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-digest');

SELECT cron.schedule(
  'notification-digest',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6d852ac6-4d80-4857-bc8c-05e21302d63c.lovable.app/api/public/hooks/notification-digest',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "dc6077fabc111c9ba876c221b193f556f962eb667e98ee6131ad6f18ebcfec04"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);