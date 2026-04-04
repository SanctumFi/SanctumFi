import { useState, useEffect, useCallback } from "react";
import { Xumm } from "xumm";

const XAMAN_API_KEY = import.meta.env.VITE_XAMAN_API_KEY || "";

let xummInstance: Xumm | null = null;

function getXumm(): Xumm {
  if (!xummInstance) {
    xummInstance = new Xumm(XAMAN_API_KEY);
  }
  return xummInstance;
}

export function useXaman() {
  const [xrplAddress, setXrplAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const xumm = getXumm();

    // Fired when user successfully signs in (or re-signs after logout)
    xumm.on("success", async () => {
      const account = await (xumm as any).user?.account;
      if (account) {
        setXrplAddress(account);
        setConnected(true);
        setLoading(false);
      }
    });

    xumm.on("logout", () => {
      setXrplAddress(null);
      setConnected(false);
    });

    xumm.on("ready", () => {
      console.log("Xaman SDK ready");
    });
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const xumm = getXumm();
      await xumm.authorize();
      // The "success" event handler above will set the address
    } catch (e) {
      console.error("Xaman connect failed:", e);
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const xumm = getXumm();
    await xumm.logout();
    setXrplAddress(null);
    setConnected(false);
  }, []);

  return { xumm: getXumm(), xrplAddress, connected, loading, connect, disconnect };
}
