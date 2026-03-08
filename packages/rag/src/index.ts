export { embed, embedBatch } from "./embeddings";
export { COLLECTIONS, getQdrantClient, ensureCollections } from "./qdrant";
export {
  indexDocument,
  search,
  searchAcrossWorkspaces,
} from "./search";
export type { RagDocument, SearchResult } from "./search";
