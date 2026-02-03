# 测试指南 - ProtocolBanks 新功能

本指南帮助你测试最新实现的功能。

---

## 🧪 测试 1: Email Login PIN 设置流程

### 前置条件
1. 确保数据库表已创建（需要运行迁移脚本）
2. Supabase Auth 配置正确
3. 开发服务器运行中

### 测试步骤

#### 步骤 1: 启动开发服务器

```bash
cd "e:\Protocol Bank\Development\历史版本\protocol-banks---web3-main"
npm run dev
```

#### 步骤 2: 访问 PIN 设置页面

```
http://localhost:3000/auth/setup-pin
```

#### 步骤 3: 测试 PIN 强度验证

**弱 PIN（应该拒绝）**：
- `123456` - 太常见
- `111111` - 重复数字
- `012345` - 连续数字

**强 PIN（应该通过）**：
- `247913` - 随机数字
- `582047` - 无规律

#### 步骤 4: 完成 PIN 设置

1. 输入强 PIN
2. 确认 PIN
3. 点击"Continue"
4. 应该看到：
   - ✅ 12个助记词
   - ✅ 恢复码（格式：XXXX-XXXX-XXXX-XXXX）
   - ✅ 钱包地址
5. 勾选"我已保存"
6. 点击"I've saved my backup"

#### 步骤 5: 验证结果

**检查数据库**：
```sql
-- 在 Supabase SQL Editor 运行
SELECT
  user_id,
  wallet_address,
  derivation_path,
  created_at
FROM embedded_wallets
ORDER BY created_at DESC
LIMIT 1;
```

应该看到：
- ✅ 新创建的钱包记录
- ✅ `encrypted_share_b` 已加密存储
- ✅ `share_c_hash` 存在
- ✅ `salt` 已保存

---

## 🧪 测试 2: HTTP 402 微支付网关

### 前置条件
1. 需要先运行迁移创建 `payment_channels` 表
2. 有测试用的 API 端点

### 步骤 1: 创建测试 API 端点

我已经创建了示例 API：`app/api/test/ai-demo/route.ts`

### 步骤 2: 使用 PB-Stream Client 测试

创建测试脚本：`tests/test-http-402.ts`

```typescript
import { PBStreamClient } from "@/lib/sdk/pb-stream-client"

async function testHTTP402() {
  console.log("🧪 测试 HTTP 402 微支付网关\n")

  // 1. 创建客户端
  const client = new PBStreamClient({
    baseUrl: "http://localhost:3000",
    sessionKey: "test_session_key", // 替换为真实的 Session Key
    autoRetry: true,
    onPaymentSuccess: (paymentId, amount) => {
      console.log(`✅ 支付成功: ${paymentId}, 金额: ${amount} USDC`)
    },
    onLowBalance: (balance) => {
      console.warn(`⚠️  余额不足警告: ${balance} USDC`)
    },
  })

  try {
    // 2. 开通支付通道
    console.log("📡 开通支付通道...")
    const channel = await client.openChannel({
      providerId: "test_ai_demo",
      depositAmount: "10", // $10
      settlementThreshold: "5", // $5 后自动结算
      durationSeconds: 24 * 3600, // 24小时
    })
    console.log(`✅ 通道已开通: ${channel.id}\n`)

    // 3. 调用受保护的 API（自动支付）
    console.log("🤖 调用 AI API...")
    const response = await client.fetchJson("/api/test/ai-demo", {
      method: "POST",
      body: JSON.stringify({
        prompt: "What is the meaning of life?",
      }),
    })

    console.log("✅ API 响应:", response)
    console.log(`💰 剩余余额: ${client.getRemainingBalance()} USDC\n`)

    // 4. 再次调用（测试累积）
    console.log("🤖 第二次调用...")
    const response2 = await client.fetchJson("/api/test/ai-demo", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Explain quantum physics",
      }),
    })
    console.log("✅ API 响应:", response2)
    console.log(`💰 剩余余额: ${client.getRemainingBalance()} USDC\n`)

    // 5. 查看通道信息
    console.log("📊 查看通道统计...")
    const channelInfo = await client.getChannel()
    console.log("通道信息:", {
      存入: channelInfo.depositAmount,
      已用: channelInfo.spentAmount,
      待结算: channelInfo.pendingAmount,
      状态: channelInfo.status,
    })

    // 6. 手动触发结算（可选）
    if (parseFloat(channelInfo.pendingAmount) > 0) {
      console.log("\n💳 手动结算...")
      const settlement = await client.settle()
      console.log("✅ 结算成功:", settlement)
    }

    // 7. 关闭通道
    console.log("\n🔒 关闭通道...")
    const closeResult = await client.closeChannel()
    console.log(`✅ 通道已关闭，结算金额: ${closeResult.settledAmount} USDC`)

  } catch (error) {
    console.error("❌ 测试失败:", error)
  }
}

// 运行测试
testHTTP402()
```

### 步骤 3: 运行测试

```bash
npx tsx tests/test-http-402.ts
```

### 预期输出

