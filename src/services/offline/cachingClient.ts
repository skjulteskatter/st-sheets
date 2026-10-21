import { Client } from "hiddentreasures-js";
import * as store from "./store";
import { withLanguage, withoutLanguage } from "../language";

/**
 * API client that saves every GET/POST response in IndexedDB and serves it
 * from there when the network is unavailable, slow, or the server fails.
 *
 * Responses are stored under the exact request (method, path, body). Items
 * with an id from the model endpoints are also stored one by one, because the
 * library batches `get(id)` calls into `POST api/<Endpoint> {itemIds}` with
 * whatever ids happen to be requested together; those requests are rebuilt
 * from the single items when the exact request was never seen.
 */

const BASE_PATH = "https://api.songtreasures.app/";
const API_VERSION = "4.0";

/** How long to wait for the network before answering from the cache, if there is a cached answer. */
const CACHE_FALLBACK_MS = 5000;

/**
 * Song data that rarely changes: answered from the cache straight away when
 * cached, and refreshed in the background for next time (stale-while-revalidate).
 */
const CACHE_FIRST_PATH = /^api\/(Songs|Files|Collections|Contributors)(?:[/?]|$)/;

const MODEL_PATH = /^api\/(Songs|Files|Contributors|Collections|Sheets)(?:\/([^/?]+))?(?:\?.*)?$/;

type ClientOptions = ConstructorParameters<typeof Client>[0];
/**
 * What is stored: the response plus when it was saved (ms since epoch).
 * `pinned` marks responses saved by a collection download, which "clear
 * viewed sheets" keeps.
 */
type Entry = { value: unknown; savedAt: number; pinned?: boolean };
type HttpError = { status: number; value: string };

function requestKey(method: string, path: string, body: unknown) {
    return `req:${method} ${path} ${typeof body === "string" ? body : ""}`;
}

function itemKey(endpoint: string, id: string) {
    return `item:${endpoint}:${id}`;
}

function parseBody(body: unknown): Record<string, unknown> | null {
    if (typeof body !== "string") return null;
    try {
        return JSON.parse(body);
    } catch {
        return null;
    }
}

function hasId(value: unknown): value is { id: string } {
    return typeof (value as { id?: unknown } | null)?.id === "string";
}

function isHttpError(e: unknown): e is HttpError {
    return typeof (e as HttpError | null)?.status === "number";
}

async function save(key: string, path: string, value: unknown, pin: boolean) {
    if (value === undefined) return;
    const values: [string, unknown][] = [[key, value]];
    const endpoint = MODEL_PATH.exec(path)?.[1];
    if (endpoint) {
        for (const item of Array.isArray(value) ? value : [value]) {
            if (hasId(item)) values.push([itemKey(endpoint, item.id), item]);
        }
    }
    // Refreshing a downloaded response (e.g. viewing it online) must keep it pinned
    const existing = pin ? [] : await store.getMany<Entry>(values.map(([k]) => k));
    const savedAt = Date.now();
    await store.setMany(
        values.map(([k, v], i): [string, Entry] => [
            k,
            { value: v, savedAt, pinned: pin || existing[i]?.pinned || undefined },
        ]),
    );
}

async function lookup(method: string, path: string, body: unknown): Promise<unknown> {
    const exact = await store.get<Entry>(requestKey(method, path, body));
    if (exact !== undefined) return exact.value;
    // Saved before the language setting, e.g. an earlier offline download
    const legacyPath = withoutLanguage(path);
    if (legacyPath !== path) {
        const legacy = await store.get<Entry>(requestKey(method, legacyPath, body));
        if (legacy !== undefined) return legacy.value;
    }

    const [, endpoint, id] = MODEL_PATH.exec(path) ?? [];
    if (!endpoint) return undefined;
    if (method === "GET" && id) {
        return (await store.get<Entry>(itemKey(endpoint, id)))?.value;
    }
    const itemIds = parseBody(body)?.itemIds;
    if (method === "POST" && !id && Array.isArray(itemIds)) {
        const items = await store.getMany<Entry>(itemIds.map((i) => itemKey(endpoint, String(i))));
        return items.every((i) => i !== undefined) ? items.map((i) => i!.value) : undefined;
    }
    return undefined;
}

export class CachingClient extends Client {
    private readonly cacheFirst: boolean;
    private readonly pin: boolean;

    /**
     * @param cacheFirst answer song data (CACHE_FIRST_PATH) from the cache when
     *   available. Off for the offline download, which needs fresh `updatedAt`s.
     * @param pin mark saved responses as downloaded, so clearing viewed sheets keeps them.
     */
    constructor(options: ClientOptions & { cacheFirst?: boolean; pin?: boolean }) {
        const { cacheFirst = true, pin = false, ...rest } = options;
        super({ ...rest, basePath: BASE_PATH, apiVersion: API_VERSION });
        this.cacheFirst = cacheFirst;
        this.pin = pin;
    }

