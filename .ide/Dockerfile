# X-plan Demo - cnb.cool 云原生开发环境
# 支持 Node.js、Hardhat、Wrangler、前端开发

FROM cnbcool/default-dev-env

# 设置环境变量
ENV NODE_VERSION=22
ENV PATH="/usr/local/bin:${PATH}"
ENV PYTHON_VERSION=3.11

# 更新 apt 并安装基础依赖
RUN apt-get update && apt-get install -y \
    git curl wget vim build-essential \
    python3 python3-pip python3-venv \
    pkg-config libssl-dev \
    jq \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js 22 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

# 安装 Wrangler (支持 API Token 方式，无需 OAuth)
RUN npm install -g wrangler

# 安装 Hardhat 和相关工具
RUN npm install -g hardhat && \
    npm install -g @nomicfoundation/hardhat-verify && \
    npm install -g @nomicfoundation/hardhat-toolbox

# 安装前端开发工具（可选）
RUN npm install -g serve live-server

# 安装 Python 开发工具（用于脚本）
RUN pip3 install --no-cache-dir web3

# 配置 Git
RUN git config --global core.autocrlf input

# 验证安装
RUN node --version && \
    npm --version && \
    wrangler --version && \
    npx hardhat --version && \
    python3 --version && \
    pip3 --version

# 暴露常用端口
# 3000 - 前端开发服务器
# 8080 - Wrangler dev
# 8787 - Cloudflare Pages 本地
# 5173 - Vite dev server (前端)
# 5174 - 前端 Demo Site
EXPOSE 3000 5173 5174 8080 8787

# 设置工作目录
WORKDIR /workspace

# 启动 Bash
CMD ["/bin/bash"]
