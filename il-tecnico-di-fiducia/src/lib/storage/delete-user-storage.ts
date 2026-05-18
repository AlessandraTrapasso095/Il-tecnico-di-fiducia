import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type StorageObjectRow = {
  bucket_id: string;
  name: string;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function deleteAllStorageObjectsForUser(
  serviceSupabase: SupabaseClient,
  userId: string,
) {
  // IMPORTANT:
  // - `storage.objects.owner` is deprecated in Supabase Storage and may be NULL for some operations
  //   (e.g. service_role uploads, move/copy). Deleting by path prefix is more reliable.
  // - We scope to known buckets to avoid scanning unrelated storage.
  const USER_PREFIX = `${userId}/`;

  const { data, error } = await serviceSupabase
    .schema("storage")
    .from("objects")
    .select("bucket_id,name")
    .in("bucket_id", ["public-media", "private-media"])
    .like("name", `${USER_PREFIX}%`);

  if (error) {
    throw new Error(`Failed to list storage objects: ${error.message}`);
  }

  const objects = (data ?? []) as StorageObjectRow[];
  if (objects.length === 0) {
    return { deleted: 0 };
  }

  const byBucket = new Map<string, string[]>();
  for (const obj of objects) {
    if (!obj?.bucket_id || !obj?.name) continue;
    const list = byBucket.get(obj.bucket_id) ?? [];
    list.push(obj.name);
    byBucket.set(obj.bucket_id, list);
  }

  let deleted = 0;

  for (const [bucketId, names] of byBucket.entries()) {
    // Supabase Storage remove supports batching; keep it conservative.
    for (const batch of chunkArray(names, 200)) {
      const { error: removeError } = await serviceSupabase.storage
        .from(bucketId)
        .remove(batch);

      if (removeError) {
        throw new Error(
          `Failed to delete storage objects in bucket ${bucketId}: ${removeError.message}`,
        );
      }

      deleted += batch.length;
    }
  }

  return { deleted };
}
