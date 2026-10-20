import { collection, getDocs, getFirestore, query, Timestamp, where } from "firebase/firestore";
import { app, firebaseAuth } from "./auth";

/**
 * A user's version of a sheet: edits (chords, notes) made in the web app and applied by the
 * backend when rendering with its id. Only the name is needed here, for picking one.
 */
export type SheetVersion = {
    id: string;
    name: string;
};

/** The current user's versions of a sheet, newest first. Empty when logged out or offline. */
export async function listMyVersions(fileId: string): Promise<SheetVersion[]> {
    const userId = firebaseAuth.currentUser?.uid;
    if (!userId) return [];

    // Firestore rules only allow listing your own versions, so the query must filter on ownerId
    const snapshot = await getDocs(
        query(collection(getFirestore(app), "sheetEdits"), where("ownerId", "==", userId), where("fileId", "==", fileId)),
    );
    return snapshot.docs
        .map((d) => ({ id: d.id, name: d.data().name as string, updatedAt: d.data().updatedAt as Timestamp | undefined }))
        .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0))
        .map(({ id, name }) => ({ id, name }));
}