    async apifetch(path: string, options: RequestInit, bypassAuth = false, json = true): Promise<any> {
        // Part of the path, so cached responses are per language
        path = withLanguage(path);
        const method = options.method ?? "GET";
        if (method !== "GET" && method !== "POST") {
            return this.fetchNetwork(path, options, bypassAuth, json);
        }

        const key = requestKey(method, path, options.body);
        const fromCache = async (error: unknown) => {
            const cached = await lookup(method, path, options.body);
            if (cached === undefined) throw error;
            return cached;
        };

        if (!navigator.onLine) {
            return fromCache(new OfflineError(path));
        }

        const network = () =>
            this.fetchNetwork(path, options, bypassAuth, json).then(async (value) => {
                await save(key, path, value, this.pin);
                return value;
            });

        if (this.cacheFirst && CACHE_FIRST_PATH.test(path)) {
            const cached = await lookup(method, path, options.body);
            if (cached !== undefined) {
                network().catch(() => {});
                return cached;
            }
        }

        return this.networkFirst(network(), method, path, options.body);
    }

    private async networkFirst(network: Promise<unknown>, method: string, path: string, body: unknown) {
        const fromCache = async (error: unknown) => {
            const cached = await lookup(method, path, body);
            if (cached === undefined) throw error;
            return cached;
        };

        const timedOut = Symbol();
        let result: unknown;
        try {
            result = await Promise.race([
                network,
                new Promise((r) => setTimeout(() => r(timedOut), CACHE_FALLBACK_MS)),
            ]);
        } catch (e) {
            // The server answered: only fall back to the cache when it failed, not on 4xx
            if (isHttpError(e) && e.status < 500) throw e;
            return fromCache(e);
        }
        if (result !== timedOut) return result;

        // Slow network: answer from the cache if possible, the request keeps running and updates it
        const cached = await lookup(method, path, body);
        if (cached !== undefined) {
            network.catch(() => {});
            return cached;
        }
        return network;
    }

    /** Same as BaseClient.apifetch, but throws instead of resolving undefined on errors. */
    private async fetchNetwork(path: string, options: RequestInit, bypassAuth: boolean, json: boolean) {
        const token = await this.getToken();
        if (!token && !bypassAuth) {
            throw new Error("No Authorization token available " + path);
        }
        const response = await fetch(BASE_PATH + path, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                "X-Api-Version": API_VERSION,
                ...(options.headers as Record<string, string> | undefined),
            },
        });
        await this.validateResponse(response);
        return this.parseJson(response, json);
    }
}

export class OfflineError extends Error {
    constructor(path: string) {
        super("Offline and not available offline: " + path);
    }
}

/**
 * When the response to `POST <path>` with `content` was saved, or undefined
 * if it isn't cached. `content` is serialized the same way as `Client.post`.
 */
export async function cachedPostAt(path: string, content: unknown): Promise<number | undefined> {
    return (await store.get<Entry>(requestKey("POST", path, JSON.stringify(content))))?.savedAt;
}

/** The cached response to `POST <path>` with `content`, or undefined if it isn't cached. */
export function cachedPost<T>(path: string, content: unknown): Promise<T | undefined> {
    return lookup("POST", path, JSON.stringify(content)) as Promise<T | undefined>;
}

/**
 * Saves `value` as the response to `POST <path>` with `content`, as if it had
 * been fetched. For answers derived from a bigger request, so the app's own
 * smaller requests find them offline.
 */
export function seedPost(path: string, content: unknown, value: unknown, pin: boolean): Promise<void> {
    return save(requestKey("POST", path, JSON.stringify(content)), path, value, pin);
}

export const clearCache = store.clear;

/** Marks the cached response to `POST <path>` with `content` as downloaded, if cached. */
export async function pinCachedPost(path: string, content: unknown): Promise<void> {
    const key = requestKey("POST", path, JSON.stringify(content));
    const entry = await store.get<Entry>(key);
    if (entry && !entry.pinned) {
        await store.setMany([[key, { ...entry, pinned: true }]]);
    }
}

/** Approximate stored size in bytes. Rendered sheets are SVG strings, mostly ASCII, so characters ≈ bytes. */
export function approximateSize(value: unknown): number {
    if (typeof value === "string") return value.length;
    if (Array.isArray(value)) return value.reduce((sum: number, v) => sum + approximateSize(v), 0);
    return JSON.stringify(value)?.length ?? 0;
}

const SHEET_RENDER_PREFIX = requestKey("POST", "api/Sheets", "");

/** A rendered sheet saved by viewing it, not by a collection download. */
function isUnpinnedSheet(key: string, entry: Entry) {
    return key.startsWith(SHEET_RENDER_PREFIX) && !entry.pinned;
}

export type SheetCacheSize = { count: number; bytes: number };

/**
 * How many rendered sheets are saved, and roughly how many bytes they take:
 * downloaded ones (`pinned`) or viewed ones.
 */
export async function measureSheets(pinned: boolean): Promise<SheetCacheSize> {
    const size = { count: 0, bytes: 0 };
    await store.forEach<Entry>((key, entry) => {
        if (key.startsWith(SHEET_RENDER_PREFIX) && !!entry.pinned === pinned) {
            size.count++;
            size.bytes += key.length + approximateSize(entry.value);
        }
    });
    return size;
}

/** Deletes viewed (not downloaded) sheets; resolves to how many and roughly how many bytes. */
export async function clearUnpinnedSheets(): Promise<SheetCacheSize> {
    let bytes = 0;
    const count = await store.removeWhere<Entry>((key, entry) => {
        const remove = isUnpinnedSheet(key, entry);
        if (remove) bytes += key.length + approximateSize(entry.value);
        return remove;
    });
    return { count, bytes };
}
