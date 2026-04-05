import type { Color, PlayedCard } from "../../../server/src/types/types";
import {
  SUIT_DEFINITIONS,
  SUIT_MAX,
  getSuitFromCard,
} from "../../../shared/types/cards";
import type {
  RoundWinner,
  SanitizedGameState,
  SanitizedPlayer,
} from "../../../shared/types/messages";

// ---------------------------------------------------------------------------
// Suit helpers
// ---------------------------------------------------------------------------

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

function cardInfo(v: number) {
  const color = getSuitFromCard(v);
  const suit = SUIT_DEFINITIONS.find((s) => s.color === color)!;
  return {
    color,
    rank: v - suit.min,
    isSpecial: v === SUIT_MAX[color],
  };
}

// ---------------------------------------------------------------------------
// Card tile
// ---------------------------------------------------------------------------

function CardTile({
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
  const { color, rank, isSpecial } = cardInfo(value);
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      title={`${color} · ${rank}${isSpecial ? " · ★" : ""}`}
      className={[
        CARD_BG[color],
        small ? "w-9 h-14 text-xs" : "w-12 h-20 text-sm",
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
      <span>{rank}</span>
      {isSpecial && (
        <span className="text-yellow-300 text-[9px] leading-none">★</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GameScreenProps {
  state: SanitizedGameState;
  myLogin: string;
  winners: RoundWinner[] | null;
  lastRoundScores: { playerId: string; tricksTaken: number }[] | null;
  error?: string | null;
  onPlayCard: (card: number) => void;
  onSelectLeader: (playerIndex: number) => void;
  onLeave: () => void;
  onDismissRoundEnd: () => void;
  onDismissError: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GameScreen({
  state,
  myLogin,
  winners,
  lastRoundScores,
  error,
  onPlayCard,
  onSelectLeader,
  onLeave,
  onDismissRoundEnd,
  onDismissError,
}: GameScreenProps) {
  const myIndex = state.players.findIndex((p) => p.id === myLogin);
  const me = myIndex >= 0 ? state.players[myIndex] : null;
  const others = state.players.filter((_, i) => i !== myIndex);

  const isMyTurn =
    state.phase === "trick-playing" && state.currentPlayerIndex === myIndex;

  const iSelectLeader =
    state.awaitingLeaderSelection &&
    state.lastTrickTakerIndex !== undefined &&
    state.lastTrickTakerIndex === myIndex;

  const playedCard = (playerId: string) =>
    state.currentTrick?.playedCards.find((pc) => pc.playerId === playerId);

  // --- Game-end screen ---
  if (state.phase === "game-end" && winners) {
    return gameEndScreen(winners, myLogin, onLeave);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-4">
          <span
            className="text-red-500 font-bold tracking-wider text-lg"
            style={{ fontFamily: "'Black Ops One', cursive" }}
          >
            S.O.S.
          </span>
          <span className="text-slate-300 text-sm">
            Round{" "}
            <span className="text-white font-bold">{state.currentRound}</span> /
            5
          </span>
        </div>
        <span className="text-slate-500 text-xs capitalize hidden sm:block">
          {state.phase.replace("-", " ")}
        </span>
        <button
          onClick={onLeave}
          className="text-slate-400 hover:text-white text-xs uppercase tracking-wider
                     transition border border-slate-600 hover:border-slate-400 rounded px-3 py-1"
        >
          Leave
        </button>
      </header>

      {/* Other players */}
      {otherPlayerHands(
        others,
        state,
        playedCard,
        iSelectLeader,
        onSelectLeader,
      )}

      {/* Trick area */}
      {trickCards(state, isMyTurn)}

      {myHand(me, isMyTurn, onPlayCard)}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-4 z-50">
          <div className="bg-red-700 rounded-lg p-6 w-full max-w-sm text-center">
            <h2 className="text-white font-bold text-xl mb-2">Invalid Move</h2>
            <p className="text-red-300 text-sm mb-4">{error}</p>
            <button
              // onClick - close dialog by clearing error message in state
              // how to close dialog?
              onClick={onDismissError}
              className="w-full rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700
                         text-white font-bold py-3 text-sm tracking-widest uppercase transition"
              style={{ fontFamily: "'Black Ops One', cursive" }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Leader-selection overlay */}
      {iSelectLeader && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-700">
            <h2
              className="text-white font-bold text-xl mb-1 text-center"
              style={{ fontFamily: "'Black Ops One', cursive" }}
            >
              Choose Leader
            </h2>
            <p className="text-slate-400 text-xs text-center mb-5">
              You played the most powerful card. Who opens the next trick?
            </p>
            <div className="flex flex-col gap-2">
              {state.players.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => onSelectLeader(idx)}
                  disabled={p.id === myLogin}
                  className="flex items-center gap-3 bg-slate-700 hover:bg-slate-600
                             disabled:opacity-40 disabled:cursor-not-allowed
                             rounded-lg px-4 py-3 text-white text-sm transition"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span>{p.name}</span>
                  {p.isBot && (
                    <span className="text-slate-400 text-xs">[bot]</span>
                  )}
                  {p.id === myLogin && (
                    <span className="ml-auto text-slate-500 text-xs">you</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Round-end overlay */}
      {lastRoundScores && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-slate-700">
            <h2
              className="text-white font-bold text-xl text-center mb-1"
              style={{ fontFamily: "'Black Ops One', cursive" }}
            >
              Round Complete
            </h2>
            <p className="text-slate-400 text-xs uppercase tracking-widest text-center mb-4">
              Tricks taken
            </p>
            <ul className="space-y-2 mb-6">
              {[...lastRoundScores]
                .sort((a, b) => b.tricksTaken - a.tricksTaken)
                .map((s) => {
                  const name =
                    state.players.find((p) => p.id === s.playerId)?.name ??
                    s.playerId;
                  return (
                    <li
                      key={s.playerId}
                      className={`flex justify-between items-center rounded-lg px-4 py-2 text-sm ${
                        s.playerId === myLogin
                          ? "bg-slate-600 text-yellow-300"
                          : "bg-slate-700 text-white"
                      }`}
                    >
                      <span>{name}</span>
                      <span className="tabular-nums">{s.tricksTaken}</span>
                    </li>
                  );
                })}
            </ul>
            <button
              onClick={onDismissRoundEnd}
              className="w-full rounded-lg bg-red-700 hover:bg-red-600 active:bg-red-800
                         text-white font-bold py-3 text-sm tracking-widest uppercase transition"
              style={{ fontFamily: "'Black Ops One', cursive" }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function trickCards(state: SanitizedGameState, isMyTurn: boolean) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-2 min-h-[140px]">
      {(state.currentTrick?.playedCards.length ?? 0) > 0 ? (
        <div className="flex gap-4 flex-wrap justify-center">
          {state.currentTrick.playedCards.map((pc) => {
            const pName =
              state.players.find((p) => p.id === pc.playerId)?.name ?? "?";
            return (
              <div
                key={pc.playerId}
                className="flex flex-col items-center gap-1"
              >
                <CardTile value={pc.card} />
                <span className="text-slate-400 text-xs">{pName}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-slate-600 text-sm italic">
          {isMyTurn ? "Play a card to start the trick" : "Waiting…"}
        </p>
      )}
    </div>
  );
}

function otherPlayerHands(
  others: SanitizedPlayer[],
  state: SanitizedGameState,
  playedCard: (playerId: string) => PlayedCard | undefined,
  iSelectLeader: boolean,
  onSelectLeader: (playerIndex: number) => void,
) {
  return (
    <div className="flex justify-center gap-3 flex-wrap px-4 py-3 shrink-0">
      {others.map((player) => {
        const pIdx = state.players.findIndex((p) => p.id === player.id);
        const isCurrent =
          state.currentPlayerIndex === pIdx && state.phase === "trick-playing";
        const pc = playedCard(player.id);
        return (
          <div
            key={player.id}
            onClick={() => {
              if (iSelectLeader) onSelectLeader(pIdx);
            }}
            className={[
              "flex flex-col items-center gap-2 bg-slate-800 rounded-xl px-3 py-2 min-w-[80px]",
              isCurrent ? "ring-2 ring-red-500" : "ring-1 ring-slate-700",
              iSelectLeader
                ? "cursor-pointer hover:ring-2 hover:ring-white transition-all"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="text-white text-xs font-semibold text-center leading-tight">
              {player.name}
              {player.isBot && (
                <span className="ml-1 text-slate-500 text-[10px]">[bot]</span>
              )}
            </span>
            <div className="flex gap-2 text-[20px] text-slate-400">
              <span title="Cards">🂠 {player.handSize}</span>
              <span title="Tricks">⚑ {player.tricksTakenPerRound}</span>
            </div>
            {pc ? (
              <CardTile value={pc.card} small />
            ) : (
              <div className="w-9 h-14 rounded border border-dashed border-slate-700" />
            )}
            {iSelectLeader && (
              <span className="text-[10px] text-blue-300 font-semibold animate-pulse">
                Select
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function myHand(
  me: SanitizedPlayer | null,
  isMyTurn: boolean,
  onPlayCard: (card: number) => void,
) {
  return (
    <div className="shrink-0 bg-slate-800/90 border-t border-slate-700 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-xs uppercase tracking-wider">
            {me?.name ?? "You"}
          </span>
          <div className="flex gap-2 text-[20px] text-slate-400">
            <span title="Cards">🂠 {me?.handSize ?? 0}</span>
            <span title="Tricks">⚑ {me?.tricksTakenPerRound ?? 0}</span>
          </div>
        </div>
        {isMyTurn && (
          <span className="text-green-400 text-xs font-semibold animate-pulse">
            ▶ Your turn
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        {me?.hand.map((card) => (
          <CardTile
            key={card}
            value={card}
            active={isMyTurn}
            onClick={isMyTurn ? () => onPlayCard(card) : undefined}
          />
        ))}
        {(!me || me.hand.length === 0) && (
          <p className="text-slate-600 text-sm italic">No cards</p>
        )}
      </div>
    </div>
  );
}

function gameEndScreen(
  winners: RoundWinner[],
  myLogin: string,
  onLeave: () => void,
) {
  const ranked = [...winners].sort(
    (a, b) => b.totalTricksTaken - a.totalTricksTaken,
  );
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <h1 className="sos-title mb-8">Game Over</h1>
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-700">
        <p className="text-slate-400 text-xs uppercase tracking-widest text-center mb-4">
          Final Rankings
        </p>
        <ol className="space-y-2">
          {ranked.map((w, i) => (
            <li
              key={w.playerId}
              className="flex items-center gap-3 bg-slate-700 rounded-lg px-4 py-3"
            >
              <span className="text-xl w-7 text-center shrink-0">
                {medals[i] ?? `#${i + 1}`}
              </span>
              <span
                className={`font-semibold ${w.playerId === myLogin ? "text-yellow-300" : "text-white"}`}
              >
                {w.name}
              </span>
              <span className="ml-auto text-slate-400 text-sm">
                {w.totalTricksTaken} tricks
              </span>
            </li>
          ))}
        </ol>
      </div>
      <button onClick={onLeave} className="mt-8 menu-item">
        Back to Menu
      </button>
    </div>
  );
}
