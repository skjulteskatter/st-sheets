import { ref, watch } from "vue";

/**
 * Keeps the screen on while the app is visible (Screen Wake Lock API), so a
 * tablet on a music stand doesn't dim or lock mid-song. The browser releases
 * the lock whenever the app is hidden, so it is requested again when the app
 * becomes visible, and on every tap: iOS only grants it after a user gesture.
 */

const STORAGE_KEY = "keepScreenOn";

export const wakeLockSupported = "wakeLock" in navigator;

/** The "Keep screen on" setting, on unless turned off. */
export const keepScreenOn = ref(localStorage.getItem(STORAGE_KEY) !== "false");

let sentinel: WakeLockSentinel | null = null;
let requesting = false;

async function acquire() {
    if (!keepScreenOn.value || !wakeLockSupported || document.visibilityState !== "visible") return;
    if ((sentinel && !sentinel.released) || requesting) return;
    requesting = true;
    try {
        sentinel = await navigator.wakeLock.request("screen");
        sentinel.addEventListener("release", () => (sentinel = null));
    } catch {
        // Refused (no user gesture yet, low battery, ...); the next tap or visibility change retries
    } finally {
        requesting = false;
    }
}

async function release() {
    const s = sentinel;
    sentinel = null;
    await s?.release().catch(() => {});
}

watch(keepScreenOn, (on) => {
    localStorage.setItem(STORAGE_KEY, String(on));
    on ? acquire() : release();
});

document.addEventListener("visibilitychange", acquire);
document.addEventListener("pointerdown", acquire, { passive: true });
document.addEventListener("keydown", acquire);

acquire();
