// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AntiTheft - 智能合约防盗币
 * @notice 通过智能合约的权限控制机制保护资产
 */
contract AntiTheft {
    // 状态变量
    address public owner;
    address public guardian;  // 监护人地址（Worker 或管理地址）
    bool public paused;  // 暂停状态
    bool public emergencyMode;  // 应急模式

    // 时间锁
    uint256 public transferLockTime;  // 转移锁定时间
    uint256 public constant TRANSFER_COOLDOWN = 1 hours;  // 转移冷却期

    // 事件
    event GuardianUpdated(address indexed oldGuardian, address indexed newGuardian);
    event EmergencyModeEnabled();
    event EmergencyModeDisabled();
    event TransferPaused();
    event TransferResumed();
    event FrozenTransfer(address indexed from, address indexed to, uint256 amount);
    event UnfrozenTransfer(address indexed from, address indexed to, uint256 amount);

    // 修饰符
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian, "Only guardian can call this function");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier transferTimeLock() {
        require(block.timestamp >= transferLockTime, "Transfer is time-locked");
        _;
    }

    // 构造函数
    constructor(address _guardian) {
        owner = msg.sender;
        guardian = _guardian;
        paused = false;
        emergencyMode = false;
        transferLockTime = 0;
        emit GuardianUpdated(address(0), _guardian);
    }

    // ===== 管理员功能 =====

    /**
     * @notice 更新监护人地址
     * @param _newGuardian 新的监护人地址
     */
    function updateGuardian(address _newGuardian) external onlyOwner {
        address oldGuardian = guardian;
        guardian = _newGuardian;
        emit GuardianUpdated(oldGuardian, _newGuardian);
    }

    /**
     * @notice 启用应急模式
     */
    function enableEmergencyMode() external onlyGuardian {
        emergencyMode = true;
        paused = true;
        emit EmergencyModeEnabled();
    }

    /**
     * @notice 关闭应急模式
     */
    function disableEmergencyMode() external onlyGuardian {
        emergencyMode = false;
        paused = false;
        emit EmergencyModeDisabled();
    }

    /**
     * @notice 暂停转移
     */
    function pauseTransfer() external onlyGuardian {
        paused = true;
        emit TransferPaused();
    }

    /**
     * @notice 恢复转移
     */
    function resumeTransfer() external onlyGuardian {
        paused = false;
        emit TransferResumed();
    }

    /**
     * @notice 设置转移锁定时间
     * @param _lockTime 锁定时间戳
     */
    function setTransferLockTime(uint256 _lockTime) external onlyGuardian {
        transferLockTime = _lockTime;
    }

    /**
     * @notice 延长转移冷却期
     */
    function extendTransferCooldown() external onlyGuardian {
        transferLockTime = block.timestamp + TRANSFER_COOLDOWN;
    }

    /**
     * @notice 转移所有权
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "New owner cannot be zero address");
        owner = _newOwner;
    }

    // ===== 视图函数 =====

    /**
     * @notice 检查是否允许转移
     * @param _sender 发送者地址
     * @param _receiver 接收者地址
     * @param _amount 转移金额
     * @return 是否允许转移
     */
    function canTransfer(
        address _sender,
        address _receiver,
        uint256 _amount
    ) external view returns (bool) {
        // 应急模式下禁止所有转移
        if (emergencyMode) {
            return false;
        }

        // 暂停状态下禁止转移
        if (paused) {
            return false;
        }

        // 检查时间锁
        if (block.timestamp < transferLockTime) {
            return false;
        }

        return true;
    }

    /**
     * @notice 获取转移状态信息
     * @return paused, emergencyMode, transferLockTime, canTransferNow
     */
    function getTransferStatus() external view returns (
        bool _paused,
        bool _emergencyMode,
        uint256 _transferLockTime,
        bool _canTransferNow
    ) {
        bool canNow = !paused && !emergencyMode && block.timestamp >= transferLockTime;
        return (paused, emergencyMode, transferLockTime, canNow);
    }

    // ===== 紧急情况处理 =====

    /**
     * @notice 冻结转移（记录但阻止）
     * @param _from 发送者
     * @param _to 接收者
     * @param _amount 金额
     */
    function recordFrozenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) external onlyGuardian {
        emit FrozenTransfer(_from, _to, _amount);
    }

    /**
     * @notice 解冻转移
     * @param _from 发送者
     * @param _to 接收者
     * @param _amount 金额
     */
    function recordUnfrozenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) external onlyGuardian {
        emit UnfrozenTransfer(_from, _to, _amount);
    }
}
