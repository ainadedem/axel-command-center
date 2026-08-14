# Rename menu subtitle

## Change
In `src/components/app-shell.tsx` (line 256), change the sidebar subtitle from `AXWG` to `The Axiom Winford Group`.

The surrounding markup:
```tsx
<span className="text-[11px] font-medium tracking-wide text-foreground/70">The Axiom Winford Group</span>
```

No other files or logic are affected — this is a single text replacement under the Axel logo in the sidebar header.
