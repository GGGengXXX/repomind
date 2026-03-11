# RepoMind

**RepoMind** 是一个基于 RAG（检索增强生成）架构的仓库智能分析 Agent。它能够自动索引 GitHub 仓库的代码结构，并回答关于该项目的技术问题，所有回答都带有精确的引用溯源。

## 技术亮点

- **RAG 架构** - 检索增强生成，避免大模型幻觉
- **AST 感知型切片** - 基于 Tree-sitter 的代码结构解析
- **语义向量检索** - ChromaDB 向量数据库 + 余弦相似度搜索
- **引用溯源** - 每行回答都可定位到原始代码文件 + 行号

## 项目结构

```
RepoMind/
├── repomind/
│   ├── src/
│   │   ├── index.ts          # CLI 入口
│   │   ├── config/           # 配置管理
│   │   ├── clone/            # 仓库克隆
│   │   ├── filter/           # 文件过滤
│   │   ├── chunk/            # 代码切片 (AST)
│   │   ├── embed/            # Embedding 生成
│   │   ├── store/            # 向量存储 (ChromaDB)
│   │   └── retrieve/         # 检索问答
│   ├── .env                  # API Key 配置
│   └── package.json
├── chroma_data/              # ChromaDB 数据目录 (自动创建)
├── CHROMADB_SETUP.md         # ChromaDB 配置指南
└── README.md
```

## 快速开始

### 前置要求

- Node.js 18+
- npm / yarn / pnpm
- Python 3.8+ (用于 ChromaDB)
- 阿里百炼 API Key（或 OpenAI API Key）

### 1. 安装依赖

```bash
cd repomind
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 阿里百炼 API 配置
DASHSCOPE_API_KEY=sk-your-api-key-here
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 模型配置
LLM_MODEL=qwen3.5-plus
EMBEDDING_MODEL=text-embedding-v3

# ChromaDB 配置
CHROMA_HOST=http://localhost:8000
```

### 3. 启动 ChromaDB 服务器

```bash
# 方式 1: 使用 conda（推荐）
conda activate repomind
chroma run --path ./chroma_data --port 8000

# 方式 2: 使用 pip
pip install chromadb
chroma run --port 8000

# 方式 3: 使用 Docker
docker run -p 8000:8000 -v $(pwd)/chroma_data:/chroma/chroma chromadb/chroma
```

验证 ChromaDB 运行：

```bash
curl http://localhost:8000/api/v1
```

### 4. 运行 RepoMind

```bash
# 开发模式（使用 tsx）
npm run dev [要索引的目录]

# 或者直接使用当前目录测试
npm run dev .
```

### 5. 交互式问答

程序启动后会进入交互模式：

```
🤔 请输入你的问题：这个项目的认证逻辑在哪里？

📋 回答:
──────────────────────────────────────────────
这个项目的认证逻辑主要在以下文件中实现：

1. src/auth/login.ts:10-30 - 登录函数实现
2. src/middleware/auth.ts:5-20 - 认证中间件
...
──────────────────────────────────────────────

📚 引用源:
[1] src/auth/login.ts:10-30
    相关性：88.0%
    内容预览：function login(user, password) { ... }...
```

## 核心模块

| 模块 | 文件 | 功能 |
|------|------|------|
| **配置管理** | `config/config.ts` | 加载环境变量，验证 API Key |
| **仓库克隆** | `clone/clone.ts` | 使用 simple-git 克隆 GitHub 仓库 |
| **文件过滤** | `filter/filter.ts` | 智能过滤 node_modules, .git 等 |
| **代码切片** | `chunk/chunk.ts` + `code-parser.ts` | Tree-sitter AST 解析，按函数/类切分 |
| **Embedding** | `embed/embedding.ts` | 调用 API 生成代码向量 |
| **向量存储** | `store/vector-store.ts` | ChromaDB 集成，向量增删查 |
| **检索问答** | `retrieve/qa.ts` | 语义检索 + LLM 生成 + 引用溯源 |

## 开发路线图

- [x] Phase 1: 项目初始化
- [x] Phase 2: 仓库克隆 + 文件过滤
- [x] Phase 3: AST 代码切片
- [x] Phase 4: 向量化 + ChromaDB 存储
- [x] Phase 5: 检索问答 + 引用溯源
- [ ] Phase 6: CLI 交互优化（支持 GitHub URL、多轮对话）
- [ ] Phase 7: 测试优化 + 性能提升

## 配置说明

### 支持的模型

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `LLM_MODEL` | LLM 模型 | `qwen3.5-plus` |
| `EMBEDDING_MODEL` | Embedding 模型 | `text-embedding-v3` |

### 支持的语言

当前支持的代码语言（基于 Tree-sitter）：

- TypeScript / JavaScript
- Python
- Go
- Rust
- Java

## 常见问题

### 1. API Key 无效

确保在阿里百炼控制台开通服务并获取正确的 API Key：https://dashscope.console.aliyun.com/apiKey

### 2. ChromaDB 连接失败

```bash
# 检查 ChromaDB 是否运行
curl http://localhost:8000/api/v1

# 检查端口占用
lsof -i :8000
```

### 3. 向量库为空

确保 Embedding 服务能正常调用，检查 API Key 和网络连接。

### 4. Tree-sitter 加载失败

```bash
# 清除缓存重新安装
rm -rf node_modules
npm install
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript |
| AST 解析 | tree-sitter + web-tree-sitter |
| 向量数据库 | ChromaDB |
| Embedding | OpenAI 兼容 API（阿里百炼） |
| LLM | OpenAI 兼容 API（通义千问） |
| Git 操作 | simple-git |
| CLI | commander |

## 参考资料

- [RAG 架构介绍](https://en.wikipedia.org/wiki/Retrieval-augmented_generation)
- [Tree-sitter 文档](https://tree-sitter.github.io/tree-sitter/)
- [ChromaDB 文档](https://docs.trychroma.com/)
- [通义千问 API](https://help.aliyun.com/zh/dashscope/)

## License

MIT

---

**RepoMind Team** | 2026
