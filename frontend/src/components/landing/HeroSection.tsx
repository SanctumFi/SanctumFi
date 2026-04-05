import { useState, useEffect } from "react";
import Veil from "./Veil";

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
      {/* Veil WebGL background */}
      <div
        className="absolute inset-0"
        style={{ filter: "grayscale(1) brightness(1.12) contrast(0.72)" }}
      >
        <Veil
          color={[1, 1, 1]}
          mouseReact={false}
          amplitude={0}
          speed={0.5}
        />
      </div>

      {/* Centered content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-4"
        style={{ filter: `blur(${blurAmount}px)` }}
      >
        <h1
          className="fade-in-up text-[clamp(48px,6vw,96px)] font-display font-normal leading-[0.9] tracking-[-0.02em] text-hero-heading mix-blend-multiply text-center"
        >
          The Worthy Shall Borrow More
        </h1>

        <p
          className="fade-in-up text-hero-sub text-center font-body text-xl leading-relaxed max-w-xl mt-10 opacity-80 tracking-wide"
          style={{ animationDelay: "0.15s" }}
        >
          Your history enters the sanctum.
          <br />
          Your collateral emerges lighter.
        </p>
      </div>
    </section>
  );
}
