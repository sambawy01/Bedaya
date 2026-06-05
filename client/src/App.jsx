import { Routes, Route } from 'react-router-dom';
import { LearnerProvider } from './context/LearnerContext';
import { GuideProvider } from './context/GuideContext';
import WelcomePage from './pages/WelcomePage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <LearnerProvider>
      <GuideProvider>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/lesson" element={<LessonPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </GuideProvider>
    </LearnerProvider>
  );
}
