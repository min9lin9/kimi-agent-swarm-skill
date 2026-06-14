import type { GoldenAnswer } from '../src/types';

export const goldenAnswers: Record<string, GoldenAnswer> = {
  'fixture-paul-graham-corpus': {
    expectedClaims: [
      "Startups should initially do things that don't scale.",
      "The maker's schedule requires long uninterrupted blocks of time.",
      "The best startup ideas often come from the founders' own problems.",
      'Wealth is created by doing what people want, not by moving it around.',
      'Startups die more often from denial than from competition.',
      'Mean people rarely win in the long run.',
    ],
    expectedSourceUrls: [
      'http://www.paulgraham.com/ds.html',
      'http://www.paulgraham.com/makersschedule.html',
      'http://www.paulgraham.com/startupideas.html',
      'http://www.paulgraham.com/wealth.html',
      'http://www.paulgraham.com/really.html',
      'http://www.paulgraham.com/mean.html',
    ],
  },
  'fixture-github-repo-landscape': {
    expectedClaims: [
      'Browser-use connects AI agents directly to browser UI elements for task automation.',
      'Stagehand provides an AI-driven browser automation framework with act/extract/observe primitives.',
      'AutoGPT was one of the first open-source projects to popularize autonomous AI agents.',
      'LangChain provides abstractions for chaining LLM calls, tools, and memory.',
      'CrewAI structures agents into role-based crews that collaborate on tasks.',
      'AutoGen from Microsoft enables multi-agent conversations and tool use.',
    ],
    expectedSourceUrls: [
      'https://github.com/browser-use/browser-use',
      'https://github.com/browserbase/stagehand',
      'https://github.com/Significant-Gravitas/AutoGPT',
      'https://github.com/langchain-ai/langchain',
      'https://github.com/crewAIInc/crewAI',
      'https://github.com/microsoft/autogen',
    ],
  },
  'fixture-market-scan': {
    expectedClaims: [
      'GitHub Copilot is the most widely adopted AI coding assistant by installed base.',
      'Cursor is an AI-first code editor built on top of VS Code.',
      'Claude Code is a terminal-based agentic coding assistant.',
      'Amazon Q Developer provides code generation, transformation, and operational assistance.',
      'Enterprise adoption of AI coding assistants is accelerating in regulated industries.',
    ],
    expectedSourceUrls: [
      'https://github.com/features/copilot',
      'https://www.cursor.com/',
      'https://www.anthropic.com/claude-code',
      'https://aws.amazon.com/q/developer/',
      'https://www.gartner.com/en/newsroom/example',
    ],
  },
  'fixture-youtube-niche': {
    expectedClaims: [
      'Niche: Personal finance for Gen Z and young millennials.',
      'Niche: Tutorials and reviews of AI tools for writers, designers, and video creators.',
      'Audience: 18-28 year olds entering the workforce with student debt and first salaries.',
      'Monetization angle: Affiliate links to neobanks, investment apps, budgeting tools, and digital courses.',
    ],
    expectedSourceUrls: [
      'https://example.com/youtube-niche/personal-finance-for-gen-z',
      'https://example.com/youtube-niche/ai-tools-for-creators',
    ],
  },
};
