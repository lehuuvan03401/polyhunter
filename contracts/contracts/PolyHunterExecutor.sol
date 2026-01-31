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

    event WorkerAdded(address indexed worker);
    event WorkerRemoved(address indexed worker);
    event ExecutionForwarded(address indexed proxy, address indexed worker, bool success);

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

        // Forward the execution to the Proxy
        // content: Proxy.execute(target, data)
        bytes memory result = IPolyHunterProxy(proxy).execute(target, data);
        
        emit ExecutionForwarded(proxy, msg.sender, true);
        return result;
    }
}
