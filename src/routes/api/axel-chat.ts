import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";

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

        const body = (await request.json()) as {
          messages: UIMessage[];
          threadId?: string;
          dataContext?: string;
        };

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
