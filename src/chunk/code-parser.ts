import * as Parser from 'web-tree-sitter';
import type { CodeBlock } from './types.js';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tree-sitter Parser 实例缓存
const parserCache = new Map<string, Parser.Parser>();
const languageCache = new Map<string, Parser.Language>();

// 是否已初始化
let isInitialized = false;

/**
 * 初始化 Tree-sitter
 * 加载 WASM 文件
 */
export async function initTreeSitter(): Promise<void> {
  if (isInitialized) return;

  // 使用动态导入确保正确加载
  const ts = await import('web-tree-sitter');
  await ts.Parser.init();
  isInitialized = true;
}

/**
 * 文件扩展名到语言包目录的映射
 */
const TREE_SITTER_LANGUAGES: Record<string, { dir: string; wasm: string }> = {
  ts: { dir: 'tree-sitter-typescript', wasm: 'tree-sitter-typescript.wasm' },
  tsx: { dir: 'tree-sitter-typescript', wasm: 'tree-sitter-tsx.wasm' },
  js: { dir: 'tree-sitter-javascript', wasm: 'tree-sitter-javascript.wasm' },
  jsx: { dir: 'tree-sitter-javascript', wasm: 'tree-sitter-javascript.wasm' },
  py: { dir: 'tree-sitter-python', wasm: 'tree-sitter-python.wasm' },
  go: { dir: 'tree-sitter-go', wasm: 'tree-sitter-go.wasm' },
  rs: { dir: 'tree-sitter-rust', wasm: 'tree-sitter-rust.wasm' },
  java: { dir: 'tree-sitter-java', wasm: 'tree-sitter-java.wasm' },
};

/**
 * 文件扩展名到语言名称的映射
 */
const LANGUAGE_MAP: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  cpp: 'C++',
  cc: 'C++',
  c: 'C',
  h: 'C',
  hpp: 'C++',
  php: 'PHP',
  rb: 'Ruby',
  swift: 'Swift',
  kt: 'Kotlin',
  scala: 'Scala',
  sh: 'Shell',
  md: 'Markdown',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
};

/**
 * 根据文件扩展名检测编程语言
 * @param extension 文件扩展名（如 '.ts' 或 'ts'）
 * @returns 语言名称
 */
export function detectLanguage(extension: string): string {
  const ext = extension.replace(/^\./, '').toLowerCase();
  return LANGUAGE_MAP[ext] || 'Unknown';
}

/**
 * 获取 Tree-sitter 语言对象
 */
async function getParserForLanguage(ext: string): Promise<{ parser: Parser.Parser; language: Parser.Language } | null> {
  const langInfo = TREE_SITTER_LANGUAGES[ext];
  if (!langInfo) return null;

  if (parserCache.has(ext)) {
    return {
      parser: parserCache.get(ext)!,
      language: languageCache.get(ext)!,
    };
  }

  try {
    // 获取语言包目录
    const langDir = path.join(__dirname, `../../node_modules/${langInfo.dir}`);
    const wasmPath = path.join(langDir, langInfo.wasm);

    // 动态导入以获取 Language
    const ts = await import('web-tree-sitter');

    // 加载语言
    const language = await ts.Language.load(wasmPath);
    languageCache.set(ext, language);

    // 创建 parser
    const parser = new ts.Parser();
    parser.setLanguage(language);
    parserCache.set(ext, parser);

    return { parser, language };
  } catch (error) {
    console.warn(`无法加载 Tree-sitter 语言包：${langInfo.dir}`, error);
    return null;
  }
}

/**
 * 从 AST 节点提取代码块信息
 */
