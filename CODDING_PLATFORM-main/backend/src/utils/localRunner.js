// Local code runner — used when no Judge0 is configured.
// Compiles / runs code on this machine with the compilers you already have
// (node for JavaScript, g++ for C++, javac + java for Java) and returns
// results in the same shape Judge0 does, so the controllers don't care
// which one ran the code.
//
// This executes submitted code directly on your computer. It is meant for
// local development only — use Judge0 for anything public.

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const IS_WIN = process.platform === 'win32';
const TIME_LIMIT_MS = Number(process.env.LOCAL_RUNNER_TIME_LIMIT_MS) || 4000;
const COMPILE_LIMIT_MS = 30000;
const MAX_OUTPUT = 1024 * 1024; // 1 MB of stdout/stderr is plenty

// Judge0 status ids, so the rest of the app can treat both runners the same
const STATUS = {
  ACCEPTED: { id: 3, description: 'Accepted' },
  WRONG: { id: 4, description: 'Wrong Answer' },
  TLE: { id: 5, description: 'Time Limit Exceeded' },
  COMPILE: { id: 6, description: 'Compilation Error' },
  RUNTIME: { id: 11, description: 'Runtime Error (NZEC)' },
  INTERNAL: { id: 13, description: 'Internal Error' },
};

// Judge0 language ids used by the app
const LANG = { 54: 'cpp', 62: 'java', 63: 'javascript' };

const toolCache = {};
const hasTool = (cmd, args = ['--version']) => {
  if (toolCache[cmd] !== undefined) return toolCache[cmd];
  try {
    const r = spawnSync(cmd, args, { stdio: 'ignore', shell: IS_WIN, timeout: 10000 });
    toolCache[cmd] = r.status === 0;
  } catch {
    toolCache[cmd] = false;
  }
  return toolCache[cmd];
};

const availableLanguages = () => ({
  javascript: true, // node is always there — it's running this server
  cpp: hasTool('g++'),
  java: hasTool('javac', ['-version']) && hasTool('java', ['-version']),
});

const normalize = (s) =>
  String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\s+$/, '');

const run = (cmd, args, { cwd, input = '', timeout }) =>
  new Promise((resolve) => {
    const started = process.hrtime.bigint();
    let stdout = '';
    let stderr = '';
    let killed = false;
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: false, windowsHide: true });
    } catch (err) {
      return resolve({ code: -1, stdout, stderr: err.message, timedOut: false, ms: 0 });
    }
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeout);

    child.stdout.on('data', (d) => { if (stdout.length < MAX_OUTPUT) stdout += d; });
    child.stderr.on('data', (d) => { if (stderr.length < MAX_OUTPUT) stderr += d; });
    child.on('error', (err) => { stderr += err.message; });
    child.on('close', (code) => {
      clearTimeout(timer);
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      // the JVM announces JAVA_TOOL_OPTIONS on stderr; that's noise, not an error
      stderr = stderr.replace(/^Picked up (?:JAVA_TOOL_OPTIONS|_JAVA_OPTIONS|JDK_JAVA_OPTIONS):.*\r?\n?/gm, '');
      resolve({ code, stdout, stderr, timedOut: killed, ms });
    });
    child.stdin.on('error', () => {}); // program may exit before reading stdin
    child.stdin.end(input);
  });

// Compile once per (language, code) and reuse the build for every test case
const buildCache = new Map();
const BUILD_ROOT = path.join(os.tmpdir(), 'codejudge-builds');

