/**
 * Per-visitor daily limit via an HMAC-signed cookie. Zero infrastructure.
 *
 * ponytail: a signed cookie can be evaded by clearing cookies. Accepted for
 * launch — the hard backstops are (a) BYO-key requests bypass this and cost
 * us nothing, (b) aggressive max_tokens caps per role, and (c) the spend
 * limit on the Anthropic console. Upgrade path: Upstash/KV global counter.
 */

import crypto from "node:crypto";

const DAILY_PER_VISITOR = 3;

function secret(): string {
  return process.env.GUERIDON_RL_SECRET ?? "gueridon-dev-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 16);
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  /** New cookie value to set (day:count:sig). */
  cookie: string;
}

export function checkRateLimit(cookieValue: string | undefined | null): RateResult {
  const today = new Date().toISOString().slice(0, 10);
  let count = 0;

  if (cookieValue) {
    const [day, rawCount, sig] = cookieValue.split(":");
    if (day === today && sig === sign(`${day}:${rawCount}`)) {
      count = Math.min(Number(rawCount) || 0, DAILY_PER_VISITOR);
    }
  }

  if (count >= DAILY_PER_VISITOR) {
    return { allowed: false, remaining: 0, cookie: cookieValue ?? "" };
  }

  const next = count + 1;
  const payload = `${today}:${next}`;
  return {
    allowed: true,
    remaining: DAILY_PER_VISITOR - next,
    cookie: `${payload}:${sign(payload)}`,
  };
}
