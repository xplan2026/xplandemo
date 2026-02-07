# 错误 #008 - BigInt 序列化失败

**日期**: 2026-02-02  
**组件**: integrated-pool-2 Worker  
**版本**: v2.4.1

---

## 错误信息

```
{
  "success": false,
  "error": "Do not know how to serialize a BigInt"
}
```

---

## 影响范围

- [x] 功能异常 - `/wallet` 端点无法返回数据
- [ ] 资产损失
- [ ] 性能下降
- [x] 用户体验影响 - 点击钱包卡片后无法查看详情

---

## 失败分析

1. **原因1**: JavaScript 原生 `JSON.stringify()` 不支持 BigInt 类型
   - BSC 钱包余额返回的是 BigInt 类型
   - 序列化时直接使用 `JSON.stringify(result)` 导致失败
   - Worker 抛出 `RangeError: Do not know how to serialize a BigInt`

2. **原因2**: 未考虑区块链返回的特殊数据类型
   - 区块链 RPC 调用经常返回 BigInt 类型
   - Web3.js 库返回的余额默认是 BigInt
   - 代码中没有处理这种类型转换

---

## 改进措施

**版本**: v2.4.1

### 改进1：添加 `safeStringify` 方法

**说明**: 在 Worker 类中添加自定义 JSON 序列化方法，自动将 BigInt 转换为字符串

```javascript
/**
 * JSON 序列化，处理 BigInt
 */
safeStringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    return typeof value === 'bigint' ? value.toString() : value
  })
},
```

### 改进2：修改 `handleWalletDetail` 使用安全序列化

**说明**: 在所有 API 响应中使用 `safeStringify` 替代 `JSON.stringify`

```javascript
// 修改前
return this.createCorsResponse(JSON.stringify({
  success: result.success,
  wallet: walletAddress,
  ...result
}))

// 修改后
return this.createCorsResponse(this.safeStringify({
  success: result.success,
  wallet: walletAddress,
  ...result
}), {})
```

---

## 改进验证

| 测试场景 | 输入 | 预期结果 | 实际结果 |
|----------|------|----------|----------|
| 获取钱包详情 | `/wallet?address=0x9f4...` | 返回包含余额的 JSON 对象 | ✅ 成功返回 |
| 余额包含 BigInt | BNB 余额 | 余额转换为字符串 | ✅ 正确转换 |
| 多个钱包状态 | `/status` | 返回 3 个钱包的状态 | ✅ 正常工作 |

---

## 相关文件

- `/workspace/cloudflare/integrated-pool-2/src/index.js` - Worker 主文件（添加 `safeStringify` 方法）

---

## 经验总结

1. **Web3 开发注意事项**:
   - 区块链 RPC 调用经常返回 BigInt 类型
   - 必须在序列化为 JSON 前进行类型转换
   - Web3.js 库的余额字段默认是 BigInt

2. **JSON 序列化最佳实践**:
   - 创建自定义序列化方法处理特殊类型
   - 使用 `JSON.stringify` 的第二个参数进行类型转换
   - 在所有 API 响应中统一使用安全序列化

3. **调试建议**:
   - 遇到 JSON 序列化错误时，首先检查数据类型
   - 使用 `typeof` 操作符验证数据类型
   - 对于区块链相关数据，特别注意 BigInt

---

**最后更新**: 2026-02-02
