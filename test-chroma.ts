/**
 * ChromaDB 测试脚本
 * 用于验证向量数据库的连接和基本功能
 */

import { ChromaClient, Collection, IncludeEnum } from 'chromadb';

const CHROMA_HOST = 'http://localhost:8000';
const COLLECTION_NAME = 'test-collection';

async function testChromaDB() {
  console.log('🧪 ChromaDB 测试开始\n');
  console.log(`连接地址：${CHROMA_HOST}\n`);

  const client = new ChromaClient({
    path: CHROMA_HOST,
  });

  try {
    // 1. 测试创建 Collection
    console.log('\n1️⃣ 创建测试 Collection...');
    let collection: Collection;
    try {
      collection = await client.createCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
      });
      console.log(`   ✓ Collection 已创建：${COLLECTION_NAME}`);
    } catch (error) {
      // 如果已存在，获取现有 Collection
      collection = await client.getCollection({ name: COLLECTION_NAME });
      console.log(`   ✓ Collection 已存在，已加载：${COLLECTION_NAME}`);
    }

    // 3. 测试添加向量
    console.log('\n2️⃣ 测试添加向量...');
    const testIds = ['test-1', 'test-2', 'test-3'];
    const testEmbeddings = [
      [1.0, 0.0, 0.0, 0.0],
      [0.0, 1.0, 0.0, 0.0],
      [0.0, 0.0, 1.0, 0.0],
    ];
    const testDocuments = ['文档 1', '文档 2', '文档 3'];
    const testMetadatas = [
      { source: 'test', type: 'doc' },
      { source: 'test', type: 'doc' },
      { source: 'test', type: 'doc' },
    ];

    await collection.add({
      ids: testIds,
      embeddings: testEmbeddings,
      documents: testDocuments,
      metadatas: testMetadatas,
    });
    console.log('   ✓ 添加 3 条测试向量');

    // 4. 测试查询数量
    console.log('\n3️⃣ 测试查询数量...');
    const count = await collection.count();
    console.log(`   ✓ Collection 中向量数量：${count}`);

    // 5. 测试相似性查询
    console.log('\n4️⃣ 测试相似性查询...');
    const queryEmbedding = [0.9, 0.1, 0.0, 0.0]; // 接近第一个向量
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 2,
      include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
    });

    console.log('   ✓ 查询结果:');
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const id = results.ids[0][i];
        const doc = results.documents?.[0]?.[i] || 'N/A';
        const distance = results.distances?.[0]?.[i] || 0;
        console.log(`     - ID: ${id}, 文档：${doc}, 距离：${distance.toFixed(4)}`);
      }
    }

    // 6. 测试带过滤的查询
    console.log('\n5️⃣ 测试带过滤的查询...');
    const filteredResults = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 2,
      where: { type: 'doc' },
      include: [IncludeEnum.Documents],
    });
    console.log(`   ✓ 过滤查询返回 ${filteredResults.ids?.[0]?.length || 0} 条结果`);

    // 7. 测试删除
    console.log('\n6️⃣ 测试删除操作...');
    await collection.delete({
      ids: ['test-1'],
    });
    const countAfterDelete = await collection.count();
    console.log(`   ✓ 删除后数量：${countAfterDelete}`);

    // 8. 测试清空 Collection
    console.log('\n7️⃣ 测试清空 Collection...');
    // ChromaDB v2 API 不支持 where: {}，需要先获取所有 ID 再删除
    const allItems = await collection.get({ limit: 100 });
    if (allItems.ids && allItems.ids.length > 0) {
      await collection.delete({
        ids: allItems.ids,
      });
    }
    const countAfterClear = await collection.count();
    console.log(`   ✓ 清空后数量：${countAfterClear}`);

    // 9. 测试删除 Collection
    console.log('\n8️⃣ 测试删除 Collection...');
    await client.deleteCollection({ name: COLLECTION_NAME });
    console.log('   ✓ Collection 已删除');

    console.log('\n✅ 所有测试通过！\n');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  } finally {
    // 清理测试 Collection（如果存在）
    try {
      await client.deleteCollection({ name: COLLECTION_NAME });
    } catch (e) {
      // 忽略清理错误
    }
  }
}

// 运行测试
testChromaDB().catch(console.error);