async function extractCodeBlocksFromAST(
  node: Parser.SyntaxNode,
  lines: string[],
  ext: string,
  language: Parser.Language
): Promise<CodeBlock[]> {
  const codeBlocks: CodeBlock[] = [];

  // 定义不同语言的查询模式
  const queryPatterns: Record<string, string> = {
    // TypeScript
    ts: `
      (function_declaration name: (identifier) @name)
      (class_declaration name: (type_identifier) @name)
      (method_definition name: (property_identifier) @name)
      (variable_declarator name: (identifier) @name value: (arrow_function))
    `,
    // TSX
    tsx: `
      (function_declaration name: (identifier) @name)
      (class_declaration name: (type_identifier) @name)
      (method_definition name: (property_identifier) @name)
      (variable_declarator name: (identifier) @name value: (arrow_function))
    `,
    // JavaScript
    js: `
      (function_declaration name: (identifier) @name)
      (class_declaration name: (identifier) @name)
      (method_definition name: (property_identifier) @name)
      (variable_declarator name: (identifier) @name value: (arrow_function))
    `,
    // JSX
    jsx: `
      (function_declaration name: (identifier) @name)
      (class_declaration name: (identifier) @name)
      (method_definition name: (property_identifier) @name)
      (variable_declarator name: (identifier) @name value: (arrow_function))
    `,
    // Python
    py: `
      (function_definition name: (identifier) @name)
      (class_definition name: (identifier) @name)
    `,
    // Go
    go: `
      (function_declaration name: (identifier) @name)
      (method_declaration name: (field_identifier) @name)
      (type_declaration (type_spec name: (type_identifier) @name))
    `,
    // Rust
    rs: `
      (function_item name: (identifier) @name)
      (impl_item type: (type_identifier) @name)
      (struct_item name: (type_identifier) @name)
    `,
    // Java
    java: `
      (method_declaration name: (identifier) @name)
      (class_declaration name: (identifier) @name)
      (interface_declaration name: (identifier) @name)
    `,
  };

  const queryStr = queryPatterns[ext];
  if (!queryStr) return [];

  try {
    const ts = await import('web-tree-sitter');
    const query = new ts.Query(language, queryStr);
    const matches = query.matches(node);

    const seen = new Set<string>();

    for (const match of matches) {
      for (const capture of match.captures) {
        if (capture.name === 'name') {
          const nameNode = capture.node;
          let declarationNode = capture.node.parent;
          if (!declarationNode) continue;

          // 对于 arrow_function，需要向上找到 variable_declarator
          if (declarationNode.type === 'arrow_function') {
            declarationNode = declarationNode.parent || declarationNode;
          }

          // 确定类型
          let type: CodeBlock['type'] = 'module';
          const parentType = declarationNode.type;
          if (parentType.includes('function') || parentType.includes('arrow')) {
            type = 'function';
          } else if (parentType.includes('class')) {
            type = 'class';
          } else if (parentType.includes('method')) {
            type = 'method';
          } else if (parentType.includes('impl') || parentType.includes('struct')) {
            type = 'class';
          }

          // 获取代码块的完整内容（整个声明节点）
          const startLine = declarationNode.startPosition.row + 1;
          const endLine = declarationNode.endPosition.row + 1;
          const blockContent = lines.slice(startLine - 1, endLine).join('\n');

          // 去重
          const key = `${startLine}-${endLine}-${nameNode.text}`;
          if (seen.has(key)) continue;
          seen.add(key);

          codeBlocks.push({
            name: nameNode.text,
            type,
            startLine,
            endLine,
            content: blockContent,
          });
        }
      }
    }
  } catch (error) {
    console.warn('Tree-sitter 查询失败:', error);
  }

  return codeBlocks;
}

/**
 * 检测文件中的代码块（使用 Tree-sitter AST 解析）
 * @param content 文件内容
 * @param extension 文件扩展名
 * @returns 代码块数组
 */
export async function findCodeBlocks(content: string, extension: string): Promise<CodeBlock[]> {
  const ext = extension.replace(/^\./, '').toLowerCase();

  // 检查是否有对应的 Tree-sitter 语言支持
  const result = await getParserForLanguage(ext);

  if (!result) {
    // 如果不支持该语言，返回空数组
    return [];
  }

  const { parser, language } = result;
  const lines = content.split('\n');

  try {
    // 解析代码
    const tree = parser.parse(content);

    // 从 AST 中提取代码块
    const codeBlocks = await extractCodeBlocksFromAST(tree.rootNode, lines, ext, language);

    // 按起始行号排序
    codeBlocks.sort((a, b) => a.startLine - b.startLine);

    return codeBlocks;
  } catch (error) {
    console.warn(`Tree-sitter 解析失败 (${ext}):`, error);
    return [];
  }
}

/**
 * 按段落切分文本文件（如 Markdown）
 * @param content 文件内容
 * @param filePath 文件路径
 * @param language 语言名称
 * @returns Chunk 数组
 */
export function splitByParagraph(
  content: string,
  filePath: string,
  language: string,
  maxLines: number = 100,
  maxChars: number = 4000
): Array<{ startLine: number; endLine: number; content: string }> {
  const lines = content.split('\n');
  const chunks: Array<{ startLine: number; endLine: number; content: string }> = [];

  let currentChunk: string[] = [];
  let chunkStartLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否需要开始新的段落（空行分隔）
    if (line.trim() === '' && currentChunk.length > 0) {
      if (currentChunk.length <= maxLines && currentChunk.join('\n').length <= maxChars) {
        chunks.push({
          startLine: chunkStartLine,
          endLine: i,
          content: currentChunk.join('\n'),
        });
      }
      currentChunk = [];
      chunkStartLine = i + 2; // 跳过空行
    } else if (line.trim() !== '') {
      currentChunk.push(line);
    }
  }

  // 处理最后一块
  if (currentChunk.length > 0) {
    chunks.push({
      startLine: chunkStartLine,
      endLine: lines.length,
      content: currentChunk.join('\n'),
    });
  }

  return chunks;
}
