import { Client } from "hiddentreasures-js";
import auth from "../auth";

export default new Client({
    basePath: "https://st-api-44114060540.europe-west4.run.app/",
    getToken: async () => (await auth.getToken()) ?? "",
});
