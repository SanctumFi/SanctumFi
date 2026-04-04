export const CONTRACTS = {
  creditVault: import.meta.env.VITE_CREDIT_VAULT_ADDRESS || "",
  instructionSender: import.meta.env.VITE_INSTRUCTION_SENDER_ADDRESS || "",
  smartAccountReceiver: import.meta.env.VITE_SMART_ACCOUNT_RECEIVER_ADDRESS || "",
  ftsoV2: "0x3d893C53D9e8056135C26C8c638B76C8b60Df726",
  fxrp: import.meta.env.VITE_FXRP_ADDRESS || "",
};

export const CREDIT_VAULT_ABI = [
  "function positions(address) view returns (uint256 creditScore, uint256 scoreTimestamp, uint256 flrCollateral, uint256 fxrpCollateral, uint256 flrDebt, uint256 fxrpDebt, uint256 flrBorrowTimestamp, uint256 fxrpBorrowTimestamp)",
  "function depositFLR() payable",
  "function depositFXRP(uint256 amount)",
  "function borrow(address asset, uint256 amount)",
  "function repay(address asset, uint256 amount) payable",
  "function withdrawCollateral(address asset, uint256 amount)",
  "function liquidate(address user)",
  "function getDebt(address user) view returns (uint256 flrDebt, uint256 fxrpDebt)",
  "function getHealthFactor(address user) view returns (uint256)",
  "function getMaxBorrow(address user, address asset) view returns (uint256)",
  "function getLtvBps(uint256 score) pure returns (uint256)",
  "event ScoreReceived(address indexed user, uint256 score, uint256 timestamp)",
  "event CollateralDeposited(address indexed user, address asset, uint256 amount)",
  "event Borrowed(address indexed user, address asset, uint256 amount)",
  "event Repaid(address indexed user, address asset, uint256 amount)",
  "event Liquidated(address indexed user, address liquidator, uint256 collateralSeized)",
];

export const INSTRUCTION_SENDER_ABI = [
  "function requestCreditScore(bytes encryptedPlaidPayload) payable",
];

export const FTSOV2_ABI = [
  "function getFeedById(bytes21 _feedId) payable returns (uint256 _value, int8 _decimals, uint64 _timestamp)",
  "function getFeedsById(bytes21[] _feedIds) payable returns (uint256[] _values, int8[] _decimals, uint64 _timestamp)",
];

export const FLR_USD_FEED_ID = "0x01464c522f55534400000000000000000000000000";
export const XRP_USD_FEED_ID = "0x015852502f55534400000000000000000000000000";
