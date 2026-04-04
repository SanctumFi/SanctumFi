import { formatEther } from "viem";

interface Props { value: bigint; }

export function HealthBar({ value }: Props) {
  const hf = Number(formatEther(value));
  const isMax = hf > 100;
  const display = isMax ? "\u221e" : hf.toFixed(2);
  let color = "bg-green-500";
  if (hf < 1.0) color = "bg-red-500";
  else if (hf < 1.5) color = "bg-yellow-500";
  const width = isMax ? 100 : Math.min(100, (hf / 3) * 100);

  return (
    <div>
      <p className={`text-2xl font-bold ${hf < 1 ? "text-red-400" : "text-green-400"}`}>{display}</p>
      <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
