import { reactive } from "vue";
import type { Unsubscribe } from "firebase/firestore";
import { firebaseAuth } from "../auth";
import { bandSyncService } from "./bandSyncService";
import {
    ANOTHER_DEVICE_LEADING,
    BandSyncException,
    BandSyncRole,
    BandSyncSession,
    BandSyncSyncStatus,
    isLedByDevice,
} from "./bandSyncSession";

/**
 * Port of st-frontend's Vuex bandSync module (state + mutations + actions) for
 * st-sheets, which has no Vuex. Behaviour and guards are kept 1:1.
 */

export type State = {
    role: BandSyncRole;
    syncStatus: BandSyncSyncStatus;
    followingLeaderUpdates: boolean;
    code: string | null;
    songbookId: string | null;
    session: BandSyncSession | null;
    isProcessing: boolean;
    errorMessage: string | null;
};

const initialState = (): State => ({
    role: "none",
    syncStatus: "inSync",
    followingLeaderUpdates: true,
    code: null,
    songbookId: null,
    session: null,
    isProcessing: false,
    errorMessage: null,
});

export const bandSyncState = reactive(initialState());

type ActivePayload = {
    role: BandSyncRole;
    code: string;
    songbookId: string;
    session?: BandSyncSession | null;
    /** When set for members, restores persisted follow preference. */
    followingLeaderUpdates?: boolean;
};

// --- mutations ---

function reset() {
    Object.assign(bandSyncState, initialState());
}

function setActive(payload: ActivePayload) {
    bandSyncState.role = payload.role;
    const followingLeaderUpdates =
        payload.role === "member"
            ? payload.followingLeaderUpdates !== false
            : true;
    bandSyncState.followingLeaderUpdates = followingLeaderUpdates;
    bandSyncState.syncStatus =
        payload.role === "member" && !followingLeaderUpdates
            ? "outOfSync"
            : "inSync";
    bandSyncState.code = payload.code;
    bandSyncState.songbookId = payload.songbookId;
    bandSyncState.session = payload.session ?? null;
    bandSyncState.isProcessing = false;
    bandSyncState.errorMessage = null;
}

function setError(errorMessage: string | null) {
    bandSyncState.errorMessage = errorMessage;
    bandSyncState.isProcessing = false;
}

function setErrorFrom(error: unknown) {
    setError(
        error instanceof BandSyncException
            ? error.message
            : START_SESSION_GENERIC_ERROR,
    );
}

// --- actions ---

const START_SESSION_TIMEOUT_MS = 15_000;
const START_SESSION_TIMEOUT_ERROR =
    "Connection timed out. Check your internet and try again.";
const START_SESSION_GENERIC_ERROR =
    "Something went wrong. Please try again.";
const SESSION_LISTENER_ERROR =
    "Lost connection to the band session. Leave and rejoin to continue syncing.";

let startSessionGeneration = 0;
let sessionUnsubscribe: Unsubscribe | null = null;

function listenToSession(code: string) {
    sessionUnsubscribe?.();
    sessionUnsubscribe = bandSyncService.watchSession(
        code,
        (session) => sessionSnapshot(session),
        () => {
            stopListening();
            setError(SESSION_LISTENER_ERROR);
            bandSyncState.syncStatus = "outOfSync";
        },
    );
}

function stopListening() {
    sessionUnsubscribe?.();
    sessionUnsubscribe = null;
}

/** Persist + commit a demotion to member (another device took the lead). */
function demoteToMember(code: string, songbookId: string, session: BandSyncSession) {
    bandSyncService.savePersistedSession({
        code,
        role: "member",
        songbookId,
        followingLeaderUpdates: true,
    });
    setActive({
        role: "member",
        code,
        songbookId,
        session,
        followingLeaderUpdates: true,
    });
}

async function startSession(
    createOrJoin: () => Promise<BandSyncSession>,
    role: BandSyncRole,
) {
    const operationId = ++startSessionGeneration;
    setError(null);
    bandSyncState.isProcessing = true;

    try {
        const session = await Promise.race([
            createOrJoin(),
            new Promise<never>((_, reject) => {
                setTimeout(
                    () => reject(new BandSyncException(START_SESSION_TIMEOUT_ERROR)),
                    START_SESSION_TIMEOUT_MS,
                );
            }),
        ]);

        if (operationId !== startSessionGeneration) return;

        bandSyncService.savePersistedSession({
            code: session.code,
            role,
            songbookId: session.songbookId,
            followingLeaderUpdates: role === "member" ? true : undefined,
        });

        setActive({
            role,
            code: session.code,
            songbookId: session.songbookId,
            session,
            followingLeaderUpdates: role === "member" ? true : undefined,
        });

        listenToSession(session.code);
    } catch (error) {
        if (operationId !== startSessionGeneration) return;
        setErrorFrom(error);
    }
}

