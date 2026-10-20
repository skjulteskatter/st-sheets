import { CollectionService, ContributorService, FileService, SongService } from "hiddentreasures-js";
import client from "../hiddentreasures/client";
import { getSheetFiles, renderedAt, renderSheet } from "../sheetRender";
import type { Clef } from "../sheetState";

export type DownloadProgress = {
    done: number;
    total: number;
    /** Sheets already downloaded and unchanged since, so not rendered again. */
    skipped: number;
    /** Titles of songs where a request failed. */
    failed: string[];
};

// The render service (st-utilities) runs out of memory with several renders
// in flight, so the download renders one sheet at a time and backs off on errors.
const CONCURRENCY = 1;
const CONTRIBUTOR_CHUNK = 100;
const RETRY_DELAYS_MS = [2000, 5000, 15000];
/**
 * A saved render only counts as up to date if it was saved this long after the
 * file changed: the backend may serve renders made before the change for up to
 * ~10 minutes (ST.API sheet details and render caches, ST.Utilities file cache).
 */
const BACKEND_CACHE_MARGIN_MS = 15 * 60 * 1000;
/** Give up after this many songs in a row fail: the render service is likely down. */
const MAX_CONSECUTIVE_FAILURES = 5;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(action: () => Promise<T>, signal: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await action();
        } catch (e) {
            const status = (e as { status?: number } | null)?.status;
            const retryable = status === undefined || status >= 500;
            if (!retryable || attempt >= RETRY_DELAYS_MS.length || signal.aborted) throw e;
            await delay(RETRY_DELAYS_MS[attempt]);
        }
    }
}

export class RenderServiceDownError extends Error {}

/**
 * Makes a collection available offline in one key: fetches the collection
 * list, its songs, their credits, and renders every sheet of every song.
 * Every response lands in the offline cache through the caching client.
 * Sheets already rendered after the file was last updated are skipped, so
 * downloading again only renders new or changed sheets.
 *
 * Fresh service instances are used so the library's in-memory caches can't
 * skip a request that has to reach the offline cache.
 */
export async function downloadCollection(
    collectionId: string,
    options: { transposition: number; clef: Clef },
    onProgress: (progress: DownloadProgress) => void,
    signal: AbortSignal,
) {
    await new CollectionService(client).list();
    const songs = await new SongService(client).childrenOf(collectionId);

    const contributorIds = [...new Set(songs.flatMap((s) => s.participants.map((p) => p.contributorId)))];
    const contributors = new ContributorService(client);
    for (let i = 0; i < contributorIds.length; i += CONTRIBUTOR_CHUNK) {
        await contributors.retrieve({ itemIds: contributorIds.slice(i, i + CONTRIBUTOR_CHUNK) });
    }

    const progress: DownloadProgress = { done: 0, total: songs.length, skipped: 0, failed: [] };
    onProgress({ ...progress });

    const queue = [...songs];
    let consecutiveFailures = 0;
    const worker = async () => {
        for (let song = queue.shift(); song && !signal.aborted; song = queue.shift()) {
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                throw new RenderServiceDownError("Sheet rendering keeps failing");
            }
            try {
                const sheets = await getSheetFiles(song.id, new FileService(client));
                for (const sheet of sheets) {
                    if (signal.aborted) return;
                    const savedAt = await renderedAt(sheet.id, options.transposition, options.clef);
                    if (savedAt !== undefined && savedAt > Date.parse(sheet.updatedAt) + BACKEND_CACHE_MARGIN_MS) {
                        progress.skipped++;
                        continue;
                    }
                    await withRetry(() => renderSheet(sheet.id, options.transposition, options.clef), signal);
                }
                consecutiveFailures = 0;
            } catch (e) {
                consecutiveFailures++;
                console.error(e);
                progress.failed.push(`${song.getNumber(collectionId) ?? ""} ${song.title}`.trim());
            }
            progress.done++;
            onProgress({ ...progress, failed: [...progress.failed] });
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // Ask the browser not to evict the cache under storage pressure (best effort)
    await navigator.storage?.persist?.().catch(() => false);
}
