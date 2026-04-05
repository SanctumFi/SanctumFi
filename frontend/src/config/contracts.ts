import { type Abi } from "viem";

export const CONTRACTS = {
  creditVault: (import.meta.env.VITE_CREDIT_VAULT_ADDRESS || "0x") as `0x${string}`,
  smartAccountReceiver: (import.meta.env.VITE_SMART_ACCOUNT_RECEIVER_ADDRESS || "0x") as `0x${string}`,
  masterAccountController: "0x434936d47503353f06750Db1A444DBDC5F0AD37c" as `0x${string}`,
  ftsoV2: "0x3d893C53D9e8056135C26C8c638B76C8b60Df726" as `0x${string}`,
  fxrp: (import.meta.env.VITE_FXRP_ADDRESS || "0x") as `0x${string}`,
};

export const creditVaultAbi = [
  { type: "function", name: "positions", inputs: [{ name: "user", type: "address" }], outputs: [
    { name: "creditScore", type: "uint256" }, { name: "scoreTimestamp", type: "uint256" },
    { name: "flrCollateral", type: "uint256" }, { name: "fxrpCollateral", type: "uint256" },
    { name: "flrDebt", type: "uint256" }, { name: "fxrpDebt", type: "uint256" },
    { name: "flrBorrowTimestamp", type: "uint256" }, { name: "fxrpBorrowTimestamp", type: "uint256" },
  ], stateMutability: "view" },
  { type: "function", name: "getDebt", inputs: [{ name: "user", type: "address" }], outputs: [
    { name: "flrDebt", type: "uint256" }, { name: "fxrpDebt", type: "uint256" },
  ], stateMutability: "view" },
  { type: "function", name: "getHealthFactor", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getMaxBorrow", inputs: [{ name: "user", type: "address" }, { name: "asset", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getLtvBps", inputs: [{ name: "score", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "pure" },
  { type: "function", name: "depositFLR", inputs: [], outputs: [], stateMutability: "payable" },
  { type: "function", name: "depositFXRP", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "borrow", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "repay", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "withdrawCollateral", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const satisfies Abi;

export const masterAccountControllerAbi = [
  { type: "function", name: "getPersonalAccount", inputs: [{ name: "xrplAddress", type: "string" }], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "getXrplProviderWallets", inputs: [], outputs: [{ type: "string[]" }], stateMutability: "view" },
] as const satisfies Abi;

export const ftsoV2Abi = [
  { type: "function", name: "getFeedById", inputs: [{ name: "_feedId", type: "bytes21" }], outputs: [
    { type: "uint256" }, { type: "int8" }, { type: "uint64" },
  ], stateMutability: "payable" },
  { type: "function", name: "getFeedsById", inputs: [{ name: "_feedIds", type: "bytes21[]" }], outputs: [
    { type: "uint256[]" }, { type: "int8[]" }, { type: "uint64" },
  ], stateMutability: "payable" },
] as const satisfies Abi;

export const FLR_USD_FEED_ID = "0x01464c522f55534400000000000000000000000000" as `0x${string}`;
export const XRP_USD_FEED_ID = "0x015852502f55534400000000000000000000000000" as `0x${string}`;
