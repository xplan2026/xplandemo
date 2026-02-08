# GitHub 认证指南

## 当前问题

Git 推送失败，错误：`permission denied`

弹窗认证在当前环境中不可用，需要手动配置 GitHub 认证。

---

## 解决方案

### 方法 1: 使用浏览器登录（推荐）

1. **打开浏览器登录 GitHub**:
   - 访问 https://github.com/login
   - 输入用户名: `xplan2026`
   - 输入密码登录

2. **创建 Personal Access Token**:
   - 登录后访问: https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 勾选 `repo` 权限
   - 点击 "Generate token"
   - **复制生成的 token**（格式: `ghp_xxxxxxxxxxxx`）

3. **将 token 告知我**:
   - 我将使用该 token 完成推送
   - token 仅在当前会话使用，不会存储

---

### 方法 2: 使用 Git Bash 交互式登录

如果您有 Git Bash 或支持交互式终端的环境：

```bash
# 方法 1: 使用密码推送（会弹窗）
cd d:/TOBEHOST/xplan2026
git push origin master

# 方法 2: 手动输入凭据
git credential fill
# 输入:
# protocol=https
# host=github.com
# username=xplan2026
# password=<your-password-or-token>
```

---

### 方法 3: 配置 SSH 密钥（长期使用）

1. **生成 SSH 密钥**:
   ```bash
   ssh-keygen -t ed25519 -C "xplan2026@163.com"
   ```

2. **复制公钥**:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

3. **添加到 GitHub**:
   - 访问: https://github.com/settings/ssh/new
   - 粘贴公钥
   - 点击 "Add SSH key"

4. **切换到 SSH URL**:
   ```bash
   git remote set-url origin git@github.com:xplan2026/xplandemo.git
   git push origin master
   ```

---

## 当前提交信息

**提交哈希**: `e386057`  
**提交信息**: feat: 添加 X-plan Demo 项目  
**文件变更**: 130 files, 34,485 insertions(+)

---

## 请选择

**选项 A**: 我已在浏览器创建了 Personal Access Token，token 是: `_____________`  
**选项 B**: 我将使用 SSH 密钥方式  
**选项 C**: 我将使用 Git Bash 独立推送

---

## 注意事项

⚠️ **安全问题**:
- 不要将 token 或密码通过不安全的渠道传输
- Token 使用后可以随时在 GitHub 设置中撤销
- 建议定期更新 Personal Access Token

---

**请告诉我您选择哪种方法，或直接提供 token（格式: `ghp_xxxxxxxxxxxx`）**
