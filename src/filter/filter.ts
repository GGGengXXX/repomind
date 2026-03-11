import fs from 'fs/promises';
import path from 'path';

// 需要过滤掉的文件夹
const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'venv',
  '__pycache__',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  'vendor',
  'target',
  'bin',
  'obj',
  '.idea',
  '.vscode',
  '.vs',
];

// 需要过滤掉的文件扩展名
const EXCLUDED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.bmp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.db',
  '.sqlite',
  '.lock',
];

// 需要过滤掉的文件名
const EXCLUDED_FILES = [
  '.gitignore',
  '.DS_Store',
  'Thumbs.db',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
];

// 代码文件的扩展名（只保留这些）
const CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.swift',
  '.kt',
  '.scala',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.ps1',
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.xml',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte',
  '.astro',
  '.sql',
  '.graphql',
  '.gql',
  '.proto',
  '.thrift',
  '.dockerfile',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'makefile',
  'makefile',
  'cmakelists.txt',
  'cargo.toml',
  'pyproject.toml',
  'setup.py',
  'requirements.txt',
  'go.mod',
  'go.sum',
  'package.json',
  'tsconfig.json',
  'jsconfig.json',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  '.prettierrc',
  'prettier.config.js',
  'README',
  'README.md',
  'CHANGELOG',
  'LICENSE',
  'CONTRIBUTING',
];

export interface FileInfo {
  path: string;
  content: string;
  extension: string;
}

/**
 * 过滤并读取仓库中的代码文件
 * @param repoPath 仓库根目录
 * @returns 文件信息列表
 */
export async function filterAndReadFiles(repoPath: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  console.log(`🔍 开始扫描仓库：${repoPath}`);

  await scanDirectory(repoPath, repoPath, files);

  console.log(`✓ 找到 ${files.length} 个代码文件`);

  return files;
}

/**
 * 递归扫描目录
 */
async function scanDirectory(
  dir: string,
  repoPath: string,
  files: FileInfo[]
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoPath, fullPath);

      // 跳过排除的目录
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.includes(entry.name)) {
          continue;
        }
        await scanDirectory(fullPath, repoPath, files);
        continue;
      }

      // 跳过排除的文件
      if (EXCLUDED_FILES.includes(entry.name)) {
        continue;
      }

      // 跳过排除的扩展名
      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDED_EXTENSIONS.includes(ext)) {
        continue;
      }

      // 读取文件内容
      try {
        const content = await fs.readFile(fullPath, 'utf-8');

        // 跳过空文件或过大的文件（大于 1MB）
        if (!content.trim() || content.length > 1024 * 1024) {
          continue;
        }

        files.push({
          path: relativePath,
          content,
          extension: ext || path.basename(entry.name), // 对于没有扩展名的文件，使用文件名
        });
      } catch (error) {
        // 跳过无法读取的文件（二进制文件等）
        continue;
      }
    }
  } catch (error) {
    // 跳过无法访问的目录
    console.warn(`无法访问目录：${dir}`);
  }
}
