# 常见问题（FAQ）
本节回答 PinMe 使用、限制、排错与最佳实践中最常见的问题。

## 常规问题
### PinMe 如何工作？
- 上传（Upload）：把文件上传到 IPFS & Filecoin 并 Pin 住以保证可用性
- 域名绑定（Domain Binding）：把内容哈希写入 ENS 子域名记录
- 访问（Access）：通过优化的 IPFS 网关访问站点

### PinMe 真的免费吗？
- PinMe 提供额度较高的免费套餐；如有企业需求可选择高级套餐。最新价格请参考 PinMe 官网。

### PinMe 与其他托管服务有什么不同？
- 去中心化：没有单点故障
- 可长期访问：内容被 Pin 后可长期可用
- 无需服务器：不需要运维服务器与 DNS

## 安装与配置
### 如何安装 PinMe？
```bash
npm install -g pinme
或：

yarn global add pinme
```
### 系统要求是什么？
- Node.js 16.0 或更高
- 能联网（用于上传）
- 安装占用约 100MB 磁盘空间

### 遇到 “command not found” 怎么办？
- 重启终端
- 检查 npm 全局路径：npm config get prefix
- 如有需要将其加入 PATH
- 或用 npx 运行：npx pinme --help

## 上传与部署
### 能上传动态网站吗？
- 不能。PinMe 只支持静态内容。如需动态能力可使用：

    -浏览器端 JavaScript
    -预渲染的静态站点生成器
    -其他服务提供的 Serverless 函数

### 如何更新网站？
- 用同一个域名上传新版本即可：
```bash
pinme upload ./updated-site --domain my-existing-domain
```
域名会自动指向新的内容。

### 两个用户上传同一个域名会怎样？
- 域名在全局范围内唯一。如果域名已被占用，会报错，需要换一个名字。

### 能重复上传相同内容吗？
- 可以，每次上传都会生成一个新的子域名。

## 域名与访问
### 域名格式是什么？
- 站点可通过如下地址访问：
```bash
https://xxx.pinit.eth.limo
```


### 能用自定义域名吗？
- 目前 PinMe 提供两种自定义域名：
    - 一种是绑定用户自己的域名，
    - 另一种是使用 PinMe 的自定义域名，例如 xxx.pinit.eth.limo。

### 域名传播需要多久？
- 通常新域名需要 1-2 分钟传播；已存在域名的更新一般很快生效。

### 站点是否支持 HTTPS？
- 支持。所有 PinMe 域名默认带自动 SSL/TLS 证书。

## IPFS 与内容持久性
### IPFS 是什么？
- IPFS（InterPlanetary File System）是点对点网络，用于在分布式文件系统中存储与分享文件。

### PinMe 能保证永久存储吗？
- PinMe 会 Pin 你的内容以提高可用性，但仍需注意：

    - 高级套餐可能提供更强的持久性保障
    - 即使从 PinMe 删除，内容可能仍存在于其他 IPFS 节点
    - 持续访问/活动通常有助于维持可用性

### 内容能从 IPFS 中完全移除吗？
- 当你从 PinMe 删除内容时：

    - 会从 PinMe 节点 unpin
    - 会移除域名记录
    - 但内容可能仍在其他 IPFS 节点上存在

### 我的内容是私有的吗？
- IPFS 上的内容默认是公开的。敏感内容建议：

    - 上传前先加密文件
    - 在应用层做访问控制
    - 对敏感数据考虑私有存储方案

## 认证与账号
### 必须要账号吗？
支持匿名上传，但账号可以带来：

- 域名所有权验证
- 跨设备同步
- 上传历史备份

## 高级功能
### 如何获取 AppKey？
- 打开 PinMe 官网
- 创建账号
- 进入 Settings → API Keys
- 复制 AppKey

### 设置 AppKey 后会发生什么？
- 匿名上传会合并到账号
- 历史会跨设备同步
- 你将获得对域名的完整控制

### 能在多台设备上使用 PinMe 吗？
- 可以。在每台设备上设置 AppKey：
```bash
pinme set-appkey your-app-key-here
```
## 排错
### 上传失败：提示 “file too large”
- 查看文件大小：du -h large-file.pdf
- 压缩或拆分大文件
- 删除目录中的无用文件

### 上传失败：提示 “network error”
- 检查网络：ping pinme.pinit.eth.limo
- 重试（通常是暂时问题）
- 检查是否在严格防火墙后

### 上传后域名不可访问
- 等待 1-2 分钟传播
- 检查域名拼写
- 确认上传成功
- 尝试用 IPFS 哈希直接访问

### 安装后命令找不到
- 重启终端
- 检查 PATH：echo $PATH | grep npm
- 重新安装：npm install -g pinme

### 无法删除内容
- 确认你是内容所有者
- 确认 AppKey 设置正确
- 尝试交互模式：pinme rm

### 历史不显示上传
- 检查 AppKey：pinme set-appkey
- 检查网络
- 清空并重同步：pinme list -c 再 pinme set-appkey

