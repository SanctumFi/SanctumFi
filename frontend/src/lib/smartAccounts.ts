/**
 * Flare Smart Accounts — Custom Instruction helpers.
 *
 * Based on the reference implementation from:
 *   https://github.com/flare-foundation/flare-smart-accounts-viem
 *
 * Adapted for browser use with Xaman (no server-side XRPL wallet).
 */

import {
  type Address,
  createWalletClient,
  http,
  encodeFunctionData,
  fromHex,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { coston2 as coston2Abis } from "@flarenetwork/flare-wagmi-periphery-package";
import { publicClient, flareTestnet } from "./flareClient";
import { creditVaultAbi } from "../config/contracts";

// ── Flare Contract Registry ─────────────────────────────────────────────────

const FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019" as Address;

async function getMasterAccountControllerAddress(): Promise<Address> {
  return publicClient.readContract({
    address: FLARE_CONTRACT_REGISTRY,
    abi: coston2Abis.iFlareContractRegistryAbi,
    functionName: "getContractAddressByName",
    args: ["MasterAccountController"],
  }) as Promise<Address>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type CustomInstruction = {
  targetContract: Address;
  value: bigint;
  data: `0x${string}`;
};

// ── Read helpers ─────────────────────────────────────────────────────────────

export async function getOperatorXrplAddresses(): Promise<string[]> {
  const mac = await getMasterAccountControllerAddress();
  return publicClient.readContract({
    address: mac,
    abi: coston2Abis.iMasterAccountControllerAbi,
    functionName: "getXrplProviderWallets",
    args: [],
  }) as Promise<string[]>;
}

export async function getPersonalAccountAddress(xrplAddress: string): Promise<Address> {
  const mac = await getMasterAccountControllerAddress();
  return publicClient.readContract({
    address: mac,
    abi: coston2Abis.iMasterAccountControllerAbi,
    functionName: "getPersonalAccount",
    args: [xrplAddress],
  }) as Promise<Address>;
}

export async function getInstructionFee(encodedInstruction: `0x${string}`): Promise<bigint> {
  const mac = await getMasterAccountControllerAddress();
  const instructionId = encodedInstruction.slice(0, 4);
  const instructionIdDecimal = fromHex(instructionId as `0x${string}`, "bigint");
  return publicClient.readContract({
    address: mac,
    abi: coston2Abis.iMasterAccountControllerAbi,
    functionName: "getInstructionFee",
    args: [instructionIdDecimal],
  }) as Promise<bigint>;
}

// ── Custom instruction hash ──────────────────────────────────────────────────

async function getCustomInstructionHash(instructions: CustomInstruction[]): Promise<`0x${string}`> {
  const mac = await getMasterAccountControllerAddress();
  return publicClient.readContract({
    address: mac,
    abi: coston2Abis.iCustomInstructionsFacetAbi,
    functionName: "encodeCustomInstruction",
    args: [instructions],
  }) as Promise<`0x${string}`>;
}

async function getCustomInstruction(hash: `0x${string}`): Promise<CustomInstruction[]> {
  const mac = await getMasterAccountControllerAddress();
  return publicClient.readContract({
    address: mac,
    abi: coston2Abis.iCustomInstructionsFacetAbi,
    functionName: "getCustomInstruction",
    args: [hash],
  }) as Promise<CustomInstruction[]>;
}

export async function isCustomInstructionRegistered(instructions: CustomInstruction[]): Promise<{
  hash: `0x${string}`;
  registered: boolean;
}> {
  const hash = await getCustomInstructionHash(instructions);
  const existing = await getCustomInstruction(hash);
  return { hash, registered: existing.length > 0 };
}

// ── Register (requires a funded Flare wallet — server-side or deployer key) ──

/**
 * Register a custom instruction on MasterAccountController.
 * This is a write transaction on Flare, so it needs a funded wallet.
 * In the hackathon demo, the deployer key signs this.
 */
export async function registerCustomInstruction(
  instructions: CustomInstruction[],
  privateKey: `0x${string}`,
): Promise<`0x${string}`> {
  const mac = await getMasterAccountControllerAddress();
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    chain: flareTestnet,
    transport: http(),
    account,
  });

  const { request } = await publicClient.simulateContract({
    account,
    address: mac,
    abi: coston2Abis.iCustomInstructionsFacetAbi,
    functionName: "registerCustomInstruction",
    args: [instructions],
  });

  return walletClient.writeContract(request);
}

