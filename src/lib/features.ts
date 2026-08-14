/**
 * Feature flags.
 * Flip a value here to enable/disable a whole feature surface (nav entry,
 * quick actions and routes) without deleting any code.
 */
export const FEATURES = {
  /** Axel AI assistant (chat threads). Hidden for now. */
  axelAI: false,
} as const;

export const AXEL_AI_ENABLED = FEATURES.axelAI;
