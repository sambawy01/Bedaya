import { Routes, Route } from 'react-router-dom';
import { LearnerProvider } from './context/LearnerContext';
import WelcomePage from './pages/WelcomePage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';

export default function App() {
  return (
    <LearnerProvider>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/lesson" element={<LessonPage />} />
      </Routes>
    </LearnerProvider>
  );
}
