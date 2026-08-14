# Plan: Logo color + subtitle text tweak

Two small visual fixes in the sidebar header of `src/components/app-shell.tsx`:

1. **Logo color — black instead of grey**
   The `{axel}` wordmark currently inherits `text-sidebar-foreground`, which resolves to grey (`#656F7D` light / `#A9AEBB` dark). Switch it to `text-foreground` so it renders near-black (`#292D34`) in light mode and white (`#F2F3F5`) in dark mode — i.e. always the strongest text color on the surface, never grey.

2. **Subtitle text**
   Change the line under the wordmark from "Unified Business Platform" to "AXWG".

### Change

`src/components/app-shell.tsx`, lines 255–256:

```diff
- <AxelWordmark title="AXEL Business Platform" className="h-7 w-auto self-start text-sidebar-foreground" />
- <span className="text-[11px] font-medium tracking-wide text-sidebar-foreground/60">Unified Business Platform</span>
+ <AxelWordmark title="AXEL Business Platform" className="h-7 w-auto self-start text-foreground" />
+ <span className="text-[11px] font-medium tracking-wide text-foreground/70">AXWG</span>
```

No other files, routes, or logic are touched.
