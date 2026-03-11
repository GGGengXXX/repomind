# RepoMind - 环境配置说明

## 获取阿里百炼 API Key

1. 访问：https://dashscope.console.aliyun.com/apiKey
2. 登录阿里云账号
3. 点击 "创建 API Key"
4. 复制生成的 `sk-` 开头的密钥

## 配置 .env 文件

1. 打开 `.env` 文件
2. 将 `DASHSCOPE_API_KEY=sk-your-api-key-here` 改为你的真实 API Key
   ```
   DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

## 支持的模型

**聊天/问答模型 (LLM_MODEL):**
- `qwen3.5-plus` - 推荐，性价比高
- `qwen3-coder-plus` - 代码专用
- `qwen3-max-2026-01-23` - 最强模型

**嵌入模型 (EMBEDDING_MODEL):**
- `text-embedding-v3` - 阿里百炼文本嵌入模型

## 模型调用说明

我们的代码使用 OpenAI 兼容格式调用阿里百炼：
- 基础 URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- 这意味着可以直接使用 `openai` npm 包
- 只需修改 `baseURL` 和 `apiKey` 即可
