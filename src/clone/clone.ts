import git from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface CloneResult {
  success: boolean;
  repoPath: string;
  error?: string;
}

/**
 * 克隆 GitHub 仓库到本地临时目录
 * @param repoUrl GitHub 仓库 URL，例如：https://github.com/owner/repo
 * @returns 克隆结果
 */
export async function cloneRepository(repoUrl: string): Promise<CloneResult> {
  try {
    // 创建一个临时目录来存放克隆的仓库
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repomind-'));
    const repoPath = path.join(tempDir, 'repo');

    console.log(`📥 正在克隆仓库：${repoUrl}`);
    console.log(`📁 目标目录：${repoPath}`);

    // 使用 simple-git 克隆仓库
    await git().clone(repoUrl, repoPath, [
      '--depth', '1',        // 浅克隆，只下载最近的 commit，加快速度
      '--single-branch',     // 只克隆主分支
    ]);

    console.log(`✓ 仓库克隆成功`);

    return {
      success: true,
      repoPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error(`✗ 克隆失败：${errorMessage}`);

    return {
      success: false,
      repoPath: '',
      error: errorMessage,
    };
  }
}

/**
 * 清理克隆的仓库（删除临时目录）
 * @param repoPath 仓库路径
 */
export async function cleanupRepository(repoPath: string): Promise<void> {
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
    console.log(`🧹 已清理临时目录：${repoPath}`);
  } catch (error) {
    console.error(`清理目录失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}
