#!/usr/bin/env node

/**
 * 测试脚本：扫描 express 仓库并测试问答功能
 */

import { config, validateConfig } from './src/config/config.js';
import { filterAndReadFiles } from './src/filter/filter.js';
import { chunkFiles, initChunk } from './src/chunk/chunk.js';
import { getEmbeddingService } from './src/embed/embedding.js';
import { getVectorStore } from './src/store/vector-store.js';
import { getRetrieveQAService } from './src/retrieve/qa.js';
import { cloneRepository } from './src/clone/clone.js';
import path from 'path';
import fs from 'fs';

// 验证配置
validateConfig();

async function runTest() {
  const repoUrl = 'https://github.com/expressjs/express.git';
  let clonedRepoPath: string | null = null;

  try {
    console.log('🚀 RepoMind QA 测试\n');

    // 1. 克隆仓库
    console.log(`📥 正在克隆 GitHub 仓库：${repoUrl}\n`);
    const cloneResult = await cloneRepository(repoUrl);
    if (!cloneResult.success) {
      console.log(`❌ 克隆失败：${cloneResult.error}`);
      return;
    }
    clonedRepoPath = cloneResult.repoPath;

    // 2. 初始化 Tree-sitter
    console.log('🔧 加载 Tree-sitter WASM...');
    await initChunk();

    // 3. 过滤并读取文件
    const files = await filterAndReadFiles(clonedRepoPath);
    console.log(`\n📄 找到 ${files.length} 个文件`);

    // 4. 切分代码
    const chunks = await chunkFiles(files);
    console.log(`\n🔪 生成的 Chunks 信息：`);
    console.log(`  总数：${chunks.length}`);
    const byType = chunks.reduce((acc, chunk) => {
      acc[chunk.metadata.type || 'unknown'] = (acc[chunk.metadata.type || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`  按类型：`, byType);

    // 5. 向量化
    console.log('\n\n========== Phase 4: 向量化和存储 ==========\n');
    const embeddingService = getEmbeddingService();
    const embeddingResults = await embeddingService.embedChunks(chunks);

    // 6. 存储向量
    const vectorStore = getVectorStore();
    await vectorStore.reset();
    await vectorStore.addVectors(embeddingResults);
    const count = await vectorStore.count();
    console.log(`\n📊 向量库统计：${count} 条向量`);

    // 7. 初始化 QA 服务
    console.log('\n\n========== Phase 5: 检索和问答 ==========\n');
    const qaService = getRetrieveQAService();
    await qaService.init();

    // 8. 测试问答
    const testQuestions = [
      'Express 如何定义路由？',
      '什么是 middleware？如何使用？',
    ];

    for (const question of testQuestions) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🤔 问题：${question}`);
      console.log('='.repeat(60));

      const result = await qaService.ask(question, 5);

      console.log('\n📝 回答：');
      console.log(qaService.formatAnswerWithSources(result));
      console.log('');
    }

  } catch (error) {
    console.error('程序出错:', error);
  } finally {
    // 清理临时目录
    if (clonedRepoPath) {
      try {
        fs.rmSync(clonedRepoPath, { recursive: true, force: true });
        console.log(`\n🧹 已清理临时目录：${clonedRepoPath}`);
      } catch (e) {
        // 忽略清理错误
      }
    }
  }
}

runTest();
