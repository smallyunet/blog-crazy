---
title: 对 Berachain 项目的分析
tags:
  - 项目分析
date: 2025-08-31 00:19:23
draft_date: 2025-08-30 23:06:41
series: Web3 项目分析系列文章
---


上周分析 Arc 项目的时候，提到 Arc 的一大亮点，是自己开发了 Rust 版本的 Malachite 共识，然后开发了一个兼容层，对接原生的 Reth 作执行层。这是一个很有意思的事情，于是我想到，那么有没有人开发 CometBFT 和 Geth 的兼容层，把 Geth 和 CometBFT 接起来呢？

[Berachain](https://www.berachain.com/) 就干了这个事情。要是只看 Berachain 的官网，肯定会觉得这是一个不怎么严肃的项目，因为首页用了一堆花里胡哨的元素展示信息。但是 Bearchain 开源了一个叫 [beacon-kit](https://github.com/berachain/beacon-kit) 的仓库，作用就是对接 CometBFT 和 Geth，一键启动一条原生 EVM 客户端 + PBFT 共识的链。（如果 Bearchain 没干这个事情，我就想干）。Berachain 的项目创意是受到 Arc 启发吗？不好说。

在没看代码的情况下，猜测把 Geth + CometBFT 中间层需要做的事情，大概是当 Geth 生成 Payload 后，把 Payload 给 PBFT 出块，然后把出块结果返回给 Geth。所以应该不会特别复杂，主要是监听两侧的事件，然后做好接口之间的字段转换。

不过从 beacon-kit 的代码量和提交次数来看，这事好像没那么简单，或者 Berachain 把事情做复杂了。malaketh-layered 的代码量显然没那么大。

因为项目复杂，具体的源码解读还需要点时间。目前关注到的一个疑点是 Berachain 沿用了 [slot](https://github.com/berachain/beacon-kit/blob/main/consensus/types/slot_data.go) 的概念，这有点奇怪，slot 是以太坊共识层的概念，Geth 里没有，CometBFT 里也没有。当然，Bearchain 是提供了一些解释的，比如 [架构文档](https://github.com/berachain/beacon-kit/blob/main/CLAUDE.md#cometbft-integration-abci) 里提到 slot 和区块高度的映射关系，以及 [代码注释](https://github.com/berachain/beacon-kit/blob/main/state-transition/core/state_processor.go#L127) 中提到 Bearchain 的设计不允许有空槽等。

beacon-kit 还需要维护数据库、做状态转换……总之初看这个项目感觉没有想象中那么简单，虽然不是开发新的链，听起来像是在集成一些启动脚本，然而事实上做的事情又有点多，多到我有点怀疑这些东西是不是必要的……我觉得有必要后续再深入了解下源码，并且自己试着做一个兼容层试试。

在看到 Berachain 文档中关于 [Proof-of-Liquidity](https://docs.berachain.com/learn/pol/) 的部分后，基本上就能知道 beacon-kit 确实是偏复杂的，因为 beacon-kit 根本不是一个工具类型的仓库，而是带有 Berachain 特有的一些经济模型逻辑，比如有 [MockPOL](https://github.com/berachain/beacon-kit/blob/main/contracts/src/brip0004/MockPoL.sol) 相关的合约代码等，beacon-kit 就是 Berachain 本身，复杂也是能理解的了。看来世界上应该还需要另一个轻便一点的兼容层。

至于 Bearchain 的其他方面，因为是 EVM 兼容的链，所以各种 DAPP 自然能玩。X 上有接近 1 M 的粉丝，关注量很高，代币 $BERA 在今年 2 月份就上了币安等交易所，市值排名 150 名左右。我有点小看 Berachain 的经济实力了，竟然在分析这个市值排名第 150 的链。这已经没什么可怀疑的，主要还是学习下 Bera 的技术。