```
🧪 测试 HTTP 402 微支付网关

📡 开通支付通道...
✅ 通道已开通: ch_abc123def456

🤖 调用 AI API...
✅ 支付成功: mp_xyz789, 金额: 0.05 USDC
✅ API 响应: { result: 'AI response here...' }
💰 剩余余额: 9.95 USDC

🤖 第二次调用...
✅ 支付成功: mp_abc456, 金额: 0.05 USDC
✅ API 响应: { result: 'Another AI response...' }
💰 剩余余额: 9.90 USDC

📊 查看通道统计...
通道信息: {
  存入: '10',
  已用: '0',
  待结算: '0.10',
  状态: 'open'
}

🔒 关闭通道...
✅ 通道已关闭，结算金额: 0.10 USDC
```

---

## 🧪 测试 3: Session Keys 自动支付

### 测试场景
测试 Session Key 与支付通道结合使用。

### 步骤

1. **创建 Session Key**
```bash
curl -X POST http://localhost:3000/api/session-keys \
  -H "Content-Type: application/json" \
  -d '{
    "chain_id": 8453,
    "spending_limit": "100",
    "expires_at": "2026-03-05T00:00:00Z"
  }'
```

2. **使用 Session Key 开通支付通道**
```typescript
const client = new PBStreamClient({
  baseUrl: "http://localhost:3000",
  sessionKey: "sk_xxx_your_session_key",
})

await client.openChannel({
  providerId: "test_provider",
  depositAmount: "50",
})
```

3. **自动支付（无需签名）**
```typescript
// 后续所有 API 调用自动从通道扣款
const result = await client.fetchJson("/api/test/ai-demo", {
  method: "POST",
  body: JSON.stringify({ prompt: "Hello" }),
})
```

---

## 🧪 测试 4: 订阅自动支付（完整流程）

### 步骤

1. **创建订阅**
```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "OpenAI API",
    "recipient_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "amount": "10",
    "token": "USDC",
    "chain": "base",
    "interval": "monthly",
    "auto_pay": true
  }'
```

2. **查看订阅支付历史**
```bash
curl http://localhost:3000/api/subscriptions/{subscription_id}/payments
```

3. **触发自动支付（模拟 Cron）**
```bash
curl -X POST http://localhost:3000/api/subscriptions/execute \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 🧪 测试 5: x402 授权管理

### 步骤

1. **访问授权管理页面**
```
http://localhost:3000/settings/authorizations
```

2. **筛选授权**
- 按状态：pending / used / cancelled / expired
- 搜索功能

3. **取消授权**
- 点击"Cancel"按钮
- 验证状态变为 cancelled

---

## ✅ 测试检查清单

### Email Login PIN 设置
- [ ] 弱 PIN 被拒绝
- [ ] 强 PIN 通过验证
- [ ] 12个助记词正确显示
- [ ] 恢复码格式正确（XXXX-XXXX-XXXX-XXXX）
- [ ] 数据库记录创建成功
- [ ] Share B 已加密存储
- [ ] 钱包地址正确生成

### HTTP 402 微支付
- [ ] 支付通道成功开通
- [ ] 微支付自动扣款
- [ ] 余额正确更新
- [ ] 累积金额正确追踪
- [ ] 达到阈值自动结算
- [ ] 手动结算成功
- [ ] 通道关闭成功

### Session Keys
- [ ] Session Key 创建成功
- [ ] 密钥列表正确显示
- [ ] 激活/停用功能正常
- [ ] 删除功能正常
- [ ] 统计数据正确

### x402 授权
- [ ] 授权列表正确显示
- [ ] 状态筛选正常
- [ ] 搜索功能正常
- [ ] 取消授权成功

### 订阅支付
- [ ] 订阅创建成功
- [ ] 自动支付执行
- [ ] 支付历史记录
- [ ] 失败重试机制

---

## 🐛 常见问题排查

### 问题 1: "Table 'embedded_wallets' does not exist"

**原因**：数据库表未创建

**解决**：
```sql
-- 在 Supabase SQL Editor 运行
-- scripts/028_subscription_session_keys.sql
```

### 问题 2: "Module '@scure/bip39' not found"

**原因**：依赖未安装

**解决**：
```bash
npm install @scure/bip39
```

### 问题 3: "Payment channel not found"

**原因**：通道未创建或已过期

**解决**：
```typescript
// 重新开通通道
await client.openChannel({...})
```

### 问题 4: "Unauthorized"

**原因**：未登录或 Session 过期

**解决**：
```bash
# 重新登录
# 访问 /auth/login
```

---

## 📊 性能基准

### 预期性能指标

| 操作 | 目标时间 | 实际时间 |
|------|----------|----------|
| PIN 设置 | < 2s | _待测试_ |
| 支付通道开通 | < 500ms | _待测试_ |
| 微支付处理 | < 100ms | _待测试_ |
| 链上结算 | < 5s | _待测试_ |

---

## 📝 测试报告模板

测试完成后，请填写：

```markdown
## 测试结果

**测试日期**: 2026-02-04
**测试人员**: [你的名字]
**环境**: Development / Staging / Production

### Email Login PIN 设置
- 状态: ✅ 通过 / ❌ 失败
- 备注: [记录任何问题]

### HTTP 402 微支付
- 状态: ✅ 通过 / ❌ 失败
- 备注: [记录任何问题]

### Session Keys
- 状态: ✅ 通过 / ❌ 失败
- 备注: [记录任何问题]

### 发现的问题
1. [问题描述]
2. [问题描述]

### 改进建议
1. [建议内容]
2. [建议内容]
```

---

**准备好了吗？开始测试吧！** 🚀
