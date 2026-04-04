import { useState } from "react";
import { ethers } from "ethers";
import { coston2 } from "../config/chains";

interface Props {
  onConnect: (provider: ethers.BrowserProvider, address: string) => void;
}

export function WalletConnect({ onConnect }: Props) {
  const [address, setAddress] = useState<string | null>(null);

  async function connect() {
    if (!window.ethereum) { alert("Please install MetaMask"); return; }
    const provider = new ethers.BrowserProvider(window.ethereum);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: coston2.chainIdHex }] });
    } catch (err: any) {
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: coston2.chainIdHex, chainName: coston2.name, rpcUrls: [coston2.rpcUrl], blockExplorerUrls: [coston2.blockExplorer], nativeCurrency: coston2.nativeCurrency }],
        });
      } else {
        throw err;
      }
    }
    const accounts = await provider.send("eth_requestAccounts", []);
    setAddress(accounts[0]);
    onConnect(provider, accounts[0]);
    window.ethereum.on("accountsChanged", (accounts: string[]) => {
      if (accounts.length > 0) {
        const newProvider = new ethers.BrowserProvider(window.ethereum);
        setAddress(accounts[0]);
        onConnect(newProvider, accounts[0]);
      }
    });
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  return (
    <button onClick={connect} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg">
      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect Wallet"}
    </button>
  );
}
