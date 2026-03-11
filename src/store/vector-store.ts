import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import type { Chunk } from '../chunk/types.js';
import type { EmbeddingResult } from '../embed/embedding.js';
import { config } from '../config/config.js';

/**
 * 向量存储类
 * 封装 ChromaDB 操作
 */
export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private collectionName: string;

  constructor(collectionName: string = 'repomind-code') {
    this.collectionName = collectionName;
    this.client = new ChromaClient({
      path: config.chroma.host,
    });
  }

  /**
   * 初始化向量库
   * 创建或获取 Collection
   */
  async init(): Promise<void> {
    try {
      // 尝试创建 Collection
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: {
          'hnsw:space': 'cosine', // 使用余弦相似度
        },
      });
      console.log(`✓ 向量库 Collection 已创建：${this.collectionName}`);
    } catch (error) {
      // 如果已存在，获取现有 Collection
      this.collection = await this.client.getCollection({
        name: this.collectionName,
      });
      console.log(`✓ 向量库 Collection 已加载：${this.collectionName}`);
    }
  }

  /**
   * 添加向量到数据库
   * @param results Embedding 结果数组
   */
  async addVectors(results: EmbeddingResult[]): Promise<void> {
    if (!this.collection) {
      throw new Error('VectorStore 未初始化，请先调用 init()');
    }

    console.log(`\n💾 开始存储 ${results.length} 条向量...`);

    // 准备 ChromaDB 需要的数据格式
    const ids: string[] = [];
    const embeddings: number[][] = [];
    const metadatas: Record<string, string | number>[] = [];
    const documents: string[] = [];

    for (const result of results) {
      ids.push(result.chunk.id);
      embeddings.push(result.embedding);
      metadatas.push({
        filePath: result.chunk.filePath,
        startLine: result.chunk.startLine,
        endLine: result.chunk.endLine,
        language: result.chunk.language,
        type: result.chunk.metadata.type || 'unknown',
        name: result.chunk.metadata.name || '',
      });
      documents.push(result.chunk.content);
    }

    // 批量添加到 ChromaDB
    await this.collection.add({
      ids,
      embeddings,
      metadatas,
      documents,
    });

    console.log(`✓ 向量存储完成`);
  }

  /**
   * 查询相似向量
   * @param query 查询文本
   * @param queryEmbedding 查询文本的 Embedding 向量
   * @param topK 返回结果数量
   * @returns 相似的 Chunk 及其元数据
   */
  async query(
    queryEmbedding: number[],
    topK: number = 5,
    filter?: Record<string, string | number>
  ): Promise<QueryResult[]> {
    if (!this.collection) {
      throw new Error('VectorStore 未初始化');
    }

    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      where: filter,
      include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
    });

    // 转换结果格式
    const queryResults: QueryResult[] = [];

    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        queryResults.push({
          id: results.ids[0][i],
          document: results.documents?.[0]?.[i] || '',
          metadata: results.metadatas?.[0]?.[i] as Record<string, string | number> | undefined,
          distance: results.distances?.[0]?.[i] || 0,
        });
      }
    }

    return queryResults;
  }

  /**
   * 删除 Collection 中的所有数据
   */
  async clear(): Promise<void> {
    if (!this.collection) {
      throw new Error('VectorStore 未初始化');
    }

    await this.collection.delete({
      where: {}, // 删除所有
    });

    console.log(`✓ 已清空向量库`);
  }

  /**
   * 获取 Collection 中的向量数量
   */
  async count(): Promise<number> {
    if (!this.collection) {
      throw new Error('VectorStore 未初始化');
    }

    return await this.collection.count();
  }
}

/**
 * 查询结果
 */
export interface QueryResult {
  id: string;
  document: string;
  metadata?: Record<string, string | number>;
  distance: number;
}

// 单例缓存
const collectionCache = new Map<string, VectorStore>();

/**
 * 获取或创建 VectorStore 实例
 */
export function getVectorStore(collectionName?: string): VectorStore {
  const name = collectionName || 'repomind-code';

  if (!collectionCache.has(name)) {
    collectionCache.set(name, new VectorStore(name));
  }

  return collectionCache.get(name)!;
}
