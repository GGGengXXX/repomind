/**
 * 代码切片（Chunk）接口
 * 表示从源文件中切分出来的一段代码
 */
export interface Chunk {
  /** 唯一标识符 */
  id: string;
  /** 源文件路径 */
  filePath: string;
  /** 代码片段内容 */
  content: string;
  /** 起始行号（从 1 开始） */
  startLine: number;
  /** 结束行号（从 1 开始） */
  endLine: number;
  /** 编程语言 */
  language: string;
  /** 元数据 */
  metadata: {
    /** 代码块类型 */
    type?: 'function' | 'class' | 'method' | 'module' | 'text';
    /** 函数名/类名 */
    name?: string;
  };
}

/**
 * 切片配置选项
 */
export interface ChunkOptions {
  /** 最大行数，超过此行数的代码块会被进一步切分（默认 100） */
  maxLines?: number;
  /** 最大字符数，超过此字符数的代码块会被进一步切分（默认 4000） */
  maxChars?: number;
  /** 重叠行数，相邻切片之间重叠的行数（默认 0） */
  overlap?: number;
}

/**
 * 代码块接口
 * 表示从源文件中识别出的一个完整代码结构（函数、类等）
 */
export interface CodeBlock {
  /** 代码块名称（函数名、类名等） */
  name: string;
  /** 代码块类型 */
  type: 'function' | 'class' | 'method' | 'module';
  /** 起始行号 */
  startLine: number;
  /** 结束行号 */
  endLine: number;
  /** 代码内容 */
  content: string;
}
