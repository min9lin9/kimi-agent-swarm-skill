#!/usr/bin/env node

const sources = [
  {
    id: "L001",
    url: "https://example.com/local-command-primary",
    title: "Local Command Primary Source",
    sourceClass: "primary-data",
    publishedAt: "2026-05-22",
    discoveredBy: "local-command fixture",
    scores: {
      relevance: 4,
      authority: 4,
      freshness: 4,
      diversity: 3,
      extractionValue: 4
    },
    claims: ["Local command providers can feed replayable source candidates into the runtime."]
  },
  {
    id: "L002",
    url: "https://example.com/local-command-low-quality",
    title: "Local Command Low Quality Source",
    sourceClass: "secondary",
    publishedAt: "2024-01-01",
    discoveredBy: "local-command fixture",
    scores: {
      relevance: 1,
      authority: 1,
      freshness: 1,
      diversity: 1,
      extractionValue: 1
    },
    claims: ["Low quality command output should be rejected."]
  }
];

for (const source of sources) {
  console.log(JSON.stringify({ type: "source_candidate", source }));
}
