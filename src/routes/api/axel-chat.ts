import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 8000;
const MAX_DATA_CONTEXT_CHARS = 20000;

const partSchema = z
  .object({
    type: z.string().max(64),
    text: z.string().max(MAX_MESSAGE_CHARS).optional(),
  })
  .passthrough();

const messageSchema = z
  .object({
    id: z.string().max(128).optional(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(partSchema).max(32),
  })
  .passthrough()
  .refine(
    (m) =>
      m.parts.reduce(
        (sum, p) => sum + (typeof p.text === "string" ? p.text.length : 0),
        0,
      ) <= MAX_MESSAGE_CHARS,
    { message: "Message text exceeds limit" },
  );

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
  threadId: z.string().uuid().optional(),
  dataContext: z.string().max(MAX_DATA_CONTEXT_CHARS).optional(),
});

const SYSTEM_PROMPT = `You are Axel AI — a senior CFO and financial analyst embedded inside the Axel command center.
You help the user (a business owner / executive) understand and manage their companies' finances.

Your job:
- Give clear, executive-grade analysis grounded in the data provided in the user's context snapshot.
- Surface risks, opportunities, anomalies, cash-flow concerns, margin issues, client concentration, overdue invoices.
- Recommend concrete next actions. Be opinionated like a real CFO. Cite numbers from the snapshot.
- When data is missing, say so explicitly instead of guessing.

Style:
- Concise, structured. Use short paragraphs and bullet lists. Numbers in the same currency as the data (MGA, EUR, USD).
- French or English — match the user's language.
- No fluff, no disclaimers about being an AI.`;

export const Route = createFileRoute("/api/axel-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return new Response("Missing OPENAI_API_KEY", { status: 500 });
        }

        const authHeader = request.headers.get("authorization");
        if (!authHeader) return new Response("Unauthorized", { status: 401 });

        // Validate user + get user_id
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        // Verify thread ownership if provided
        if (body.threadId) {
          const { data: thread, error: threadErr } = await supabase
            .from("axel_chat_threads")
            .select("id")
            .eq("id", body.threadId)
            .eq("user_id", userId)
            .maybeSingle();
          if (threadErr || !thread) {
            return new Response("Thread not found", { status: 404 });
          }
        }

        const openai = createOpenAI({ apiKey });
        const system = body.dataContext
          ? `${SYSTEM_PROMPT}\n\n---\nCurrent business data snapshot:\n${body.dataContext}`
          : SYSTEM_PROMPT;

        const result = streamText({
          model: openai("gpt-4o-mini"),
          system,
          messages: await convertToModelMessages(body.messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            if (!body.threadId) return;
            // Persist only the newly added messages (last user + new assistant)
            const last = messages[messages.length - 1];
            const prevLast = body.messages[body.messages.length - 1];
            const toInsert: { thread_id: string; user_id: string; role: string; parts: unknown }[] = [];
            if (prevLast && prevLast.role === "user") {
              toInsert.push({
                thread_id: body.threadId,
                user_id: userId,
                role: "user",
                parts: prevLast.parts as unknown,
              });
            }
            if (last && last.role === "assistant") {
              toInsert.push({
                thread_id: body.threadId,
                user_id: userId,
                role: "assistant",
                parts: last.parts as unknown,
              });
            }
            if (toInsert.length) {
              await supabase.from("axel_chat_messages").insert(toInsert);
              await supabase
                .from("axel_chat_threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", body.threadId);
            }
          },
        });
      },
    },
  },
});
