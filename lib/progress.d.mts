export const CAPTIONS: Readonly<Record<string,string>>;
export const PROGRESS_LABELS: readonly string[];
export function isPublicCommentaryRecord(record: unknown): boolean;
export function progressFromRecord(record: unknown): string|null;
