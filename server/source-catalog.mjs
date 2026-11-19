import { homedir } from 'node:os';
import { win32, posix } from 'node:path';

export const sources = {
  codex: 'Codex', claude: 'Claude Code', opencode: 'OpenCode',
  gemini: 'Gemini CLI', copilot: 'GitHub Copilot CLI', qwen: 'Qwen Code',
  kimi: 'Kimi Code', pi: 'Pi', omp: 'Oh My Pi', senpi: 'OmO Native',
  openclaw: 'OpenClaw', droid: 'Factory Droid', codebuddy: 'CodeBuddy Code',
  workbuddy: 'WorkBuddy', dsh: 'DeepSeek Harness', cline: 'Cline',
  reasonix: 'Reasonix', mimo: 'MiMo Code / Desktop', kilo: 'Kilo Code', cherry: 'Cherry Studio Agents', proma: 'Proma',
};

export function defaultSourceRoots(home = homedir(), env = process.env, platform = process.platform) {
  const { join, isAbsolute } = platform === 'win32' ? win32 : posix;
  const base = (key, fallback) => isAbsolute(env[key]?.trim() || '') ? env[key].trim() : fallback;
  const data = platform === 'win32' ? base('APPDATA', join(home, 'AppData', 'Roaming'))
    : platform === 'darwin' ? join(home, 'Library', 'Application Support') : base('XDG_CONFIG_HOME', join(home, '.config'));
  const tasks = extension => join(data, 'Code', 'User', 'globalStorage', extension, 'tasks');
  const xdgData = base('XDG_DATA_HOME', join(home, '.local', 'share'));
  const reasonix = base('REASONIX_STATE_HOME', base('REASONIX_HOME', platform === 'win32' ? join(data, 'reasonix') : join(home, '.reasonix')));
  const cherry = join(data, 'CherryStudio');
  return {
    codex: join(base('CODEX_HOME', join(home, '.codex')), 'sessions'),
    claude: join(base('CLAUDE_CONFIG_DIR', join(home, '.claude')), 'projects'),
    opencode: join(xdgData, 'opencode', 'opencode.db'),
    gemini: join(base('GEMINI_CLI_HOME', join(home, '.gemini')), 'tmp'),
    copilot: join(base('COPILOT_HOME', join(home, '.copilot')), 'session-state'),
    qwen: join(base('QWEN_HOME', join(home, '.qwen')), 'projects'),
    kimi: [join(home, '.kimi', 'sessions'), join(base('KIMI_CODE_HOME', join(home, '.kimi-code')), 'sessions'),
      join(data, 'kimi-desktop', 'daimon-share', 'daimon', 'runtime', 'kimi-code', 'home', 'sessions')],
    pi: join(base('PI_CODING_AGENT_DIR', join(home, '.pi', 'agent')), 'sessions'),
    omp: join(home, '.omp', 'agent', 'sessions'),
    senpi: [join(base('SENPI_CODING_AGENT_DIR', join(home, '.senpi', 'agent')), 'sessions'),
      join(home, '.omo', 'agent', 'sessions'), join(home, '.omo', 'senpi-task', 'children')],
    openclaw: join(base('OPENCLAW_STATE_DIR', join(home, '.openclaw')), 'agents'),
    droid: join(home, '.factory', 'sessions'),
    codebuddy: join(home, '.codebuddy', 'projects'),
    workbuddy: [join(home, '.workbuddy', 'projects'), join(home, '.workbuddy-ai', 'projects')],
    dsh: join(home, '.dsh', 'sessions'),
    reasonix: [join(reasonix, 'sessions'), join(reasonix, 'projects')],
    cline: [tasks('saoudrizwan.claude-dev'), join(home, '.cline', 'data', 'sessions'), join(home, '.cline', 'data', 'tasks')],
    kilo: [join(xdgData, 'kilo', 'kilo.db'), tasks('kilocode.kilo-code')],
    mimo: [join(xdgData, 'mimocode', 'mimocode.db'),
      ...(platform === 'darwin' ? [join(data, 'orca', 'mimocode-hooks', 'shared', 'data', 'mimocode.db')] : [])],
    cherry: [join(cherry, 'Data', 'Agents', '.claude', 'projects'), join(cherry, '.claude', 'projects')],
    proma: ['.proma', '.proma-dev'].flatMap(folder => ['projects', 'sessions'].map(dir => join(home, folder, 'sdk-config', dir))),
  };
}

export const databaseNames = { opencode: 'opencode.db', kilo: 'kilo.db', mimo: 'mimocode.db' };

export function matchesSessionFile(source, filename) {
  switch (source) {
    case 'gemini': return /^session-.*\.jsonl?$/.test(filename);
    case 'copilot': return filename === 'events.jsonl';
    case 'kimi': return filename === 'wire.jsonl';
    case 'dsh': return /^session\.jsonl(?:\.zstd)?$/.test(filename);
    case 'cline': return filename.endsWith('.messages.json') || filename === 'api_conversation_history.json';
    case 'kilo': return filename === 'api_conversation_history.json';
    default: return filename.endsWith('.jsonl');
  }
}
