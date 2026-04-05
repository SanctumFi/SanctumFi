import Veil from "./Veil";

interface Props {
  onConnect: () => void;
  loading: boolean;
}

export function HeroSection({ onConnect, loading }: Props) {
  return (
    <section style={{
      position: "sticky",
      top: 0,
      height: "100vh",
      overflow: "hidden",
      zIndex: 0,
    }}>
      {/* Veil WebGL background — never moves, sections slide over it */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: "grayscale(1) brightness(1.12) contrast(0.72)",
        }}
      >
        <Veil
          color={[1, 1, 1]}
          mouseReact={false}
          amplitude={0}
          speed={0.5}
        />
      </div>

      {/* Centered content */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 1rem",
      }}>
        <h1
          className="fade-in-up text-[clamp(48px,6vw,96px)] font-display font-normal leading-[0.9] tracking-[-0.02em] text-hero-heading mix-blend-multiply text-center"
        >
          The Worthy Shall Borrow More
        </h1>

        <p
          className="fade-in-up text-hero-sub text-center font-display italic opacity-55"
          style={{
            animationDelay: "0.15s",
            fontSize: "clamp(16px, 1.6vw, 22px)",
            letterSpacing: "0.02em",
            marginTop: "3rem",
          }}
        >
          Your history enters the sanctum — your collateral emerges lighter.
        </p>
      </div>
    </section>
  );
}
