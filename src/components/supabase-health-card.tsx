import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ClientState =
  | { status: "checking" }
  | { status: "ok"; latencyMs: number }
  | { status: "error"; message: string };

type ServerState =
  | { status: "checking" }
  | {
      status: "ok" | "error";
      ok: boolean;
      stage?: string;
      httpStatus?: number;
      message?: string;
      env?: Record<string, boolean>;
    };

export function SupabaseHealthCard() {
  const [client, setClient] = useState<ClientState>({ status: "checking" });
  const [server, setServer] = useState<ServerState>({ status: "checking" });

  const runChecks = async () => {
    setClient({ status: "checking" });
    setServer({ status: "checking" });

    // Client: initialize the Supabase client and issue a trivial auth call.
    const t0 = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      setClient({ status: "ok", latencyMs: Math.round(performance.now() - t0) });
    } catch (e) {
      setClient({ status: "error", message: (e as Error).message });
    }

    // Server: hit our health endpoint.
    try {
      const res = await fetch("/api/health/supabase", { cache: "no-store" });
      const body = (await res.json()) as {
        ok: boolean;
        stage?: string;
        message?: string;
        env?: Record<string, boolean>;
      };
      setServer({
        status: body.ok ? "ok" : "error",
        ok: body.ok,
        stage: body.stage,
        httpStatus: res.status,
        message: body.message,
        env: body.env,
      });
    } catch (e) {
      setServer({ status: "error", ok: false, message: (e as Error).message });
    }
  };

  useEffect(() => {
    runChecks();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Backend connectivity</CardTitle>
        <Button variant="ghost" size="sm" onClick={runChecks} className="h-8 gap-1">
          <RefreshCw className="h-3.5 w-3.5" />
          Re-check
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row
          label="Client (browser)"
          state={client.status}
          detail={
            client.status === "ok"
              ? `getSession OK · ${client.latencyMs}ms`
              : client.status === "error"
                ? client.message
                : "Checking…"
          }
        />
        <Row
          label="Server (/api/health/supabase)"
          state={server.status === "checking" ? "checking" : server.ok ? "ok" : "error"}
          detail={
            server.status === "checking"
              ? "Checking…"
              : server.ok
                ? `Reachable · stage=${server.stage}`
                : `${server.stage ?? "error"}${server.message ? ` · ${server.message}` : ""}`
          }
        />
        {server.status !== "checking" && server.env && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(server.env).map(([k, v]) => (
              <Badge key={k} variant={v ? "secondary" : "destructive"} className="font-mono text-[10px]">
                {k}={v ? "set" : "missing"}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  state,
  detail,
}: {
  label: string;
  state: "checking" | "ok" | "error";
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        {state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {state === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        {state === "error" && <XCircle className="h-4 w-4 text-destructive" />}
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-right text-xs text-muted-foreground max-w-[60%] break-words">{detail}</span>
    </div>
  );
}
