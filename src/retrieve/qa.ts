import OpenAI from 'openai';
import { config } from '../config/config.js';
import { getVectorStore, type QueryResult } from '../store/vector-store.js';
import { getEmbeddingService } from '../embed/embedding.js';

/**
 * 检索结果
 */
export interface RetrievalResult {
  queryResults: QueryResult[];
  query: string;
}

/**
 * LLM 回答结果
 */
export interface AnswerResult {
  answer: string;
  sources: Source[];
  model: string;
}

/**
 * 引用源
 */
export interface Source {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  relevanceScore: number;
}

/**
 * Prompt 模板
 */
const PROMPT_TEMPLATE = `你是一个专业的代码助手 RepoMind。请根据以下检索到的代码片段回答用户问题。

## 检索到的代码片段
{context}

## 用户问题
{question}

## 回答要求
1. 基于检索到的代码片段进行回答，不要编造信息
2. 回答要简洁清晰，直接切中要点
3. 如果检索到的代码不足以回答问题，请说明"根据当前检索到的代码，无法确定..."
4. **重要：在回答中引用代码时，必须标注来源**，格式为：\`[文件路径：起始行 - 结束行]\`
   例如："这个函数用于处理用户输入 [src/auth/login.ts:15-30]"
5. 如果有多个引用源，分别标注

## 回答
`;

/**
 * 检索和问答服务类
 */
export class RetrieveQAService {
  private client: OpenAI;
  private vectorStore;
  private embeddingService;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.dashscope.apiKey,
      baseURL: config.dashscope.baseURL,
    });
    this.vectorStore = getVectorStore();
    this.embeddingService = getEmbeddingService();
  }

  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    await this.vectorStore.init();
  }

  /**
   * 检索相关代码片段
   * @param question 用户问题
   * @param topK 返回结果数量
   * @returns 检索结果
   */
  async retrieve(question: string, topK: number = 15): Promise<RetrievalResult> {
    console.log(`\n🔍 正在检索相关代码...`);
    console.log(`   问题：${question}`);

    // 生成问题的 Embedding
    const embedding = await this.embeddingService.embedChunk({
      id: 'query',
      filePath: '',
      content: question,
      startLine: 0,
      endLine: 0,
      language: 'text',
      metadata: {},
    });

    // 查询向量库 - 过滤掉 Markdown 的 text 类型，只检索代码内容
    // type: 'function' | 'method' | 'class' | 'module' 是代码，type: 'text' 是 Markdown 段落
    const queryResults = await this.vectorStore.query(
      embedding,
      topK,
      // 使用 $ne 排除 type 为 'text' 的文档
      { type: { $ne: 'text' } as any }
    );

    console.log(`✓ 找到 ${queryResults.length} 个相关代码片段`);

    // 调试打印：显示所有检索结果
    console.log('\n📋 检索结果详情:');
    queryResults.forEach((result, index) => {
      const metadata = result.metadata || {};
      const filePath = metadata.filePath as string || 'unknown';
      const startLine = metadata.startLine as number || 0;
      const endLine = metadata.endLine as number || 0;
      const distance = result.distance || 0;
      console.log(`  [${index + 1}] ${filePath}:${startLine}-${endLine}`);
      console.log(`      距离：${distance.toFixed(4)} (相关性：${((1 - distance) * 100).toFixed(1)}%)`);
    });
    console.log('');

    return {
      queryResults,
      query: question,
    };
  }

  /**
   * 构建带引用的上下文
   * @param queryResults 检索结果
   * @returns 格式化的上下文字符串
   */
  private buildContext(queryResults: QueryResult[]): string {
    if (queryResults.length === 0) {
      return '未检索到相关代码片段';
    }

    // 去重：使用 filePath + startLine + endLine 作为唯一键
    const seen = new Set<string>();
    const uniqueResults = queryResults.filter((result) => {
      const metadata = result.metadata || {};
      const key = `${metadata.filePath}:${metadata.startLine}-${metadata.endLine}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    const contextParts = uniqueResults.map((result, index) => {
      const metadata = result.metadata || {};
      const filePath = metadata.filePath as string || 'unknown';
      const startLine = metadata.startLine as number || 0;
      const endLine = metadata.endLine as number || 0;
      const name = metadata.name as string || '';

      return `[${index + 1}] ${filePath}:${startLine}-${endLine}${name ? ` (${name})` : ''}
${result.document}
---`;
    });

    return contextParts.join('\n\n');
  }

  /**
   * 提取引用源
   * @param queryResults 检索结果
   * @returns 引用源数组
   */
  private extractSources(queryResults: QueryResult[]): Source[] {
    // 去重：使用 filePath + startLine + endLine 作为唯一键
    const seen = new Set<string>();
    const sources: Source[] = [];

    for (const result of queryResults) {
      const metadata = result.metadata || {};
      const key = `${metadata.filePath}:${metadata.startLine}-${metadata.endLine}`;

      if (!seen.has(key)) {
        seen.add(key);
        sources.push({
          filePath: metadata.filePath as string || 'unknown',
          startLine: metadata.startLine as number || 0,
          endLine: metadata.endLine as number || 0,
          content: result.document,
          relevanceScore: 1 - result.distance,
        });
      }
    }

    return sources;
  }

  /**
   * 调用 LLM 生成回答
   * @param question 用户问题
   * @param context 检索到的上下文
   * @returns LLM 回答
   */
  private async callLLM(question: string, context: string): Promise<string> {
    const prompt = PROMPT_TEMPLATE.replace('{context}', context).replace('{question}', question);

    console.log(`\n💬 正在生成回答...`);

    const response = await this.client.chat.completions.create({
      model: config.model.llm,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 较低的温度，使回答更准确
      max_tokens: 2000,
    });

    const answer = response.choices[0]?.message?.content || '无法生成回答';
    console.log(`✓ 回答生成完成`);

    return answer;
  }

  /**
   * 处理用户问题（完整流程）
   * @param question 用户问题
   * @param topK 检索结果数量
   * @returns 回答结果
   */
  async ask(question: string, topK: number = 15): Promise<AnswerResult> {
    // 检索相关代码
    const retrievalResult = await this.retrieve(question, topK);

    // 构建上下文
    const context = this.buildContext(retrievalResult.queryResults);

    // 调用 LLM
    const answer = await this.callLLM(question, context);

    // 提取引用源
    const sources = this.extractSources(retrievalResult.queryResults);

    return {
      answer,
      sources,
      model: config.model.llm,
    };
  }

  /**
   * 格式化带引用的回答
   * @param answerResult 回答结果
   * @returns 格式化后的字符串
   */
  formatAnswerWithSources(answerResult: AnswerResult): string {
    const { answer, sources } = answerResult;

    let output = '\n📋 回答:\n';
    output += '─'.repeat(50) + '\n';
    output += answer + '\n';
    output += '─'.repeat(50) + '\n';

    if (sources.length > 0) {
      output += '\n📚 引用源:\n';
      sources.forEach((source, index) => {
        output += `\n[${index + 1}] ${source.filePath}:${source.startLine}-${source.endLine}`;
        output += `\n    相关性：${(source.relevanceScore * 100).toFixed(1)}%`;
        output += `\n    内容预览：${source.content.substring(0, 100).replace(/\n/g, ' ')}...`;
      });
    }

    return output;
  }
}

// 单例实例
let qaServiceInstance: RetrieveQAService | null = null;

/**
 * 获取 RetrieveQAService 单例
 */
export function getRetrieveQAService(): RetrieveQAService {
  if (!qaServiceInstance) {
    qaServiceInstance = new RetrieveQAService();
  }
  return qaServiceInstance;
}
