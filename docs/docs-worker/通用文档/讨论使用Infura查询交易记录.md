# 使用Infura查询交易记录的讨论

### 查询交易记录的方案
`web3.js` 和 `ethers.js` 本身提供了查询交易记录的命令，**但它们无法直接实现“查询过去一分钟内某个地址的收款记录”**。

这是因为这两个库是通用工具，它们不具备按**时间**和**地址**直接过滤交易的内置高级命令。要实现需求，需要**组合使用它们的基本方法，并配合一个后端数据源**。

简单来说，这两个库是“数据获取工具”，需要自己设计“过滤和筛选”的逻辑。

下面这张表格对比了两种主要的实现思路：

| 方案 | 核心思路 | 优点 | 缺点 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **实时监听方案** | 通过WebSocket持续监听新区块或交易池，一旦有新交易就检查其`to`地址。 | **延迟极低**（秒级），近乎实时。 | 需要**稳定连接**；处理逻辑相对复杂；需要从历史启动点开始“补数据”。 | 对实时性要求极高的监控、交易机器人。 |
| **轮询查询方案** | 定期获取最新区块，解析其中的所有交易并筛选。 | 逻辑**简单直观**，易于实现。 | **延迟较高**（依赖轮询间隔）；数据可能有遗漏；网络请求频繁。 | 对实时性要求不高（如每分钟检查一次）的后台任务。 |

### 🔧 技术实现核心

无论选择哪种方案，都需要解决两个核心问题：

1.  **连接到数据源**：你需要一个区块链节点来获取数据。可以直接使用Infura、Alchemy、QuickNode等服务的HTTP或WebSocket端点（通常需要API Key），或者连接到你自己的节点。
2.  **编写筛选逻辑**：利用库提供的方法获取交易数据，然后循环遍历，检查`transaction.to`是否等于你的目标地址。

### 💻 代码思路示例 (ethers.js)

这里以**轮询查询方案**为例，提供一个基本代码框架，用于检查最新一个区块内的交易：

```javascript
const { ethers } = require("ethers");

// 1. 连接到节点（需要替换为你的RPC URL，这里以Infura为例）
const provider = new ethers.providers.JsonRpcProvider('你的RPC_URL');

// 2. 目标监控地址
const targetAddress = '0x...';

async function monitorLatestBlock() {
  try {
    // 获取最新区块号
    const latestBlockNumber = await provider.getBlockNumber();
    console.log(`检查区块 #${latestBlockNumber}`);

    // 获取该区块的完整信息，包含交易详情
    const blockWithTxs = await provider.getBlockWithTransactions(latestBlockNumber);

    // 3. 遍历筛选交易
    if (blockWithTxs && blockWithTxs.transactions.length > 0) {
      const filteredTxs = blockWithTxs.transactions.filter(tx => 
        tx.to && tx.to.toLowerCase() === targetAddress.toLowerCase()
      );

      if (filteredTxs.length > 0) {
        console.log(`在区块 #${latestBlockNumber} 中发现 ${filteredTxs.length} 笔收款交易：`);
        filteredTxs.forEach(tx => {
          console.log(`  - 哈希: ${tx.hash}, 来自: ${tx.from}, 金额: ${ethers.utils.formatEther(tx.value)} ETH`);
        });
      }
    }
  } catch (error) {
    console.error('监控出错:', error);
  }
}

