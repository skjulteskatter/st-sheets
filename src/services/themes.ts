let prefersDark = false;

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    prefersDark = true;
}

export type Theme = "dark" | "light" | null

const addClass = (c: string) => {
    if (!document.documentElement.classList.contains(c)) {
        document.documentElement.classList.add(c)
    }
}

const removeClass = (c: string) => {
    if (document.documentElement.classList.contains(c)) {
        document.documentElement.classList.remove(c)
    }
}

class Themes {
    init() {
        const saved = localStorage.getItem("theme")
        if (saved === "dark") {
            addClass("dark")
        } else if (saved === "light") {
            removeClass("dark")
        } else if (prefersDark) {
            addClass("dark")
        } else {
            removeClass("dark")
        }
    }

    set(theme: Theme) {
        if (theme) {
            localStorage.setItem("theme", theme)
        } else {
            localStorage.removeItem("theme")
        }
        this.init()
    }

    get() {
        return localStorage.getItem("theme") as Theme
    }
}

const themes = new Themes();

themes.init();

export default themes;