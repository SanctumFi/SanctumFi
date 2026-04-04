import { ethers } from "ethers";

const OP_TYPE_CREDIT = ethers.encodeBytes32String("CREDIT");
const OP_COMMAND_SCORE = ethers.encodeBytes32String("SCORE");

export function register(f: any): void {
  f.handle(OP_TYPE_CREDIT, OP_COMMAND_SCORE, async (msg: string) => {
    const { handleCreditScore } = await import("./handlers/creditScore");
    const result = await handleCreditScore(msg);
    return { data: result.data, status: result.status, err: result.err };
  });
}
