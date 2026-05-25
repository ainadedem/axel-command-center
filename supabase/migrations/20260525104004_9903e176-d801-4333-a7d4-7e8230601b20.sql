
-- Promote gmail to group_admin
UPDATE public.user_roles
SET role = 'group_admin'
WHERE user_id = (SELECT user_id FROM public.profiles WHERE email = 'ainadedem@gmail.com');

-- Remove the stale icloud account entirely
DELETE FROM auth.users
WHERE id = (SELECT user_id FROM public.profiles WHERE email = 'ainadedem@icloud.com');
