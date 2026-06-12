import type { GoldenAnswer } from "../src/types";

export const goldenAnswers: Record<string, GoldenAnswer> = {
  "fixture-paul-graham-corpus": {
    expectedClaims: [
      "Startups should initially do things that don't scale.",
      "The maker's schedule requires long uninterrupted blocks of time.",
      "The best startup ideas often come from the founders' own problems.",
      "Wealth is created by doing what people want, not by moving it around.",
      "Startups die more often from denial than from competition.",
      "Mean people rarely win in the long run.",
    ],
    expectedSourceUrls: [
      "http://www.paulgraham.com/ds.html",
      "http://www.paulgraham.com/makersschedule.html",
      "http://www.paulgraham.com/startupideas.html",
      "http://www.paulgraham.com/wealth.html",
      "http://www.paulgraham.com/really.html",
      "http://www.paulgraham.com/mean.html",
    ],
  },
};
