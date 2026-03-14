/**
 * 调试脚本：检查 ChromaDB 中存储的内容
 */

import { ChromaClient, Collection, IncludeEnum } from 'chromadb';

const CHROMA_HOST = 'http://localhost:8000';
const COLLECTION_NAME = 'repomind-code';

async function debugChromaDB() {
  console.log('🔍 调试 ChromaDB 存储内容\n');
  console.log(`连接地址：${CHROMA_HOST}\n`);

  const client = new ChromaClient({
    path: CHROMA_HOST,
  });

  try {
    // 获取 Collection
    const collection = await client.getCollection({ name: COLLECTION_NAME });

    // 获取总数
    const count = await collection.count();
    console.log(`📊 向量总数：${count}\n`);

    // 获取所有数据（分批）
    console.log('📋 获取所有存储的 Chunk 信息:\n');

    const allMetadatas: Record<string, any>[] = [];
    const batchSize = 100;
    let offset = 0;

    while (true) {
      const batch = await collection.get({
        limit: batchSize,
        offset: offset,
        include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
      });

      if (!batch.ids || batch.ids.length === 0) break;

      for (let i = 0; i < batch.ids.length; i++) {
        const id = batch.ids[i];
        const doc = batch.documents?.[i] || 'N/A';
        const metadata = batch.metadatas?.[i] as Record<string, any> || {};

        const filePath = metadata.filePath || 'unknown';
        const startLine = metadata.startLine || 0;
        const endLine = metadata.endLine || 0;
        const type = metadata.type || 'unknown';
        const name = metadata.name || '';

        allMetadatas.push(metadata);

        if (i < 50) {  // 只打印前 50 条
          console.log(`[${offset + i + 1}] ${filePath}:${startLine}-${endLine} (type: ${type}, name: ${name || 'anonymous'})`);
          console.log(`    内容预览：${doc.substring(0, 60).replace(/\n/g, ' ')}...`);
          console.log('');
        }
      }

      offset += batchSize;
      if (batch.ids.length < batchSize) break;
    }

    // 统计文件分布
    const fileCount = new Map<string, number>();
    for (const metadata of allMetadatas) {
      const filePath = metadata.filePath || 'unknown';
      fileCount.set(filePath, (fileCount.get(filePath) || 0) + 1);
    }

    // 按文件统计
    console.log('\n📊 按文件统计 Chunk 数量:\n');
    const sorted = Array.from(fileCount.entries()).sort((a, b) => b[1] - a[1]);
    for (const [file, count] of sorted) {
      console.log(`  ${file}: ${count} chunks`);
    }
  } catch (error) {
    console.error('❌ 错误:', error);
  }
}

debugChromaDB().catch(console.error);
