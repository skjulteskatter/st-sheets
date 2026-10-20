/** Human-readable byte size, e.g. "4.2 MB" or "380 KB". */
export function formatBytes(bytes: number) {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
