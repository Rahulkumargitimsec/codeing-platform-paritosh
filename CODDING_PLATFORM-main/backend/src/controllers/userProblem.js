const mongoose = require("mongoose");
const { judge } = require("../utils/problemUtility");
const Problem = require("../models/problem");
const User = require("../models/user");
const Submission = require("../models/submission");
const SolutionVideo = require("../models/solutionVideo");

const errMsg = (err) => (err && err.message) || String(err);
const isId = (id) => mongoose.isValidObjectId(id);

// Every reference solution must pass every test case before a problem is saved
const verifyReferenceSolutions = async ({ referenceSolution = [], visibleTestCases = [], hiddenTestCases = [] }) => {
  if (!referenceSolution.length) return 'Add at least one reference solution';
  const tests = [...visibleTestCases, ...hiddenTestCases];
  if (!tests.length) return 'Add at least one test case';

  for (const { language, completeCode } of referenceSolution) {
    const verdict = await judge(completeCode, language, tests);
    if (verdict.status !== 'accepted') {
      const i = verdict.firstFailure.index;
      const where = i < visibleTestCases.length ? `visible test case ${i + 1}` : `hidden test case ${i - visibleTestCases.length + 1}`;
      return `The ${language} reference solution failed ${where}: ${verdict.statusText}` +
        (verdict.errorMessage && verdict.errorMessage !== verdict.statusText ? `\n${String(verdict.errorMessage).slice(0, 800)}` : '');
    }
  }
  return null;
};

const createProblem = async (req, res) => {
  try {
    const problemError = await verifyReferenceSolutions(req.body);
    if (problemError) return res.status(400).json({ message: problemError });

    const { title, description, difficulty, tags, visibleTestCases, hiddenTestCases, startCode, referenceSolution } = req.body;
    const problem = await Problem.create({
      title, description, difficulty, tags, visibleTestCases, hiddenTestCases, startCode, referenceSolution,
      problemCreator: req.result._id,
    });
    res.status(201).json({ message: "Problem created", _id: problem._id });
  } catch (err) {
    res.status(400).json({ message: errMsg(err) });
  }
};

const updateProblem = async (req, res) => {
  const { id } = req.params;
  try {
    if (!isId(id)) return res.status(400).json({ message: "Invalid problem id" });
    const existing = await Problem.findById(id);
    if (!existing) return res.status(404).json({ message: "Problem not found" });

    const { title, description, difficulty, tags, visibleTestCases, startCode, referenceSolution } = req.body;
    // Hidden test cases are optional on update — keep the stored ones if none were sent
    const hiddenTestCases = Array.isArray(req.body.hiddenTestCases) && req.body.hiddenTestCases.length
      ? req.body.hiddenTestCases
      : existing.hiddenTestCases.map((t) => ({ input: t.input, output: t.output }));

    const problemError = await verifyReferenceSolutions({ referenceSolution, visibleTestCases, hiddenTestCases });
    if (problemError) return res.status(400).json({ message: problemError });

    const updated = await Problem.findByIdAndUpdate(
      id,
      { title, description, difficulty, tags, visibleTestCases, hiddenTestCases, startCode, referenceSolution },
      { runValidators: true, new: true }
    );
    res.status(200).json({ message: "Problem updated", _id: updated._id });
  } catch (err) {
    res.status(400).json({ message: errMsg(err) });
  }
};

const deleteProblem = async (req, res) => {
  const { id } = req.params;
  try {
    if (!isId(id)) return res.status(400).json({ message: "Invalid problem id" });
    const deleted = await Problem.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Problem not found" });

    await Promise.all([
      Submission.deleteMany({ problemId: id }),
      SolutionVideo.deleteMany({ problemId: id }),
      User.updateMany({ problemSolved: id }, { $pull: { problemSolved: id } }),
    ]);
    res.status(200).json({ message: "Problem deleted" });
  } catch (err) {
    res.status(500).json({ message: errMsg(err) });
  }
};

const getProblemById = async (req, res) => {
  const { id } = req.params;
  try {
    if (!isId(id)) return res.status(404).json({ message: "Problem not found" });
    const problem = await Problem.findById(id).lean();
    if (!problem) return res.status(404).json({ message: "Problem not found" });

    const isAdmin = req.result.role === 'admin';
    const solved = req.result.problemSolved.some((p) => p.toString() === id);

    const data = {
      _id: problem._id,
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      tags: problem.tags,
      visibleTestCases: problem.visibleTestCases,
      startCode: problem.startCode,
      hiddenTestCount: problem.hiddenTestCases.length,
      solved,
      // Reference solutions unlock once you've solved the problem
      solutionsLocked: !(isAdmin || solved),
      referenceSolution: isAdmin || solved ? problem.referenceSolution : [],
    };
    if (isAdmin) data.hiddenTestCases = problem.hiddenTestCases;

    const video = await SolutionVideo.findOne({ problemId: id }).lean();
    if (video) {
      data.secureUrl = video.secureUrl;
      data.thumbnailUrl = video.thumbnailUrl;
      data.duration = video.duration;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: errMsg(err) });
  }
};

const getAllProblem = async (req, res) => {
  try {
    const problems = await Problem.find({}).select('_id title difficulty tags createdAt').sort({ createdAt: 1 }).lean();

    // Acceptance rate per problem
    let stats = [];
    try {
      stats = await Submission.aggregate([
        { $group: { _id: '$problemId', total: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } } } },
      ]);
    } catch {
      // Some Mongo-compatible stores lack $cond in $group — count in JS instead
      try {
        const subs = await Submission.find({}).select('problemId status').lean();
        const acc = new Map();
        for (const x of subs) {
          const k = String(x.problemId);
          const e = acc.get(k) || { _id: k, total: 0, accepted: 0 };
          e.total++; if (x.status === 'accepted') e.accepted++;
          acc.set(k, e);
        }
        stats = [...acc.values()];
      } catch { /* stats are optional */ }
    }
    const byId = new Map(stats.map((s) => [String(s._id), s]));

    const videos = await SolutionVideo.find({}).select('problemId').lean();
    const withVideo = new Set(videos.map((v) => String(v.problemId)));

    res.status(200).json(problems.map((p) => {
      const s = byId.get(String(p._id));
      return {
        ...p,
        submissions: s?.total || 0,
        acceptance: s?.total ? Math.round((s.accepted / s.total) * 100) : null,
        hasVideo: withVideo.has(String(p._id)),
      };
    }));
  } catch (err) {
    res.status(500).json({ message: errMsg(err) });
  }
};

const solvedAllProblembyUser = async (req, res) => {
  try {
    const user = await User.findById(req.result._id).populate({
      path: "problemSolved",
      select: "_id title difficulty tags",
    });
    res.status(200).json((user.problemSolved || []).filter(Boolean));
  } catch (err) {
    res.status(500).json({ message: errMsg(err) });
  }
};

const submittedProblem = async (req, res) => {
  try {
    const { pid } = req.params;
    if (!isId(pid)) return res.status(200).json([]);
    const list = await Submission.find({ userId: req.result._id, problemId: pid }).sort({ createdAt: -1 }).lean();
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: errMsg(err) });
  }
};

module.exports = { createProblem, updateProblem, deleteProblem, getProblemById, getAllProblem, solvedAllProblembyUser, submittedProblem };
