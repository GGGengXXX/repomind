import dotenv from 'dotenv';
import path from 'path';

// 加载 .env 文件
dotenv.config({ path: path.join(process.cwd(), '.env') });

// 从环境变量读取配置
export const config = {
  // 阿里百炼 API 配置
  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    baseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  // 模型配置
  model: {
    llm: process.env.LLM_MODEL || 'qwen3.5-plus',
    embedding: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
  },
  // ChromaDB 配置（暂时用不到）
  chroma: {
    host: process.env.CHROMA_HOST || 'http://localhost:8000',
  },
};

// 验证必要的配置是否存在
export function validateConfig(): void {
  if (!config.dashscope.apiKey) {
    throw new Error('缺少 DASHSCOPE_API_KEY，请在 .env 文件中配置');
  }

  console.log('✓ 配置加载成功');
  console.log(`  - LLM 模型：${config.model.llm}`);
  console.log(`  - Embedding 模型：${config.model.embedding}`);
}
