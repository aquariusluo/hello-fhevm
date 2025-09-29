import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("redact:address", "Prints the RedactedToken address").setAction(async (_, hre) => {
  const { deployments } = hre;
  const rt = await deployments.get("RedactedToken");
  console.log("RedactedToken address is " + rt.address);
});

task("redact:get-balance", "Reads encrypted balance and clear balance")
  .addOptionalParam("address", "Optionally specify the account address")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used for decryption (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();
    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const signerIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(signerIndex) || signerIndex < 0 || signerIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const signerForDecrypt = signers[signerIndex];
    const who = (args.address as string) || signerForDecrypt.address;
    // 读取加密余额（hex）与明文余额（uint64）
    const encBal = await contract.getBalance(who);
    const clearOnChain = await contract.getClearBalance(who);

    // 解密加密余额
    let decryptedBalance = 0;
    try {
      // 使用正确的FHEVM解密API
      const result = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encBal,
        rtAddr,
        signerForDecrypt
      );
      decryptedBalance = Number(result);
    } catch (error) {
      console.log(`Decryption failed (no permission or zero balance): ${error}`);
      decryptedBalance = 0;
    }

    // 始终统一为大写标签，便于后端解析
    console.log(`Encrypted balance: ${encBal}`);
    console.log(`Clear balance    : ${decryptedBalance}`);
  });

task("redact:mint", "Mints private balance to an address")
  .addParam("to", "Recipient address")
  .addParam("value", "Amount to mint")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used to send tx (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    const value = parseInt(args.value as string);
    if (!Number.isInteger(value)) throw new Error("--value must be integer");
    await fhevm.initializeCLIApi();
    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const senderIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(senderIndex) || senderIndex < 0 || senderIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const sender = signers[senderIndex];

    const enc = await fhevm
      .createEncryptedInput(rtAddr, args.to as string)
      .add64(value)
      .encrypt();

    const tx = await contract.connect(sender).mintPrivate(args.to as string, enc.handles[0], enc.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("redact:transfer", "Transfers private balance")
  .addParam("to", "Recipient address")
  .addParam("value", "Amount to transfer")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used to send tx (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    const value = parseInt(args.value as string);
    if (!Number.isInteger(value)) throw new Error("--value must be integer");
    await fhevm.initializeCLIApi();
    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const senderIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(senderIndex) || senderIndex < 0 || senderIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const sender = signers[senderIndex];

    const enc = await fhevm
      .createEncryptedInput(rtAddr, sender.address)
      .add64(value)
      .encrypt();

    const tx = await contract.connect(sender).transferPrivate(args.to as string, enc.handles[0], enc.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    const newEncBal = await contract.getBalance(sender.address);
    console.log("Encrypted balance after transfer:", newEncBal);
  });

// 明文铸币：将未加密的 RT 增加到接收者的明文余额
task("redact:mint-clear", "Mints clear (unencrypted) balance to an address")
  .addParam("to", "Recipient address")
  .addParam("value", "Amount to mint")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used to send tx (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const value = parseInt(args.value as string);
    if (!Number.isInteger(value)) throw new Error("--value must be integer");
    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const senderIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(senderIndex) || senderIndex < 0 || senderIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const sender = signers[senderIndex];

    const tx = await contract.connect(sender).mintClear(args.to as string, value);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

// 从明文余额加密并注入到调用者的私密余额
task("redact:encrypt-from-clear", "Encrypts clear balance into private balance for caller")
  .addParam("value", "Amount to encrypt from clear balance")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used to send tx (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    const value = parseInt(args.value as string);
    if (!Number.isInteger(value)) throw new Error("--value must be integer");
    await fhevm.initializeCLIApi();
    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const senderIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(senderIndex) || senderIndex < 0 || senderIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const sender = signers[senderIndex];

    const enc = await fhevm
      .createEncryptedInput(rtAddr, sender.address)
      .add64(value)
      .encrypt();

    const tx = await contract.connect(sender).encryptFromClear(value, enc.handles[0], enc.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

// 从私密余额解密为明文余额（调用者自身）
task("redact:decrypt-to-clear", "Decrypts private balance into clear balance for caller")
  .addParam("value", "Amount to decrypt from private balance")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used to send tx (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    const value = parseInt(args.value as string);
    if (!Number.isInteger(value)) throw new Error("--value must be integer");
    await fhevm.initializeCLIApi();
    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const senderIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(senderIndex) || senderIndex < 0 || senderIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const sender = signers[senderIndex];

    const enc = await fhevm
      .createEncryptedInput(rtAddr, sender.address)
      .add64(value)
      .encrypt();

    const tx = await contract.connect(sender).decryptToClear(value, enc.handles[0], enc.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });