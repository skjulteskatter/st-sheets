import { initializeApp } from "firebase/app";
import {
    AuthProvider,
    browserLocalPersistence,
    getAuth,
    GoogleAuthProvider,
    OAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    User,
} from "firebase/auth";
import { firebaseConfig } from "../config";

export const app = initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);

export type Provider = "google" | "apple";

const providers: Record<Provider, () => AuthProvider> = {
    google: () => new GoogleAuthProvider(),
    apple: () => {
        const p = new OAuthProvider("apple.com");
        p.addScope("email");
        p.addScope("name");
        return p;
    },
};

/** The API only accepts verified accounts (same rule as st-frontend/presentation). */
const isUsable = (u: User | null) => u?.emailVerified === true;

function errorMessage(e: unknown): string {
    const code = (e as { code?: string } | null)?.code;
    switch (code) {
        case "auth/invalid-email":
            return "Invalid email address.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
            return "Wrong email or password.";
        case "auth/too-many-requests":
            return "Too many attempts. Wait a few minutes and try again.";
        case "auth/popup-closed-by-user":
        case "auth/cancelled-popup-request":
            return "";
        case "auth/popup-blocked":
            return "The login popup was blocked by the browser.";
        case "auth/account-exists-with-different-credential":
            return "This email is registered with another login method.";
        default:
            return "Login failed. Please try again.";
    }
}

export class AuthException extends Error {}

export class Auth {
    get authenticated() {
        return this._loggedIn === true;
    }

    private _loggedIn: boolean | null = null;
    setLoggedIn(value: boolean) {
        this._loggedIn = value;
        for (const hook of this._loginHooks) {
            hook();
        }
    }

    private _loginHooks: (() => any)[] = [];
    onStateUpdate(hook: () => any) {
        this._loginHooks.push(hook);
    }

    get loading() {
        return this._loggedIn === null;
    }

    private async afterLogin(user: User) {
        if (!isUsable(user)) {
            await signOut(firebaseAuth);
            throw new AuthException(
                "Your email is not verified. Verify it from the email we sent you, then try again.",
            );
        }
    }

    async login(provider: Provider) {
        await firebaseAuth.setPersistence(browserLocalPersistence);
        try {
            const result = await signInWithPopup(firebaseAuth, providers[provider]());
            await this.afterLogin(result.user);
        } catch (e) {
            if (e instanceof AuthException) throw e;
            const message = errorMessage(e);
            if (message) throw new AuthException(message);
        }
    }

    async loginWithEmail(email: string, password: string) {
        await firebaseAuth.setPersistence(browserLocalPersistence);
        let user: User;
        try {
            user = (await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)).user;
        } catch (e) {
            throw new AuthException(errorMessage(e));
        }
        await this.afterLogin(user);
    }

    async resetPassword(email: string) {
        try {
            await sendPasswordResetEmail(firebaseAuth, email.trim());
        } catch (e) {
            throw new AuthException(errorMessage(e));
        }
    }

    logout() {
        signOut(firebaseAuth)
    }

    async getToken() {
        if (!this.authenticated) {
            return null;
        }
        return (await firebaseAuth.currentUser?.getIdToken()) ?? null;
    }
}

const auth = new Auth();

onAuthStateChanged(firebaseAuth, (u) => {
    auth.setLoggedIn(isUsable(u));
});

export default auth;