## 技术问题
### 支持服务端渲染（SSR）吗？
不支持。PinMe 只提供静态内容。如需 SSR：

- 使用预渲染的静态站点生成器
- 使用客户端渲染
- 或结合其他服务实现混合架构

### 能用 PinMe 部署 API 吗？
不适合。PinMe 面向静态内容。API 建议：

- 使用 Serverless functions
- 使用传统后端服务
- 或尝试 IPFS 生态的数据方案（视需求评估）

### 数据库怎么办？
PinMe 不提供数据库服务。数据存储建议：

- 小数据用静态 JSON/XML
- 评估 OrbitDB 等方案
- 使用外部数据库服务

### 能做站点统计吗？
可以，使用客户端统计：

- Google Analytics
- Plausible（更注重隐私）
- 自建统计（注意隐私合规）

### 支持 WebAssembly 吗？
支持。WASM 文件可以上传，在支持 WebAssembly 的浏览器中可正常运行。

## 性能与优化
### 如何优化 PinMe 上的网站？
- 压缩图片与静态资源
- 压缩/最小化 CSS/JS
- 使用相对路径

### 做客户端缓存
- 使用 Service Worker 支持离线

### 图片最佳做法？
- 用 WebP 提升压缩比
- 懒加载
- 响应式图片（srcset）
- 大媒体文件可考虑额外 CDN（按需）

## PinMe 适合大规模应用吗？
PinMe 很适合：

- 静态网站/作品集
- 文档站
- SPA
- PWA

超大规模应用可以考虑：

- 内容拆分到多个域名
- PinMe 做前端、其他服务做后端
- 使用高级套餐获得更高额度

## 安全
### PinMe 安全吗？
PinMe 提供：

- 全站 HTTPS
- IPFS 哈希保障内容完整性
- 无服务器漏洞面（因为没有服务器）

### XSS 等 Web 安全问题呢？
PinMe 不会额外引入漏洞，但你仍需：

- 对用户输入做净化
- 使用 CSP（内容安全策略）
- 保持依赖更新
- 遵循 Web 安全最佳实践

### 能隐藏源代码吗？
IPFS 内容默认公开。对于私有代码：

- JS 混淆不是安全方案
- 敏感逻辑应放在服务端或其他受控环境
- 或使用私有托管方案

### GDPR 与隐私合规呢？
PinMe 提供静态内容分发。合规建议：

- 在应用中提供隐私政策
- 使用隐私友好的统计
- 遵循数据最小化原则

## 计费与限制
### 当前限制是多少？
**免费套餐：**
- 500MB 存储、10 个域名
- 文件大小：单文件 20MB

**高级套餐：**更高额度

### 如何查看用量？
```bash
pinme list -l 1000 | grep -E "(KB|MB|GB)" | awk '{sum+=$4} END {print "Total:", sum}'
```
### 超过限制会怎样？
**免费套餐：**上传可能被阻止
**高级套餐：**提供升级选项

可能需要清理旧内容

### 能获得更多存储吗？
可以。高级套餐通常提供：

- 更高存储
- 更多域名
- 更强支持

### 高级功能
最新信息请查看 PinMe 官网。

## 集成与开发
### 能在 CI/CD 中集成吗？
可以，例如 GitHub Actions：
```yaml
- name: Deploy to PinMe
  env:
    PINME_APPKEY: ${{ secrets.PINME_APPKEY }}
  run: |
    npm install -g pinme
    pinme set-appkey $PINME_APPKEY
    pinme upload ./dist --domain my-app-${{ github.sha }}
```


### 有 API 吗？
目前以 CLI 为主，后续可能提供 REST API。

### 能在 PinMe 上构建工具吗？
可以。PinMe 开源，你可以：

- 编写自定义部署脚本
- 开发 GUI 工具
- 集成到研发流程
- 参与贡献
- 社区与支持

### 去哪里获取帮助？
- 文档：浏览我们的指南
- GitHub Issues： 提交问题
- 邮箱： pinme@glitterprotocol.io
- 官网： https://pinme.eth.limo/

### 如何参与贡献？
- 代码：提交 PR
- 文档：帮忙完善指南
- Bug 报告：提交详细 issue
- 社区：帮助他人答疑

### PinMe 是开源的吗？
是的。可查看 GitHub 仓库 获取源码与贡献方式。

## 迁移与替代方案
### 如何从传统托管迁移？
- 导出静态文件
- 本地用相对路径测试
- 用 PinMe 上传并绑定域名
- （如有自定义域名）更新 DNS
- 监控与测试迁移结果

### PinMe 的替代方案有哪些？
- 传统托管：Vercel、Netlify、GitHub Pages
- IPFS Pin 服务：Infura、Pinata、Fleek
- 去中心化托管：Arweave、Skynet

各方案权衡不同。PinMe 优势在于：

- 简单（一条命令）
- ENS 集成
- 加密原生