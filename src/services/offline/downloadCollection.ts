import { CollectionService, ContributorService, SheetService, SongService } from "hiddentreasures-js";
import { downloadClient as client } from "../hiddentreasures/client";
import { cachedRenderSize, pinRender, renderedAt, renderSheet } from "../sheetRender";
import { approximateSize, seedPost } from "./cachingClient";
import type { Clef } from "../sheetState";

export type DownloadProgress = {
    done: number;
    total: number;
    /** Sheets already downloaded and unchanged since, so not rendered again. */
    skipped: number;
    /** Roughly how many bytes the collection's sheets take on the device so far. */
    bytes: number;
    /** Titles of songs where a request failed. */
    failed: string[];
};

// Two in flight overlaps one sheet's network round trips with another's render.
// st-utilities renders one sheet at a time per instance, so more mostly takes
// render capacity from people viewing sheets.
const CONCURRENCY = 2;
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
/** The fields of a file (`POST api/Files`) the download needs. */
type RawFile = { id: string; songId: string; type: string; updatedAt: string };

/**
 * Fetches every file of the collection's songs in one request, and saves it
 * per song in the shape `FileService.childrenOf(songId)` requests it
 * (`{ parentIds: [songId] }`), so the viewer finds each song's files offline.
 * Songs without files get an empty list.
 */
async function fetchFilesBySong(collectionId: string, songIds: string[]) {
    const files = await client.post<RawFile[]>("api/Files", { collectionIds: [collectionId] });
    const bySong = new Map<string, RawFile[]>(songIds.map((id) => [id, []]));
    for (const file of files) {
        bySong.get(file.songId)?.push(file);
    }
    for (const [songId, songFiles] of bySong) {
        await seedPost("api/Files", { parentIds: [songId] }, songFiles, true);
    }
    return bySong;
}

export async function downloadCollection(
    collectionId: string,
    options: { transposition: number; clef: Clef },
    onProgress: (progress: DownloadProgress) => void,
    signal: AbortSignal,
) {
    await new CollectionService(client).list();
    const songs = await new SongService(client).childrenOf(collectionId);

    // All contributors in one request, the same one the app makes for credits
    await new ContributorService(client).list();

    const filesBySong = await fetchFilesBySong(collectionId, songs.map((s) => s.id));

    const progress: DownloadProgress = { done: 0, total: songs.length, skipped: 0, bytes: 0, failed: [] };
    onProgress({ ...progress });

    const sheetService = new SheetService(client);
    const queue = [...songs];
    let consecutiveFailures = 0;
    const worker = async () => {
        for (let song = queue.shift(); song && !signal.aborted; song = queue.shift()) {
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                throw new RenderServiceDownError("Sheet rendering keeps failing");
            }
            try {
                const sheets = (filesBySong.get(song.id) ?? []).filter((f) => f.type === "sheetmusic");
                for (const sheet of sheets) {
                    if (signal.aborted) return;
                    const savedAt = await renderedAt(sheet.id, options.transposition, options.clef);
                    if (savedAt !== undefined && savedAt > Date.parse(sheet.updatedAt) + BACKEND_CACHE_MARGIN_MS) {
                        // May have been saved by viewing it; keep it when viewed sheets are cleared
                        await pinRender(sheet.id, options.transposition, options.clef);
                        progress.bytes += await cachedRenderSize(sheet.id, options.transposition, options.clef);
                        progress.skipped++;
                        continue;
                    }
                    const pages = await withRetry(
                        () => renderSheet(sheet.id, options.transposition, options.clef, { service: sheetService }),
                        signal,
                    );
                    progress.bytes += approximateSize(pages);
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
