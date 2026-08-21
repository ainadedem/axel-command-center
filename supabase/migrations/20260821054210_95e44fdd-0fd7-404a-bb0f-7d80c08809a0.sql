DROP POLICY IF EXISTS "Users insert own messages" ON public.axel_chat_messages;
CREATE POLICY "Users insert own messages" ON public.axel_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.axel_chat_threads t
    WHERE t.id = axel_chat_messages.thread_id
      AND t.user_id = auth.uid()
  )
);