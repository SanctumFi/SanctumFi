import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACTS, INSTRUCTION_SENDER_ABI } from "../config/contracts";

export function useCreditScore(provider: ethers.BrowserProvider | null) {
  const [requesting, setRequesting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function requestScore(encryptedPayload: Uint8Array) {
    if (!provider) throw new Error("No provider");
    setRequesting(true);
    try {
      const signer = await provider.getSigner();
      const sender = new ethers.Contract(CONTRACTS.instructionSender, INSTRUCTION_SENDER_ABI, signer);
      const tx = await sender.requestCreditScore(encryptedPayload, { value: ethers.parseEther("0.01") });
      setTxHash(tx.hash);
      await tx.wait();
    } finally {
      setRequesting(false);
    }
  }

  return { requestScore, requesting, txHash };
}
