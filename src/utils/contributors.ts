import { ISong } from "hiddentreasures-js";
import { contributorService } from "../services/hiddentreasures";

export async function getContributorString(song: ISong) {
    const contributors = await Promise.all(song.participants.map(i => contributorService.get(i.contributorId)))

    let result = "";

    const authors = song.participants.filter(i => i.type === "author")
    if (authors.length) {
        
    }
}
