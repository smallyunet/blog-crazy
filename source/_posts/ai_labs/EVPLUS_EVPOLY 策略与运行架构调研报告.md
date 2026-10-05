---
layout: post
title: "EVPLUS / EVPOLY 策略与运行架构调研报告"
date: 2026-08-07 20:53:00
collection: ai
tags: AI 文章库
---

> 调研日期：2026-08-07（Asia/Shanghai）  
> 调研对象：EVPLUS 托管版 Starter Bot、公开 EVPOLY v2.6.2 源码  
> 性质：产品与技术调研，不构成投资建议

## 1. 结论摘要

EVPLUS 是 EVPOLY Rust 交易引擎的托管产品形态。当前账户实际开启了两类方向性策略：

- **Premarket / Pre-M**：在加密货币 5m、15m、1h、4h 涨跌盘开盘前，对 UP 和 DOWN 两边布置多档限价买单。
- **EVSnipe + Pre-hit**：监控 Binance 现货价格，在价格接近或触及 Polymarket hit-price 市场的 strike 时快速买入对应结果。

当前关闭的策略是：

- **MM 2.0**：围绕 Polymarket 流动性奖励市场做双边顶层做市。
- **COMBO//** ：体育 Combo 市场的 RFQ（Request for Quote）策略。

本次日志中真正触发下单的是 `premarket_v1`。没有发现 EVSnipe、MM 2.0 或 COMBO// 的实际成交证据。日志显示：

- `Total Trades Executed: 0`
- `Open exposure: $0.00`
- 账户余额约 `9.365227 pUSD`
- 已有活动订单占用约 `5.0061 pUSD`
- 后续多个约 `$5` 的 Premarket 订单因 `not enough balance / allowance` 被交易所拒绝

最重要的风险不是策略方向本身，而是**配置规模与本金严重不匹配**。Premarket 的 `$5 Base Size` 不能简单理解为“这一轮最多只用 5 美元”：公开源码规定每一个 ladder rung（阶梯档位）最低都是 `$5`，单个市场最多有六档、两边合计十二个候选订单。即使风险调度器和余额约束阻止全部订单生效，当前 `$9.37` 本金也只能支持大约一个 `$5` 活动订单，无法完整运行该策略设计。

## 2. 证据等级与边界

本报告把证据分为三类：

