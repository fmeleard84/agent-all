import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Embed a single text string and return a 1536-dimensional vector.
 */
export async function embed(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

/**
 * Embed multiple texts in batches of up to 100.
 * Returns one vector per input text, in order.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await getClient().embeddings.create({
      model: MODEL,
      input: batch,
    });
    // Sort by index to preserve order within the batch
    const sorted = res.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      vectors.push(item.embedding);
    }
  }

  return vectors;
}
