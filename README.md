// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title X-plan Token
 * @dev 演示在私钥泄露情况下如何保护资产的ERC20代币
 * 版本: 8.0.0
 * 网络: BSC Testnet
 */
contract XplanToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    
    // 安全特性
    mapping(address => bool) public whitelist;
    mapping(address => bool) public blacklist;
    mapping(address => uint256) public dailyTransferLimit;
    mapping(address => uint256) public lastTransferTime;
    
    uint256 public maxTransferAmount;
    bool public emergencyPause;
    address public securityGuard; // 安全管理员
    
    // 事件
    event WhitelistUpdated(address indexed account, bool status);
    event BlacklistUpdated(address indexed account, bool status);
    event DailyLimitUpdated(address indexed account, uint256 limit);
    event EmergencyPaused(bool status);
    event SecurityGuardChanged(address oldGuard, address newGuard);
    
    /**
     * @dev 构造函数
     * @param initialSupply 初始供应量
     * @param securityGuardAddress 安全管理员地址
     */
    constructor(
        uint256 initialSupply,
        address securityGuardAddress
    ) ERC20("X-plan Demo Token", "XPLAN") {
        _mint(msg.sender, initialSupply * 10**decimals());
        securityGuard = securityGuardAddress;
        maxTransferAmount = 10000 * 10**decimals(); // 默认最大转账限制
        emergencyPause = false;
        
        // 默认将部署者和安全管理员加入白名单
        whitelist[msg.sender] = true;
        whitelist[securityGuardAddress] = true;
    }
    
    // ==================== 安全功能 ====================
    
    /**
     * @dev 设置白名单
     */
    function setWhitelist(address account, bool status) external onlyOwner {
        whitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }
    
    /**
     * @dev 设置黑名单
     */
    function setBlacklist(address account, bool status) external onlyOwnerOrSecurityGuard {
        blacklist[account] = status;
        emit BlacklistUpdated(account, status);
    }
    
    /**
     * @dev 设置每日转账限额
     */
    function setDailyLimit(address account, uint256 limit) external onlyOwnerOrSecurityGuard {
        dailyTransferLimit[account] = limit;
        emit DailyLimitUpdated(account, limit);
    }
    
    /**
     * @dev 紧急暂停所有交易
     */
    function setEmergencyPause(bool status) external onlyOwnerOrSecurityGuard {
        emergencyPause = status;
        emit EmergencyPaused(status);
    }
    
    /**
     * @dev 更改安全管理员
     */
    function changeSecurityGuard(address newGuard) external onlyOwner {
        emit SecurityGuardChanged(securityGuard, newGuard);
        securityGuard = newGuard;
    }
    
    // ==================== 转账限制检查 ====================
    
    modifier transferRestrictions(address from, address to, uint256 amount) {
        require(!emergencyPause, "Emergency pause active");
        require(!blacklist[from], "Sender is blacklisted");
        require(!blacklist[to], "Recipient is blacklisted");
        
        // 检查转账金额限制
        if (!whitelist[from]) {
            require(amount <= maxTransferAmount, "Exceeds max transfer amount");
            
            // 检查每日限额
            if (dailyTransferLimit[from] > 0) {
                uint256 timeSinceLastTransfer = block.timestamp - lastTransferTime[from];
                if (timeSinceLastTransfer < 1 days) {
                    // 24小时内，检查累计转账
                    uint256 spentToday = balanceOf(from) - amount;
                    require(spentToday <= dailyTransferLimit[from], "Exceeds daily limit");
                } else {
                    // 新的一天，重置
                    lastTransferTime[from] = block.timestamp;
                }
            }
        }
        
        _;
    }
    
    // ==================== 重写ERC20函数 ====================
    
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused
        nonReentrant
        transferRestrictions(msg.sender, to, amount)
        returns (bool) 
    {
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        whenNotPaused
        nonReentrant
        transferRestrictions(from, to, amount)
        returns (bool) 
    {
        return super.transferFrom(from, to, amount);
    }
    
    function approve(address spender, uint256 amount) 
        public 
        override 
        whenNotPaused
        nonReentrant
        returns (bool) 
    {
        require(!blacklist[msg.sender], "Account is blacklisted");
        require(!blacklist[spender], "Spender is blacklisted");
        return super.approve(spender, amount);
    }
    
    // ==================== 铸造和销毁 ====================
    
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    // ==================== 管理员功能 ====================
    
    function withdrawStuckTokens(address tokenAddress, uint256 amount) 
        external 
        onlyOwner 
        nonReentrant 
    {
        IERC20 token = IERC20(tokenAddress);
        token.transfer(owner(), amount);
    }
    
    // ==================== 修饰符 ====================
    
    modifier onlyOwnerOrSecurityGuard() {
        require(
            msg.sender == owner() || msg.sender == securityGuard,
            "Caller is not owner or security guard"
        );
        _;
    }
}