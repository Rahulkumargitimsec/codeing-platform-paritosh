const axios = require('axios');

const getLanguageById = (lang) => {
  const language = {
    "c++": 54,
    "cpp": 54,
    "java": 62,
    "javascript": 63
  };
  return language[String(lang || '').toLowerCase()];
};


// Helper to encode plain text to base64
const encode = (str) => Buffer.from(str ?? '').toString('base64');

// Helper to decode base64 to plain text
const decode = (str) => str ? Buffer.from(str, 'base64').toString('utf8') : null;


// Judge0 config
//  - RapidAPI (default): set JUDGE0_KEY
//  - Self-hosted Judge0: set JUDGE0_URL=http://localhost:2358 (and JUDGE0_AUTH_TOKEN if you enabled auth)
const JUDGE0_URL = (process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com').replace(/\/+$/, '');
const isRapidApi = JUDGE0_URL.includes('rapidapi.com');

const judgeHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (isRapidApi) {
    if (!process.env.JUDGE0_KEY) {
      throw new Error('JUDGE0_KEY is not set in backend/.env — code cannot be run. Get a key from https://rapidapi.com/judge0-official/api/judge0-ce');
    }
    headers['x-rapidapi-key'] = process.env.JUDGE0_KEY;
    headers['x-rapidapi-host'] = new URL(JUDGE0_URL).host;
  } else if (process.env.JUDGE0_AUTH_TOKEN) {
    headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
  }
  return headers;
};

const describeAxiosError = (error) => {
  if (error.response) {
    const body = typeof error.response.data === 'string'
      ? error.response.data
      : JSON.stringify(error.response.data);
    return `Judge0 responded ${error.response.status}: ${body}`;
  }
  return `Judge0 request failed: ${error.message}`;
};


const submitBatch = async (submissions) => {

  // Encode source_code, stdin, and expected_output before sending
  const encodedSubmissions = submissions.map((s) => ({
    ...s,
    source_code: encode(s.source_code),
    stdin: encode(s.stdin),
    expected_output: encode(s.expected_output),
  }));

  try {
    const response = await axios.request({
      method: 'POST',
      url: `${JUDGE0_URL}/submissions/batch`,
      params: { base64_encoded: 'true' },
      headers: judgeHeaders(),
      data: { submissions: encodedSubmissions },
    });

    const data = response.data;
    if (!Array.isArray(data)) {
      throw new Error(`Unexpected Judge0 response: ${JSON.stringify(data)}`);
    }
    const bad = data.find((d) => !d.token);
    if (bad) {
      throw new Error(`Judge0 rejected a submission: ${JSON.stringify(bad)}`);
    }
    return data;
  } catch (error) {
    if (error.response || error.request) throw new Error(describeAxiosError(error));
    throw error;
  }
};


const waiting = (timer) => {
  return new Promise((resolve) => setTimeout(resolve, timer));
};


const submitToken = async (resultToken) => {

  const MAX_ATTEMPTS = 30; // ~30 seconds

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let result;
    try {
      const response = await axios.request({
        method: 'GET',
        url: `${JUDGE0_URL}/submissions/batch`,
        params: {
          tokens: resultToken.join(","),
          base64_encoded: 'true',
          fields: '*'
        },
        headers: judgeHeaders(),
      });
      result = response.data;
    } catch (error) {
      if (error.response || error.request) throw new Error(describeAxiosError(error));
      throw error;
    }

    const IsResultObtained = result.submissions.every((r) => r.status_id > 2);

    if (IsResultObtained) {
      // Decode all base64 fields before returning
      return result.submissions.map((r) => ({
        ...r,
        stdout: decode(r.stdout),
        stderr: decode(r.stderr),
        compile_output: decode(r.compile_output),
        expected_output: decode(r.expected_output),
        stdin: decode(r.stdin),
      }));
    }

    await waiting(1000);
  }

  throw new Error('Timed out waiting for Judge0 results');
};


// ── Which runner? ──────────────────────────────────────────
//  CODE_RUNNER=judge0 | local   (default: judge0 if JUDGE0_KEY / JUDGE0_URL is set, else local)
const runnerMode = () => {
  const forced = String(process.env.CODE_RUNNER || '').toLowerCase();
  if (forced === 'judge0' || forced === 'local') return forced;
  return process.env.JUDGE0_KEY || process.env.JUDGE0_URL ? 'judge0' : 'local';
};

// Run a batch of { source_code, language_id, stdin, expected_output } and
// return Judge0-shaped results (status_id 3 = accepted, 4 = wrong answer, ...)
const executeBatch = async (submissions) => {
  if (!submissions.length) return [];
  if (runnerMode() === 'local') {
    return require('./localRunner').runBatch(submissions);
  }
  const submitResult = await submitBatch(submissions);
  return submitToken(submitResult.map((s) => s.token));
};

// Run code against test cases and summarise the outcome
const judge = async (code, language, testCases) => {
  const languageId = getLanguageById(language);
  if (!languageId) throw new Error(`Unsupported language: ${language}`);

  const results = await executeBatch(testCases.map((tc) => ({
    source_code: code,
    language_id: languageId,
    stdin: tc.input,
    expected_output: tc.output,
  })));

  let passed = 0, runtime = 0, memory = 0;
  let status = 'accepted';
  let errorMessage = null;
  let firstFailure = null;

  results.forEach((r, i) => {
    if (r.status_id === 3) {
      passed++;
      runtime += parseFloat(r.time) || 0;
      memory = Math.max(memory, Number(r.memory) || 0);
    } else if (!firstFailure) {
      firstFailure = { index: i, ...r };
      status = r.status_id === 4 ? 'wrong' : 'error';
      errorMessage = r.compile_output || r.stderr || r.status?.description || 'Failed';
    }
  });

  return {
    results,
    passed,
    total: results.length,
    runtime: Number(runtime.toFixed(3)),
    memory,
    status,
    statusText: firstFailure ? firstFailure.status?.description : 'Accepted',
    errorMessage,
    firstFailure,
  };
};

module.exports = { getLanguageById, submitBatch, submitToken, executeBatch, judge, runnerMode };
