/**
 * Language for titles from the API (collections, songs), chosen in Settings.
 * Without it the API uses the account's language, and falls back to whichever
 * translation comes first, so the default is English.
 */

/** The languages the API knows (ST/Language.cs). */
export const languages = [
    { key: "en", name: "English" },
    { key: "da", name: "Dansk" },
    { key: "de", name: "Deutsch" },
    { key: "es", name: "Español" },
    { key: "fr", name: "Français" },
    { key: "it", name: "Italiano" },
    { key: "hu", name: "Magyar" },
    { key: "nl", name: "Nederlands" },
    { key: "no", name: "Norsk" },
    { key: "pl", name: "Polski" },
    { key: "pt", name: "Português" },
    { key: "ro", name: "Română" },
    { key: "sl", name: "Slovenščina" },
    { key: "fi", name: "Suomi" },
    { key: "sv", name: "Svenska" },
    { key: "tr", name: "Türkçe" },
    { key: "ru", name: "Русский" },
    { key: "zh", name: "汉语/漢語" },
];

const STORAGE_KEY = "language";

function read() {
    try {
        return localStorage.getItem(STORAGE_KEY) ?? "en";
    } catch {
        return "en";
    }
}

/** Fixed for the page's lifetime: the API library keeps models in memory, so a change reloads the page. */
export const language = read();

export function setLanguage(key: string) {
    if (key === language) return;
    if (key === "en") {
        localStorage.removeItem(STORAGE_KEY);
    } else {
        localStorage.setItem(STORAGE_KEY, key);
    }
    location.reload();
}

/** The endpoints whose titles are translated. Not Sheets: renders don't depend on it, and their cache is matched by path. */
const TRANSLATED_PATH = /^api\/(Songs|Collections)(?:[/?]|$)/;

/** Adds `language` to a path of a translated endpoint unless it already has one. */
export function withLanguage(path: string) {
    if (!TRANSLATED_PATH.test(path) || /[?&]language=/.test(path)) return path;
    return path + (path.includes("?") ? "&" : "?") + "language=" + encodeURIComponent(language);
}

/** The path without a `language` param, as it was requested before the setting existed. */
export function withoutLanguage(path: string) {
    return path.replace(/([?&])language=[^&]*(&|$)/, (_, sep, end) => (end ? sep : "")).replace(/[?&]$/, "");
}
