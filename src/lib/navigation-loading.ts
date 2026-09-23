export const NAVIGATION_LOADING_START = "taiyo:navigation-loading-start";
export const NAVIGATION_LOADING_FINISH = "taiyo:navigation-loading-finish";

/**
 * Next's router does not emit a public "navigation started" event. Links are
 * detected centrally, while controls that call router.push() use this small
 * bridge so they receive the same cursor-level feedback.
 */
export function startNavigationLoading() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAVIGATION_LOADING_START));
}

/** Cancel feedback when work fails before router.push() can be reached. */
export function finishNavigationLoading() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAVIGATION_LOADING_FINISH));
}
