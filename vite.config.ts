// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const publicBackendUrl =
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "https://kydzlvttvbhodolhakep.supabase.co";

const publicBackendKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZHpsdnR0dmJob2RvbGhha2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTE0NTgsImV4cCI6MjA5NTI2NzQ1OH0.buQ3GgQfw7nDbLg9xQ0amevKtgAEuqNn3nE_Jp_b6Bo";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicBackendUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicBackendKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(publicBackendKey),
    },
  },
});
