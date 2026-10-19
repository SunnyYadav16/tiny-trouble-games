import type { wordpathV1 } from '@ttg/engine';
import type { Candidate } from '@ttg/generator/gates';

export interface ProposeRequest {
  topic: string;
  level: wordpathV1.Level;
  /** Answers already used; never propose one again. */
  avoid: readonly string[];
  /** Earlier proposals for this slot and why each was turned down. */
  rejected: readonly { answer: string; reason: string }[];
}

export interface ReviewRequest {
  candidate: Candidate;
  sourceText: string;
}

export interface Review {
  supported: boolean;
  offensive: boolean;
  /** The clue is a dictionary definition of the answer or a synonym. */
  plainDefinition: boolean;
  reason: string;
}

/** What a player sees, and nothing more: never the answer or the source. */
export interface SolveRequest {
  clue: string;
  length: number;
  /** The answer's distinct letters, sorted. */
  letters: string;
}

/** Every model call goes through here, so tests use a fake and never the network. */
export interface Llm {
  propose(r: ProposeRequest): Promise<Candidate>;
  review(r: ReviewRequest): Promise<Review>;
  /** Up to 3 uppercase guesses, best first. */
  solve(r: SolveRequest): Promise<string[]>;
}

/** The provider refused the API key (invalid, expired, or without permission). Refill stops the run on it. */
export class LlmAuthError extends Error {}
