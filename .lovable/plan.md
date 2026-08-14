# Standardize brand to "AXEL — The Axiom Winford Group"

## Context
No literal "AXWG" remains anywhere in the codebase — the only instance (sidebar subtitle) was already changed to "The Axiom Winford Group". The browser tab title and OG/Twitter cards still show "AXEL — ERP" (root) and "Sign in — AXEL" (login). Per your choice, AXEL stays as the product name with the group name appended.

## Changes

### 1. Root tab title & social cards — `src/routes/__root.tsx`
- Line 63: `{ title: "AXEL — ERP" }` → `{ title: "AXEL — The Axiom Winford Group" }`
- Line 65: `og:title` "AXEL — ERP" → "AXEL — The Axiom Winford Group"
- Line 66: `twitter:title` "AXEL — ERP" → "AXEL — The Axiom Winford Group"

This is the default title inherited by the dashboard, reports, and all authenticated pages that don't override it.

### 2. Login tab title & OG card — `src/routes/login.tsx`
- Line 31: `{ title: "Sign in — AXEL" }` → `{ title: "Sign in — AXEL — The Axiom Winford Group" }`
- Line 33: `og:title` "Sign in — AXEL" → "Sign in — AXEL — The Axiom Winford Group"

### 3. Main header branding (sidebar) — `src/components/app-shell.tsx`
Already correct: AxelWordmark "AXEL Business Platform" logo + subtitle "The Axiom Winford Group" (line 256). No change needed.

## Not changed
- Product/app name "AXEL" throughout the UI (about page, login footer, reconciliation export footer) stays as the product name; the group name already appears alongside it where relevant.
- `og:site_name` "AXEL" stays — it's the short site handle, not a title.
