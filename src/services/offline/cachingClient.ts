import { Client } from "hiddentreasures-js";
import * as store from "./store";

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

const MODEL_PATH = /^api\/(Songs|Files|Contributors|Collections|Sheets)(?:\/([^/?]+))?(?:\?.*)?$/;

type ClientOptions = ConstructorParameters<typeof Client>[0];
/** What is stored: the response plus when it was saved (ms since epoch). */
type Entry = { value: unknown; savedAt: number };
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

async function save(key: string, path: string, value: unknown) {
    if (value === undefined) return;
    const savedAt = Date.now();
    const entries: [string, Entry][] = [[key, { value, savedAt }]];
    const endpoint = MODEL_PATH.exec(path)?.[1];
    if (endpoint) {
        for (const item of Array.isArray(value) ? value : [value]) {
            if (hasId(item)) entries.push([itemKey(endpoint, item.id), { value: item, savedAt }]);
        }
    }
    await store.setMany(entries);
}

async function lookup(method: string, path: string, body: unknown): Promise<unknown> {
    const exact = await store.get<Entry>(requestKey(method, path, body));
    if (exact !== undefined) return exact.value;

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
    constructor(options: ClientOptions) {
        super({ ...options, basePath: BASE_PATH, apiVersion: API_VERSION });
    }

    async apifetch(path: string, options: RequestInit, bypassAuth = false, json = true): Promise<any> {
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

        const network = this.fetchNetwork(path, options, bypassAuth, json).then(async (value) => {
            await save(key, path, value);
            return value;
        });

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
        const cached = await lookup(method, path, options.body);
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

export const clearCache = store.clear;
