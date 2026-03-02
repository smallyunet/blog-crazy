---
title: 对 Midnight Network 项目的分析
date: 2025-08-10 03:16:34
tags: 
- 项目分析
- ZK
series: Web3 项目分析系列文章
---

[Midngiht Network](https://midnight.network/) 早在 2022 年就 [宣布成立](https://iohk.io/en/blog/posts/2022/11/18/iog-announces-new-blockchain-to-protect-data-and-safeguard-technology-freedoms/?utm_source=chatgpt.com) 并处于技术研发中了。今天 6 月份 [正式宣布](https://midnight.network/blog/state-of-the-network-june-2025?utm_source=chatgpt.com) 了 NIGHT 代币的 TGE 计划，目前 NIGHT 代币的 [空投](https://www.midnight.gd/) 仍然处于申领阶段，所以近期 Midnight Network 处于比较活跃的状态。

**项目简介**

先来概括下 Midnight Network 在干什么，[白皮书](https://midnight.network/whitepaper) 中的介绍是，Midngiht Network 结合了 ZK 技术后，可以实现对链上的数据进行隐私保护的效果。其他公开区块链的 DApp 在和区块链进行交互的时候，必然是暴露所有用户数据和交互记录的，而 Midnight Network 试图解决这个问题，允许用户和区块链交互的时候，有一部分链上数据是保密（Shielded）的。

对于这样的项目描述，我们可能会好奇两个技术问题：

1. Midnight Network 的项目架构是怎样的？
2. Midngiht Network 是如何利用 ZK 技术，实现链上数据保密的？

此外白皮书里还提到了其他概念，像 DID、RWA、投票之类，这些都是噱头类型的应用场景，不用在意。

**项目背景**

Midnight Network 的资金实力非常强大，没有公开的融资信息，但是持续开发了多年，还用了 [Midnight Foundation](https://midnight.foundation/) 这样的名字，一般的开发团队可不敢叫基金会。技术实力也比较强大，比如开发出了 [Compact](https://docs.midnight.network/develop/reference/compact/writing) 这样的编程语言，作为智能合约的开发语言，这种语言是为了表达 ZK 电路而专门设计的。还有很多已经发布的 [软件](https://docs.midnight.network/relnotes/overview)，包括能本地运行的 Proof server、浏览器钱包、VS Code 插件等，简直自己开发了一整套生态。由此可见 Midnight Network 拥有深厚的技术积累。

遗憾的是，Midnight Network 公开的 [Github仓库](https://github.com/midnight-ntwrk) 里，没有开源任何核心代码，所以我们没办法从代码角度对项目的技术结构做分析，只能根据文档描述来推测技术实现。要注意，文档内容不一样靠谱，因为即使一行代码没写，文档也可以写的很全面。即使内部服务器用了单机的程序，也可以对外宣称是去中心化网络，不能因为有公开的测试网 RPC 而相信什么。

**共识与出块**

不过也不用过度担心，文档中已经公开了很多操作流程。首先借用了 Cardano 的 [质押池](https://docs.midnight.network/validate/run-a-validator/)，Midnight 的节点会追踪 Cardano 网络的质押情况，用来确认哪些节点有出块权限，有点像是侧链的模式，但是 Midnight 又不完全依赖 Cardano 网络，Midnight 把这种模式叫做 partner chain。

Midnight 网络的 [出块](https://docs.midnight.network/develop/nodes-and-dapps/consensus) 则是借鉴了 PolkDot 网络 Substrate 的思路，由一种叫 [AURA](https://openethereum.github.io/Aura) 的 PoA 共识出块，[GRANDPA](https://wiki.polkadot.com/learn/learn-consensus/?utm_source=chatgpt.com#finality-gadget-grandpa) 机制负责块的确认。PolkDot 用这种混合的共识机制，是为了迎合子网络与平行链的应用场景。而 Midnight 用这种模式，目前没有找到很好的说辞，猜测一方面是直接用了 Substrate 的代码，方面二次开发；另一方面是有兼容 ZK 服务的考虑，也许有把 proof server 放到 validator 节点的尝试。

无论是哪种情况，都能看出 Midnight Network 有硬核的开发实力，在区块链的出块、共识方面都进行了自定义改造。

**隐私保护**

Midnight Network 能实现链上隐私保护的理论基础，是 IOHK 的一篇论文 [Kachina](https://iohk.io/en/research/library/papers/kachina-foundations-of-private-smart-contracts/)，论文很复杂，简单理解就是用 ZK 电路来描述智能合约的状态转移函数。以往的智能合约不都是公开代码来改变状态吗，Kachina 试图用 ZK 来隐藏代码细节。论文包含很多具体设计，比如 ZK 描述全部状态转移是一件困难的事情，就简化为只描述对状态预言机的访问记录。

所以对于 Midnight 的隐私保护能力，可以理解为对 Kachina 做了 [工程化](https://docs.midnight.network/academy/module-4) 的实现，链下生成对合约操作的 ZK 证明，链上来验证这个证明，并且改变链上状态。当然这个部分很复杂，但是 Midnight 把这一套做出来了，虽然代码没开源。

**隐私应用**

由于 Midngiht 对于 ZK 成熟的应用能力，搞出了 [Zswap](https://docs.midnight.network/learn/understanding-midnights-technology/zswap) 这种带有隐私保护的代币交换池，大意是链上只暴露了 ZK 的承诺信息，但是并不透露具体哪两种代币发生了交换，也不知道交换金额是多少。有点类似 Zcash 的效果，但是做的更好。

**代币模型**

Midnight 的代币模型搞的也很复杂，有 NIGHT 和 DUST 两种代币，因为 Midnight 网络本身的节点结构就复杂。NIGHT 是发行在 Cardano 上的，用 partner chain 的方式 1:1 锚定到 Midnight 上。DUST 则用来支付 Midnight 网络的手续费，持有 NIGHT 会不断产生 DUST，类似 Tron 网络的能量，持有 Trx 就会产生能量那种。

**小结**

Midnight Network 拥有很强的技术实力，无论是区块链方面的出块和共识机制，还是对于 ZK 在工程方面的落地能力，都有很大的技术难度，不是一般开发团队能胜任的。尽管叙事上不太接近当前的热点，应该不会很出圈，但是技术方面如果开源的话，肯定会留下浓墨重彩的一笔。





