import { Client } from "hiddentreasures-js";
import auth from "../auth";

export default new Client({
    basePath: "https://api.songtreasures.app/",
    getToken: async () => (await auth.getToken()) ?? "",
});
