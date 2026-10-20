import { watch } from "vue";
import { getCollectionSongs } from "../collectionData";
import {
    applyRemoteSong,
    applyRemoteTransposition,
    collectionId,
    instrument,
    sheetEdit,
    sheetTransposition,
    songId,
    songNumber,
} from "../sheetState";
import {
    bandSyncState,
    leaderPublish,
    memberSynced,
    setFollowingLeaderUpdates,
    setMemberSyncStatus,
} from "./bandSyncStore";
import {
    BandSyncSession,
    hasLeaderStateChangedComparedTo,
    matchesSheetEdit,
    matchesSongState,
    samePitchClass,
    sessionTranspositionFromApi,
    toSheetApiTransposition,
} from "./bandSyncSession";

function songKey(songbookId: string, songNumber: number): string {
    return `${songbookId}:${songNumber}`;
}

function instrumentOffset(): number {
    return parseInt(instrument.value ?? "0") || 0;
}

/** st-sheets port of st-frontend's BandSyncSongCoordinator, driven by sheetState. */
class BandSyncCoordinator {
    private isApplying = false;
    private lastSeenRemoteSession: BandSyncSession | null = null;
    /** Last local song identity we observed; used to detect member-initiated navigation. */
    private lastLocalSongKey: string | null = null;
    private unwatch: (() => void) | null = null;

    start(): void {
        const initial = this.getLocalState();
        this.lastLocalSongKey = songKey(initial.songbookId, initial.songNumber);

        this.unwatch = watch(
            () => ({
                role: bandSyncState.role,
                syncStatus: bandSyncState.syncStatus,
                followingLeaderUpdates: bandSyncState.followingLeaderUpdates,
                code: bandSyncState.code,
                sessionTransposition: bandSyncState.session?.transposition,
                sessionSongNumber: bandSyncState.session?.songNumber,
                sessionSongbookId: bandSyncState.session?.songbookId,
                sessionUpdatedAt: bandSyncState.session?.updatedAt?.getTime(),
                sessionSheetFileId: bandSyncState.session?.sheetFileId,
                sessionSheetEditId: bandSyncState.session?.sheetEditId,
                collectionId: collectionId.value,
                songId: songId.value,
                songNumber: songNumber.value,
                sheetTransposition: sheetTransposition.value,
                instrument: instrument.value,
                sheetFileId: sheetEdit.value?.fileId,
                sheetEditId: sheetEdit.value?.editId,
            }),
            () => this.onChange(),
            { deep: true },
        );

        this.onChange();
    }

    dispose(): void {
        this.unwatch?.();
        this.unwatch = null;
        this.lastSeenRemoteSession = null;
        this.lastLocalSongKey = null;
    }

    async resyncToLeader(): Promise<void> {
        const { role, session } = bandSyncState;
        if (!session || role !== "member") {
            return;
        }

        setFollowingLeaderUpdates(true);
        this.reportApplied(await this.applySession(session));
    }

    private onChange(): void {
        const session = bandSyncState.session;
        const leaderChanged =
            session != null &&
            hasLeaderStateChangedComparedTo(session, this.lastSeenRemoteSession);

        this.onBandSyncState(leaderChanged);
        this.onLocalChange(leaderChanged);
    }

    private reportApplied(applied: boolean): void {
        if (applied) {
            memberSynced();
        } else {
            setMemberSyncStatus("outOfSync");
        }
    }

    private getLocalState() {
        const songbookId = collectionId.value ?? "";
        const number = songId.value ? songNumber.value ?? 0 : 0;
        const transposition = sessionTranspositionFromApi(
            parseInt(sheetTransposition.value) || 0,
            instrumentOffset(),
        );
        // The sheet and version shown; followers apply it in SheetViewer
        const sheetFileId = sheetEdit.value?.fileId ?? null;
        const sheetEditId = sheetEdit.value?.editId ?? null;
        return { songbookId, songNumber: number, transposition, sheetFileId, sheetEditId };
    }

    private rememberLocalSong(): void {
        const { songbookId, songNumber } = this.getLocalState();
        this.lastLocalSongKey = songKey(songbookId, songNumber);
    }

