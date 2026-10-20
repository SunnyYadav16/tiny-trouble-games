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
}

export interface Review {
  /** Every fact in the clue is true and the clue points to the answer. */
  accurate: boolean;
  offensive: boolean;
  /** The clue is a dictionary definition of the answer or a synonym. */
  plainDefinition: boolean;
  reason: string;
}

/** What a player sees, and nothing more: never the answer. */
export interface SolveRequest {
  clue: string;
  length: number;
  /** The answer's distinct letters, sorted. */
  letters: string;
}

/** Credits spent per call kind (one per refill stage that calls a model). */
export type Spent = Record<'propose' | 'review' | 'solve', number>;

/** Every model call goes through here, so tests use a fake and never the network. */
export interface Llm {
  propose(r: ProposeRequest): Promise<Candidate>;
  review(r: ReviewRequest): Promise<Review>;
  /** Up to 3 uppercase guesses, best first. */
  solve(r: SolveRequest): Promise<string[]>;
  /** Running totals, for providers that report the cost of each reply. */
  readonly spent?: Readonly<Spent>;
}

/** Any condition that makes every later call fail (a refused key, no credits, a used-up daily limit), so refill stops the run on it. */
export class LlmAuthError extends Error {}

/** The provider's free daily request limit is used up: every later call fails until it resets, so refill stops (and keeps what it saved) the same way as for a refused key. */
export class LlmQuotaError extends LlmAuthError {}
