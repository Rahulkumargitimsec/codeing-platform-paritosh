export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', stored: ['javascript', 'js'] },
  { id: 'cpp', label: 'C++', monaco: 'cpp', stored: ['c++', 'cpp'] },
  { id: 'java', label: 'Java', monaco: 'java', stored: ['java'] },
];

export const languageLabel = (lang) => {
  const l = String(lang || '').toLowerCase();
  return LANGUAGES.find((x) => x.id === l || x.stored.includes(l))?.label || lang || '—';
};

// Find the starter code for a language whatever case/alias it was stored with
export const codeFor = (list = [], langId, key = 'initialCode') => {
  const lang = LANGUAGES.find((l) => l.id === langId);
  const names = lang ? lang.stored.concat(lang.label.toLowerCase()) : [String(langId).toLowerCase()];
  return list.find((x) => names.includes(String(x.language).toLowerCase()))?.[key] || '';
};

export const TAGS = {
  array: 'Array',
  string: 'String',
  hashmap: 'Hash map',
  stack: 'Stack',
  linkedList: 'Linked list',
  binarySearch: 'Binary search',
  twoPointers: 'Two pointers',
  graph: 'Graph',
  tree: 'Tree',
  dp: 'Dynamic programming',
  greedy: 'Greedy',
  math: 'Math',
};
export const tagLabel = (t) => TAGS[t] || t;

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const difficultyLabel = (d) => (d ? d[0].toUpperCase() + d.slice(1) : '—');

export const formatRuntime = (s) => {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n < 1 ? `${Math.round(n * 1000)} ms` : `${n.toFixed(2)} s`;
};

export const formatMemory = (kb) => {
  const n = Number(kb);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n < 1024 ? `${n} KB` : `${(n / 1024).toFixed(1)} MB`;
};

export const formatDate = (d, opts = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) =>
  d ? new Date(d).toLocaleString(undefined, opts) : '—';

export const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' });
};

// Submission status -> tone + words
export const STATUS = {
  accepted: { tone: 'ok', label: 'Accepted' },
  wrong: { tone: 'bad', label: 'Wrong answer' },
  error: { tone: 'warn', label: 'Error' },
  pending: { tone: 'run', label: 'Judging' },
};
export const statusOf = (s) => STATUS[s] || { tone: 'warn', label: s || 'Unknown' };

// Judge0 status id -> tone
export const toneForStatusId = (id) => (id === 3 ? 'ok' : id === 4 ? 'bad' : id <= 2 ? 'run' : 'warn');