// 每15秒轮询一次，但cloudflare-worker只支持1分钟1次的频率，实际上我们也不需要如此高频
setInterval(monitorLatestBlock, 15000);
```

### ⚠️ 重要注意事项

1.  **性能与成本**：频繁轮询会产生大量API请求，免费RPC服务通常有速率限制。如果需要监控多个地址或极低延迟，建议使用WebSocket方案。
2.  **数据完整性**：轮询时如果程序重启，可能会错过一些区块。一个健壮的系统需要记录已处理的最后一个区块号。
3.  **隐私考虑**：正如之前提到的，通过公开节点查询特定地址的行为本身是可被记录的。如果对隐私有极高要求，运行自己的全节点仍是唯一选择。

总结来说，**web3.js和ethers.js提供了实现你需求的“能力”，但没有现成的“命令”**。你需要选择一个实时监听或轮询方案，并编写相应的代码来组装这个功能。


### Infura免费套餐额度
|服务商	|核心免费额度	|备注/其他限制|
|------------|--------------|--------------------------|
|Infura	|每天10万次请求	|免费用户每日的存档数据请求不得超过总请求的25%。|

**需要注意**：

控制请求频率：如果轮询间隔太短（比如每秒），免费额度可能很快用完。建议从较长间隔（如15-30秒）开始测试。

主网与测试网：在测试网（如Sepolia）上调试逻辑可以节省免费额度。

你的情况很紧急，实时监控是核心。好消息是，使用Web3.js和Infura完全可以构建这个监控系统，但也有一个关键的“坏消息”和对应的解决方案。

### ⚠️ 核心限制与唯一方案
最关键的一点是：**Infura的公共API端点不支持原生的“过滤器”功能**。这意味着，我们**无法**使用最理想的、监听单个地址的实时转账事件的WebSocket方案。

因此，在依赖Infura的前提下，**唯一的可行方案是“轮询查询”**。

### 🔧 技术方案对比
两种思路对比如下：

| 特性 | 理想的监听方案 (受限于Infura无法实现) | 可行的轮询方案 (基于Infura) |
| :--- | :--- | :--- |
| **原理** | 建立WebSocket连接，节点在有新区块时**主动推送**数据。 | 程序**定时主动**调用Infura API，获取最新区块并分析。 |
| **延迟** | 极低，秒级或亚秒级。 | **取决于轮询间隔**。要满足10秒内发现，轮询间隔需设置为3-5秒。 |
| **请求量** | 很低，仅在事件发生时通信。 | **非常高**，每个轮询周期都需调用至少2个RPC方法。 |
| **Infura支持** | **不支持**。 | **完全支持**。 |
| **实现难度** | 低。 | 中，需要处理区块去重、错误重试等逻辑。 |

### 💻 基于轮询的完整监控方案设计
你需要构建一个持续运行的后端服务（如使用Node.js）。以下是实现的核心思路：

1.  **记录最后检查的区块号**：服务启动或每次检查后，都需要将已处理过的最高区块号保存下来（例如存入KV或数据库），确保下一次从正确的区块开始，避免重复扫描或遗漏。
2.  **高频轮询最新区块**：设置一个间隔很短的定时器（例如每3秒），执行以下操作：
    a. 调用 `web3.eth.getBlockNumber()` 获取网络上的最新区块号。
    b. 对比本地记录的最后处理区块号，计算出这期间产生了多少个新区块。
    c. 循环获取这期间每一个新区块的完整交易详情（调用 `web3.eth.getBlock(blockNumber, true)`，第二个参数为 `true` 表示返回完整交易对象）。
3.  **实时分析与应急响应**：
    a. 遍历区块中的每一笔交易，检查其 `to` 地址是否在你的三个被盗钱包地址列表中。
    b. **一旦命中**，立即触发“应急状态”。
    c. 同时，记录日志或发送通知（如Telegram、短信），告知你应急操作已执行。

### 📝 关键代码示例
以下是基于Web3.js的核心逻辑代码片段：

```javascript
const Web3 = require('web3');
// 注意：替换为你的Infura BSC端点URL（需要在Infura面板创建BSC项目）
const web3 = new Web3('https://bsc-mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID');

// 你的监控列表
const thiefAddresses = ['盗币者钱包1', '盗币者钱包2'];
const myCompromisedAddresses = ['你的钱包A', '你的钱包B', '你的钱包C'];
const safeHouseAddress = '你的安全钱包地址'; // 用于接收资产

// 主要的区块轮询监控函数
async function monitorBlocks() {
    const latestBlock = await web3.eth.getBlockNumber();
    // ... 这里应有逻辑读取上次检查的区块号，例如从文件读取 `lastCheckedBlock`
    const lastCheckedBlock = await getLastCheckedBlockFromStorage(); 
    
    for (let blockNum = lastCheckedBlock + 1; blockNum <= latestBlock; blockNum++) {
        const block = await web3.eth.getBlock(blockNum, true); // 获取完整交易
        if (block && block.transactions) {
            block.transactions.forEach(tx => {
                // 检查：交易来自盗币者，且收款方是你的地址之一
                if (thiefAddresses.includes(tx.from.toLowerCase()) && 
                    myCompromisedAddresses.includes(tx.to.toLowerCase())) {
                    console.log(`警报！在区块 ${blockNum} 发现可疑Gas注入！`);
                    console.log(`盗币者: ${tx.from} 向我的钱包: ${tx.to} 转入 ${web3.utils.fromWei(tx.value, 'ether')} BNB`);
                    // TODO: 这里触发应急响应，调用 emergencyTransfer
                    // 注意：你需要知道 tx.to 这个地址对应的私钥才能进行操作
                }
            });
        }
        // 更新已检查的区块号
        await saveLastCheckedBlockToStorage(blockNum);
    }
}