    private onBandSyncState(leaderChanged: boolean): void {
        const isActive = bandSyncState.role !== "none" && bandSyncState.code != null;

        if (!isActive || !bandSyncState.session) {
            this.lastSeenRemoteSession = null;
            return;
        }

        if (bandSyncState.role === "leader") {
            this.lastSeenRemoteSession = bandSyncState.session;
            return;
        }

        const session = bandSyncState.session;

        const shouldApply =
            leaderChanged &&
            bandSyncState.followingLeaderUpdates &&
            !this.matchesLocal(session);

        this.lastSeenRemoteSession = session;

        if (!shouldApply) {
            return;
        }

        void this.applySession(session).then((applied) => this.reportApplied(applied));
    }

    private onLocalChange(leaderChanged: boolean): void {
        if (this.isApplying) return;

        const isActive = bandSyncState.role !== "none" && bandSyncState.code != null;
        const session = bandSyncState.session;

        if (!isActive || !session) return;

        const { songbookId, songNumber, transposition, sheetFileId, sheetEditId } = this.getLocalState();
        const localKey = songKey(songbookId, songNumber);
        const localSongChanged =
            this.lastLocalSongKey != null && this.lastLocalSongKey !== localKey;
        this.lastLocalSongKey = localKey;

        if (bandSyncState.role === "leader") {
            // Only publish when viewing a real song in a collection.
            if (!songbookId || songNumber <= 0) {
                return;
            }

            if (
                matchesSongState(session, songbookId, songNumber, transposition) &&
                matchesSheetEdit(session, sheetFileId, sheetEditId)
            ) {
                return;
            }

            void leaderPublish({ songbookId, songNumber, transposition, sheetFileId, sheetEditId });
            return;
        }

        if (bandSyncState.role === "member") {
            const inSync = matchesSongState(
                session,
                songbookId,
                songNumber,
                transposition,
            );

            // Unfollow only when the *member* navigated away from the session song.
            if (
                localSongChanged &&
                !leaderChanged &&
                bandSyncState.followingLeaderUpdates &&
                !inSync
            ) {
                setFollowingLeaderUpdates(false);
                return;
            }

            if (leaderChanged) {
                return;
            }

            setMemberSyncStatus(
                inSync && bandSyncState.followingLeaderUpdates ? "inSync" : "outOfSync",
            );
        }
    }

    private matchesLocal(session: BandSyncSession): boolean {
        const { songbookId, songNumber, transposition } = this.getLocalState();
        return matchesSongState(session, songbookId, songNumber, transposition);
    }

    private refreshMemberSyncStatus(): void {
        if (bandSyncState.role !== "member" || !bandSyncState.session) {
            return;
        }
        const inSync = this.matchesLocal(bandSyncState.session);
        setMemberSyncStatus(
            inSync && bandSyncState.followingLeaderUpdates ? "inSync" : "outOfSync",
        );
    }

    /**
     * Applies remote session to local song state.
     * @returns false when the song cannot be resolved (fail closed).
     */
    private async applySession(session: BandSyncSession): Promise<boolean> {
        if (this.isApplying) {
            return false;
        }
        this.isApplying = true;

        try {
            const { songbookId, songNumber, transposition } = this.getLocalState();
            const songChanged =
                session.songbookId !== songbookId || session.songNumber !== songNumber;
            const transpositionChanged = !samePitchClass(
                session.transposition,
                transposition,
            );

            if (!songChanged && !transpositionChanged) {
                return true;
            }

            const apiTransposition = toSheetApiTransposition(
                session.transposition,
                instrumentOffset(),
            );

            if (!songChanged) {
                applyRemoteTransposition(apiTransposition);
                return true;
            }

            if (session.songNumber <= 0) {
                return false;
            }

            const songs = await getCollectionSongs(session.songbookId);
            const target = songs.find(
                (s) => s.getNumber(session.songbookId) == session.songNumber,
            );
            if (!target) {
                return false;
            }

            applyRemoteSong({
                collectionId: session.songbookId,
                songId: target.id,
                songNumber: session.songNumber,
                sheetTransposition: apiTransposition,
            });

            return true;
        } catch {
            return false;
        } finally {
            this.isApplying = false;
            this.rememberLocalSong();
            this.refreshMemberSyncStatus();
        }
    }
}

let activeCoordinator: BandSyncCoordinator | null = null;

export function startBandSyncCoordinator(): void {
    activeCoordinator?.dispose();
    activeCoordinator = new BandSyncCoordinator();
    activeCoordinator.start();
}

export function stopBandSyncCoordinator(): void {
    activeCoordinator?.dispose();
    activeCoordinator = null;
}

export async function resyncBandSyncToLeader(): Promise<void> {
    await activeCoordinator?.resyncToLeader();
}
