
-- 1) Deduplicate team_members keeping the earliest row per normalized name
WITH ranked AS (
  SELECT id, lower(trim(name)) AS k,
         row_number() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at ASC, id ASC) AS rn
  FROM public.team_members
),
keepers AS (
  SELECT k, (SELECT id FROM ranked r2 WHERE r2.k=ranked.k AND r2.rn=1 LIMIT 1) AS keep_id
  FROM ranked GROUP BY k
),
dups AS (
  SELECT r.id AS dup_id, k.keep_id
  FROM ranked r JOIN keepers k ON k.k=r.k
  WHERE r.rn > 1
)
-- Repoint sales_members references before deletion
UPDATE public.sales_members sm
SET team_member_id = d.keep_id
FROM dups d
WHERE sm.team_member_id = d.dup_id;

WITH ranked AS (
  SELECT id, lower(trim(name)) AS k,
         row_number() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at ASC, id ASC) AS rn
  FROM public.team_members
)
DELETE FROM public.team_members t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

-- Also dedupe sales_members that now point to the same team_member_id
WITH r AS (
  SELECT id, row_number() OVER (PARTITION BY team_member_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.sales_members
)
DELETE FROM public.sales_members s USING r WHERE s.id=r.id AND r.rn > 1;

-- 2) Allow any authenticated user to view team_members (global people directory)
CREATE POLICY "Authenticated users view team_members"
ON public.team_members
FOR SELECT
TO authenticated
USING (true);
