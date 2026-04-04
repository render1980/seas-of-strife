// Re-exports card constants and utilities shared between server and client.
// Both sides import from here — no duplication.
export { SUIT_DEFINITIONS } from "../../server/src/types/types";
export {
  SUIT_MAX,
  getSuitFromCard,
  isHighestCardOfSuit,
} from "../../server/src/game/cards";
