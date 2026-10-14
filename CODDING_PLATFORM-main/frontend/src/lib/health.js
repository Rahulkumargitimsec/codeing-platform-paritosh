import { useEffect, useState } from 'react';
import api from './api';

// What the backend has configured (code runner, AI keys, video). Fetched once.
let cache = null;
let inflight = null;

export const fetchHealth = () => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api.get('/health')
      .then((r) => (cache = r.data))
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
};

export const useHealth = () => {
  const [health, setHealth] = useState(cache);
  useEffect(() => {
    let alive = true;
    if (!cache) fetchHealth().then((h) => alive && setHealth(h));
    return () => { alive = false; };
  }, []);
  return health;
};
