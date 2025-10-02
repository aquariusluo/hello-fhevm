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

    // Try to initialize fhEVM API with retry, but don't fail if it can't connect
    let fhevmAvailable = false;
    let retries = 2;
    while (retries > 0 && !fhevmAvailable) {
      try {
        await fhevm.initializeCLIApi();
        fhevmAvailable = true;
      } catch (error: any) {
        retries--;
        if (retries > 0) {
          console.log(`fhEVM API connection failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log(`Warning: fhEVM API unavailable (${error.message}), decryption will be skipped`);
        }
      }
    }

    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const signerIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(signerIndex) || signerIndex < 0 || signerIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const signerForDecrypt = signers[signerIndex];
    const who = (args.address as string) || signerForDecrypt.address;

    // Get wallet's native ETH balance
    const walletBalance = await ethers.provider.getBalance(who);

    // Get RedactedToken clear balance and encrypted balance
    const encBal = await contract.getBalance(who);
    const clearOnChain = await contract.getClearBalance(who);

    // Decrypt encrypted balance (only if fhEVM API is available)
    let decryptedBalance: bigint = 0n;
    const isZeroEncrypted = encBal === '0x0000000000000000000000000000000000000000000000000000000000000000';

    if (!isZeroEncrypted && fhevmAvailable) {
      try {
        decryptedBalance = await fhevm.userDecryptEuint(
          FhevmType.euint128,
          encBal,
          rtAddr,
          signerForDecrypt
        );
      } catch (_error) {
        console.log(`Decryption failed (no permission or network error)`);
        decryptedBalance = 0n;
      }
    }

    // Always use uppercase labels for backend parsing
    console.log(`Wallet ETH balance: ${walletBalance}`);
    console.log(`Encrypted balance: ${encBal}`);
    console.log(`Decrypted balance: ${decryptedBalance}`);
    console.log(`Clear balance    : ${clearOnChain}`);
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
      .add128(value)
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
    const value = BigInt(args.value as string);
    if (value <= 0n) throw new Error("--value must be positive");

    // Retry fhEVM initialization
    let retries = 2;
    let fhevmReady = false;
    while (retries > 0 && !fhevmReady) {
      try {
        await fhevm.initializeCLIApi();
        fhevmReady = true;
      } catch (error: any) {
        retries--;
        if (retries > 0) {
          console.log(`fhEVM API connection failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error(`fhEVM API unavailable: ${error.message}`);
        }
      }
    }

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
      .add128(value)
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
    const value = BigInt(args.value as string);
    if (value <= 0n) throw new Error("--value must be positive");

    // Retry fhEVM initialization
    let retries = 2;
    let fhevmReady = false;
    while (retries > 0 && !fhevmReady) {
      try {
        await fhevm.initializeCLIApi();
        fhevmReady = true;
      } catch (error: any) {
        retries--;
        if (retries > 0) {
          console.log(`fhEVM API connection failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error(`fhEVM API unavailable: ${error.message}`);
        }
      }
    }

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
      .add128(value)
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
    const value = BigInt(args.value as string);
    if (value <= 0n) throw new Error("--value must be positive");

    // Retry fhEVM initialization
    let retries = 2;
    let fhevmReady = false;
    while (retries > 0 && !fhevmReady) {
      try {
        await fhevm.initializeCLIApi();
        fhevmReady = true;
      } catch (error: any) {
        retries--;
        if (retries > 0) {
          console.log(`fhEVM API connection failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error(`fhEVM API unavailable: ${error.message}`);
        }
      }
    }

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
      .add128(value)
      .encrypt();

    const tx = await contract.connect(sender).decryptToClear(value, enc.handles[0], enc.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

// Deposit native ETH to get clear balance
task("redact:deposit-eth", "Deposits native ETH to receive clear balance")
  .addParam("value", "Amount of ETH to deposit (in ETH, e.g. 0.1)")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used to send tx (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const valueEth = parseFloat(args.value as string);
    if (isNaN(valueEth) || valueEth <= 0) throw new Error("--value must be a positive number");
    const valueWei = ethers.parseEther(valueEth.toString());

    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const senderIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(senderIndex) || senderIndex < 0 || senderIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const sender = signers[senderIndex];

    const tx = await contract.connect(sender).depositETH({ value: valueWei });
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Deposited ${valueEth} ETH (${valueWei} wei)`);
  });

// Direct encrypt: Deposit ETH and immediately encrypt to eETH
task("redact:deposit-and-encrypt", "Deposits ETH and immediately encrypts to eETH")
  .addParam("value", "Amount of ETH to deposit and encrypt (in ETH, e.g. 0.1)")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used to send tx (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    const valueEth = parseFloat(args.value as string);
    if (isNaN(valueEth) || valueEth <= 0) throw new Error("--value must be a positive number");
    const valueWei = ethers.parseEther(valueEth.toString());

    // Check uint128 limit (2^128 - 1 = 340282366920938463463374607431768211455 wei ≈ 340 undecillion ETH)
    // This is effectively unlimited for practical ETH amounts, but we still validate for safety
    const UINT128_MAX = BigInt("340282366920938463463374607431768211455");
    if (valueWei > UINT128_MAX) {
      throw new Error(`Amount exceeds uint128 maximum. Maximum is ~340 undecillion ETH, you entered ${valueEth} ETH`);
    }

    // Retry fhEVM initialization
    let retries = 2;
    let fhevmReady = false;
    while (retries > 0 && !fhevmReady) {
      try {
        await fhevm.initializeCLIApi();
        fhevmReady = true;
      } catch (error: any) {
        retries--;
        if (retries > 0) {
          console.log(`fhEVM API connection failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error(`fhEVM API unavailable: ${error.message}`);
        }
      }
    }

    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const senderIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(senderIndex) || senderIndex < 0 || senderIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const sender = signers[senderIndex];

    // Create encrypted input with the ETH amount
    // Use valueWei directly as bigint - fhevm will handle conversion
    const enc = await fhevm
      .createEncryptedInput(rtAddr, sender.address)
      .add128(valueWei)
      .encrypt();

    const tx = await contract.connect(sender).depositAndEncrypt(enc.handles[0], enc.inputProof, { value: valueWei });
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Deposited and encrypted ${valueEth} ETH (${valueWei} wei)`);
  });


// Withdraw clear balance as native ETH
task("redact:withdraw-eth", "Withdraws clear balance as native ETH")
  .addParam("value", "Amount of ETH to withdraw (in ETH, e.g. 0.1)")
  .addOptionalParam("contract", "Optionally specify the RedactedToken contract address")
  .addOptionalParam("fromindex", "Signer index used to send tx (default 0)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const valueEth = parseFloat(args.value as string);
    if (isNaN(valueEth) || valueEth <= 0) throw new Error("--value must be a positive number");
    const valueWei = ethers.parseEther(valueEth.toString());

    const rtAddr = (args.contract as string) || (await deployments.get("RedactedToken")).address;
    const contract = await ethers.getContractAt("RedactedToken", rtAddr);
    const signers = await ethers.getSigners();
    const senderIndex = args.fromindex ? parseInt(args.fromindex as string) : 0;
    if (!Number.isInteger(senderIndex) || senderIndex < 0 || senderIndex >= signers.length) {
      throw new Error("--fromindex is out of range");
    }
    const sender = signers[senderIndex];

    const tx = await contract.connect(sender).withdrawETH(valueWei);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Withdrawn ${valueEth} ETH (${valueWei} wei)`);
  });
