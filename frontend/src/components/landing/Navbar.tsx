import { Button } from "../ui/button";

const NAV_ITEMS = ["Markets", "Borrow", "Earn"];

interface Props {
  onConnect: () => void;
  loading: boolean;
}

export function Navbar({ onConnect, loading }: Props) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 py-6 px-10">
      <div className="flex flex-row items-center justify-between">
        {/* Logo */}
        <span className="font-display text-6xl tracking-widest text-foreground italic">
          Veil
        </span>

        {/* Center nav items */}
        <div className="hidden md:flex items-center gap-20">
          {NAV_ITEMS.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-foreground/70 text-lg tracking-widest uppercase font-body transition-opacity duration-200 hover:opacity-100"
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA */}
        <Button
          variant="heroSecondary"
          size="default"
          className="px-8 py-3 text-base tracking-widest uppercase"
          onClick={onConnect}
          disabled={loading}
        >
          {loading ? "Connecting\u2026" : "Connect Wallet"}
        </Button>
      </div>

      {/* Ultra-thin divider */}
      <div className="mt-[10px] w-full h-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
    </nav>
  );
}
