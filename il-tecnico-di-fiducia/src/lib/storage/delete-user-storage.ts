import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function joinStoragePath(prefix: string, name: string) {
  if (!prefix) return name;
  return `${prefix}/${name}`;
}

async function listAllPathsUnderPrefix(
  supabase: SupabaseClient,
  bucketId: string,
  rootPrefix: string,
) {
  const limit = 1000;
  const queue: string[] = [rootPrefix];
  const visited = new Set<string>();
  const paths: string[] = [];

  while (queue.length > 0) {
    const prefix = queue.shift()!;
    if (visited.has(prefix)) continue;
    visited.add(prefix);

    let offset = 0;

    // Storage list is non-recursive; we walk "folders" (items with id === null).
    while (true) {
      const { data, error } = await supabase.storage
        .from(bucketId)
        .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });

      if (error) {
        // If a bucket doesn't exist (dev/prod mismatch), treat as empty.
        const msg = error.message.toLowerCase();
        if (msg.includes("bucket") && msg.includes("not found")) {
          return [];
        }
        throw new Error(`Failed to list files in bucket ${bucketId}: ${error.message}`);
      }

      const objects = data ?? [];
      for (const obj of objects) {
        const name = obj?.name;
        if (!name) continue;

        // Supabase uses synthetic "folder" nodes where id is null.
        // (We already rely on this behavior in the attachments listing endpoint.)
        if (!obj.id) {
          queue.push(joinStoragePath(prefix, name));
          continue;
        }

        paths.push(joinStoragePath(prefix, name));
      }

      if (objects.length < limit) break;
      offset += limit;
    }
  }

  return paths;
}

export async function deleteAllStorageObjectsForUser(
  serviceSupabase: SupabaseClient,
  userId: string,
) {
  // IMPORTANT:
  // - Do not rely on `storage.objects` via PostgREST; many hosted projects don't expose `storage` schema.
  // - `storage.objects.owner` can be NULL; prefix delete is more reliable.
  const rootPrefix = userId;

  const bucketIds = ["public-media", "private-media"] as const;
  const byBucket = new Map<string, string[]>();

  for (const bucketId of bucketIds) {
    const paths = await listAllPathsUnderPrefix(
      serviceSupabase,
      bucketId,
      rootPrefix,
    );
    if (paths.length > 0) byBucket.set(bucketId, paths);
  }

  if (byBucket.size === 0) return { deleted: 0 };

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
