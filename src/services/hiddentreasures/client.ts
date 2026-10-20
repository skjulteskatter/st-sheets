import auth from "../auth";
import { CachingClient } from "../offline/cachingClient";

export default new CachingClient({
    getToken: async () => (await auth.getToken()) ?? "",
});
