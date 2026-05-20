import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const LearnerContext = createContext(null);

export function LearnerProvider({ children }) {
  const [learner, setLearner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = localStorage.getItem('bedaya_learner_id');
    if (savedId) {
      api(`/learners/${savedId}`)
        .then(setLearner)
        .catch(() => localStorage.removeItem('bedaya_learner_id'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((next) => {
    setLearner(next);
    if (next?.id) localStorage.setItem('bedaya_learner_id', String(next.id));
  }, []);

  const logout = useCallback(() => {
    setLearner(null);
    localStorage.removeItem('bedaya_learner_id');
  }, []);

  return (
    <LearnerContext.Provider value={{ learner, loading, login, logout, setLearner }}>
      {children}
    </LearnerContext.Provider>
  );
}

export function useLearner() {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error('useLearner must be used within LearnerProvider');
  return ctx;
}
