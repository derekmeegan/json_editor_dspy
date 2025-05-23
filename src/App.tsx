import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import AuthPage from './components/AuthPage';
import EditorPage from './components/EditorPage';
import SettingsPage from './components/SettingsPage';
import Navbar from './components/Navbar';
import { FileProvider } from './contexts/FileContext';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <FileProvider>
          <div className="min-h-screen bg-gray-50 flex flex-col">
            <Navbar />
            <div className="flex-1 py-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/editor/:markdownName" element={<EditorPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          </div>
        </FileProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;