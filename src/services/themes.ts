import { ref } from "vue";

export type Theme = "dark" | "light" | null

const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)')

/** The chosen theme; null follows the device. Reactive so the Settings selector stays in sync. */
const current = ref((localStorage.getItem("theme") as Theme) ?? null)

class Themes {
    init() {
        const dark = current.value ? current.value === "dark" : systemDark?.matches === true
        document.documentElement.classList.toggle("dark", dark)
    }

    set(theme: Theme) {
        current.value = theme
        if (theme) {
            localStorage.setItem("theme", theme)
        } else {
            localStorage.removeItem("theme")
        }
        this.init()
    }

    get() {
        return current.value
    }
}

const themes = new Themes();

themes.init();

// With "System", follow the device switching between light and dark
systemDark?.addEventListener?.("change", () => themes.init());

export default themes;
