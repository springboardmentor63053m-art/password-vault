import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import VaultDashboard from './components/VaultDashboard';
import { getStoredAuth, logoutUser } from './services/api';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState('login'); // 'login' | 'register' | 'vault'

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth && auth.user) {
      setCurrentUser(auth.user);
      setActiveView('vault');
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveView('vault');
  };

  const handleRegisterSuccess = () => {
    setActiveView('login');
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setActiveView('login');
  };

  return (
    <div className="app-container">
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {activeView === 'login' && (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onNavigateRegister={() => setActiveView('register')}
          />
        )}

        {activeView === 'register' && (
          <Register
            onRegisterSuccess={handleRegisterSuccess}
            onNavigateLogin={() => setActiveView('login')}
          />
        )}

        {activeView === 'vault' && (
          <VaultDashboard currentUser={currentUser} onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
}