const prepare = async (lang, code) => {
  const key = crypto.createHash('sha1').update(lang + '\0' + code).digest('hex');
  if (buildCache.has(key)) return buildCache.get(key);

  const promise = (async () => {
    const dir = path.join(BUILD_ROOT, key);
    fs.mkdirSync(dir, { recursive: true });

    if (lang === 'javascript') {
      fs.writeFileSync(path.join(dir, 'main.js'), code);
      return { cmd: process.execPath, args: ['main.js'], cwd: dir };
    }

    if (lang === 'cpp') {
      if (!availableLanguages().cpp) {
        return { error: 'C++ is not available: g++ was not found on this machine. Install g++ (MinGW on Windows, build-essential on Linux, Xcode tools on macOS) or set JUDGE0_KEY in backend/.env.' , internal: true };
      }
      const exe = IS_WIN ? 'main.exe' : 'main';
      fs.writeFileSync(path.join(dir, 'main.cpp'), code);
      if (!fs.existsSync(path.join(dir, exe))) {
        const r = await run('g++', ['-O2', '-std=c++17', '-o', exe, 'main.cpp'], { cwd: dir, timeout: COMPILE_LIMIT_MS });
        if (r.code !== 0) return { error: r.stderr || r.stdout || 'Compilation failed', compile: true };
      }
      return { cmd: path.join(dir, exe), args: [], cwd: dir };
    }

    if (lang === 'java') {
      if (!availableLanguages().java) {
        return { error: 'Java is not available: javac/java were not found on this machine. Install a JDK (17+) or set JUDGE0_KEY in backend/.env.', internal: true };
      }
      const match = code.match(/public\s+(?:final\s+)?class\s+([A-Za-z_]\w*)/);
      const cls = match ? match[1] : 'Main';
      fs.writeFileSync(path.join(dir, `${cls}.java`), code);
      if (!fs.existsSync(path.join(dir, `${cls}.class`))) {
        const r = await run('javac', ['-encoding', 'UTF-8', `${cls}.java`], { cwd: dir, timeout: COMPILE_LIMIT_MS });
        if (r.code !== 0) return { error: r.stderr || r.stdout || 'Compilation failed', compile: true };
      }
      return { cmd: 'java', args: ['-Xss64m', '-cp', '.', cls], cwd: dir, extraTime: 1500 };
    }

    return { error: `Unsupported language id`, internal: true };
  })();

  buildCache.set(key, promise);
  const result = await promise;
  if (result.error) buildCache.delete(key); // don't cache failures
  return result;
};

const runOne = async (build, sub) => {
  const base = {
    token: crypto.randomUUID(),
    language_id: sub.language_id,
    stdin: sub.stdin ?? '',
    expected_output: sub.expected_output ?? '',
    stdout: null,
    stderr: null,
    compile_output: null,
    time: '0',
    memory: null,
  };

  if (build.error) {
    const status = build.compile ? STATUS.COMPILE : STATUS.INTERNAL;
    return { ...base, status_id: status.id, status, compile_output: build.compile ? build.error : null, stderr: build.compile ? null : build.error };
  }

  const r = await run(build.cmd, build.args, {
    cwd: build.cwd,
    input: sub.stdin ?? '',
    timeout: TIME_LIMIT_MS + (build.extraTime || 0),
  });

  let status;
  if (r.timedOut) status = STATUS.TLE;
  else if (r.code !== 0) status = STATUS.RUNTIME;
  else if (sub.expected_output != null && normalize(r.stdout) !== normalize(sub.expected_output)) status = STATUS.WRONG;
  else status = STATUS.ACCEPTED;

  return {
    ...base,
    status_id: status.id,
    status,
    stdout: r.stdout,
    stderr: r.stderr || null,
    time: (r.ms / 1000).toFixed(3),
  };
};

// Same contract as Judge0's batch submit + poll: array in, array of results out
const runBatch = async (submissions) => {
  const results = new Array(submissions.length);
  const queue = submissions.map((s, i) => [s, i]);
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const [sub, i] = queue.shift();
      const lang = LANG[sub.language_id];
      const build = lang ? await prepare(lang, sub.source_code) : { error: 'Unsupported language', internal: true };
      results[i] = await runOne(build, sub);
    }
  });
  await Promise.all(workers);
  return results;
};

module.exports = { runBatch, availableLanguages, normalize };
