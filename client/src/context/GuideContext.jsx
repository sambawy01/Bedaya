import { createContext, useContext, useState, useCallback } from 'react';
import { useLearner } from './LearnerContext';

const GuideContext = createContext(null);

/**
 * Holds the active voice guide (Umm Yasmin / Amm Hassan) so every screen
 * narrates in the same voice. During onboarding the guide isn't chosen yet,
 * so we default to umm_yasmin and let the picker override.
 */
export function GuideProvider({ children }) {
  const { learner } = useLearner();
  const [override, setOverride] = useState(null);
  const guide = override || learner?.voice_guide || 'umm_yasmin';
  const chooseGuide = useCallback((g) => setOverride(g), []);
  return (
    <GuideContext.Provider value={{ guide, chooseGuide }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const ctx = useContext(GuideContext);
  if (!ctx) return { guide: 'umm_yasmin', chooseGuide: () => {} };
  return ctx;
}
