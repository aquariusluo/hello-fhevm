// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128, externalEuint128, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract RedactedToken is SepoliaConfig {
    address private _owner;
    mapping(address => euint128) private _balances;
    // Track which addresses have initialized encrypted balances
    mapping(address => bool) private _initialized;
    // 明文余额：支持"先铸明文，后加密"的演示流程
    mapping(address => uint128) private _clearBalances;
    mapping(address => bool) private _members;

    constructor() {
        _owner = msg.sender;
        // Bootstrap: 部署者作为初始成员，可进行首次铸币
        _members[_owner] = true;
    }

    function owner() external view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "not owner");
        _;
    }

    function getBalance(address account) external view returns (euint128) {
        return _balances[account];
    }

    // 读取明文余额
    function getClearBalance(address account) external view returns (uint128) {
        return _clearBalances[account];
    }

    // 铸造明文 RT（未加密）。演示用：成员可自助铸币。
    function mintClear(address to, uint128 amount) external {
        require(_members[msg.sender], "not member");
        require(amount > 0, "amount=0");
        _clearBalances[to] += amount;
        // 收到币的账户成为成员，便于后续流程
        _members[to] = true;
    }

    function mintPrivate(address to, externalEuint128 inputAmount, bytes calldata inputProof) external {
        require(_members[msg.sender], "not member");
        euint128 amt = FHE.fromExternal(inputAmount, inputProof);

        if (!_initialized[to]) {
            _balances[to] = amt;
            _initialized[to] = true;
        } else {
            _balances[to] = FHE.add(_balances[to], amt);
        }

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);
        // 收到币的账户成为成员，使其具备后续铸币资格
        _members[to] = true;
    }

    // 将调用者的明文余额加密并注入其私密余额
    function encryptFromClear(uint128 valueClear, externalEuint128 inputAmount, bytes calldata inputProof) external {
        require(valueClear > 0, "amount=0");
        require(_clearBalances[msg.sender] >= valueClear, "insufficient clear");
        // 消耗明文余额
        _clearBalances[msg.sender] -= valueClear;
        // 使用传入的加密输入增加私密余额
        euint128 amt = FHE.fromExternal(inputAmount, inputProof);

        if (!_initialized[msg.sender]) {
            _balances[msg.sender] = amt;
            _initialized[msg.sender] = true;
        } else {
            _balances[msg.sender] = FHE.add(_balances[msg.sender], amt);
        }

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }

    // Direct encrypt: Deposit ETH and immediately encrypt to eETH in one transaction
    function depositAndEncrypt(externalEuint128 inputAmount, bytes calldata inputProof) external payable {
        require(msg.value > 0, "amount=0");
        require(msg.value <= type(uint128).max, "amount too large");

        // Encrypt the deposited amount directly to private balance
        euint128 amt = FHE.fromExternal(inputAmount, inputProof);

        if (!_initialized[msg.sender]) {
            _balances[msg.sender] = amt;
            _initialized[msg.sender] = true;
        } else {
            _balances[msg.sender] = FHE.add(_balances[msg.sender], amt);
        }

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        _members[msg.sender] = true;
    }

    // 将调用者的私密余额按给定数额解密，归还到其明文余额
    function decryptToClear(uint128 valueClear, externalEuint128 inputAmount, bytes calldata inputProof) external {
        require(valueClear > 0, "amount=0");
        // 使用传入的加密输入从私密余额中扣减同等加密数额
        euint128 amt = FHE.fromExternal(inputAmount, inputProof);
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amt);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        // 增加明文余额
        _clearBalances[msg.sender] += valueClear;
    }

    function transferPrivate(address to, externalEuint128 inputAmount, bytes calldata inputProof) external {
        euint128 amt = FHE.fromExternal(inputAmount, inputProof);

        // Deduct from sender
        // Note: Sender must be initialized, otherwise this will fail
        require(_initialized[msg.sender], "sender not initialized");
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amt);

        // If recipient is not initialized, set their balance to the amount
        // Otherwise, add to their existing balance
        if (!_initialized[to]) {
            _balances[to] = amt;
            _initialized[to] = true;
        } else {
            _balances[to] = FHE.add(_balances[to], amt);
        }

        FHE.allowThis(_balances[msg.sender]);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allow(_balances[to], to);
        // Both parties in the transfer become members for future self-minting
        _members[msg.sender] = true;
        _members[to] = true;
    }

    // Deposit native ETH to receive clear balance (in wei)
    function depositETH() external payable {
        require(msg.value > 0, "amount=0");
        require(msg.value <= type(uint128).max, "amount too large");
        uint128 amount = uint128(msg.value);
        _clearBalances[msg.sender] += amount;
        _members[msg.sender] = true;
    }

    // Withdraw clear balance as native ETH (amount in wei)
    function withdrawETH(uint128 amount) external {
        require(amount > 0, "amount=0");
        require(_clearBalances[msg.sender] >= amount, "insufficient clear balance");
        require(address(this).balance >= amount, "insufficient contract ETH");
        _clearBalances[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // Receive ETH directly
    receive() external payable {
        require(msg.value > 0 && msg.value <= type(uint128).max, "invalid amount");
        uint128 amount = uint128(msg.value);
        _clearBalances[msg.sender] += amount;
        _members[msg.sender] = true;
    }

    // Fallback function
    fallback() external payable {
        require(msg.value > 0 && msg.value <= type(uint128).max, "invalid amount");
        uint128 amount = uint128(msg.value);
        _clearBalances[msg.sender] += amount;
        _members[msg.sender] = true;
    }
}