# Git 提交安全检查

**创建日期**: 2026-02-02  
**适用分支**: 所有分支

---

## 概述

本项目使用 Git pre-commit 钩子来防止提交敏感信息，确保代码仓库的安全性。

---

## 检查内容

Pre-commit 钩子会检查以下敏感信息：

### 1. 私钥检测
- 检测格式: `0x` 后跟 64 个十六进制字符
- 示例: `0x1234567890abcdef...`

### 2. API Token 检测
- 检测硬编码的 API Token
- 排除占位符: `<your_token>`, `your_token`, `your-api-token`
- 检测模式: `CLOUDFLARE_API_TOKEN="..."`

### 3. API Key 检测
- 检测 32+ 字符长的 API Key
- 检测模式: `X-API-Key: "..."`

### 4. 密码检测
- 检测包含密码关键词的长字符串
- 关键词: `password`, `secret`, `private_key`

### 5. 环境文件检测
- `.env` 文件
- `.dev.vars` 文件

### 6. 大文件警告
- 检测超过 100KB 的文件
- 仅警告，不阻止提交

### 7. 二进制文件警告
- 检测常见二进制文件格式
- 仅警告，不阻止提交

---

## 使用方法

### 正常提交

```bash
git add .
git commit -m "commit message"
```

提交前会自动运行安全检查，如果发现问题会中止提交。

### 跳过检查（不推荐）

如果需要跳过检查，使用 `--no-verify` 参数：

```bash
git commit --no-verify -m "commit message"
```

**警告**: 仅在确信没有敏感信息时使用此选项。

---

## 输出示例

### 检查通过

```
========================================
Git 提交安全检查
========================================

检查暂存的文件:
index.js
api.js

检查私钥 ... ✓
检查 API Token ... ✓
检查 API Key ... ✓
检查密码关键词 ... ✓
检查环境文件 ... ✓
检查大文件 ... ✓
检查二进制文件 ... ✓

========================================
✓ 安全检查通过
========================================
```

### 检查失败

```
========================================
Git 提交安全检查
========================================

检查暂存的文件:
config.js

检查私钥 ... ❌ 发现私钥格式
+const PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" (示例)
检查 API Token ... ❌ 发现硬编码的 API Token
+export CLOUDFLARE_API_TOKEN="3r83Sa64WIxZ..."

========================================
❌ 发现 2 个安全问题，提交已中止
请修复后再提交
```

---

## .gitignore 配置

确保以下类型文件不会被追踪：

```gitignore
# 环境文件
.env
.env.local
.env.*.local

# Cloudflare
cloudflare/**/.dev.vars

# 敏感文件
**/*secret*.txt
**/*private*.txt
**/*token*.txt
**/*.pem
**/*.key

# 部署脚本（本地使用）
cloudflare/deploy-all.sh
```

---

## 安全最佳实践

### 1. 敏感信息存储

**禁止提交**:
- API Token
- 私钥
- 密码
- 密钥文件（.pem, .key）

**正确做法**:
- 使用环境变量
- 使用 Cloudflare Secrets
- 在文档中使用占位符

### 2. 文档编写

**❌ 错误**:
```markdown
export CLOUDFLARE_API_TOKEN="3r83Sa64WIxZHbPhD3rcjA8jTjGC5usY9nm5NyKY"
```

**✅ 正确**:
```markdown
export CLOUDFLARE_API_TOKEN="<your-api-token>"
```

### 3. 代码注释

**❌ 错误**:
```javascript
// API Key: 3r83Sa64WIxZHbPhD3rcjA8jTjGC5usY9nm5NyKY
const apiKey = process.env.API_KEY
```

**✅ 正确**:
```javascript
// 从环境变量获取 API Key
const apiKey = process.env.API_KEY
```

---

## 钩子位置

Pre-commit 钩子位于：
```
/workspace/.git/hooks/pre-commit
```

---

## 维护说明

### 更新检查规则

编辑 `/workspace/.git/hooks/pre-commit` 文件即可更新检查规则。

### 添加新的检测模式

在钩子文件中添加新的检查函数：

```bash
check_pattern() {
    local pattern="$1"
    local description="$2"

    echo -n "检查 $description ... "

    if git diff --cached | grep -E "$pattern" > /dev/null; then
        echo -e "${RED}❌ 发现敏感模式${NC}"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓${NC}"
    fi
}

# 调用检查
check_pattern "your_pattern_here" "自定义检查"
```

---

**最后更新**: 2026-02-02
**维护者**: Development Team
