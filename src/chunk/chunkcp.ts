import type { FileInfo } from '../filter/filter.js';
import type { Chunk, ChunkOptions } from './types.js';
import { detectLanguage, findCodeBlocks, splitByParagraph } from './code-parser.js';

const DEFAULT_OPTIONS: ChunkOptions = {
    maxLines: 100,
    maxChars: 4000,
    overlap: 0,
};

let chunkCounter = 0;

function generateChunkId(): string {
    chunkCounter++;
    return `chunk-${Date.now()}-${chunkCounter}`;
}

export function chunkFiles(files: FileInfo[], options?: ChunkOptions) : Chunk[]
{
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const chunks: Chunk[] = [];
    
    console.log(`🔪 开始切分 ${files.length} 个文件...`);

    for (const file of files)
    {
        const fileChunks = chunkFile(file, opts);
        chunks.push(...fileChunks);
    }
}

function chunkFile(file: FileInfo, options: ChunkOptions): Chunk[]
{
    const language = detectLanguage(file.extension);
    const chunks: Chunk[] = [];

    if (language === 'Unknown' || language === 'Markdown' || language === 'JSON' || language === 'YAML')
    {
        // Handle special cases for unknown, markdown, JSON, and YAML files
        const paragraphs = splitByParagraph(file.content);
        for (const paragraph of paragraphs)
        {
            chunks.push({
                id: generateChunkId(),
                filePath: file.path,
                content: paragraph,
                startLine: paragraph.startLine,
                endLine: paragraph.endLine,
                language,
                metadata: {
                    type: 'text',
                },
            });
        }
        return chunks;
    }

    // 对于代码文件，使用代码块识别
    const codeBlocks = findCodeBlocks(file.content, language);

    if (codeBlocks.length === 0)
    {
        const lines = file.content.split('\n');
        if (lines.length <= options.maxLines! && file.content.length <= options.maxChars!)
    }


    return chunks;
}