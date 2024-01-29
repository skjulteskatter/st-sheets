import { Client } from "hiddentreasures-js";
import auth from "../auth";

export default new Client({
    basePath: "https://songtreasures.azurewebsites.net/",
    getToken: async () => (await auth.getToken()) ?? "",
});
