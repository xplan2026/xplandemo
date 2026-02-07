# 自定义 cnb.cool 云原生开发环境
FROM cnbcool/default-dev-env

ENV NODE_VERSION=20
ENV PATH="/usr/local/bin:${PATH}"

RUN apt-get update && apt-get install -y \
    git curl wget vim build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# 安装最新版本 wrangler（支持 API Token 方式，无需 OAuth）
RUN npm install -g wrangler

# 验证安装
RUN node --version && npm --version && wrangler --version

EXPOSE 3000 8080 8787

CMD ["/bin/bash"]