export async function init(): Promise<void> {
    const persisted = bandSyncService.readPersistedSession();
    if (!persisted || persisted.role === "none") {
        return;
    }

    setActive({
        role: persisted.role,
        code: persisted.code,
        songbookId: persisted.songbookId,
        followingLeaderUpdates: persisted.followingLeaderUpdates,
    });

    listenToSession(persisted.code);

    // Re-stamp this tab's device claim so a second window with a shared
    // legacy localStorage identity cannot keep publishing as leader.
    if (persisted.role === "leader") {
        try {
            const session = await bandSyncService.claimLead({
                code: persisted.code,
            });
            bandSyncService.savePersistedSession({
                code: persisted.code,
                role: "leader",
                songbookId: session.songbookId,
            });
            setActive({
                role: "leader",
                code: persisted.code,
                songbookId: session.songbookId,
                session,
            });
        } catch {
            // Snapshot demotion / auth errors are handled elsewhere.
        }
    }
}

export function createSession(payload: {
    songbookId: string;
    songNumber: number;
    transposition: number;
}): Promise<void> {
    return startSession(() => bandSyncService.createSession(payload), "leader");
}

export function joinSession(code: string): Promise<void> {
    return startSession(() => bandSyncService.joinSession(code), "member");
}

export function cancelStart(): void {
    startSessionGeneration++;
    bandSyncState.isProcessing = false;
    setError(null);
}

export async function leaveSession(): Promise<void> {
    stopListening();

    if (bandSyncState.role === "leader" && bandSyncState.code) {
        try {
            await bandSyncService.endSession({ code: bandSyncState.code });
        } catch {
            // swallow errors
        }
    }

    bandSyncService.clearPersistedSession();
    reset();
}

export async function renewSession(): Promise<void> {
    const { role, code, session } = bandSyncState;
    if (role !== "leader" || !code || !session) {
        return;
    }

    setError(null);
    bandSyncState.isProcessing = true;

    try {
        const expireAt = await bandSyncService.renewSession({ code });
        bandSyncState.session = { ...session, expireAt };
    } catch (error) {
        setErrorFrom(error);
    } finally {
        bandSyncState.isProcessing = false;
    }
}

export async function takeLead(): Promise<void> {
    const { role, code, songbookId, session } = bandSyncState;
    if (role !== "member" || !code || !songbookId || !session) {
        return;
    }

    const uid = firebaseAuth.currentUser?.uid;
    if (!uid || session.leaderId !== uid) {
        return;
    }

    setError(null);
    bandSyncState.isProcessing = true;

    try {
        const claimed = await bandSyncService.claimLead({ code });

        bandSyncService.savePersistedSession({
            code,
            role: "leader",
            songbookId,
        });

        setActive({
            role: "leader",
            code,
            songbookId,
            session: claimed,
        });
    } catch (error) {
        setErrorFrom(error);
    } finally {
        bandSyncState.isProcessing = false;
    }
}

export async function leaderPublish(payload: {
    songbookId: string;
    songNumber: number;
    transposition: number;
}): Promise<void> {
    if (bandSyncState.role !== "leader" || !bandSyncState.code) {
        return;
    }

    try {
        await bandSyncService.updateSession({
            code: bandSyncState.code,
            ...payload,
        });

        if (bandSyncState.session) {
            bandSyncState.session = {
                ...bandSyncState.session,
                songbookId: payload.songbookId,
                songNumber: payload.songNumber,
                transposition: payload.transposition,
                updatedAt: new Date(),
            };
        }
    } catch (error) {
        const { code, songbookId, session } = bandSyncState;
        // Another device claimed leadership — demote locally.
        if (
            error instanceof BandSyncException &&
            error.message === ANOTHER_DEVICE_LEADING &&
            code &&
            songbookId &&
            session
        ) {
            demoteToMember(code, songbookId, session);
            return;
        }
        setErrorFrom(error);
    }
}

export function setMemberSyncStatus(syncStatus: BandSyncSyncStatus): void {
    if (bandSyncState.role !== "member" || bandSyncState.syncStatus === syncStatus) {
        return;
    }
    bandSyncState.syncStatus = syncStatus;
}

export function memberSynced(): void {
    setMemberSyncStatus("inSync");
}

export function setFollowingLeaderUpdates(enabled: boolean): void {
    if (bandSyncState.role !== "member") {
        return;
    }

    bandSyncState.followingLeaderUpdates = enabled;

    if (bandSyncState.code && bandSyncState.songbookId) {
        bandSyncService.savePersistedSession({
            code: bandSyncState.code,
            role: "member",
            songbookId: bandSyncState.songbookId,
            followingLeaderUpdates: enabled,
        });
    }

    if (!enabled) {
        bandSyncState.syncStatus = "outOfSync";
    }
}

function sessionSnapshot(session: BandSyncSession | null): void {
    if (!session) {
        sessionEnded();
        return;
    }

    // Another device claimed leadership — demote this install to member.
    if (bandSyncState.role === "leader" && bandSyncState.code) {
        if (!isLedByDevice(session, bandSyncService.getDeviceId())) {
            demoteToMember(bandSyncState.code, session.songbookId, session);
            return;
        }
    }

    bandSyncState.session = session;
}

function sessionEnded(): void {
    stopListening();
    bandSyncService.clearPersistedSession();
    reset();
}

export function isBandSyncActive(): boolean {
    return bandSyncState.role !== "none" && bandSyncState.code != null;
}