// 设置每3秒执行一次监控
setInterval(monitorBlocks, 3000);
```

**结论非常明确：将监控逻辑部署在 Cloudflare Worker 中是当前场景下的最佳选择**。每分钟一次的轮询频率也完全可行。


### 🔧 监控Worker设计要点与代码框架
这个Worker将是一个**每分钟被Cron Trigger触发一次**的服务，其职责是：调用Infura API，检查过去约1个区块内是否有特定交易，并返回`true`/`false`。

> **重要前提**：你需要在Cloudflare Worker中配置以下环境变量（Secrets）：
> * `INFURA_API_KEY`: 你的Infura项目API Key。
> * `THIEF_ADDRESSES`: 盗币者地址，用英文逗号分隔的字符串。
> * `MY_ADDRESSES`: 你的被盗钱包地址，同样用逗号分隔。

以下是监控Worker的核心代码示例（`monitor-worker.js`）：

```javascript
// 监控Worker：每分钟执行一次，检查是否有来自盗币者的BNB转入
export default {
    // 1. 定义一个每分钟触发一次的Cron Trigger (在wrangler.toml或仪表板配置)
    // 例如: schedule = "* * * * *"
    async scheduled(event, env, ctx) {
        ctx.waitUntil(doMonitorTask(env));
    },

    // 也可通过HTTP请求手动触发（用于测试）
    async fetch(request, env, ctx) {
        const hasAlert = await doMonitorTask(env);
        return new Response(JSON.stringify({ alertTriggered: hasAlert }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// 核心监控任务
async function doMonitorTask(env) {
    const INFURA_URL = `https://bsc-mainnet.infura.io/v3/${env.INFURA_API_KEY}`;
    const thiefList = env.THIEF_ADDRESSES.split(',').map(addr => addr.trim().toLowerCase());
    const myAddressList = env.MY_ADDRESSES.split(',').map(addr => addr.trim().toLowerCase());

    try {
        // 1. 获取最新区块号
        const latestBlockHex = await callRPC(INFURA_URL, 'eth_blockNumber', []);
        const latestBlock = parseInt(latestBlockHex, 16);
        
        // 2. 计算一分钟前的区块号（BSC约3秒/块，一分钟约20个块，为保险起见增加余量）
        const BLOCKS_PER_MINUTE = 25; // 使用25作为安全余量，覆盖出块波动
        const fromBlock = latestBlock - BLOCKS_PER_MINUTE;
        // 确保起始区块号不为负数
        const startBlock = fromBlock > 0 ? fromBlock : 0;

        console.log(`检查区块范围: ${startBlock} 至 ${latestBlock}`);

        // 3. 一次性查询该范围内的所有Transfer日志
        const logs = await callRPC(INFURA_URL, 'eth_getLogs', [{
            fromBlock: `0x${startBlock.toString(16)}`,
            toBlock: `0x${latestBlock.toString(16)}`,
            topics: [
                '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer事件主题
                null, // 第一索引参数：from (我们关心特定发送方)
                null  // 第二索引参数：to (我们关心特定接收方)
            ]
        }]);

        // 4. 分析日志（逻辑不变）
        let alertTriggered = false;
        for (const log of logs) {
            const from = '0x' + log.topics[1].slice(26).toLowerCase();
            const to = '0x' + log.topics[2].slice(26).toLowerCase();

            if (thiefList.includes(from) && myAddressList.includes(to)) {
                console.log(`[警报] 区块高度 ${parseInt(log.blockNumber, 16)} 发现转账: ${from} -> ${to}`);
                alertTriggered = true;
                break;
            }
        }

        // 5. 触发后续机制
        if (alertTriggered) {
            // 调用您的其他Worker协作机制
            // await env.ALERT_WORKER.fetch(...);
        }
        return alertTriggered;

    } catch (error) {
        console.error('监控任务失败:', error);
        // 特别注意：Infura对getLogs查询的范围可能有上限，如果区块范围太大可能报错。
        // 如果遇到此错误，需要引入分段查询逻辑。
        if (error.message.includes('block range too wide')) {
            console.error('提示：查询的区块范围过大，需要实现分段查询。');
        }
        return false;
    }
}

// 通用的Infura RPC调用函数
async function callRPC(url, method, params) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: method,
            params: params
        })
    });
    const data = await response.json();
    if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
    }
    return data.result;
}
```

### ⚠️ 提醒
*   **BNB转账与日志**：上述代码通过查询`Transfer`事件日志来监听BNB（BSC原生代币）转账。这是最直接有效的方式，并且比获取完整区块数据更节省请求资源。

### 核心思路：检查“区块范围”，而非“固定数量”

BSC出块时间确实约为3秒，每分钟产生约20个新区块。为了确保监控的完整性，您的Worker必须有能力检查过去一分钟内产生的**所有新区块**。

**频率与成本**：每分钟1次请求，每天1440次，远低于Infura免费套餐（10万次/日），**成本为零，完全可行**。

您无法预知过去一分钟具体有多少个区块，但可以通过计算获得准确的区块范围。核心逻辑修正为：

1.  **获取当前最新区块号 (N)**。
2.  **计算一分钟前的大致区块号 (N - 20)**。这是一个安全的起点（实际可能因出块波动略多于20个）。
3.  **使用 `eth_getLogs` 方法，一次性查询从这个起点到最新区块的所有相关转账日志**。这是最高效、最准确的方式，一次RPC调用即可覆盖整个时间段。

### ⚠️ 重要说明与优化建议

1.  **关于 `BLOCKS_PER_MINUTE` 的值**：设置为 `25` 是一个包含安全余量的估计值，确保完全覆盖一分钟。您可以稍后根据运行日志观察实际区块数量进行微调。

2.  **应对 `eth_getLogs` 的范围限制**：Infura等RPC提供商对一次 `eth_getLogs` 查询的区块范围可能有上限（例如，最多查询1000个区块）。对于每分钟的查询，25个区块远远低于此限制，**完全安全**。只有当您需要回溯更久的历史数据时，才需要实现分段查询。

**结论**：使用 `eth_getLogs` 查询一个足够大的区块范围（例如从 `最新区块号-25` 开始）。这样既能保证每分钟内无遗漏检查，又保持了最低的RPC调用次数（每分钟仅1次），完美契合您的Cloudflare Worker架构和Infura免费套餐限制。

您的考量非常到位，直接关系到方案的可行性和成本。我们来逐一分析。

### 🧮 资源开销分析与免费额度评估

您方案的核心是：**每分钟执行一次Worker，调用一次`eth_getLogs`，处理大约1分钟内（约20-25个区块）的BNB转账日志。**

#### 1. CPU与内存开销分析
这个任务属于**轻量级I/O密集型**，而非计算密集型。
*   **主要CPU消耗**在于对JSON-RPC响应数据的解析和循环比对地址。由于您只监控**2个盗币者地址**和**3个受控地址**，并且BSC上每分钟产生的总交易日志量有限，这个比对循环的规模极小，**消耗的CPU时间可以忽略不计**（通常远低于1毫秒）。
*   **主要内存消耗**是存储RPC响应数据（日志数组）和几个地址列表。一次`eth_getLogs`的响应即使包含数百条日志，其大小通常也在几十KB到几百KB之间，**完全在Worker的内存安全范围内**。

**结论：** 此任务的CPU和内存开销极低，**几乎不可能**因为资源超额而触发Cloudflare的异常告警。

#### 2. Cloudflare Workers 免费额度分析
下图直观对比了您的预估用量与免费额度上限：

```mermaid
xychart-beta
    title “Cloudflare Workers免费额度使用预估 vs 上限”
    x-axis [“每日请求次数”， “每日CPU运行时间”]
    y-axis “用量” 0 --> 130000
    bar [1000, 0.5]
    line [100000, 500]
