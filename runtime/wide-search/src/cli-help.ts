import { defaultLogger } from './logger';
import { listProviderNames } from './providers';

export function printUsage(exitCode = 1): void {
  defaultLogger.error(
    'Usage: kasw [options] <research|run|verify|inspect|export|benchmark|leaderboard|providers|init|worker>'
  );
  defaultLogger.error('');
  defaultLogger.error('Global options:');
  defaultLogger.error('  --verbose, -v                   enable debug logging');
  defaultLogger.error('');
  defaultLogger.error('  research|run <objective> [options]');
  defaultLogger.error(
    '    --profile <profile>           fixture | fixture-asset-mgmt | fixture-sellside-research |'
  );
  defaultLogger.error(
    '                                  fixture-youtube-niche | fixture-paul-graham-corpus |'
  );
  defaultLogger.error(
    '                                  fixture-github-repo-landscape | fixture-market-scan |'
  );
  defaultLogger.error('                                  local-command | web-search');
  defaultLogger.error(
    `    --provider|--provider-name    ${listProviderNames().join(' | ')} (default: mock)`
  );
  defaultLogger.error(
    '    --depth <depth>               light | standard (default) | deep | maximum'
  );
  defaultLogger.error('    --work-dir <dir>              working directory (default: cwd)');
  defaultLogger.error(
    '    --max-cost-usd <n>            abort if estimated/actual cost exceeds budget'
  );
  defaultLogger.error('    --max-provider-calls <n>      abort if provider calls exceed budget');
  defaultLogger.error('    --max-api-calls <n>           abort if API calls exceed budget');
  defaultLogger.error('    --dry-run                     print cost estimate without executing');
  defaultLogger.error(
    '    --use-cache                   reuse cached provider responses when available'
  );
  defaultLogger.error(
    '    --strict-claims               write strict claim artifacts and gate synthesis'
  );
  defaultLogger.error(
    '    --allow-public-reader-hostnames  allow public-reader DNS-validated hostnames'
  );
  defaultLogger.error(
    '    --replay <run-id>             rerun a previous run with the same inputs'
  );
  defaultLogger.error('    --distributed                 execute using distributed worker tasks');
  defaultLogger.error(
    '    --workers <n>                 number of in-process workers; use 0 for external-only (default: 4)'
  );
  defaultLogger.error('    --max-retries <n>             max retries per task (default: 3)');
  defaultLogger.error(
    '    --queue-type <memory|redis>   distributed queue backend (default: memory)'
  );
  defaultLogger.error('    --resume-job-id <id>          resume a previous distributed job');
  defaultLogger.error('    --redis-url <url>             Redis URL (defaults to REDIS_URL env)');
  defaultLogger.error(
    '    --redis-password <password>   Redis password (defaults to REDIS_PASSWORD env)'
  );
  defaultLogger.error(
    '    --redis-username <username>   Redis username (defaults to REDIS_USERNAME env)'
  );
  defaultLogger.error(
    '    --task-timeout-ms <n>         max time a distributed task may stay running (default: 300000)'
  );
  defaultLogger.error('');
  defaultLogger.error('  verify --run-dir <dir> [--strict-claims] [--require-completion-evidence]');
  defaultLogger.error('');
  defaultLogger.error(
    '  worker --job-id <id> [--worker-id <id>] [--work-dir <dir>] [--queue-type <memory|redis>]'
  );
  defaultLogger.error('    --redis-url <url>             Redis URL (defaults to REDIS_URL env)');
  defaultLogger.error(
    '    --redis-password <password>   Redis password (defaults to REDIS_PASSWORD env)'
  );
  defaultLogger.error(
    '    --redis-username <username>   Redis username (defaults to REDIS_USERNAME env)'
  );
  defaultLogger.error('  init [--non-interactive] [--local] [--work-dir <dir>]');
  defaultLogger.error('  verify --run-dir <dir>');
  defaultLogger.error('  inspect --run-dir <dir>');
  defaultLogger.error('  export --run-dir <dir> --format json|csv|html|svg [--out <path>]');
  defaultLogger.error('  benchmark --profile <fixture> [--work-dir <dir>]');
  defaultLogger.error('  leaderboard [options]');
  defaultLogger.error('    --profile <fixture>           filter by profile');
  defaultLogger.error('    --compare <run-id-1>,<run-id-2>  compare specific runs');
  defaultLogger.error('    --html [--out <path>]         generate HTML report');
  defaultLogger.error(
    '    --clear                       clear all leaderboard entries (requires --yes)'
  );
  defaultLogger.error('    --yes                         confirm destructive operations');
  defaultLogger.error('    --work-dir <dir>              working directory (default: cwd)');
  defaultLogger.error('    --leaderboard-path <path>     custom leaderboard file path');
  defaultLogger.error(
    '  providers                      list available providers and required env vars'
  );
  process.exitCode = exitCode;
}
