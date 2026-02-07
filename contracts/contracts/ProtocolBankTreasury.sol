// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Protocol Bank Treasury
 * @author Protocol Banks Team
 * @dev USDC vault on Base L2 that backs pbUSD 1:1 on HashKey Chain.
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │                   Treasury Vault Design                      │
 * ├───────────────────────────────────────────────────────────────┤
 * │  Chain:       Base (mainnet 8453 / testnet 84532)            │
 * │  Asset:       USDC (Circle)                                  │
 * │  Controls:    Pausable, ReentrancyGuard, Daily Release Limit │
 * │  Roles:       Admin, Relayer, Guardian                       │
 * └───────────────────────────────────────────────────────────────┘
 *
 * Flow:
 *   1. User deposits USDC → Treasury emits DepositForMint
 *   2. Bridge bot observes event → mints pbUSD on HashKey Chain
 *   3. User burns pbUSD on HashKey → bot calls releaseFromBurn here
 *   4. Treasury sends USDC back to user on Base
 *
 * Security:
 *   - Daily release cap limits exposure from compromised relayer
 *   - Burn TX hash idempotency prevents double-release
 *   - Emergency withdrawal protected by GUARDIAN_ROLE
 *   - ReentrancyGuard on all fund-moving functions
 */
contract ProtocolBankTreasury is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //                          ROLES
    // ══════════════════════════════════════════════════════════════
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ══════════════════════════════════════════════════════════════
    //                      STATE VARIABLES
    // ══════════════════════════════════════════════════════════════
    IERC20 public immutable usdc;

    // --- Supply Tracking ---
    uint256 public totalDeposited;
    uint256 public totalReleased;

    // --- Burn TX Idempotency ---
    mapping(bytes32 => bool) public processedBurnTxs;

    // --- Daily Release Cap ---
    uint256 public dailyReleaseCap;
    uint256 public currentDayReleased;
    uint256 public lastReleaseResetDay;

    // --- Emergency ---
    uint256 public emergencyWithdrawalDelay;
    mapping(bytes32 => uint256) public emergencyRequests; // requestHash => unlockTimestamp

    // ══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ══════════════════════════════════════════════════════════════
    event DepositForMint(
        address indexed depositor,
        uint256 amount,
        address indexed hashKeyRecipient,
        uint256 timestamp
    );

    event ReleasedFromBurn(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed burnTxHash,
        address indexed relayer,
        uint256 timestamp
    );

    event EmergencyWithdrawRequested(
        address indexed requester,
        address indexed to,
        uint256 amount,
        bytes32 requestHash,
        uint256 unlockTime
    );

    event EmergencyWithdrawExecuted(
        address indexed executor,
        address indexed to,
        uint256 amount,
        bytes32 requestHash
    );

    event EmergencyWithdrawCanceled(bytes32 requestHash);
    event DailyReleaseCapUpdated(uint256 oldCap, uint256 newCap);
    event EmergencyDelayUpdated(uint256 oldDelay, uint256 newDelay);
    event ReleaseCapReset(uint256 day, uint256 previousDayTotal);

    // ══════════════════════════════════════════════════════════════
    //                        ERRORS
    // ══════════════════════════════════════════════════════════════
    error InvalidAmount();
    error InvalidRecipient();
    error BurnTxAlreadyProcessed(bytes32 burnTxHash);
    error DailyReleaseCapExceeded(uint256 requested, uint256 remaining);
    error InsufficientVaultBalance(uint256 requested, uint256 available);
    error EmergencyNotReady(bytes32 requestHash, uint256 unlockTime);
    error EmergencyRequestNotFound(bytes32 requestHash);
    error EmergencyAlreadyRequested(bytes32 requestHash);

    // ══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════
    constructor(
        address _usdc,
        address admin,
        address relayer,
        address guardian,
        uint256 _dailyReleaseCap,
        uint256 _emergencyDelay
    ) {
        usdc = IERC20(_usdc);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, relayer);
        _grantRole(GUARDIAN_ROLE, guardian);

        dailyReleaseCap = _dailyReleaseCap;
        emergencyWithdrawalDelay = _emergencyDelay;
        lastReleaseResetDay = _currentDay();
    }

    // ══════════════════════════════════════════════════════════════
    //                    DEPOSIT (User → Vault)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Deposit USDC into the treasury to receive pbUSD on HashKey Chain.
     * @param amount Amount of USDC to deposit (6 decimals).
     * @param hashKeyRecipient The address on HashKey Chain to receive pbUSD.
     */
    function depositToHashKey(uint256 amount, address hashKeyRecipient)
        external
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) revert InvalidAmount();
        if (hashKeyRecipient == address(0)) revert InvalidRecipient();

        totalDeposited += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit DepositForMint(msg.sender, amount, hashKeyRecipient, block.timestamp);
    }

    // ══════════════════════════════════════════════════════════════
    //                  RELEASE (Vault → User)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Release USDC to a user after they burned pbUSD on HashKey Chain.
     * @dev Only callable by authorized relayer. Idempotent via burnTxHash.
     * @param recipient The USDC recipient on Base.
     * @param amount Amount of USDC to release (6 decimals).
     * @param burnTxHash The pbUSD burn transaction hash on HashKey Chain (for idempotency).
     */
    function releaseFromBurn(
        address recipient,
        uint256 amount,
        bytes32 burnTxHash
    )
        external
        onlyRole(RELAYER_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();
        if (processedBurnTxs[burnTxHash]) revert BurnTxAlreadyProcessed(burnTxHash);

        // Daily release limit check
        _resetDailyReleaseIfNeeded();
        if (dailyReleaseCap > 0 && currentDayReleased + amount > dailyReleaseCap) {
            revert DailyReleaseCapExceeded(amount, dailyReleaseCap - currentDayReleased);
        }

        uint256 balance = usdc.balanceOf(address(this));
        if (balance < amount) revert InsufficientVaultBalance(amount, balance);

        processedBurnTxs[burnTxHash] = true;
        currentDayReleased += amount;
        totalReleased += amount;

        usdc.safeTransfer(recipient, amount);

        emit ReleasedFromBurn(recipient, amount, burnTxHash, msg.sender, block.timestamp);
    }

    // ══════════════════════════════════════════════════════════════
    //            EMERGENCY WITHDRAWAL (Time-locked)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Request an emergency withdrawal. Subject to time-lock delay.
     */
    function requestEmergencyWithdraw(address to, uint256 amount)
        external
        onlyRole(GUARDIAN_ROLE)
    {
        if (to == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        bytes32 requestHash = keccak256(abi.encode(to, amount, block.timestamp));
        if (emergencyRequests[requestHash] != 0) revert EmergencyAlreadyRequested(requestHash);

        uint256 unlockTime = block.timestamp + emergencyWithdrawalDelay;
        emergencyRequests[requestHash] = unlockTime;

        emit EmergencyWithdrawRequested(msg.sender, to, amount, requestHash, unlockTime);
    }

    /**
     * @notice Execute a previously requested emergency withdrawal after time-lock.
     */
    function executeEmergencyWithdraw(
        address to,
        uint256 amount,
        bytes32 requestHash
    )
        external
        onlyRole(GUARDIAN_ROLE)
        nonReentrant
    {
        uint256 unlockTime = emergencyRequests[requestHash];
        if (unlockTime == 0) revert EmergencyRequestNotFound(requestHash);
        if (block.timestamp < unlockTime) revert EmergencyNotReady(requestHash, unlockTime);

        uint256 balance = usdc.balanceOf(address(this));
        if (balance < amount) revert InsufficientVaultBalance(amount, balance);

        delete emergencyRequests[requestHash];
        totalReleased += amount;

        usdc.safeTransfer(to, amount);

        emit EmergencyWithdrawExecuted(msg.sender, to, amount, requestHash);
    }

    /**
     * @notice Cancel a pending emergency withdrawal request.
     */
    function cancelEmergencyWithdraw(bytes32 requestHash)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (emergencyRequests[requestHash] == 0) revert EmergencyRequestNotFound(requestHash);
        delete emergencyRequests[requestHash];
        emit EmergencyWithdrawCanceled(requestHash);
    }

    // ══════════════════════════════════════════════════════════════
    //                    ADMINISTRATION
    // ══════════════════════════════════════════════════════════════

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setDailyReleaseCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldCap = dailyReleaseCap;
        dailyReleaseCap = newCap;
        emit DailyReleaseCapUpdated(oldCap, newCap);
    }

    function setEmergencyDelay(uint256 newDelay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldDelay = emergencyWithdrawalDelay;
        emergencyWithdrawalDelay = newDelay;
        emit EmergencyDelayUpdated(oldDelay, newDelay);
    }

    // ══════════════════════════════════════════════════════════════
    //                     VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Returns USDC balance held in the vault.
     */
    function vaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Net deposits = totalDeposited - totalReleased.
     */
    function netDeposited() external view returns (uint256) {
        return totalDeposited - totalReleased;
    }

    /**
     * @notice How much more USDC can be released today.
     */
    function remainingDailyRelease() external view returns (uint256) {
        if (dailyReleaseCap == 0) return type(uint256).max;
        uint256 day = _currentDay();
        if (day != lastReleaseResetDay) return dailyReleaseCap;
        if (currentDayReleased >= dailyReleaseCap) return 0;
        return dailyReleaseCap - currentDayReleased;
    }

    /**
     * @notice Whether a burn TX has been processed.
     */
    function isBurnProcessed(bytes32 burnTxHash) external view returns (bool) {
        return processedBurnTxs[burnTxHash];
    }

    // ══════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function _resetDailyReleaseIfNeeded() internal {
        uint256 today = _currentDay();
        if (today != lastReleaseResetDay) {
            emit ReleaseCapReset(today, currentDayReleased);
            currentDayReleased = 0;
            lastReleaseResetDay = today;
        }
    }
}
