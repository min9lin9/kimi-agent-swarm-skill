import {
  EXECUTION_PROFILES,
  getBooleanFlag,
  getFlag,
  parseCliArgs,
  validateEnum,
} from './cli-contract';
import { printUsage } from './cli-help';
import { clearLeaderboard, compareRuns, generateHtmlReport, getLeaderboard } from './leaderboard';
import { defaultLogger } from './logger';

export async function handleLeaderboard(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const profile = validateEnum('profile', getFlag(parsed, 'profile'), EXECUTION_PROFILES);
  const compareRaw = getFlag(parsed, 'compare');
  const html = getBooleanFlag(parsed, 'html');
  const outPath = getFlag(parsed, 'out');
  const shouldClear = getBooleanFlag(parsed, 'clear');
  const workDir = getFlag(parsed, 'work-dir') ?? process.cwd();
  const leaderboardPath = getFlag(parsed, 'leaderboard-path');

  if (shouldClear) {
    if (!getBooleanFlag(parsed, 'yes')) {
      throw new Error('--clear requires --yes');
    }
    await clearLeaderboard(workDir, leaderboardPath);
    console.log(JSON.stringify({ cleared: true }, null, 2));
    return;
  }

  if (compareRaw) {
    const runIds = compareRaw.split(',').map((id) => id.trim());
    const comparison = await compareRuns(runIds, workDir, leaderboardPath);
    if (comparison.missing.length > 0) {
      defaultLogger.warn(`Run IDs not found in leaderboard: ${comparison.missing.join(', ')}`);
    }
    console.log(JSON.stringify(comparison, null, 2));
    return;
  }

  const entries = await getLeaderboard(profile, workDir, leaderboardPath);

  if (html) {
    const destination = outPath ?? 'leaderboard-report.html';
    await generateHtmlReport(entries, destination);
    console.log(JSON.stringify({ report: destination }, null, 2));
    return;
  }

  console.log(JSON.stringify(entries, null, 2));
}