// ── Encode for XRPL memo ────────────────────────────────────────────────────

/**
 * Encode a custom instruction into the 32-byte format for XRPL MemoData.
 * Format: 0xff + walletId(1 byte) + callHash(30 bytes)
 */
export async function encodeCustomInstruction(
  instructions: CustomInstruction[],
  walletId: number = 0,
): Promise<`0x${string}`> {
  const hash = await getCustomInstructionHash(instructions);
  // Cut off 0x prefix and first 2 bytes (4 hex chars), replace with 0xff + walletId
  return ("0xff" + toHex(walletId, { size: 1 }).slice(2) + hash.slice(6)) as `0x${string}`;
}

// ── Build instruction arrays for CreditVault actions ─────────────────────────

const CREDIT_VAULT = (import.meta.env.VITE_CREDIT_VAULT_ADDRESS || "0x") as Address;
const INSTRUCTION_SENDER = (import.meta.env.VITE_INSTRUCTION_SENDER_ADDRESS || "0x") as Address;

/** Build a deposit FLR instruction. */
export function buildDepositInstruction(amountWei: bigint): CustomInstruction[] {
  return [{
    targetContract: CREDIT_VAULT,
    value: amountWei,
    data: encodeFunctionData({
      abi: creditVaultAbi,
      functionName: "depositFLR",
      args: [],
    }),
  }];
}

/** Build a borrow instruction. */
export function buildBorrowInstruction(asset: Address, amountWei: bigint): CustomInstruction[] {
  return [{
    targetContract: CREDIT_VAULT,
    value: 0n,
    data: encodeFunctionData({
      abi: creditVaultAbi,
      functionName: "borrow",
      args: [asset, amountWei],
    }),
  }];
}

/** Build a withdraw FLR collateral instruction. */
export function buildWithdrawInstruction(amountWei: bigint): CustomInstruction[] {
  return [{
    targetContract: CREDIT_VAULT,
    value: 0n,
    data: encodeFunctionData({
      abi: creditVaultAbi,
      functionName: "withdrawCollateral",
      args: ["0x0000000000000000000000000000000000000000" as Address, amountWei],
    }),
  }];
}

/** Build a repay FLR instruction. */
export function buildRepayInstruction(amountWei: bigint): CustomInstruction[] {
  return [{
    targetContract: CREDIT_VAULT,
    value: amountWei,
    data: encodeFunctionData({
      abi: creditVaultAbi,
      functionName: "repay",
      args: ["0x0000000000000000000000000000000000000000" as Address, 0n],
    }),
  }];
}

// ── Watch for execution event ────────────────────────────────────────────────

export async function watchForExecution(
  encodedInstruction: `0x${string}`,
  personalAccountAddress: Address,
  onExecuted: () => void,
  timeoutMs: number = 300_000,
) {
  const mac = await getMasterAccountControllerAddress();
  let found = false;

  const unwatch = publicClient.watchContractEvent({
    address: mac,
    abi: coston2Abis.iInstructionsFacetAbi,
    eventName: "CustomInstructionExecuted",
    onLogs: (logs) => {
      for (const log of logs) {
        const args = (log as any).args;
        if (
          args?.callHash?.slice(6) === encodedInstruction.slice(6) &&
          args?.personalAccount?.toLowerCase() === personalAccountAddress.toLowerCase()
        ) {
          found = true;
          onExecuted();
          break;
        }
      }
    },
  });

  // Auto-cleanup after timeout
  setTimeout(() => {
    if (!found) unwatch();
  }, timeoutMs);

  return unwatch;
}
