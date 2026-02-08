# Ubuntu Server Manager Skill 使用指南

## 概述

我已经为你创建了一个专门的 **Ubuntu Server Manager Skill**，它可以接管和管理你的 Ubuntu 服务器（182.254.180.26）。

---

## ✅ Skill 已创建

**位置**: `d:\TOBEHOST\xplan2026\.codebuddy\skills\ubuntu-server-manager\`

**压缩包**: `ubuntu-server-manager-v1.0.zip`

---

## 📋 Skill 包含的内容

### 1. SKILL.md（核心文件）
- Skill 的元数据和触发条件
- 完整的工作流程说明
- 常见任务的执行步骤
- 安全最佳实践

### 2. Scripts（可执行脚本）
- `check-server-health.sh` - 服务器健康检查脚本

### 3. References（参考文档）
- `server-architecture.md` - 服务器架构说明
- `troubleshooting-guide.md` - 故障排查指南

### 4. Assets（资源文件）
- `xplan-demo.conf` - Nginx 配置模板

### 5. README.md
- Skill 使用说明
- 常见问题解答
- 维护计划

---

## 🚀 如何使用这个 Skill

### 方法 1：自动触发（推荐）

当你在对话中提到以下关键词时，Skill 会自动加载：

- "部署到服务器"
- "服务器管理"
- "Ubuntu 服务器"
- "检查服务器健康"
- "Nginx 配置"
- "部署失败"
- "服务器错误"

**示例对话**:
```
你: 帮我检查一下服务器健康状态
我: [自动加载 Skill] 运行健康检查脚本...
```

```
你: 部署到服务器失败了，帮我看看
我: [自动加载 Skill] 查看故障排查指南...
```

### 方法 2：手动请求

你可以直接要求加载 Skill：

```
你: 请加载 ubuntu-server-manager skill
我: [加载 Skill] Skill 已加载，现在可以管理服务器了
```

---

## 💡 常见使用场景

### 场景 1：初始化新服务器

```
你: 我需要初始化新的 Ubuntu 服务器
我: [加载 Skill]
    执行以下步骤：
    1. 连接到服务器
    2. 运行 setup-server.sh
    3. 配置 Nginx
    4. 验证部署
```

### 场景 2：部署前端应用

```
你: 部署官网到服务器
我: [加载 Skill]
    执行部署脚本...
    验证部署状态...
    重启 Nginx...
```

### 场景 3：排查服务器问题

```
你: 服务器无法访问，帮我看看
我: [加载 Skill]
    检查连接...
    查看 Nginx 日志...
    分析错误信息...
    提供解决方案...
```

### 场景 4：健康监控

```
你: 检查服务器健康状态
我: [加载 Skill]
    运行健康检查脚本...
    生成健康报告...
```

---

## 🔧 Skill 提供的功能

### 1. 服务器管理
- ✅ SSH 连接管理
- ✅ 服务状态监控
- ✅ 文件权限设置
- ✅ 防火墙配置

### 2. 部署自动化
- ✅ GitHub Actions 集成
- ✅ 自动构建和部署
- ✅ 部署状态验证
- ✅ 回滚支持

### 3. 健康监控
- ✅ CPU、内存、磁盘监控
- ✅ Nginx 状态检查
- ✅ 应用部署验证
- ✅ 日志分析

### 4. 故障排查
- ✅ 常见问题诊断
- ✅ 错误日志分析
- ✅ 性能优化建议
- ✅ 恢复步骤指导

### 5. 安全管理
- ✅ SSH 密钥管理
- ✅ 防火墙配置
- ✅ SSL/TLS 证书
- ✅ 访问控制

---

## 📦 安装和部署 Skill

### 步骤 1：验证 Skill 结构

```bash
# 查看 Skill 目录
cd d:\TOBEHOST\xplan2026\.codebuddy\skills\ubuntu-server-manager
dir

# 应该看到：
# SKILL.md
# README.md
# scripts/
# references/
# assets/
```

### 步骤 2：测试 Skill（可选）

如果 CodeBuddy 支持 Skill 加载测试，可以测试：

```
你: 测试 ubuntu-server-manager skill
我: [执行测试]
    Skill 结构验证通过
    脚本可执行性检查通过
    参考文档完整性检查通过
```

### 步骤 3：开始使用

直接开始使用，无需额外安装步骤！

---

## 🎯 下一步操作建议

### 1. 配置 GitHub Secrets（必需）

在 GitHub 仓库中配置以下 Secrets：

```
CLOUDFLARE_API_TOKEN          # Cloudflare API 令牌
CLOUDFLARE_ACCOUNT_ID         # Cloudflare 账户 ID
SSH_PRIVATE_KEY               # SSH 私钥
SSH_HOST                      # 182.254.180.26
SSH_USER                      # root
PINATA_API_KEY                # Pinata API 密钥
PINATA_API_SECRET             # Pinata API 密钥
PINATA_JWT                    # Pinata JWT 令牌
```

### 2. 初始化服务器（首次使用）

```bash
# 连接到服务器
ssh root@182.254.180.26

# 运行设置脚本
cd /tmp
git clone https://github.com/xplan2026/xplandemo.git
cd xplandemo
bash server-configs/setup-server.sh
```

### 3. 测试部署

```bash
# 推送代码到 GitHub
git add .
git commit -m "测试部署"
git push origin master

# GitHub Actions 会自动触发部署
```

---

## 📚 相关文档

- **完整部署指南**: `docs/部署指南/完整的部署配置.md`
- **任务完成总结**: `temp/任务完成总结.md`
- **Skill README**: `.codebuddy/skills/ubuntu-server-manager/README.md`
- **服务器架构**: `.codebuddy/skills/ubuntu-server-manager/references/server-architecture.md`
- **故障排查**: `.codebuddy/skills/ubuntu-server-manager/references/troubleshooting-guide.md`

---

## 🔍 Skill 触发示例

以下是一些会触发 Skill 的对话示例：

### 自动触发

```
你: 帮我部署到 Ubuntu 服务器
我: [自动加载 Skill] 开始部署...

你: Nginx 配置有问题
我: [自动加载 Skill] 检查 Nginx 配置...

你: 服务器 CPU 使用率很高
我: [自动加载 Skill] 分析 CPU 使用情况...

你: 查看服务器日志
我: [自动加载 Skill] 获取日志...
```

### 手动触发

```
你: 使用 ubuntu-server-manager skill 检查健康状态
我: [手动加载 Skill] 运行健康检查...
```

---

## ⚠️ 注意事项

1. **SSH 密钥安全**
   - 不要将 SSH 私钥提交到 Git
   - 定期更换 SSH 密钥
   - 使用强密码保护密钥

2. **权限管理**
   - 定期审查用户权限
   - 不要在生产环境使用 root 账户进行日常操作
   - 使用 sudo 限制权限

3. **日志管理**
   - 定期清理旧日志
   - 设置日志轮转
   - 备份重要日志

4. **备份策略**
   - 定期备份配置文件
   - 验证备份完整性
   - 保留多个备份版本

---

## 🎉 总结

你现在拥有一个功能完整的 **Ubuntu Server Manager Skill**，它可以：

- ✅ 自动化服务器管理任务
- ✅ 提供故障排查指导
- ✅ 监控服务器健康状态
- ✅ 管理部署流程
- ✅ 提供安全建议

**立即开始使用！**

```
你: 帮我检查服务器状态
我: [加载 Skill] 开始检查...
```

---

**创建日期**: 2026-02-08
**Skill 版本**: 1.0
**服务器 IP**: 182.254.180.26
