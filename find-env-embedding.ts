/**
 * 调试脚本：测试检索并找出 .env 相关 chunk 的位置
 */

import { ChromaClient, IncludeEnum } from 'chromadb';
import { getEmbeddingService } from './src/embed/embedding.js';

const CHROMA_HOST = 'http://localhost:8000';
const COLLECTION_NAME = 'repomind-code';

async function findEnvEmbedding() {
  console.log('🔍 查找 .env 相关的 Embedding 配置 chunk\n');

  const client = new ChromaClient({
    path: CHROMA_HOST,
  });

  const collection = await client.getCollection({ name: COLLECTION_NAME });

  // 获取总数
  const count = await collection.count();
  console.log(`📊 向量总数：${count}\n`);

  // 生成测试问题的 embedding
  const embeddingService = getEmbeddingService();
  const testQuestion = "这个项目是如何配置 Embedding 的？";

  console.log(`测试问题：${testQuestion}\n`);

  const embedding = await embeddingService.embedChunk({
    id: 'query',
    filePath: '',
    content: testQuestion,
    startLine: 0,
    endLine: 0,
    language: 'text',
    metadata: {},
  });

  // 查询 Top 50
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: 50,
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
  });

  console.log('📋 检索结果（Top 50）:\n');

  if (results.ids && results.ids[0]) {
    let envFound = false;
    for (let i = 0; i < results.ids[0].length; i++) {
      const id = results.ids[0][i];
      const doc = results.documents?.[0]?.[i] || 'N/A';
      const metadata = results.metadatas?.[0]?.[i] as Record<string, any> || {};
      const distance = results.distances?.[0]?.[i] || 0;

      const filePath = metadata.filePath || 'unknown';

      // 标记 .env 相关文件
      if (filePath.includes('.env') || filePath.includes('config')) {
        envFound = true;
        console.log(`⭐ [${i + 1}] ${filePath}:${metadata.startLine}-${metadata.endLine}`);
      } else {
        console.log(`   [${i + 1}] ${filePath}:${metadata.startLine}-${metadata.endLine}`);
      }
      console.log(`       距离：${distance.toFixed(4)} (相关性：${((1 - distance) * 100).toFixed(1)}%)`);
      console.log(`       内容：${doc.substring(0, 60).replace(/\n/g, ' ')}...\n`);
    }

    if (!envFound) {
      console.log('\n⚠️  .env 和 config 文件没有在 Top 50 中找到！');
    }
  }
}

findEnvEmbedding().catch(console.error);
