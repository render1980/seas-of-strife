import {
    Color,
    getSuitFromCard,
    SUIT_DEFINITIONS,
    SUIT_MAX,
} from "../../../../shared/types/cards";

type SuitColor = Color;

const CARD_BG: Record<SuitColor, string> = {
  orange: "bg-orange-500",
  red: "bg-red-600",
  gray: "bg-slate-500",
  blue: "bg-blue-600",
  green: "bg-green-600",
  purple: "bg-purple-600",
  teal: "bg-teal-500",
  dark_red: "bg-red-900",
};

export function CardTile({
  value,
  onClick,
  active,
  small,
}: {
  value: number;
  onClick?: () => void;
  active?: boolean;
  small?: boolean;
}) {
  const { color, rank, suitSize, number, isSpecial } = cardInfo(value);
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      title={`Card #${number} · Rank ${rank}/${suitSize}${isSpecial ? " · ★" : ""}`}
      className={[
        CARD_BG[color],
        small ? "w-16 h-28 text-sm" : "w-24 h-36 text-lg",
        "rounded-lg flex flex-col items-center justify-center gap-0.5 shrink-0",
        "text-white font-bold shadow border-2 select-none transition-all",
        isSpecial ? "border-yellow-400" : "border-white/20",
        active ? "ring-2 ring-white" : "",
        onClick
          ? "hover:scale-110 hover:shadow-xl cursor-pointer"
          : "cursor-default",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-1 w-full px-1">
        {Array.from({ length: suitSize }).map((_, i) => (
          <div
            key={i}
            className={`h-0.5 rounded-full transition-all ${
              i !== rank ? "bg-white/20" : "bg-white"
            }`}
            style={{ width: `${((i + 1) / suitSize) * 100}%` }}
          />
        ))}
      </div>
      <span className="text-[18px] leading-none opacity-70">{number}</span>
      {isSpecial && (
        <span className="text-yellow-300 text-[18px] leading-none">★</span>
      )}
    </button>
  );
}

function cardInfo(v: number) {
  const color = getSuitFromCard(v);
  const suit = SUIT_DEFINITIONS.find((s) => s.color === color)!;
  return {
    color,
    rank: v - suit.min,
    suitSize: suit.max - suit.min + 1,
    number: v,
    isSpecial: v === SUIT_MAX[color],
  };
}
