# PDF preview layout controls missing on the published site

## What's going on

The column-resize and fit-to-one-page controls were added to the document preview after the last time the site was published. Frontend changes only reach `axel-command-center.lovable.app` and `axel.weaxiom.com` when the project is published again — the Lovable preview always runs the newest code, the published domains keep serving the last shipped build. That matches the symptom exactly: no error, the controls simply aren't there.

## Plan

1. Run a security scan check (required before publishing) and report any critical findings instead of shipping over them.
2. Publish the project so both the Lovable domain and the custom domain pick up the current build.
3. After the deploy settles, open a quotation preview on the published site and confirm:
   - the toolbar shows Fit 1 page, Compact / Normal / Spacious and the page-count badge,
   - column borders drag and widths persist,
   - Print / Export PDF output matches the preview.
4. If the controls are still missing on the live build after publishing, investigate as a real bug: compare the served JS bundle against the preview build and check for a build-time difference (persisted `localStorage` view state, or the controls being gated behind a condition that only holds in preview).

## Notes

No code changes are expected in step 1-3. Step 4 only runs if publishing doesn't resolve it, and any fix there would stay inside `src/components/document-preview.tsx`.
