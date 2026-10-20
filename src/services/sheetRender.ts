import { fileService, sheetService } from "./hiddentreasures";
import { cachedPostAt } from "./offline/cachingClient";
import type { Clef } from "./sheetState";

/**
 * Renders a sheet to SVG pages. Shared by the viewer and the offline download
 * so both send the exact same request, which is what the offline cache is keyed on.
 */
export function renderSheet(id: string, transposition: number, clef: Clef) {
    return sheetService.render(renderOptions(id, transposition, clef));
}

/** When this render was saved in the offline cache, or undefined if it isn't. */
export function renderedAt(id: string, transposition: number, clef: Clef) {
    return cachedPostAt("api/Sheets", renderOptions(id, transposition, clef));
}

function renderOptions(id: string, transposition: number, clef: Clef) {
    return { id, transposition, clef };
}

export async function getSheetFiles(songId: string, service = fileService) {
    const files = await service.childrenOf(songId);
    return files.filter((f) => f.type === "sheetmusic");
}
