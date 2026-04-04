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
    xumm.environment.ready.then(() => {
      if (xumm.runtime?.xapp) {
        xumm.environment.ott?.then((ott: { account?: string } | undefined) => {
          if (ott?.account) {
            setXrplAddress(ott.account);
            setConnected(true);
          }
        });
      }
    });
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const xumm = getXumm();
      await xumm.authorize();
      const account = xumm.runtime?.jwt?.sub || null;
      if (account) {
        setXrplAddress(account);
        setConnected(true);
      }
    } catch (e) {
      console.error("Xaman connect failed:", e);
    } finally {
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
