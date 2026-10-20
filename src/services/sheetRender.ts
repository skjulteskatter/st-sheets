import type { SheetService } from "hiddentreasures-js";
import { sheetService } from "./hiddentreasures";
import { getSongFiles } from "./collectionData";
import { approximateSize, cachedPost, cachedPostAt, pinCachedPost } from "./offline/cachingClient";
import type { Clef } from "./sheetState";

/**
 * Renders a sheet to SVG pages. Shared by the viewer and the offline download
 * so both send the exact same request, which is what the offline cache is keyed on.
 */
export function renderSheet(id: string, transposition: number, clef: Clef, service: SheetService = sheetService) {
    return service.render(renderOptions(id, transposition, clef));
}

/** This render from the offline cache, without touching the network, or undefined if it isn't cached. */
export function cachedRender(id: string, transposition: number, clef: Clef) {
    return cachedPost<string[]>("api/Sheets", renderOptions(id, transposition, clef));
}

/** When this render was saved in the offline cache, or undefined if it isn't. */
export function renderedAt(id: string, transposition: number, clef: Clef) {
    return cachedPostAt("api/Sheets", renderOptions(id, transposition, clef));
}

/** Roughly how many bytes this cached render takes; 0 if it isn't cached. */
export async function cachedRenderSize(id: string, transposition: number, clef: Clef) {
    return approximateSize(await cachedRender(id, transposition, clef) ?? []);
}

/** Marks this cached render as downloaded, so clearing viewed sheets keeps it. */
export function pinRender(id: string, transposition: number, clef: Clef) {
    return pinCachedPost("api/Sheets", renderOptions(id, transposition, clef));
}

function renderOptions(id: string, transposition: number, clef: Clef) {
    return { id, transposition, clef };
}

export async function getSheetFiles(songId: string) {
    const files = await getSongFiles(songId);
    return files.filter((f) => f.type === "sheetmusic");
}
