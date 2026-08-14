# PDF preview: zoom, fit modes, remembered view, export feedback

All changes stay inside the document preview dialog (`src/components/document-preview.tsx`). No document content, numbering, or export output changes.

## Zoom controls

Add a zoom group to the preview toolbar:
- `−` and `+` buttons stepping through sensible levels (50% up to 200%).
- Current percentage shown between them, clickable to reset to 100%.
- Ctrl/Cmd + scroll wheel over the sheet zooms smoothly, anchored on the cursor, without scrolling the page behind.
- The A4 sheet scales visually only; export and print always render at true A4 size.

## Fit to page / Actual size

Two mode buttons next to the zoom control:
- **Fit** — scales the sheet so the full page width (and height when it fits) is visible in the current window; recalculates when the dialog is resized.
- **100%** (Actual size) — renders the sheet at true A4 dimensions.
- Manually zooming switches the mode indicator to "Custom".

## Remember zoom and scroll

Store the last zoom level, mode, and scroll position per document kind in browser local storage, and restore them when the preview is reopened. Falls back to Fit mode the first time.

## Export progress and errors

- Clicking Print or Export PDF disables both buttons and shows a spinner with "Preparing PDF…".
- If the print window is blocked by the browser, or rendering fails, show a clear inline error plus a toast explaining the cause (e.g. "Pop-ups are blocked — allow pop-ups to export this PDF") with a retry.
- The indicator clears once the print dialog opens or the operation fails.

## Technical notes

- Zoom applied via CSS `transform: scale()` with `transform-origin: top left` on a wrapper around the A4 sheet, with the wrapper sized to the scaled dimensions so scrollbars stay correct.
- Wheel zoom uses a native non-passive `wheel` listener with exponential scaling from `deltaY` (normalised for `deltaMode`) and cursor-anchored offset correction.
- Fit mode uses a `ResizeObserver` on the scroll container.
- Persistence via a small `localStorage` key (`axel:doc-preview:view`), read in an effect after mount to avoid hydration issues.
