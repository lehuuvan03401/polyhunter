// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IPolyHunterProxy {
    function execute(address target, bytes calldata data) external payable returns (bytes memory);
}

/**
 * @title PolyHunterExecutor
 * @notice Central authorization hub for the Horus Wallet Fleet.
 * @dev Users authorize this contract address on their Proxy. 
 *      This contract then validates that the caller is a whitelisted Worker before passing the call.
 */
contract PolyHunterExecutor is Ownable {
    
    // Whitelist of valid worker wallets (The Fleet)
    mapping(address => bool) public isWorker;

    // Allowlisted target contracts
    mapping(address => bool) public allowedTargets;

    // Pause switch for execution
    bool public paused;

    event WorkerAdded(address indexed worker);
    event WorkerRemoved(address indexed worker);
    event ExecutionForwarded(address indexed proxy, address indexed worker, bool success);
    event TargetAllowedUpdated(address indexed target, bool allowed);
    event ExecutionPaused(bool paused);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Add a worker to the whitelist.
     * @param worker Address of the worker wallet.
     */
    function addWorker(address worker) external onlyOwner {
        require(worker != address(0), "Invalid address");
        isWorker[worker] = true;
        emit WorkerAdded(worker);
    }

    /**
     * @notice Remove a worker from the whitelist.
     * @param worker Address of the worker wallet.
     */
    function removeWorker(address worker) external onlyOwner {
        isWorker[worker] = false;
        emit WorkerRemoved(worker);
    }

    /**
     * @notice Bulk add workers.
     */
    function addWorkers(address[] calldata workers) external onlyOwner {
        for (uint256 i = 0; i < workers.length; i++) {
            if (workers[i] != address(0)) {
                isWorker[workers[i]] = true;
                emit WorkerAdded(workers[i]);
            }
        }
    }

    /**
     * @notice Update allowlist targets
     */
    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        require(target != address(0), "Invalid target");
        allowedTargets[target] = allowed;
        emit TargetAllowedUpdated(target, allowed);
    }

    /**
     * @notice Batch update allowlist targets
     */
    function setAllowedTargets(address[] calldata targets, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            address target = targets[i];
            if (target != address(0)) {
                allowedTargets[target] = allowed;
                emit TargetAllowedUpdated(target, allowed);
            }
        }
    }

    /**
     * @notice Pause execution forwarding
     */
    function pauseExecution() external onlyOwner {
        paused = true;
        emit ExecutionPaused(true);
    }

    /**
     * @notice Unpause execution forwarding
     */
    function unpauseExecution() external onlyOwner {
        paused = false;
        emit ExecutionPaused(false);
    }

    /**
     * @notice Execute a transaction on a user's Proxy.
     * @dev Only whitelisted workers can call this.
     * @param proxy The user's Proxy contract address.
     * @param target The target contract to call (e.g., CTF, USDC).
     * @param data The calldata for the target contract.
     */
    function executeOnProxy(
        address proxy, 
        address target, 
        bytes calldata data
    ) external payable returns (bytes memory) {
        require(isWorker[msg.sender], "Horus: Unauthorized Worker");
        require(!paused, "Horus: Paused");
        require(allowedTargets[target], "Horus: Target not allowed");

        // Forward the execution to the Proxy
        // content: Proxy.execute(target, data)
        bytes memory result = IPolyHunterProxy(proxy).execute(target, data);
        
        emit ExecutionForwarded(proxy, msg.sender, true);
        return result;
    }
}
