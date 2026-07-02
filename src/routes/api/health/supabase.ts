import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health/supabase")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.SUPABASE_URL;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        const viteUrl = process.env.VITE_SUPABASE_URL;
        const vitePublishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const effectiveUrl = url || viteUrl;
        const effectiveKey = publishable || vitePublishable;

        const env = {
          SUPABASE_URL: !!url,
          SUPABASE_PUBLISHABLE_KEY: !!publishable,
          VITE_SUPABASE_URL: !!viteUrl,
          VITE_SUPABASE_PUBLISHABLE_KEY: !!vitePublishable,
        };

        if (!effectiveUrl || !effectiveKey) {
          return Response.json(
            { ok: false, stage: "env", message: "Missing Supabase env vars on server", env },
            { status: 500 },
          );
        }

        try {
          const res = await fetch(`${effectiveUrl}/auth/v1/health`, {
            headers: { apikey: effectiveKey },
          });
          return Response.json({
            ok: res.ok,
            stage: "reachable",
            status: res.status,
            env,
            checkedAt: new Date().toISOString(),
          }, { status: res.ok ? 200 : 502 });
        } catch (e) {
          return Response.json(
            { ok: false, stage: "network", message: (e as Error).message, env },
            { status: 502 },
          );
        }
      },
    },
  },
});
