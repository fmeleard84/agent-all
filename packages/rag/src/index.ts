export { embed, embedBatch } from "./embeddings";
export { COLLECTIONS, getQdrantClient, ensureCollections } from "./qdrant";
export {
  indexDocument,
  search,
  searchAcrossWorkspaces,
} from "./search";
export type { RagDocument, SearchResult } from "./search";
export { createQontoClient, fetchAllTransactions } from "./qonto";
export type { QontoClient } from "./qonto";
