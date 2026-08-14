import { useEffect } from "react";

/** Broadcast fired by the topbar "New" button so the active page opens its own create flow. */
export const CREATE_EVENT = "axel:open-create";

/** Subscribe a page's create action to the topbar "New" button. */
export function useCreateAction(onCreate: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = () => onCreate();
    window.addEventListener(CREATE_EVENT, handler);
    return () => window.removeEventListener(CREATE_EVENT, handler);
  }, [onCreate, enabled]);
}
