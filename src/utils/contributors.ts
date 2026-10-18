import { ISong, ParticipantType } from "hiddentreasures-js";
import { contributorService } from "../services/hiddentreasures";

export type Credits = {
    authors: string[];
    composers: string[];
};

/** Names of the song's authors (text) and composers (melody). */
export async function getCredits(song: ISong): Promise<Credits> {
    const ids = [
        ...new Set(
            song.participants
                .filter((p) => p.type === "author" || p.type === "composer")
                .map((p) => p.contributorId),
        ),
    ];
    const contributors = ids.length
        ? await contributorService.retrieve({ itemIds: ids })
        : [];

    const names = (type: ParticipantType) =>
        song.participants
            .filter((p) => p.type === type)
            .map((p) => contributors.find((c) => c.id === p.contributorId)?.name)
            .filter((name): name is string => !!name);

    return {
        authors: names("author"),
        composers: names("composer"),
    };
}
