import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import VaultDashboard from './components/VaultDashboard';
import AdminDashboard from './admin/AdminDashboard';
import { getStoredAuth, logoutUser } from './services/api';
import { checkIsAdmin, clearAdminSession } from './admin/adminApi';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeView, setActiveView] = useState('login'); // 'login' | 'register' | 'vault' | 'admin'

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth && auth.user) {
      setCurrentUser(auth.user);
      setActiveView('vault');
      checkIsAdmin().then((admin) => {
        setIsAdmin(Boolean(admin));
      }).catch(() => {
        setIsAdmin(false);
      });
    }
  }, []);

  const handleLoginSuccess = async (user) => {
    setCurrentUser(user);
    const admin = await checkIsAdmin().catch(() => false);
    setIsAdmin(Boolean(admin));
    setActiveView('vault');
  };

  const handleRegisterSuccess = () => {
    setActiveView('login');
  };

  const handleLogout = () => {
    logoutUser();
    clearAdminSession();
    setCurrentUser(null);
    setIsAdmin(false);
    setActiveView('login');
  };

  return (
    <div className="app-container">
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onLogout={handleLogout}
      />

      <main className={`main-content ${activeView === 'admin' ? 'admin-view' : ''}`}>
        {activeView === 'login' && (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onNavigateRegister={() => setActiveView('register')}
            onNavigateAdmin={() => setActiveView('admin')}
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

        {activeView === 'admin' && (
          <AdminDashboard
            currentUser={currentUser}
            onNavigateToVault={() => setActiveView(currentUser ? 'vault' : 'login')}
            onSignedOut={handleLogout}
          />
        )}
      </main>
    </div>
  );
}
