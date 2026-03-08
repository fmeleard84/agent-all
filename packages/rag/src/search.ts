import { randomUUID } from "crypto";
import { embed } from "./embeddings";
import { getQdrantClient } from "./qdrant";

export interface RagDocument {
  id?: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

/**
 * Embed a document's content and upsert it into the given Qdrant collection.
 */
export async function indexDocument(
  collection: string,
  doc: RagDocument,
  workspaceId: string,
  userId: string
): Promise<string> {
  const qdrant = getQdrantClient();
  const vector = await embed(doc.content);
  const id = doc.id ?? randomUUID();

  await qdrant.upsert(collection, {
    points: [
      {
        id,
        vector,
        payload: {
          content: doc.content,
          workspace_id: workspaceId,
          user_id: userId,
          ...doc.metadata,
        },
      },
    ],
  });

  return id;
}

/**
 * Semantic search within a single workspace.
 */
export async function search(
  collection: string,
  query: string,
  workspaceId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const qdrant = getQdrantClient();
  const vector = await embed(query);

  const results = await qdrant.search(collection, {
    vector,
    limit,
    filter: {
      must: [
        {
          key: "workspace_id",
          match: { value: workspaceId },
        },
      ],
    },
    with_payload: true,
  });

  return results.map(toSearchResult);
}

/**
 * Semantic search across all workspaces belonging to a user.
 */
export async function searchAcrossWorkspaces(
  collection: string,
  query: string,
  userId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const qdrant = getQdrantClient();
  const vector = await embed(query);

  const results = await qdrant.search(collection, {
    vector,
    limit,
    filter: {
      must: [
        {
          key: "user_id",
          match: { value: userId },
        },
      ],
    },
    with_payload: true,
  });

  return results.map(toSearchResult);
}

function toSearchResult(point: {
  id: string | number;
  score: number;
  payload?: Record<string, unknown> | null;
}): SearchResult {
  const payload = (point.payload ?? {}) as Record<string, unknown>;
  const { content, workspace_id, user_id, ...metadata } = payload;
  return {
    id: String(point.id),
    content: (content as string) ?? "",
    metadata,
    score: point.score,
  };
}
