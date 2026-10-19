import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import VaultDashboard from './components/VaultDashboard';
import AdminDashboard from '../../src/App';
import { getStoredAuth, getStoredToken, logoutUser } from './services/api';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState('login'); // 'login' | 'register' | 'vault'

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth && auth.user) {
      setCurrentUser(auth.user);
      setActiveView(auth.user.role === 'ROLE_ADMIN' ? 'admin' : 'vault');
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveView(user.role === 'ROLE_ADMIN' ? 'admin' : 'vault');
  };

  const handleRegisterSuccess = () => {
    setActiveView('login');
  };

  const handleLogout = useCallback(() => {
    logoutUser();
    setCurrentUser(null);
    setActiveView('login');
  }, []);

  return (
    <div className="app-container">
      {activeView === 'admin' && currentUser?.role === 'ROLE_ADMIN' ? (
        <AdminDashboard
          accessToken={getStoredToken()}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
