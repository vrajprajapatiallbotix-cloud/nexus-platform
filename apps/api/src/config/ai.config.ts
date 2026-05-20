import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeEnvironment: process.env.PINECONE_ENVIRONMENT,
  pineconeIndex: process.env.PINECONE_INDEX ?? 'nexus',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
}));
