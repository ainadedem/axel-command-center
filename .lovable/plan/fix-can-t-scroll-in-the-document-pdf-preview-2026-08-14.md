# Fix: can't scroll in the document PDF preview

## Problem

In the invoice/quotation PDF preview dialog, the A4 page is taller than the dialog, but the
page area doesn't scroll — the bottom of the document (and the export area) is unreachable.

The dialog is capped at 90% of the screen height with `overflow-hidden`, and the preview
area is marked `overflow-y-auto` but is never told it can shrink inside that cap, so it grows
to full document height and gets clipped instead of scrolling. The toolbar (checkboxes,
language, logo size, Print / Export PDF) also has no room to wrap on narrower screens.

## Fix

In `src/components/document-preview.tsx`:

- Make the dialog a vertical flex container (`flex flex-col`) with the header fixed
  (`shrink-0`) and the preview region `flex-1 min-h-0 overflow-auto`, so the page area
  scrolls within the 90vh cap.
- Allow horizontal scroll too, since the A4 sheet is a fixed 210mm wide and is cut off on
  smaller viewports; center it only when it fits.
- Let the toolbar wrap (`flex-wrap`, `gap-y`) so the Print / Export PDF buttons stay
  reachable at narrow widths.

No changes to the PDF/print output itself — this is layout only.
