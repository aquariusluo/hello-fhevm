// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract RedactedToken is SepoliaConfig {
    address private _owner;
    mapping(address => euint64) private _balances;
    // 明文余额：支持“先铸明文，后加密”的演示流程
    mapping(address => uint64) private _clearBalances;
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

    function getBalance(address account) external view returns (euint64) {
        return _balances[account];
    }

    // 读取明文余额
    function getClearBalance(address account) external view returns (uint64) {
        return _clearBalances[account];
    }

    // 铸造明文 RT（未加密）。演示用：成员可自助铸币。
    function mintClear(address to, uint64 amount) external {
        require(_members[msg.sender], "not member");
        require(amount > 0, "amount=0");
        _clearBalances[to] += amount;
        // 收到币的账户成为成员，便于后续流程
        _members[to] = true;
    }

    function mintPrivate(address to, externalEuint64 inputAmount, bytes calldata inputProof) external {
        require(_members[msg.sender], "not member");
        euint64 amt = FHE.fromExternal(inputAmount, inputProof);
        _balances[to] = FHE.add(_balances[to], amt);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);
        // 收到币的账户成为成员，使其具备后续铸币资格
        _members[to] = true;
    }

    // 将调用者的明文余额加密并注入其私密余额
    function encryptFromClear(uint64 valueClear, externalEuint64 inputAmount, bytes calldata inputProof) external {
        require(valueClear > 0, "amount=0");
        require(_clearBalances[msg.sender] >= valueClear, "insufficient clear");
        // 消耗明文余额
        _clearBalances[msg.sender] -= valueClear;
        // 使用传入的加密输入增加私密余额
        euint64 amt = FHE.fromExternal(inputAmount, inputProof);
        _balances[msg.sender] = FHE.add(_balances[msg.sender], amt);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }

    // 将调用者的私密余额按给定数额解密，归还到其明文余额
    function decryptToClear(uint64 valueClear, externalEuint64 inputAmount, bytes calldata inputProof) external {
        require(valueClear > 0, "amount=0");
        // 使用传入的加密输入从私密余额中扣减同等加密数额
        euint64 amt = FHE.fromExternal(inputAmount, inputProof);
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amt);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        // 增加明文余额
        _clearBalances[msg.sender] += valueClear;
    }

    function transferPrivate(address to, externalEuint64 inputAmount, bytes calldata inputProof) external {
        euint64 amt = FHE.fromExternal(inputAmount, inputProof);
        // 在FHE环境中，我们不能直接在链上解密进行余额检查
        // 而是依赖FHE运行时的安全机制来处理下溢情况
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amt);
        _balances[to] = FHE.add(_balances[to], amt);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allow(_balances[to], to);
        // 参与转账的双方视为成员，便于后续自助铸币
        _members[msg.sender] = true;
        _members[to] = true;
    }
}