import type { FileInfo } from '../filter/filter.js';
import type { Chunk, ChunkOptions, CodeBlock } from './types.js';
import { detectLanguage, findCodeBlocks, splitByParagraph, initTreeSitter } from './code-parser.js';

/**
 * 默认切片配置
 */
const DEFAULT_OPTIONS: ChunkOptions = {
  maxLines: 100,
  maxChars: 4000,
  overlap: 0,
};

/**
 * 计数器，用于生成唯一 ID
 */
let chunkCounter = 0;

/**
 * 生成唯一 ID
 */
function generateChunkId(): string {
  chunkCounter++;
  return `chunk-${Date.now()}-${chunkCounter}`;
}

/**
 * 初始化切片模块（加载 Tree-sitter WASM）
 * 必须在使用前调用
 */
export async function initChunk(): Promise<void> {
  await initTreeSitter();
}

/**
 * 将文件数组切分成 Chunk
 * @param files 文件信息数组
 * @param options 切片配置选项
 * @returns Chunk 数组
 */
export async function chunkFiles(files: FileInfo[], options?: ChunkOptions): Promise<Chunk[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];

  console.log(`🔪 开始切分 ${files.length} 个文件...`);

  for (const file of files) {
    const fileChunks = await chunkFile(file, opts);
    chunks.push(...fileChunks);
  }

  console.log(`✓ 切分完成，共生成 ${chunks.length} 个 Chunk`);

  return chunks;
}

/**
 * 将单个文件切分成 Chunk
 * @param file 文件信息
 * @param options 切片配置选项
 * @returns Chunk 数组
 */
async function chunkFile(file: FileInfo, options: ChunkOptions): Promise<Chunk[]> {
  const language = detectLanguage(file.extension);
  const chunks: Chunk[] = [];

  // 对于非代码文件，按段落切分
  if (language === 'Unknown' || language === 'Markdown' || language === 'JSON' || language === 'YAML') {
    const paragraphs = splitByParagraph(file.content, file.path, language, options.maxLines!, options.maxChars!);
    for (const para of paragraphs) {
      chunks.push({
        id: generateChunkId(),
        filePath: file.path,
        content: para.content,
        startLine: para.startLine,
        endLine: para.endLine,
        language,
        metadata: {
          type: 'text',
        },
      });
    }
    return chunks;
  }

  // 对于代码文件，按代码结构切分（使用 Tree-sitter AST 解析）
  const codeBlocks = await findCodeBlocks(file.content, file.extension);

  if (codeBlocks.length === 0) {
    // 如果没有识别出代码块，将整个文件作为一个 Chunk
    const lines = file.content.split('\n');
    if (lines.length <= options.maxLines! && file.content.length <= options.maxChars!) {
      chunks.push({
        id: generateChunkId(),
        filePath: file.path,
        content: file.content,
        startLine: 1,
        endLine: lines.length,
        language,
        metadata: {
          type: 'module',
        },
      });
    } else {
      // 文件太大，按行数切分
      const lineChunks = chunkByLines(file.content, options.maxLines!, options.overlap!);
      for (const chunk of lineChunks) {
        chunks.push({
          id: generateChunkId(),
          filePath: file.path,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          language,
          metadata: {
            type: 'module',
          },
        });
      }
    }
    return chunks;
  }

  // 处理每个代码块
  for (const block of codeBlocks) {
    const lines = block.content.split('\n');

    // 检查代码块是否超过限制
    if (lines.length > options.maxLines! || block.content.length > options.maxChars!) {
      // 代码块太大，需要进一步切分
      const subChunks = chunkByLines(block.content, options.maxLines!, options.overlap!, block.startLine);
      for (const chunk of subChunks) {
        chunks.push({
          id: generateChunkId(),
          filePath: file.path,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          language,
          metadata: {
            type: block.type,
            name: block.name,
          },
        });
      }
    } else {
      // 代码块大小合适，直接添加
      chunks.push({
        id: generateChunkId(),
        filePath: file.path,
        content: block.content,
        startLine: block.startLine,
        endLine: block.endLine,
        language,
        metadata: {
          type: block.type,
          name: block.name,
        },
      });
    }
  }

  return chunks;
}

/**
 * 按行数切分代码
 */
function chunkByLines(
  content: string,
  maxLines: number,
  overlap: number,
  startLineOffset: number = 1
): Array<{ startLine: number; endLine: number; content: string }> {
  const lines = content.split('\n');
  const chunks: Array<{ startLine: number; endLine: number; content: string }> = [];

  let i = 0;
  while (i < lines.length) {
    const chunkEnd = Math.min(i + maxLines, lines.length);
    const chunkLines = lines.slice(i, chunkEnd);

    chunks.push({
      startLine: i + startLineOffset,
      endLine: chunkEnd + startLineOffset - 1,
      content: chunkLines.join('\n'),
    });

    // 移动到下一个 chunk，考虑重叠
    i += maxLines - overlap;
    if (i >= lines.length) break;
  }

  return chunks;
}

/**
 * 重置计数器（用于测试）
 */
export function resetCounter(): void {
  chunkCounter = 0;
}
