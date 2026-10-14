const mongoose = require("mongoose");
const Problem = require("../models/problem");
const Submission = require("../models/submission");
const { judge } = require("../utils/problemUtility");

const LANGS = { cpp: 'c++', 'c++': 'c++', java: 'java', javascript: 'javascript', js: 'javascript' };
const errMsg = (err) => (err && err.message) || String(err);
const clip = (s, n = 2000) => (s == null ? s : String(s).length > n ? String(s).slice(0, n) + '\n…' : String(s));

const readRequest = async (req, res) => {
  const { id } = req.params;
  const language = LANGS[String(req.body.language || '').toLowerCase()];
  const { code } = req.body;
  if (!code || !String(code).trim()) { res.status(400).json({ message: "Write some code first" }); return null; }
  if (!language) { res.status(400).json({ message: "Pick C++, Java or JavaScript" }); return null; }
  if (!mongoose.isValidObjectId(id)) { res.status(404).json({ message: "Problem not found" }); return null; }
  const problem = await Problem.findById(id);
  if (!problem) { res.status(404).json({ message: "Problem not found" }); return null; }
  return { problem, code, language };
};

const submitCode = async (req, res) => {
  let record;
  try {
    const parsed = await readRequest(req, res);
    if (!parsed) return;
    const { problem, code, language } = parsed;

    record = await Submission.create({
      userId: req.result._id,
      problemId: problem._id,
      code,
      language,
      status: 'pending',
      testCasesTotal: problem.hiddenTestCases.length,
    });

    const verdict = await judge(code, language, problem.hiddenTestCases);

    record.status = verdict.status;
    record.testCasesPassed = verdict.passed;
    record.errorMessage = verdict.status === 'accepted' ? '' : clip(verdict.errorMessage, 4000);
    record.runtime = verdict.runtime;
    record.memory = verdict.memory;
    await record.save();

    const accepted = verdict.status === 'accepted';
    const pid = problem._id.toString();
    if (accepted && !req.result.problemSolved.some((p) => p.toString() === pid)) {
      req.result.problemSolved.push(problem._id);
      await req.result.save();
    }

    // Show the failing input only when it's small enough to be useful
    const f = verdict.firstFailure;
    const failedCase = f && String(f.stdin || '').length <= 400 ? {
      number: f.index + 1,
      input: f.stdin,
      expected: f.expected_output,
      output: clip(f.stdout, 400),
    } : f ? { number: f.index + 1 } : null;

    res.status(201).json({
      _id: record._id,
      accepted,
      status: verdict.status,
      statusText: verdict.statusText,
      totalTestCases: verdict.total,
      passedTestCases: verdict.passed,
      cases: verdict.results.map((r) => r.status_id),
      runtime: verdict.runtime,
      memory: verdict.memory,
      errorMessage: accepted ? null : clip(verdict.errorMessage),
      failedCase,
    });
  } catch (err) {
    if (record) {
      record.status = 'error';
      record.errorMessage = errMsg(err);
      await record.save().catch(() => {});
    }
    res.status(500).json({ message: errMsg(err) });
  }
};

const runCode = async (req, res) => {
  try {
    const parsed = await readRequest(req, res);
    if (!parsed) return;
    const { problem, code, language } = parsed;

    const verdict = await judge(code, language, problem.visibleTestCases);

    res.status(200).json({
      success: verdict.status === 'accepted',
      statusText: verdict.statusText,
      runtime: verdict.runtime,
      memory: verdict.memory,
      errorMessage: verdict.status === 'accepted' ? null : clip(verdict.errorMessage),
      testCases: verdict.results.map((r) => ({
        status_id: r.status_id,
        status: r.status?.description,
        stdin: r.stdin,
        expected_output: r.expected_output,
        stdout: clip(r.stdout),
        stderr: clip(r.stderr),
        compile_output: clip(r.compile_output),
        time: r.time,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: errMsg(err) });
  }
};

// Recent submissions across all problems + a per-day activity count for the profile page
const mySubmissions = async (req, res) => {
  try {
    const since = new Date(Date.now() - 371 * 24 * 3600 * 1000);
    const all = await Submission.find({ userId: req.result._id, createdAt: { $gte: since } })
      .select('problemId language status runtime memory testCasesPassed testCasesTotal createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const titles = new Map((await Problem.find({ _id: { $in: [...new Set(all.slice(0, 30).map((s) => String(s.problemId)))] } })
      .select('title difficulty').lean()).map((p) => [String(p._id), p]));

    const activity = {};
    for (const s of all) {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      activity[key] = (activity[key] || 0) + 1;
    }

    res.json({
      total: all.length,
      accepted: all.filter((s) => s.status === 'accepted').length,
      activity,
      recent: all.slice(0, 30).map((s) => ({
        ...s,
        problem: titles.get(String(s.problemId)) || null,
      })).filter((s) => s.problem),
    });
  } catch (err) {
    res.status(500).json({ message: errMsg(err) });
  }
};

module.exports = { submitCode, runCode, mySubmissions };
