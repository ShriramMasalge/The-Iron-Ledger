import { Contract } from "ethers";

export const CONTRACT_ADDRESS = "0xa8a37959d63C2A51e3eeF254a694cFDa7A67f1Aa";

export const CONTRACT_ABI = [
  "function createTrade(address payable _seller, uint256 _amount, uint64 _deadline, uint8 _slashingPenaltyBps) returns (bytes32)",
  "function fundTrade(bytes32 _tradeId) payable",
  "function updateStatusInTransit(bytes32 _tradeId)",
  "function updateStatusDelivered(bytes32 _tradeId)",
  "function completeTrade(bytes32 _tradeId)",
  "function slashSellerAndComplete(bytes32 _tradeId)",
  "function cancelTrade(bytes32 _tradeId)",
  "function getTrade(bytes32 _tradeId) view returns (address buyer, address seller, uint256 amount, uint64 deadline, uint64 createdAt, uint8 state, uint8 slashingPenaltyBps, bool sellerSlashed)",
  "function getTradeState(bytes32 _tradeId) view returns (uint8)",
  "function getTradeCount() view returns (uint256)",
  "function getTradeIdAtIndex(uint256 _index) view returns (bytes32)",
  "event TradeCreated(bytes32 indexed tradeId, address indexed buyer, address indexed seller, uint256 amount, uint64 deadline)",
  "event TradeFunded(bytes32 indexed tradeId)",
  "event TradeInTransit(bytes32 indexed tradeId)",
  "event TradeDelivered(bytes32 indexed tradeId)",
  "event TradeCompleted(bytes32 indexed tradeId, uint256 finalPayoutToSeller, uint256 penaltyToBuyer)",
  "event TradeCancelled(bytes32 indexed tradeId)",
  "event SellerSlashed(bytes32 indexed tradeId, uint256 penaltyAmount)",
];

export const getContract = (provider: any) => {
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
};