1. **已确认：托管页面**——来自登录后的 EVPLUS Dashboard、策略设置页和实时日志。
2. **已确认：公开源码**——来自 [`Degenapetrader/EVPOLY`](https://github.com/Degenapetrader/EVPOLY) 当前 `main`，检出的提交为 [`10eb5b50`](https://github.com/Degenapetrader/EVPOLY/commit/10eb5b50fa143461b99e9d1c561a9935eb49dbc3)，版本 `2.6.2`，提交日期 2026-07-22。
3. **技术推断**——托管版与公开版名称、日志模块和行为高度一致，但无法证明 EVPLUS 生产环境正好运行上述公开提交。托管版可能包含更新或私有模块。

特别说明：

- `COMBO//` 的产品配置可以从网页确认，但其业务实现没有出现在公开 EVPOLY 主程序中。
- 托管页面部分数值与公开版默认值不同，说明存在账户覆盖值、托管版覆盖值或版本差异。
- 本报告没有访问 EVPLUS 服务器、数据库、私有仓库或管理接口。

## 3. 当前账户与策略总览

| 项目 | 当前状态 | 当前页面配置 | 本次日志是否验证 |
|---|---:|---|---|
| Bot | Running | 约 102.37 credits；0.5 credits/小时 | 是 |
| Bankroll | 可用但很小 | 约 $9.37 pUSD | 是 |
| Pre-M | On | Base Size $5 | 是，`premarket_v1` 正在尝试挂单 |
| EVSnipe | On | $5 / hit | 未发现触发或成交 |
| Pre-hit | On | Ratio 0.30；Pre-trigger 1 bps | 未发现触发或成交 |
| MM 2.0 | Off | Depth Ratio；Max Share Ratio 0.20 | 未运行 |
| COMBO// | Off | 固定 $11 / RFQ | 未运行 |
| 已成交交易 | 0 | 无仓位、无已实现 PnL | 是 |

`credits` 是机器人运行时长额度，不是交易本金；`pUSD bankroll` 才是订单可使用的抵押资金。

## 4. Premarket / Pre-M

### 4.1 策略原理

Premarket 在每个短周期 UP/DOWN 市场开盘前约四分钟生成订单意图，在两边分别放置阶梯买单。其目标不是预测一个单一方向，而是利用新市场开盘前后可能出现的薄流动性、瞬时价格跳动和错误报价，以较低价格获得结果份额。

公开源码的默认时间点为：

- 5m 市场：分钟数 `%5 == 1`
- 15m 市场：分钟数 `%15 == 11`
- 1h 市场：每小时第 56 分钟
- 4h 市场：开盘前对应小时的第 56 分钟

公开源码确认它同时对 `UP` 和 `DOWN` 建立候选 BUY ladder。实际收益结构是非线性的：低价成交后若该结果最终胜出，每份接近按 `$1` 结算；若结果失败，成交本金可能大部分或全部损失。

### 4.2 公开版默认阶梯

| 周期 | Normal 基础价格 |
|---|---|
| 5m | 0.31、0.26、0.22、0.16、0.09、0.03 |
| 15m / 1h / 4h | 0.40、0.30、0.24、0.18、0.12、0.06 |

六档预算权重为 `23% / 23% / 17% / 14% / 12% / 11%`。模式包括：

- `Normal`：原始阶梯价格
- `Safe`：整体降低买价，降低成交率但改善赔率
- `Aggressive`：整体提高买价，提高成交率但牺牲赔率

公开版默认 `Safe Bias = -10%`、`Aggressive Bias = +10%`。

### 4.3 当前 Web 配置

当前托管页面显示：

- Enabled：On
- Base Size：`$5`
- Symbols：BTC、ETH、SOL、XRP
- 5m Ladder：Safe
- Safe Bias：`-20%`
- Aggressive Bias：`+10%`
- 当前 5m 选中档位：`0.25 / 0.21 / 0.18 / 0.13 / 0.08 / 0.03`
- Symbol multiplier：BTC `1.0`、ETH `0.8`、SOL `0.5`、XRP `0.5`
- Timeframe multiplier：5m `0.75`、15m `1.0`、1h/4h `1.25`
- 开盘后撤单：5m `20s`、15m `40s`、1h `60s`、4h `180s`

理论 side budget 公式为：

```text
base_size × symbol_multiplier × timeframe_multiplier
```

但是公开源码还有一个更强的执行约束：**每个 rung 最低 $5**。因此当 Base Size 很小时，最低订单门槛会覆盖权重和 multiplier 计算，使 `$5 Base Size` 不能充当总风险上限。

### 4.4 日志验证

日志中出现的 5m 档位包括：

- `$0.25 × 20 = $5`
- `$0.21 × 23.81 ≈ $5`
- `$0.18 × 27.78 ≈ $5`
- `$0.13 × 38.47 ≈ $5`
- `$0.08 × 62.5 = $5`
- `$0.03 × 166.67 ≈ $5`

这些价格与 Normal 5m 阶梯应用 `-20% Safe Bias`、向上按 1 美分对齐后的结果完全一致，证明 Web 设置确实进入了运行时。

日志同时对 `SOL Up` 与 `SOL Down` 尝试多个档位，验证了“双边盘前阶梯”的策略结构。

### 4.5 退出逻辑

日志对 5m 订单明确写出：

```text
When filled, no sell orders will be placed
Hold-to-resolution policy applied
```

因此当前 5m 路径倾向于成交后持有到结算。公开源码另有 Premarket TP worker，但只适用于 15m/1h/4h：开盘五分钟后开始工作，目标卖价规则为 `max(2 × entry, top_ask, 0.60)`，再按 tick 对齐。

### 4.6 当前主要风险

如果六档、两边全部成功提交，单一市场的最低名义挂单额可达到：

```text
6 档 × 2 边 × $5 = $60
```

这不是必然成交额，因为还存在余额、arbiter、并发、去重和撤单控制；但它表明 `$9.37` 本金不足以完整表达一次 Premarket ladder。当前日志已经证明只有一个约 `$5` 活动订单后，其他订单就被余额校验拒绝。

## 5. EVSnipe 与 Pre-hit

### 5.1 EVSnipe 原理

EVSnipe 面向带有明确价格目标的加密货币 hit-price 市场，例如“BTC 是否会在到期前触及某个价格”。公开源码的流程是：

1. 本地扫描 Polymarket Gamma 市场并建立 watchlist。
2. 用 Binance 实时成交数据跟踪现货价格。
3. 当价格触及 strike 时，把规则映射到对应 Polymarket outcome token。
4. 立即提交 FAK BUY。
5. 通过 condition/leg 去重，防止同一信号重复执行。

FAK（Fill-and-Kill）允许立即成交可成交部分，并取消剩余部分，因此它比普通挂单更偏向低延迟抢成交。源码中的最大买价保护固定为 `0.99`，这意味着策略在确认“已经命中”的场景下可以接受很高价格；仍然存在数据延迟、错误映射、流动性和结算定义风险。

### 5.2 当前 Web 配置

- Enabled：On
- Size Per Hit Signal：`$5`
- Symbols：BTC、ETH、SOL、XRP、DOGE、BNB、HYPE
- Strike Window：`20%`
- Max Days To Expiry：`30`
- Web 页面显示 Max Exposure：`$100,000`

公开源码 v2.6.2 的默认值是：

- Size：`$5`
- Strike Window：固定 `20%`
- Max Days To Expiry：`30`
- Strategy Cap：`$10,000`
- Worker count：`4`
- Max inflight tasks：`16`

Web 的 `$100,000` 与公开版 `$10,000` 默认 cap 不一致。无论哪个值，对当前 `$9.37` 账户都没有实际保护意义；有效限制最终来自钱包余额和共享 arbiter。

### 5.3 Pre-hit 原理

Pre-hit 是 EVSnipe 的提前入场 leg，而不是独立市场策略。它在现货价格尚未真正越过 strike、但进入极窄触发带时先建立部分仓位；真正 hit 后再执行 confirm leg。

当前配置：

- Pre-hit：On
- Pre-hit Ratio：`0.30`
- Pre-trigger：`1 bps`

对于一个 `$5` hit signal，概念上的预算拆分为：

- Pre-hit leg：约 `$1.50`
- Confirm leg：约 `$3.50`

`1 bps = 0.01%`。公开源码还规定，当距离市场 cutoff 不足四小时时，不允许再触发 Pre-hit；确认命中已进入 inflight 或 completed 后，也会阻止同一 condition 的后续 Pre-hit。

### 5.4 本次运行证据

当前日志没有出现 `evsnipe_v1` request、FAK EVSnipe 成交或 Pre-hit/confirm leg 记录。因此只能确认配置已开启，不能确认它已实际交易，更不能据此评估胜率或收益。

## 6. MM 2.0

### 6.1 策略原理

MM 2.0 的公开策略 ID 是 `mm_sport_v1`。它在有 Polymarket 流动性奖励的二元市场上，为两个 outcome 的 top-of-book 放置 BUY maker 报价，目标收益来自：

- bid/ask spread
- 流动性奖励
- maker rebate（若适用）

它不是无风险套利。任一侧成交都会形成方向性库存；行情单边移动、比赛临近开始或奖励下降时，库存退出可能产生亏损。公开源码因此包含奖励门槛、top bid 门槛、FIFO 队列占比、实况比赛保护、库存清理和最大退出亏损等控制。

### 6.2 当前 Web 配置

当前策略关闭，页面显示的配置包括：

- Enabled：Off
- Route：提供 Sport / Non-S / Dual；页面描述以 Sports 为默认路径
- Quote Sizing：Depth Ratio
- Max Share Ratio：`0.20`
- Min Top Depth：`$1,100`
- Min Entry Top Bid：`$0.05`
- Active Hours：Off（界面保留 13:00–04:00 UTC 窗口）
- Min Reward / Day：`$5`
- Pause After Fill：`3600s`
- Inventory Exit Starts：到期前 `1h`
- Non-S Fresh Entry Stop：结束前 `48h`
- Quote Expiry：`185–300s`
- FIFO Max Share Ratio：`0.50`
- Sport Max Quote Shares：`1000`
- Non-S Max Quote Shares：`200`
- Inventory Exit：Auto
- Max Exit Loss：`10 cents/share`

`Depth Ratio = 0.20` 表示根据可见 top-of-book 深度和可用 buying power 计算报价规模，目标不超过设定的深度份额。它不代表只用本金的 20%。

### 6.3 公开版默认值与差异

公开 v2.6.2 默认：

- 策略 Off
- Route：Sports
- Quote mode：Depth Ratio
- Max Share Ratio：`0.20`
- Min Reward / Day：`$5`
- Match Only：true
- Min Entry Top Bid：`$0.05`
- Sponsored Rewards：允许
- Depth Ratio collateral cap：可用 pUSD 的 `90%`
- Quote expiry：源码文档默认 `65–185s`
- Inventory max loss：`10 cents/share`

Web 当前 `185–300s` 与公开版默认 `65–185s` 不同，应视为托管版覆盖值或版本差异。

### 6.4 当前适用性

当前关闭 MM 2.0 是合理的风险隔离状态。公开仓库的策略组合指南明确建议：MM 2.0 不应在没有重新审查 sizing 与 inventory risk 的情况下，与高频方向性策略同时重仓运行。以 `$9.37` 本金同时运行做市和 Premarket/EVSnipe，会产生明显的资金竞争和库存退出问题。

## 7. COMBO//

### 7.1 策略原理

COMBO// 是体育组合市场的 RFQ sidecar。机器人选择符合条件的体育 Combo，向市场请求报价，并只在报价相对于刷新后的 fair odds 足够有利时确认交易。

Combo 的多个 leg 必须共同成立才能获胜，赔率通常较高，但一个 leg 失败即可使整组失败。`Quote/Fair Odds` 过滤器衡量市场报价相对于内部公平赔率是否具有足够价值。

### 7.2 当前 Web 配置

- Enabled：Off
- Event Window：Today
- Today 定义：Bot 启动一小时后至 18:00 UTC 开始的赛事
- Minimum Size：`$11`
- Maximum Size：`$11`
- 因最小值等于最大值，每个 RFQ 实际固定 `$11`
- Max Trades per Day：`10,000`，相当于未设置实用安全上限
- Market Types：All（Moneyline、Totals、Spreads）
- Sports：All
- Fair Odds：`1.5x–5x`
- Minimum Quote/Fair Odds：`85%`

当前 bankroll 只有约 `$9.37`，低于单笔 `$11`，即使打开也无法正常完成一笔配置规模的交易。

### 7.3 源码边界

公开 EVPOLY 主程序没有 COMBO// 业务实现。仓库中只有 CLOB SDK 自带的通用 RFQ 类型和示例，不能证明托管版 Combo 的筛选、定价或确认逻辑。该策略应视为 EVPLUS 平台专有 sidecar，以上原理以 Web 页面文案为准。

## 8. 当前日志的技术审计

### 8.1 已确认的订单状态

交易所返回示例：

```text
balance: 9365227
sum of active orders: 5006100
sum of matched orders: 0
order amount (inc. fees): 5005100
```

换算后约为：

- 钱包余额：`$9.365227`
- 已有活动订单占用：`$5.006100`
- 新订单需要：`$5.005100`
- 两者合计超过余额，因此返回 HTTP 400

这不是签名失败、网络超时或 API key 失效，而是明确的余额/allowance不足。日志还写明：

```text
local order signer error did not qualify for fallback
fallback signer skipped for non-fallback post error
```

也就是说本地签名与 builder attribution 路径已经走到交易所；由于错误属于永久性业务拒绝，系统正确地没有切换 fallback signer 重试。

### 8.2 `Pending Trades` 的含义

Dashboard 同时出现：

- `Pending Trades: 7`
- `Total Trades Executed: 0`
- `Open exposure: $0.00`

因此 `Pending` 不能解释为七笔已成交仓位。它混合反映内部 tracking/候选 ladder/未成交订单状态。判断真实风险时，应优先看：

1. Polymarket Open Orders
2. active-order reserved balance
3. matched fills
4. positions / exposure

本次可以确认至少存在一个活动挂单，但没有 matched order 或持仓。

### 8.3 当前有效策略画像

从日志看，当前机器人并非同时执行所有已开启策略，而是频繁刷新四种资产的 5m/15m UP/DOWN 盘口，并在新周期前批量提交 Safe ladder。当前风险几乎全部来自 Premarket 的订单占用；EVSnipe 只是待命状态。

## 9. 源码与部署方式

### 9.1 公开自托管版

公开仓库是 Rust 项目：

- crate：`polymarket-arbitrage-bot`
- version：`2.6.2`
- Rust edition：2021
- Polymarket CLOB V2 SDK：`0.6.0-canary.1`
- 异步运行时：Tokio
- HTTP / WebSocket：Reqwest、tokio-tungstenite
- 本地持久化：SQLite `tracking.db`
- 事件与历史：`events.jsonl`、`history.toml`
- 本地管理 API：Axum `manual_bot`

官方 README 推荐部署在 Vultr VPS，规格为 2 vCPU / 4GB RAM、Amsterdam。标准流程是：

```bash
cargo build --release --bin polymarket-arbitrage-bot
./ev start live
```

`./ev` 负责 `.env` 加载、release build 检查、tmux session、wallet-sync worker、磁盘清理与自动重启。它不是 Docker/Kubernetes-first 的部署方式。

公开仓库采用 PolyForm Noncommercial 1.0.0，是**源码可见、非商业许可**，不是宽松开源许可证。个人研究和非商业使用被允许；将其作为商业 SaaS 需要另行授权。

### 9.2 EVPLUS 托管版

从公开 HTTP 响应和页面资源可以确认：

- 前端为 React/Vite 单页应用，静态资源由 Vercel 提供。
- 登录使用 Clerk 自定义域名 `clerk.evplus.ai`。
- 产品 API 地址是 `https://api-web.evplus.ai`，由 Cloudflare 代理；根路径返回 `EVPOLY Platform backend is running.`。
- `alpha.evplus.ai` / `alpha2.evplus.ai` 用于部分远程发现或 alpha 服务，前面同样有 Cloudflare。
- 官方 FAQ 明确说明关闭浏览器后 Bot 仍会在 EVPLUS 基础设施上运行。
- Bot Setup 页面说明 managed signer key 使用 AWS KMS 加密，并允许用户导出私钥。
- 实际订单日志显示使用本地 CLOB SDK 签名和 EVPOLY builder attribution。

无法从公开信息确认：

- Bot worker 具体运行在 AWS、Vultr 还是其他计算平台
- 是否使用容器、ECS、Kubernetes 或纯 VPS/tmux
- Web API 如何调度每个用户的 Rust worker
- 生产版本对应的精确 Git commit
- KMS key policy、数据库类型、备份与灾备方案

合理但未证实的架构推断是：Vercel 前端通过 Clerk token 调用 `api-web.evplus.ai`；后端管理用户、credits、bot 配置和生命周期；独立 Rust worker 使用用户钱包签名材料连接 Polymarket CLOB，并把日志、订单和钱包快照回传给平台。此推断与页面及日志一致，但不是官方架构声明。

## 10. Web 托管版与公开源码的差异

| 项目 | 当前 Web | 公开 v2.6.2 默认 | 判断 |
|---|---:|---:|---|
| Premarket Base Size | $5 | $10 | 托管账户覆盖 |
| 5m Ladder | Safe，-20% | Normal；Safe 默认 -10% | 托管账户覆盖 |
| Premarket symbols | BTC/ETH/SOL/XRP | 相同 | 一致 |
| EVSnipe size | $5 | $5 | 一致 |
| EVSnipe symbols | 7 个 | 相同 7 个 | 一致 |
| EVSnipe cap | $100,000 | $10,000 | 明显差异 |
| EVSnipe strike window | 20% | 固定 20% | 一致 |
| MM 2.0 | Off | Off | 一致 |
| MM max share ratio | 0.20 | 0.20 | 一致 |
| MM quote expiry | 185–300s | 65–185s | 托管覆盖或版本差异 |
| COMBO// | Web 专有 | 主程序无实现 | 平台专有模块 |

公开源码可以解释核心策略和日志，但不能被当作托管生产环境的逐字镜像。

## 11. 针对当前账户的建议

### P0：先处理资金与订单规模不匹配

在继续运行前，应先确认 Polymarket Open Orders 中那一笔约 `$5` 的活动订单是否仍然存在。当前 `$9.37` 无法支撑 Premarket 的多档双边设计，持续运行只会产生大量永久性余额拒绝。

可选方向只有两类：

- 暂停 Premarket，保留资金并观察；或
- 重新设计可接受的总暴露，再决定是否提供足够本金。

不建议仅因为错误而机械增加资金。应先把“单市场、单周期、所有 rung 的最大总订单额”算清楚。

### P1：不要把 Base Size 当作总风险上限

公开源码的 `$5/rung` 最低门槛会使小 Base Size 失去直观意义。建议 EVPLUS 产品侧同时展示：

- per-rung minimum
- estimated max orders per market
- estimated max reserved collateral
- current available buying power

在现有 UI 下，仅看到 `$5` 很容易误以为一次最多投入 `$5`。

### P1：降低无效的策略 cap

EVSnipe Web cap `$100,000` 与当前账户规模完全脱节。即使钱包余额暂时形成硬限制，也应把策略 cap 设置为与账户权益和可承受损失一致的数值，避免未来充值后突然放大风险。

### P1：保持 MM 2.0 与 COMBO// 关闭

- MM 2.0 需要更充足的双边抵押资金和库存退出空间。
- COMBO// 单笔最低 `$11` 已高于当前 bankroll。
- 公开仓库也建议把方向性 stack 与 MM profile 分开运行，除非重新审查 sizing。

### P2：先积累可评价样本

当前 `Executed = 0`，没有数据支持胜率、期望值或收益判断。至少应记录：

- 每个策略的 submitted / rejected / filled 数量
- fill price 与结算结果
- reserved collateral 峰值
- 策略级 realized PnL
- maker reward / rebate 与方向性 PnL 分开统计
- 因余额不足而丢失的信号数量

在没有这些数据前，不能根据 “Running” 或 “Pending Trades” 判断策略有效。

## 12. 总体评价

从设计上看，EVPLUS 不是单一“套利机器人”，而是一个多策略执行平台：

- Premarket 寻找新盘薄流动性和低价成交机会；
- EVSnipe 用外部现货触发器抢 hit-price 市场；
- MM 2.0 用库存风险换取 spread 与 LP reward；
- COMBO// 用公平赔率过滤体育组合 RFQ。

四类策略的收益来源和风险完全不同，不能用同一个“每笔金额”理解。当前账户最实际的问题是：托管页面显示的配置看起来很小，但 Premarket 的 per-rung 最低金额使真实挂单需求远高于 bankroll。日志已经验证这个问题，而不是理论上的担忧。

在现状下，最稳妥的结论是：**Bot 已运行，但策略还没有形成有效成交样本；大多数 Premarket 订单因资金不足无法提交，因此当前运行结果不能用于评价策略盈利能力。**

## 13. 主要参考资料

- [EVPLUS 官方产品页](https://www.evplus.ai/)
- [EVPOLY 公开仓库](https://github.com/Degenapetrader/EVPOLY)
- [EVPOLY v2.6.2 调研提交](https://github.com/Degenapetrader/EVPOLY/commit/10eb5b50fa143461b99e9d1c561a9935eb49dbc3)
- [Premarket v1 Guide](https://github.com/Degenapetrader/EVPOLY/blob/main/docs/premarket_v1.md)
- [EVSnipe v1 Guide](https://github.com/Degenapetrader/EVPOLY/blob/main/docs/evsnipe_v1.md)
- [MM 2.0 Guide](https://github.com/Degenapetrader/EVPOLY/blob/main/docs/mm_sport_v1.md)
- [Strategy Combo Guide](https://github.com/Degenapetrader/EVPOLY/blob/main/docs/strategy_combos.md)
- EVPLUS 登录后的 Strategy Settings 与实时 Bot Logs（2026-08-07 采样）
