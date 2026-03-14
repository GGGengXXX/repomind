import OpenAI from 'openai';
import { config } from '../config/config.js';
import type { Chunk } from '../chunk/types.js';

/**
 * Embedding 结果
 * chunk 是代码切片的原始信息，embedding 是对应的向量表示
 * number[] 是向量数组，维度取决于所使用的 Embedding 模型（如 text-embedding-v3 通常是 1024 维）
 */
export interface EmbeddingResult {
  chunk: Chunk;
  embedding: number[];
}

/**
 * Embedding 服务类
 */
export class EmbeddingService {
  /**
   * EmbeddingService 需要生成 Embedding 的模型和 API 配置
   * 这里使用 OpenAI 的 Embedding API，模型可以在配置中指定
   * 例如：text-embedding-v3 是一个适合文本的通用 Embedding 模型
   * 也可以根据需要选择其他支持的模型
   */
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.embedding.apiKey,
      baseURL: config.embedding.baseURL,
    });
  }

  /**
   * 为单个 Chunk 生成 Embedding
   * @param chunk 需要向量化的代码块
   * @returns Embedding 向量
   */
  async embedChunk(chunk: Chunk): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: config.model.embedding,
        input: chunk.content,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error(`Embedding 失败：${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`, error);
      throw error;
    }
  }

  /**
   * 批量生成 Embedding
   * @param chunks 需要向量化的代码块数组
   * @param batchSize 每批次的数量（API 限制）
   * @returns Embedding 结果数组
   */
  async embedChunks(chunks: Chunk[], batchSize: number = 10): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    const totalBatches = Math.ceil(chunks.length / batchSize);

    console.log(`\n🔢 开始生成 Embedding，共 ${chunks.length} 个 Chunk，分为 ${totalBatches} 批次...`);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, chunks.length);
      const batch = chunks.slice(start, end);

      try {
        const response = await this.client.embeddings.create({
          model: config.model.embedding,
          input: batch.map((chunk) => chunk.content),
        });

        // 将向量与原始 Chunk 对应
        for (let j = 0; j < response.data.length; j++) {
          results.push({
            chunk: batch[j],
            embedding: response.data[j].embedding,
          });
        }

        // 进度提示
        console.log(`  批次 ${i + 1}/${totalBatches} 完成`);
      } catch (error) {
        console.error(`批次 ${i + 1} 失败:`, error);
        throw error;
      }
    }

    console.log(`✓ Embedding 生成完成，共 ${results.length} 条向量`);
    return results;
  }

  /**
   * 获取 Embedding 的维度
   * @param chunk 示例 Chunk
   * @returns 向量维度
   */
  async getEmbeddingDimension(chunk: Chunk): Promise<number> {
    const embedding = await this.embedChunk(chunk);
    return embedding.length;
  }
}

// 单例实例
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * 获取 EmbeddingService 单例
 */
export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}
