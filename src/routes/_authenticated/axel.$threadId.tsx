import { createFileRoute, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAxelThreadMessages, renameAxelThread } from "@/lib/axel.functions";
import { buildAxelDataSnapshot } from "@/lib/axel-context";
import { useCompany } from "@/lib/company-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/axel/$threadId")({
  component: AxelThread,
});

function AxelThread() {
  const { threadId } = useParams({ from: "/_authenticated/axel/$threadId" });
  const qc = useQueryClient();
  const loadMessages = useServerFn(getAxelThreadMessages);
  const rename = useServerFn(renameAxelThread);
  const { scope } = useCompany();
  const companyId = scope.id === "company" ? scope.companyId : undefined;

  const { data: initial = [], isLoading } = useQuery({
    queryKey: ["axel-thread", threadId],
    queryFn: () => loadMessages({ data: { threadId } }),
  });

  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const dataContext = useMemo(() => buildAxelDataSnapshot({ companyId }), [companyId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/axel-chat",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { threadId, dataContext },
      }),
    [token, threadId, dataContext],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initial as UIMessage[],
    transport,
  });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Auto-rename thread from first user message + invalidate caches on finish
  const renamedRef = useRef(false);
  useEffect(() => {
    if (renamedRef.current) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return;
    const text = firstUser.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim()
      .slice(0, 60);
    if (text && initial.length === 0) {
      renamedRef.current = true;
      void rename({ data: { threadId, title: text } }).then(() =>
        qc.invalidateQueries({ queryKey: ["axel-threads"] }),
      );
    }
  }, [messages, initial.length, rename, threadId, qc]);

  useEffect(() => {
    if (status === "ready" && messages.length > 0) {
      qc.invalidateQueries({ queryKey: ["axel-thread", threadId] });
    }
  }, [status, messages.length, qc, threadId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v || status === "submitted" || status === "streaming") return;
    setInput("");
    await sendMessage({ text: v });
  };

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {isLoading && messages.length === 0 && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="text-center py-16">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-chart-2 grid place-items-center mx-auto mb-4 shadow-[var(--shadow-glow)]">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="font-display text-xl mb-2">Ask Axel anything</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Try: "What's my cash position this quarter?", "Which clients are overdue?",
                "Where am I bleeding margin?"
              </p>
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            return (
              <div
                key={m.id}
                className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="h-7 w-7 shrink-0 rounded-md bg-gradient-to-br from-primary to-chart-2 grid place-items-center mt-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface border border-border",
                  )}
                >
                  {text || <span className="text-muted-foreground italic">…</span>}
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="flex gap-3 items-center text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Axel is thinking…
            </div>
          )}
        </div>
      </div>
      <form
        onSubmit={onSubmit}
        className="border-t border-border bg-background/70 backdrop-blur p-4"
      >
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSubmit(e as unknown as React.FormEvent);
              }
            }}
            rows={1}
            placeholder="Ask your CFO analyst… (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-lg bg-surface border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-40"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-10 w-10 grid place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
