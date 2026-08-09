---
title: BitDoge
date: 2026-01-20 23:47:06
tags: BitDoge
---

BitDoge 是一个部署在以太坊主网（Chain ID=1）的 ERC-20 代币，按照这样的规则运行：

1. 代币名称：BitDoge (BITDOGE)
2. 代币合约地址：[`0x000000001994bb7b8ee7d91012bdecf5ec033a7f`](https://etherscan.io/address/0x000000001994bb7b8ee7d91012bdecf5ec033a7f)
3. 代币的总供应量是 2100 万，没有初始流通量
4. 代币的释放规则是，每一个以太坊区块最多产生 1 BitDoge
5. 获取代币的方式是，每次向代币的合约地址转账 0 ETH，就可以获得 1 BitDoge
6. 转账的金额可以大于 0 ETH，但是不会因为带有金额而获得更多 BitDoge，仍然只能得到 1 BitDoge。而且转账的金额会被永久锁定在合约内，无法取出
7. 合约中没有任何 Owner 权限，也没有其他特殊权限，[合约源码](https://etherscan.io/address/0x000000001994bb7b8ee7d91012bdecf5ec033a7f#code) 已经在 Etherscan 验证
8. 代币的创世区块（Genesis Block）是以太坊的区块高度 [24444444](https://etherscan.io/block/24444444)（2026年2月12日），在此之前合约会拒绝交易
9. 每一个区块的代币奖励是 1 BitDoge，每 4 年减半一次，也就是 10512000 个以太坊区块之后，每个区块只能获得 0.5 BitDoge
10. 如果当前区块没有地址交互，代币奖励会打入黑洞地址 [`0x000000000000000000000000000000000000dEaD`](https://etherscan.io/address/0x000000000000000000000000000000000000dEaD)
11. 每一个区块只有第一个与合约交互的地址可以获得代币奖励
12. 按照每 4 年一次的减半周期，BitDoge 的区块奖励大概会在 140 年之后（2166年）归零

合约源码全文：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title BitDoge (The 140-Year Social Experiment)
 * @notice A deflationary token that rigorously simulates Bitcoin's halving mechanics on Ethereum.
 * @dev 
 * - Total Supply: 21,000,000 (Strict Cap)
 * - Block Time: ~12 seconds (Ethereum)
 * - Halving: Every ~4 years (10,512,000 blocks)
 * - Mechanism: 
 * 1. Pure PVP: First come, first served per block. No Cooldowns. No Limits.
 * 2. Entropy Rule: If a block is missed (no interaction), its reward is BURNED forever.
 * 3. Genesis Launch: Mining is strictly locked until block #24,444,444.
 */
contract BitDoge is ERC20 {
    // ==========================================
    //              COSMIC CONSTANTS
    // ==========================================

    // Strict cap: 21 Million coins.
    uint256 public constant MAX_SUPPLY = 21000000 * 1e18; 
    
    // Initial reward: 1 Coin per block.
    // Ethereum produces ~7200 blocks/day. 
    // This matches Bitcoin's early issuance (~7200 BTC/day) perfectly.
    uint256 public constant INITIAL_REWARD = 1 * 1e18;
    
    // Halving interval: ~4 Years (based on 12s block time).
    uint256 public constant HALVING_BLOCKS = 10512000; 
    
    // Standard burn address (The Black Hole).
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ==========================================
    //           GENESIS CONFIGURATION
    // ==========================================

    // The Sequence of Death and Entropy.
    // Mining starts precisely at this block height.
    // Approx. 23 days from now (based on current height ~24.27M).
    uint256 public constant GENESIS_BLOCK = 24444444; 

    // ==========================================
    //              STATE VARIABLES
    // ==========================================

    // Tracks the last block that was processed (mined or burned).
    uint256 public lastMinedBlock;       
    
    // Total ETH sacrificed to the contract (forever locked).
    // Serves as the "floor value" or monument of the experiment.
    uint256 public totalSacrificed; 

    // ==========================================
    //                 EVENTS
    // ==========================================

    event Minted(address indexed user, uint256 userReward, uint256 burnedReward, uint256 blockNumber);
    event Sacrifice(address indexed user, uint256 amount);

    /**
     * @dev Constructor
     * Sets the state pointers. No parameters needed as Genesis is hardcoded.
     */
    constructor() ERC20("BitDoge", "BITDOGE") {
        require(GENESIS_BLOCK > block.number, "Genesis must be in the future");
        
        // Initialize state so the first valid mineable block is GENESIS_BLOCK
        lastMinedBlock = GENESIS_BLOCK - 1; 
    }

    /**
     * @dev Main interaction point. 
     * Send 0 ETH (to just mint) or sacrifice ETH (to mint + donate).
     * WARNING: No Cooldowns. No Max ETH Limits. Pure Gas War.
     */
    receive() external payable {
        // 1. Genesis Check: Is it time yet?
        require(block.number >= GENESIS_BLOCK, "BitDoge loading... Wait for Block #24444444!");

        // 2. Competition Check: Has this block already been mined?
        // Only one winner per block.
        require(block.number > lastMinedBlock, "Block already mined");
        
        // 3. Bot Protection: Only allow EOAs (Externally Owned Accounts).
        // This prevents smart contracts from batch-mining, ensuring fairness.
        require(msg.sender == tx.origin, "Humans only");
        
        // 4. Hard Cap Check.
        require(totalSupply() < MAX_SUPPLY, "Minting ended (Year 2160+)");

        _processMining(msg.sender, msg.value);
    }

    /**
     * @dev Internal logic to calculate rewards and burns.
     */
    function _processMining(address user, uint256 ethAmount) internal {
        // --- Step 1: Calculate Current Reward Rate ---
        // Based on time passed since Genesis.
        uint256 blocksPassed = block.number - GENESIS_BLOCK;
        uint256 era = blocksPassed / HALVING_BLOCKS; 
        
        // Bitwise shift for halving. Returns 0 after 64 halvings.
        uint256 currentRate = (era >= 64) ? 0 : (INITIAL_REWARD >> era);

        // --- Step 2: Distribute Rewards ---
        
        // A. User Reward: 
        // The user only gets the reward for the CURRENT block.
        uint256 userReward = currentRate;
        
        // B. Black Hole Reward (Entropy):
        // All blocks missed between the last mine and now are burned.
        // "Use it or lose it."
        uint256 missedBlocks = block.number - lastMinedBlock - 1;
        uint256 burnReward = missedBlocks * currentRate;
        
        // --- Step 3: Supply Cap Protection ---
        uint256 totalRequired = userReward + burnReward;
        if (totalSupply() + totalRequired > MAX_SUPPLY) {
            uint256 remaining = MAX_SUPPLY - totalSupply();
            
            // Priority given to the user. Burn the rest.
            if (remaining <= userReward) {
                userReward = remaining;
                burnReward = 0;
            } else {
                burnReward = remaining - userReward;
            }
        }

        // --- Step 4: Update State ---
        lastMinedBlock = block.number;
        
        // Handle ETH Sacrifice (locked forever)
        if (ethAmount > 0) {
            totalSacrificed += ethAmount;
            emit Sacrifice(user, ethAmount);
        }

        // --- Step 5: Minting ---
        if (userReward > 0) {
            _mint(user, userReward);
        }
        
        // Direct mint to Dead address (Auto-Burn)
        if (burnReward > 0) {
            _mint(BURN_ADDRESS, burnReward);
        }

        emit Minted(user, userReward, burnReward, block.number);
    }
}
```

