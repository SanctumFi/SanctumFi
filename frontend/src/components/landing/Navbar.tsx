import { Button } from "../ui/button";

const NAV_ITEMS = ["Markets", "Borrow", "Earn", "Institutions"];

interface Props {
  onConnect: () => void;
  loading: boolean;
}

export function Navbar({ onConnect, loading }: Props) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 py-5 px-8">
      <div className="flex flex-row items-center justify-between">
        {/* Logo */}
        <span className="font-display text-xl tracking-widest text-foreground">
          SANCTUM
        </span>

        {/* Center nav items */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-foreground/70 text-sm tracking-wide font-body transition-opacity duration-200 hover:opacity-100"
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA */}
        <Button
          variant="heroSecondary"
          size="sm"
          className="px-6 py-2"
          onClick={onConnect}
          disabled={loading}
        >
          {loading ? "Connecting\u2026" : "Launch App"}
        </Button>
      </div>

      {/* Ultra-thin divider */}
      <div className="mt-[10px] w-full h-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
    </nav>
  );
}
