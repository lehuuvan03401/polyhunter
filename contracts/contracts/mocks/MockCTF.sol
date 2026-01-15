// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockCTF {
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external {
        // Just emit events, we don't care about balances for simulation
        emit TransferSingle(msg.sender, from, to, id, amount);
    }

    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external {
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }

    function setApprovalForAll(address operator, bool approved) external {}
    function isApprovedForAll(address account, address operator) external view returns (bool) { return true; }
}
