/**
 * Ambient module declarations for optional peer dependencies.
 *
 * These packages are dynamically imported at runtime — they may not be
 * installed.  The declarations here prevent TS2307 errors during type
 * checking while keeping the actual types opaque (`any`).
 */
declare module "openai" {
  const value: any;
  export default value;
  export const OpenAI: any;
}

declare module "@anthropic-ai/sdk" {
  const value: any;
  export default value;
}

declare module "cohere-ai" {
  export const CohereClient: any;
}

declare module "@google/generative-ai" {
  export const GoogleGenerativeAI: any;
}

declare module "chromadb" {
  export const ChromaClient: any;
}

declare module "@pinecone-database/pinecone" {
  export const Pinecone: any;
}

declare module "@qdrant/js-client-rest" {
  export const QdrantClient: any;
}

declare module "weaviate-client" {
  const value: any;
  export default value;
}

declare module "@modelcontextprotocol/sdk/client/index.js" {
  export const Client: any;
}

declare module "@modelcontextprotocol/sdk/server/index.js" {
  export const Server: any;
}

declare module "@modelcontextprotocol/sdk/server/stdio.js" {
  export const StdioServerTransport: any;
}
