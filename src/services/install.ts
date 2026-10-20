import { computed, ref } from "vue";

/**
 * Install-as-app state. Chrome/Edge/Android fire `beforeinstallprompt`, which
 * is kept to show the browser's install dialog later. iOS Safari has no such
 * event: the app can only point to Share → Add to Home Screen.
 *
 * Imported from main.ts so the event, which fires early, is never missed.
 */

type BeforeInstallPromptEvent = Event & {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "installPromptDismissedAt";
/** Ask again this long after "Not now". */
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);

const installed = ref(
    window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
);

function readDismissed() {
    try {
        const at = parseInt(localStorage.getItem(DISMISSED_KEY) ?? "");
        return !!at && Date.now() - at < DISMISS_FOR_MS;
    } catch {
        return false;
    }
}
const dismissed = ref(readDismissed());

// iPadOS reports itself as a Mac; touch support tells them apart
const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
// Only Safari can add to the home screen on older iOS; other iOS browsers can't install at all
const isIosSafari = isIos && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt.value = e as BeforeInstallPromptEvent;
});

window.addEventListener("appinstalled", () => {
    installed.value = true;
    deferredPrompt.value = null;
});

/** What to offer: the browser's install dialog, iOS instructions, or nothing. */
export const installOffer = computed<"prompt" | "ios" | null>(() => {
    if (installed.value || dismissed.value) return null;
    if (deferredPrompt.value) return "prompt";
    if (isIosSafari) return "ios";
    return null;
});

export async function install() {
    const prompt = deferredPrompt.value;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event can only be used once
    deferredPrompt.value = null;
    if (outcome === "dismissed") dismissInstall();
}

export function dismissInstall() {
    dismissed.value = true;
    try {
        localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    } catch {
        // Storage unavailable: hidden for this session only
    }
}
