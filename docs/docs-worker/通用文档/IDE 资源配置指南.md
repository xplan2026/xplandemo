# cnb.cool 云原生开发IDE - 资源配置指南

## 概述

本指南介绍如何在 cnb.cool 云原生开发IDE中配置自定义开发环境和调整资源配置。

## 目录

- [自定义开发环境](#自定义开发环境)
- [资源配置](#资源配置)
- [当前项目配置](#当前项目配置)
- [操作步骤](#操作步骤)
- [验证配置](#验证配置)

---

## 自定义开发环境

### cnb.cool 机制说明

cnb.cool 支持通过自定义 Dockerfile 来构建开发环境镜像：

- 如果仓库根目录包含 `.ide/Dockerfile` 文件，启动开发环境时会优先使用该文件构建镜像
- 如果不存在 `.ide/Dockerfile`，则使用默认的 `cnbcool/default-dev-env` 镜像

### Dockerfile 配置

创建 `.ide/Dockerfile` 文件来自定义开发环境：

```dockerfile
# 基础镜像
FROM cnbcool/default-dev-env

# 设置 Node.js 版本
ENV NODE_VERSION=20

# 安装开发工具
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    vim \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# 全局安装工具
RUN npm install -g \
    @cloudflare/wrangler \
    eslint \
    prettier \
    typescript

# 暴露端口
EXPOSE 3000 8080 8787

# 默认命令
CMD ["/bin/bash"]
```

### Dev Container 配置（可选）

`.devcontainer/devcontainer.json` 提供更详细的开发环境配置：

```json
{
  "name": "X-plan Development Environment",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "installZsh": true,
      "installOhMyZsh": true
    }
  },
  "forwardPorts": [3000, 8080],
  "postCreateCommand": "npm install && cd cloudflare && npm install",
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode"
      ]
    }
  }
}
```

---

## 资源配置

### 重要说明

**CPU 和内存资源配置需要在 cnb.cool IDE 界面中设置**，不能通过 Dockerfile 直接配置。

### 配置界面访问

1. 打开 cnb.cool IDE
2. 点击左下角的 **⚙️ 设置图标** 或使用快捷键 `Ctrl+,`
3. 导航到 **"云原生开发"** 或 **"开发环境配置"**
4. 找到 **"资源配置"** 或 **"硬件配置"**

### 推荐配置

根据项目需求调整资源：

| 项目类型 | CPU | 内存 | 说明 |
|---------|-----|------|------|
| 轻量级开发 | 2 核 | 4 GiB | 纯前端/脚本开发 |
| 标准开发 | 2 核 | 8 GiB | Node.js 全栈开发 |
| 重度开发 | 4 核 | 16 GiB | 大型项目/多服务 |
| 生产构建 | 8 核 | 16 GiB+ | 生产环境构建 |

### 当前项目配置

- **CPU**: 2 核
- **内存**: 8 GiB
- **Node.js 版本**: 20+
- **适用场景**: X-plan 项目开发（Cloudflare Workers + 前端）

---

## 当前项目配置

### 项目信息

- **项目名称**: X-plan
- **开发环境**: cnb.cool 云原生开发IDE
- **基础镜像**: cnbcool/default-dev-env

### 配置文件

1. **`.ide/Dockerfile`** - cnb.cool 自定义开发环境
2. **`.devcontainer/devcontainer.json`** - Dev Container 配置
3. **`.cnbconfig.json`** - cnb.cool 项目配置

### 核心依赖

- **Node.js**: 20.0+
- **npm**: 最新版本
- **Cloudflare Wrangler**: 最新版本
- **其他**: ethers、eslint、prettier、typescript

---

## 操作步骤

### 步骤 1：创建配置文件

```bash
# 创建 .ide 目录
mkdir -p .ide

# 创建 Dockerfile
cat > .ide/Dockerfile << 'EOF'
# 自定义 cnb.cool 云原生开发环境
FROM cnbcool/default-dev-env

ENV NODE_VERSION=20
ENV PATH="/usr/local/bin:${PATH}"

RUN apt-get update && apt-get install -y \
    git curl wget vim build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

RUN npm install -g @cloudflare/wrangler eslint prettier typescript

EXPOSE 3000 8080 8787

CMD ["/bin/bash"]
EOF
```

### 步骤 2：在 IDE 中配置资源

1. 打开 cnb.cool IDE
2. 进入 **"云原生开发"** → **"开发环境配置"**
3. 在 **"资源配置"** 中设置：
   - CPU: **2 核**
   - 内存: **8 GiB**
4. 点击 **"应用"** 保存配置
5. 重启开发环境

### 步骤 3：提交到 Git

```bash
# 添加配置文件
git add .ide/Dockerfile .devcontainer/ .cnbconfig.json

# 提交
git commit -m "chore: 添加云原生开发环境配置"

# 推送到远程仓库
git push origin main
```

### 步骤 4：重启开发环境

在 cnb.cool IDE 中：

1. 点击 **"重启环境"** 按钮
2. 等待环境重新构建和启动
3. 确认使用新配置启动

---

## 验证配置

### 验证系统资源

重启后，在终端中执行：

```bash
# 查看CPU核心数（应显示2）
nproc

# 查看内存（应显示约8GiB）
free -h
```

### 验证 Node.js 环境

```bash
# 查看Node.js版本（应>=20）
node --version

# 查看npm版本
npm --version
```

### 验证开发工具

```bash
# 验证Cloudflare Wrangler
wrangler --version

# 验证其他工具
eslint --version
prettier --version
tsc --version
```

### 验证项目依赖

```bash
# 进入项目目录
cd /workspace

# 安装根目录依赖
npm install

# 安装 Cloudflare Workers 依赖
cd cloudflare && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..
```

---

## 常见问题

### Q1: 为什么资源配置需要在 IDE 界面设置？

Dockerfile 主要定义软件环境和工具链，而硬件资源（CPU、内存）由容器平台管理，需要在 cnb.cool IDE 的配置界面中设置。

### Q2: 如何临时提升资源配置？

在 cnb.cool IDE 中：

1. 打开 **"开发环境配置"**
2. 临时提升资源配置（如 4 核 16 GiB）
3. 执行重量级任务（构建、测试）
4. 完成后恢复为标准配置（2 核 8 GiB）

### Q3: 配置文件不生效怎么办？

检查以下几点：

1. 确认文件在仓库根目录（`.ide/Dockerfile`）
2. 确认文件名和路径正确
3. 重新提交并推送到远程仓库
4. 在 cnb.cool IDE 中强制重新构建环境

### Q4: Node.js 版本不满足要求怎么办？

更新 Dockerfile 中的 Node.js 版本：

```dockerfile
# 安装 Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs
```

---

## 参考资源

- [cnb.cool 官方文档](https://cnb.cool)
- [Dev Containers 规范](https://containers.dev)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Node.js 版本发布](https://nodejs.org/)

---

**最后更新**: 2025-01-17
**适用版本**: cnb.cool 云原生开发IDE
