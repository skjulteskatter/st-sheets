import type { Contributor, MediaFile, Song } from "hiddentreasures-js";
import { contributorService, fileService, songService } from "./hiddentreasures";

/**
 * The open collection's songs and their files, and all contributors, loaded
 * once instead of one request per song. Song details, files and credits are
 * looked up here first and only fall back to the API for anything missing (a
 * song outside the collection while switching, or a contributor added since
 * the list loaded).
 */

type CollectionData = {
    collectionId: string;
    songs: Promise<Song[]>;
    /** Files per song; every song in the collection has an entry, possibly empty. */
    files: Promise<Map<string, MediaFile[]>>;
};

/**
 * Every file of the collection's songs in one request. The API supports
 * `collectionIds` for files, the library's types just don't list it. The
 * offline download makes the same request, so its saved copy is found offline.
 */
function retrieveCollectionFiles(collectionId: string) {
    return fileService.retrieve({ collectionIds: [collectionId] } as unknown as Parameters<typeof fileService.retrieve>[0]);
}

let current: CollectionData | null = null;

/** Every contributor, one `GET api/Contributors` for the whole session, started when the first collection opens. */
let allContributors: Promise<Map<string, Contributor>> | null = null;

function loadContributors() {
    if (!allContributors) {
        const loading = contributorService.list().then((list) => new Map(list.map((c) => [c.id, c])));
        // A failed load is retried next time; credits fall back to per-song requests meanwhile
        loading.catch((e) => {
            console.error(e);
            if (allContributors === loading) allContributors = null;
        });
        allContributors = loading;
    }
    return allContributors;
}

function load(collectionId: string): CollectionData {
    if (current?.collectionId === collectionId) return current;

    const songs = songService.childrenOf(collectionId);
    const files = Promise.all([songs, retrieveCollectionFiles(collectionId)]).then(([songList, fileList]) => {
        const bySong = new Map<string, MediaFile[]>(songList.map((s) => [s.id, []]));
        for (const file of fileList) bySong.get(file.songId)?.push(file);
        return bySong;
    });
    // Files fall back to per-song requests if this fails; don't leave it unhandled
    files.catch((e) => console.error(e));
    loadContributors();

    current = { collectionId, songs, files };
    // A failed load is retried next time instead of being remembered
    songs.catch(() => {
        if (current?.songs === songs) current = null;
    });
    return current;
}

/** The collection's songs (a copy, safe to sort). Loads the collection's data if it isn't loaded yet. */
export async function getCollectionSongs(collectionId: string): Promise<Song[]> {
    return [...(await load(collectionId).songs)];
}

/** A song, from the open collection when it's there. */
export async function getSong(id: string): Promise<Song> {
    const songs = current ? await current.songs.catch(() => []) : [];
    return songs.find((s) => s.id === id) ?? songService.get(id);
}

/** A song's files, from the open collection when the song is in it. */
export async function getSongFiles(songId: string): Promise<MediaFile[]> {
    const bySong = current ? await current.files.catch(() => null) : null;
    return bySong?.get(songId) ?? fileService.childrenOf(songId);
}

/** Contributors by id, from the full contributor list when they're there. */
export async function getContributors(ids: string[]): Promise<Contributor[]> {
    const known = await loadContributors().catch(() => new Map<string, Contributor>());
    const missing = ids.filter((id) => !known.has(id));
    const fetched = missing.length ? await contributorService.retrieve({ itemIds: missing }) : [];
    return ids
        .map((id) => known.get(id) ?? fetched.find((c) => c.id === id))
        .filter((c): c is Contributor => !!c);
}
