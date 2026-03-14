#!/usr/bin/env node

import { config, validateConfig } from './config/config.js';
import { filterAndReadFiles } from './filter/filter.js';
import { chunkFiles, initChunk } from './chunk/chunk.js';
import { getEmbeddingService } from './embed/embedding.js';
import { getVectorStore } from './store/vector-store.js';
import { getRetrieveQAService } from './retrieve/qa.js';
import { cloneRepository } from './clone/clone.js';
import path from 'path';
import readline from 'readline';
import fs from 'fs';

// 验证配置
validateConfig();

// 全局变量存储已初始化的服务
let qaService: ReturnType<typeof getRetrieveQAService> | null = null;
let clonedRepoPath: string | null = null;

// 注册退出时的清理函数
process.on('exit', () => {
  if (clonedRepoPath) {
    try {
      fs.rmSync(clonedRepoPath, { recursive: true, force: true });
      console.log(`\n🧹 已清理临时目录：${clonedRepoPath}`);
    } catch (e) {
      // 忽略清理错误
    }
  }
});

// 捕获 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 程序中断，退出...');
  process.exit(0);
});

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  };

  console.log('🚀 RepoMind 仓库检索助手\n');

  // 优先使用命令行参数，如果没有则交互式询问
  let repoPath: string;
  const arg = process.argv[2];

  if (arg) {
    // 判断是 URL 还是本地路径
    if (arg.startsWith('http://') || arg.startsWith('https://') || arg.startsWith('git@')) {
      console.log(`📥 正在克隆 GitHub 仓库：${arg}\n`);
      const cloneResult = await cloneRepository(arg);
      if (!cloneResult.success) {
        console.log(`❌ 克隆失败：${cloneResult.error}`);
        rl.close();
        process.exit(1);
      }
      clonedRepoPath = cloneResult.repoPath;
      repoPath = cloneResult.repoPath;
    } else {
      // 本地路径
      repoPath = path.resolve(arg);
    }
  } else {
    // 交互式询问
    const mode = await question(
      '请选择模式:\n' +
      '  1) 本地目录 - 扫描本地已有的代码目录\n' +
      '  2) GitHub 仓库 - 克隆 GitHub 仓库到临时目录并扫描\n' +
      '  输入选项 (1 或 2，直接回车退出): '
    );

    if (mode === '1') {
      const inputPath = await question('\n请输入本地仓库路径 (直接回车使用当前目录): ');
      repoPath = inputPath ? path.resolve(inputPath) : process.cwd();
    } else if (mode === '2') {
      const repoUrl = await question('\n请输入 GitHub 仓库 URL (如：https://github.com/owner/repo): ');
      if (!repoUrl) {
        console.log('❌ 未输入 URL，退出');
        rl.close();
        process.exit(1);
      }
      console.log('\n📥 正在克隆仓库...');
      const cloneResult = await cloneRepository(repoUrl);
      if (!cloneResult.success) {
        console.log(`❌ 克隆失败：${cloneResult.error}`);
        rl.close();
        process.exit(1);
      }
      clonedRepoPath = cloneResult.repoPath;
      repoPath = cloneResult.repoPath;
    } else {
      console.log('👋 再见！');
      rl.close();
      process.exit(0);
    }
  }

  console.log(`\n📁 扫描目录：${repoPath}\n`);

  // 初始化 Tree-sitter
  console.log('🔧 加载 Tree-sitter WASM...');
  await initChunk();

  // 过滤并读取文件
  const files = await filterAndReadFiles(repoPath);

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

  // ========== Phase 4: 向量化和存储 ==========
  console.log('\n\n========== Phase 4: 向量化和存储 ==========\n');

  // 获取 Embedding 服务
  const embeddingService = getEmbeddingService();

  // 生成 Embedding
  const embeddingResults = await embeddingService.embedChunks(chunks);

  // 初始化向量库（如果已存在则重置）
  const vectorStore = getVectorStore();
  await vectorStore.reset();

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
  await startInteractiveQA(rl);
}

/**
 * 交互式问答
 */
async function startInteractiveQA(rl: readline.Interface) {
  return new Promise<void>((resolve) => {
    let shouldExit = false;

    const prompt = () => {
      if (shouldExit) {
        resolve();
        return;
      }
      try {
        rl.question('🤔 请输入你的问题：', (question) => {
          if (shouldExit) {
            resolve();
            return;
          }

          const trimmedQuestion = question.trim().toLowerCase();

          // 退出命令
          if (trimmedQuestion === 'quit' || trimmedQuestion === 'exit') {
            console.log('\n👋 再见！');
            shouldExit = true;
            rl.close();
            resolve();
            return;
          }

          if (!qaService) {
            console.log('❌ QA 服务未初始化');
            shouldExit = true;
            rl.close();
            resolve();
            return;
          }

          // 异步处理问题，不阻塞 readline
          const currentQaService = qaService;
          currentQaService.ask(question, 5)
            .then((result) => {
              const formattedOutput = currentQaService.formatAnswerWithSources(result);
              console.log(formattedOutput);
            })
            .catch((error) => {
              console.error('❌ 处理问题时出错:', error);
            })
            .finally(() => {
              console.log(''); // 空行
              prompt();
            });
        });
      } catch (error) {
        // readline 已关闭，直接 resolve
        resolve();
      }
    };

    prompt();
  });
}

// 捕获错误
main().catch((error) => {
  console.error('程序出错:', error);
  process.exit(1);
});
