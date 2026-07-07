interface CompletionCommandEvidence {
  readonly command: string;
  readonly exitCode: number;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isCompletionCommand(value: unknown): value is CompletionCommandEvidence {
  return (
    value !== null &&
    typeof value === 'object' &&
    'command' in value &&
    typeof value.command === 'string' &&
    'exitCode' in value &&
    typeof value.exitCode === 'number'
  );
}

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|cookie|authorization)/i;
const SECRET_TEXT_PATTERN =
  /(api[_-]?key|token|secret|password|cookie|authorization)\s*[:=]|bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}/i;

function containsSecretShape(value: unknown, depth = 0): boolean {
  if (depth > 8) {
    return false;
  }
  if (typeof value === 'string') {
    return SECRET_TEXT_PATTERN.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSecretShape(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        return true;
      }
      if (containsSecretShape(item, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

export function validateCompletionEvidence(evidence: unknown): string[] {
  const failures: string[] = [];
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return ['completion evidence must be an object'];
  }

  if (containsSecretShape(evidence)) {
    failures.push('unsafe completion evidence contains secret-shaped content');
  }

  const changedFiles = 'changedFiles' in evidence ? evidence.changedFiles : undefined;
  if (!isStringArray(changedFiles) || changedFiles.length === 0) {
    failures.push('completion evidence requires changedFiles');
  }

  const commands = 'commands' in evidence ? evidence.commands : undefined;
  if (!Array.isArray(commands) || commands.length === 0) {
    failures.push('completion evidence requires commands');
    return failures;
  }

  if (!commands.filter(isCompletionCommand).some((command) => command.exitCode === 0)) {
    failures.push('completion evidence requires a passing command');
  }

  return failures;
}
