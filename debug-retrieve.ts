/**
 * 调试脚本：测试检索功能
 */

import { ChromaClient, IncludeEnum } from 'chromadb';
import { getEmbeddingService } from './src/embed/embedding.js';

const CHROMA_HOST = 'http://localhost:8000';
const COLLECTION_NAME = 'repomind-code';

async function testRetrieve() {
  console.log('🔍 调试检索功能\n');

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

  console.log(`Embedding 维度：${embedding.length}\n`);

  // 查询 ChromaDB
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: 10,
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
  });

  console.log('📋 检索结果（Top 10）:\n');

  if (results.ids && results.ids[0]) {
    for (let i = 0; i < results.ids[0].length; i++) {
      const id = results.ids[0][i];
      const doc = results.documents?.[0]?.[i] || 'N/A';
      const metadata = results.metadatas?.[0]?.[i] as Record<string, any> || {};
      const distance = results.distances?.[0]?.[i] || 0;

      const filePath = metadata.filePath || 'unknown';
      const startLine = metadata.startLine || 0;
      const endLine = metadata.endLine || 0;
      const type = metadata.type || 'unknown';
      const name = metadata.name || '';

      console.log(`[${i + 1}] ${filePath}:${startLine}-${endLine} (type: ${type}, name: ${name || 'anonymous'})`);
      console.log(`    距离：${distance.toFixed(4)} (相关性：${((1 - distance) * 100).toFixed(1)}%)`);
      console.log(`    内容预览：${doc.substring(0, 80).replace(/\n/g, ' ')}...`);
      console.log('');
    }
  }

  // 统计所有文件的嵌入
  console.log('\n📊 获取全部文件分布（批量获取）...\n');

  // 分批获取所有数据
  const allMetadatas: Record<string, any>[] = [];
  const batchSize = 100;
  let offset = 0;

  while (true) {
    const batch = await collection.get({
      limit: batchSize,
      offset: offset,
      include: [IncludeEnum.Metadatas],
    });

    if (!batch.ids || batch.ids.length === 0) break;

    for (const metadata of batch.metadatas || []) {
      allMetadatas.push(metadata as Record<string, any>);
    }

    offset += batchSize;
    if (batch.ids.length < batchSize) break;
  }

  // 统计文件分布
  const fileCount = new Map<string, number>();
  const typeCount = new Map<string, number>();

  for (const metadata of allMetadatas) {
    const filePath = metadata.filePath || 'unknown';
    const type = metadata.type || 'unknown';

    fileCount.set(filePath, (fileCount.get(filePath) || 0) + 1);
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  }

  console.log('📊 按文件统计 Chunk 数量:\n');
  const sortedFiles = Array.from(fileCount.entries()).sort((a, b) => b[1] - a[1]);
  for (const [file, count] of sortedFiles) {
    console.log(`  ${file}: ${count} chunks`);
  }

  console.log('\n📊 按类型统计 Chunk 数量:\n');
  const sortedTypes = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes) {
    console.log(`  ${type}: ${count} chunks`);
  }
}

testRetrieve().catch(console.error);