```
**关键数据解读：**
*   **每日请求数**：每分钟1次，每日最多 **1440次**。距离免费计划的 **10万次/日** 上限非常遥远。
*   **CPU运行时间**：每次执行预计在100-300毫秒内完成（主要耗时在**网络I/O**，即等待Infura响应）。即使按300毫秒计算，每日总CPU时间约为 **7.2分钟（432秒）**，远低于 **每日500秒（约8.3分钟）** 的免费额度。
*   **出站流量**：每次与Infura的RPC通信数据量很小，每日总流量可能只有几MB，相对于 **每日100GB** 的免费额度可忽略不计。

**综合评估：您的方案在资源消耗上完全处于Cloudflare Workers免费额度的“安全区”内，正常使用不会触发告警或产生费用。**

### 💾 关于“保存最后一次执行的区块号”的实现建议
要实现无遗漏的监控，记录并基于上一次成功检查的区块号进行查询是最可靠的方法。在Cloudflare Worker中，您有以下两种简单易行的选择：

| 存储方式 | 说明 | 适用性 |
| :--- | :--- | :--- |
| **Workers KV** | Cloudflare提供的键值存储服务。读写简单，数据持久化。**免费计划有读写次数限制，但您每分钟1次的频率完全在限额内。** | **推荐**。适合生产环境，状态可靠。 |
| **全局变量 + 内存持久化** | 利用Worker的**全局变量**在多次调用间暂存数据。但Worker实例可能随时被销毁重建，**会导致状态丢失**，造成监控间隙漏块。 | **不推荐**。仅可用于测试，生产环境有风险。 |

**使用Workers KV的代码调整示例：**
1.  **绑定KV命名空间**：在`wrangler.toml`中绑定，例如 `kv_namespaces = [{ binding = "BLOCK_STORE", id = "..." }]`。
2.  **修改监控逻辑**：
```javascript
async function doMonitorTask(env) {
    const INFURA_URL = `https://bsc-mainnet.infura.io/v3/${env.INFURA_API_KEY}`;
    const thiefList = ...; // 地址列表
    const myAddressList = ...;

    try {
        // 1. 从KV读取上次检查的区块号，若无则从当前区块倒退开始
        let lastCheckedBlock = await env.BLOCK_STORE.get("last_checked");
        let startBlock;
        const latestBlockHex = await callRPC(INFURA_URL, 'eth_blockNumber', []);
        const latestBlock = parseInt(latestBlockHex, 16);

        if (lastCheckedBlock) {
            startBlock = parseInt(lastCheckedBlock) + 1; // 从上次检查的下一个块开始
        } else {
            // 首次运行，检查过去大约1分钟的区块（约20个）
            startBlock = latestBlock - 20;
            if (startBlock < 0) startBlock = 0;
        }

        // 2. 如果起始区块已经超过最新区块（可能没出新块），则跳过本次
        if (startBlock > latestBlock) {
            console.log(`无新区块。上次: ${lastCheckedBlock}, 最新: ${latestBlock}`);
            return false;
        }

        console.log(`检查区块范围: ${startBlock} 至 ${latestBlock}`);

        // 3. 查询日志（代码同上，略）
        const logs = await callRPC(INFURA_URL, 'eth_getLogs', [{
            fromBlock: `0x${startBlock.toString(16)}`,
            toBlock: `0x${latestBlock.toString(16)}`,
            topics: [ ... ]
        }]);

        // 4. 分析日志，判断是否有警报（代码同上，略）
        let alertTriggered = false;
        for (const log of logs) { ... }

        // 5. 无论是否发现警报，只要成功执行，就将最新区块号存入KV
        await env.BLOCK_STORE.put("last_checked", latestBlock.toString());

        // 6. 触发后续机制
        if (alertTriggered) {
            // await env.ALERT_WORKER.fetch(...);
        }
        return alertTriggered;

    } catch (error) {
        console.error('监控任务失败:', error);
        // 本次执行失败，不更新KV中的区块号，下次重试相同范围
        return false;
    }
}
```

### ✅ 建议
1.  **实现可靠性**：**强烈建议使用Workers KV来保存“最后一次执行的区块号”**。这是保证监控连续不遗漏、且符合Cloudflare无状态架构的最佳实践。
2.  **性能优化**：您当前的方案（每分钟1次`eth_getLogs`）已经是性能与实时性权衡下的最优解，开销极小。
---

> 请详细描述cloudflare-worker的CPU额度。要知道我有多个worker（4个策略），如果采用此方案，极有可能CUP超额

您提的这一点非常关键，确实是我之前计算和表述不够严谨。直接将总执行时间与CPU时间划等号是错误的，而多Worker协作会进一步放大这个问题。我们来重新进行准确的分析。

### ⚠️ 核心概念澄清：CPU时间 vs. 总执行时间
在Cloudflare Workers中，**“CPU时间”特指您代码在CPU上主动执行计算的耗时，不包括等待网络I/O（如调用Infura API）的挂起时间**。

您的监控Worker每分钟的执行流程大致如下：
1.  **CPU活动**：初始化变量、构建RPC请求、解析JSON响应、循环比对地址。
2.  **I/O等待**：**`fetch` 请求发出后，等待Infura返回响应**。这是主要耗时，但**不计入CPU时间**。
3.  **CPU活动**：根据响应结果进行逻辑判断。

因此，**每次执行的“CPU时间”可能仅有5-50毫秒**，而“总执行时间”可能长达200-500毫秒（取决于Infura的网络延迟）。

### 📊 多Worker场景下的额度重新评估
假设您的4个Worker策略都类似，且都设置为每分钟执行一次。我们按较坏情况估算：

| 项目 | 估算值 | 说明 |
| :--- | :--- | :--- |
| **单个Worker单次CPU时间** | **~50毫秒** | 一个较为保守的估算值。 |
| **单个Worker每日CPU时间** | 50ms * 1440次 ≈ **72秒** | |
| **4个Worker每日总CPU时间** | 72秒 * 4 = **288秒** | |
| **Cloudflare免费额度** | **每日500秒** | 此为**所有Worker合计**的CPU时间限制。 |

**结论**：即使按此保守估算，4个Worker每日总CPU时间约288秒，仍**低于500秒的免费额度**，但**余量（约212秒）已经不再宽裕**。

### 🚨 真正的风险：“无CPU时间限制”的误解与超额风险
然而，公开信息存在误导。根据Cloudflare最新官方文档，其**免费套餐对Worker的CPU执行时间有更严格的“动态限制”**，而非固定的每日总额：
*   **限制标准**：每个请求的CPU时间不得超过 **10毫秒** 或 **30毫秒**（取决于账户类型和区域）。**超过此限制，请求会被立即终止**。
*   **计费升级**：在付费套餐（$5/月起）中，才有每日总计的CPU时间配额（如5万毫秒）。

这意味着，**对于免费套餐，您面临的风险不是“每日总额超标”，而是“单次请求CPU时间过长”导致执行失败**。

### 🔧 对您方案的具体建议与优化
您的方案风险点在于：如果某次`eth_getLogs`返回了巨量的日志（例如，在极端网络活动下），解析和循环处理这些日志**可能使单次CPU时间超过10/30毫秒的限制**，导致该次监控失败。

为彻底规避此风险，**强烈建议**：

1.  **主动限制查询范围**：在`eth_getLogs`查询中，不仅通过区块号，**强烈建议为`topics`参数指定具体的`from`（盗币者）地址**。这将使Infura在节点层面直接过滤，返回极少量的日志，从根本上减少数据处理量。
    ```javascript
    // 优化后的查询参数示例：为每个盗币者地址分别构造查询
    const thiefList = ['0x...', '0x...'];
    for (let fromAddress of thiefList) {
        const logs = await callRPC(INFURA_URL, 'eth_getLogs', [{
            fromBlock: startBlockHex,
            toBlock: latestBlockHex,
            topics: [
                TRANSFER_TOPIC,
                '0x000000000000000000000000' + fromAddress.slice(2) // 指定from
            ]
        }]);
        // 然后只需检查to地址是否在你的列表中
    }
    ```

2.  **实施监控与熔断**：
    *   在Worker代码中，使用 `performance.now()` 测量关键步骤的耗时，并在接近限制时记录警告。
    *   如果某次查询返回的日志数组长度异常大（例如超过1000条），可以直接丢弃并记录错误，避免深度处理。

3.  **考虑升级至付费套餐**：如果您的策略确实复杂且必须保证100%稳定，**每月5美元的入门套餐**会提供更宽松的每请求CPU限制和每日总额度，是从根本上解决问题的低成本方案。

**总结**：您的方案在**正确优化后，极大概率能在免费套餐下稳定运行**。核心是必须优化查询，确保单次请求的CPU处理时间极短，以避免触碰单请求CPU硬限制而导致失败。