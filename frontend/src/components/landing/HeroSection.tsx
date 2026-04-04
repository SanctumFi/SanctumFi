import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Navbar } from "./Navbar";

interface Props {
  onConnect: () => void;
  loading: boolean;
}

export function HeroSection({ onConnect, loading }: Props) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const blurAmount = Math.min(scrollY / 50, 10);

  return (
    <section className="bg-background relative overflow-hidden min-h-screen">
      <Navbar onConnect={onConnect} loading={loading} />

      {/* Centered content with scroll blur */}
      <div
        className="pt-40 px-4 flex flex-col items-center"
        style={{ filter: `blur(${blurAmount}px)` }}
      >
        {/* Headline */}
        <h1
          className="fade-in-up text-[clamp(80px,15vw,180px)] font-display font-normal leading-[0.9] tracking-[-0.02em] text-hero-heading mix-blend-multiply"
        >
          Liquidity
        </h1>

        {/* Subtext */}
        <p
          className="fade-in-up text-hero-sub text-center font-body text-lg leading-relaxed max-w-lg mt-8 opacity-80"
          style={{ animationDelay: "0.15s" }}
        >
          Cryptographic protection meets
          <br />
          institutional-grade marble.
        </p>

        {/* CTA */}
        <div
          className="fade-in-up mt-12 mb-[66px]"
          style={{ animationDelay: "0.3s" }}
        >
          <Button
            variant="hero"
            className="px-[32px] py-[20px]"
            onClick={onConnect}
            disabled={loading}
          >
            {loading ? "Connecting\u2026" : "Check Credit Score"}
          </Button>
        </div>
      </div>
    </section>
  );
}
