#!/usr/bin/env node

import { config, validateConfig } from './config/config.js';
import { filterAndReadFiles } from './filter/filter.js';
import { chunkFiles, initChunk } from './chunk/chunk.js';
import { getEmbeddingService } from './embed/embedding.js';
import { getVectorStore } from './store/vector-store.js';
import { getRetrieveQAService } from './retrieve/qa.js';
import path from 'path';
import readline from 'readline';

// 验证配置
validateConfig();

// 测试用的本地目录（用当前项目测试）
const testLocalPath = process.argv[2] || process.cwd();

// 全局变量存储已初始化的服务
let qaService: ReturnType<typeof getRetrieveQAService> | null = null;

async function main() {
  console.log('🚀 RepoMind 测试启动\n');
  console.log(`📁 扫描目录：${testLocalPath}`);

  // 初始化 Tree-sitter
  console.log('🔧 加载 Tree-sitter WASM...');
  await initChunk();

  // 过滤并读取文件
  const files = await filterAndReadFiles(testLocalPath);

  console.log(`\n📄 找到 ${files.length} 个文件`);

  // 切分代码
  const chunks = await chunkFiles(files);

  console.log(`\n🔪 生成的 Chunks 信息：`);
  console.log(`  总数：${chunks.length}`);

  // 按类型统计
  const byType = chunks.reduce((acc, chunk) => {
    acc[chunk.metadata.type || 'unknown'] = (acc[chunk.metadata.type || 'unknown'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`  按类型：`, byType);

  // 打印前 10 个 Chunk 的详细信息
  console.log(`\n📋 前 10 个 Chunks:`);
  chunks.slice(0, 10).forEach((chunk) => {
    console.log(`  - [${chunk.metadata.type}] ${chunk.filePath}:${chunk.startLine}-${chunk.endLine} (${chunk.metadata.name || 'anonymous'})`);
    console.log(`    ${chunk.content.split('\n')[0]?.substring(0, 50)}...`);
  });

  // ========== Phase 4: 向量化和存储 ==========
  console.log('\n\n========== Phase 4: 向量化和存储 ==========\n');

  // 获取 Embedding 服务
  const embeddingService = getEmbeddingService();

  // 生成 Embedding
  const embeddingResults = await embeddingService.embedChunks(chunks);

  // 初始化向量库
  const vectorStore = getVectorStore();
  await vectorStore.init();

  // 存储向量
  await vectorStore.addVectors(embeddingResults);

  // 显示统计
  const count = await vectorStore.count();
  console.log(`\n📊 向量库统计：`);
  console.log(`  向量总数：${count}`);

  // ========== Phase 5: 检索和问答 ==========
  console.log('\n\n========== Phase 5: 检索和问答 ==========\n');

  // 初始化 QA 服务
  qaService = getRetrieveQAService();
  await qaService.init();

  console.log('✓ RepoMind 初始化完成，进入交互式问答模式');
  console.log('  输入问题并按回车获取答案');
  console.log('  输入 "quit" 或 "exit" 退出程序\n');

  // 启动交互式问答
  await startInteractiveQA();
}

/**
 * 交互式问答
 */
async function startInteractiveQA() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('🤔 请输入你的问题：', async (question) => {
      const trimmedQuestion = question.trim().toLowerCase();

      // 退出命令
      if (trimmedQuestion === 'quit' || trimmedQuestion === 'exit') {
        console.log('\n👋 再见！');
        rl.close();
        return;
      }

      if (!qaService) {
        console.log('❌ QA 服务未初始化');
        rl.close();
        return;
      }

      try {
        // 检索并生成回答
        const result = await qaService.ask(question, 5);

        // 格式化输出
        const formattedOutput = qaService.formatAnswerWithSources(result);
        console.log(formattedOutput);
      } catch (error) {
        console.error('❌ 处理问题时出错:', error);
      }

      console.log(''); // 空行
      askQuestion(); // 继续下一个问题
    });
  };

  askQuestion();
}

// 捕获错误
main().catch((error) => {
  console.error('程序出错:', error);
  process.exit(1);
});
