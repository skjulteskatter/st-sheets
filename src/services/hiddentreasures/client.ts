import auth from "../auth";
import { CachingClient } from "../offline/cachingClient";

const getToken = async () => (await auth.getToken()) ?? "";

export default new CachingClient({ getToken });

/**
 * For the offline download: always asks the server first (it needs current
 * data) and pins what it saves, so clearing viewed sheets keeps downloads.
 */
export const downloadClient = new CachingClient({ getToken, cacheFirst: false, pin: true });
