import { QdrantClient } from "@qdrant/js-client-rest";

const VECTOR_SIZE = 1536;

export const COLLECTIONS = {
  CONVERSATIONS: "workspace_conversations",
  DOCUMENTS: "workspace_documents",
} as const;

let client: QdrantClient | null = null;

/**
 * Return a singleton Qdrant client connected to 127.0.0.1:6333.
 */
export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ host: "127.0.0.1", port: 6333 });
  }
  return client;
}

/**
 * Create the required collections if they don't already exist,
 * along with payload indexes on workspace_id and user_id.
 */
export async function ensureCollections(): Promise<void> {
  const qdrant = getQdrantClient();

  for (const name of Object.values(COLLECTIONS)) {
    const exists = await collectionExists(qdrant, name);
    if (exists) continue;

    await qdrant.createCollection(name, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });

    await qdrant.createPayloadIndex(name, {
      field_name: "workspace_id",
      field_schema: "keyword",
    });

    await qdrant.createPayloadIndex(name, {
      field_name: "user_id",
      field_schema: "keyword",
    });
  }
}

async function collectionExists(
  qdrant: QdrantClient,
  name: string
): Promise<boolean> {
  try {
    await qdrant.getCollection(name);
    return true;
  } catch {
    return false;
  }
}
