import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './admin/AdminDashboard';
import { getStoredAuth, logoutUser } from './services/api';
import { clearAdminSession, readStoredAdminToken } from './admin/adminApi';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() =>
    readStoredAdminToken() ? null : getStoredAuth()?.user ?? null);
  const [activeView, setActiveView] = useState(() =>
    readStoredAdminToken() ? 'admin' : currentUser ? 'vault' : 'login');

  function handleLoginSuccess(user) {
    setCurrentUser(user);
    setActiveView('vault');
  }

  function handleUserLogout() {
    void logoutUser();
    clearAdminSession();
    setCurrentUser(null);
    setActiveView('login');
  }

  if (activeView === 'admin') {
    return <AdminDashboard onNavigateToUserLogin={() => {
      clearAdminSession();
      setActiveView('login');
    }} />;
  }

  if (activeView === 'vault' && currentUser) {
    return <UserDashboard currentUser={currentUser} onLogout={handleUserLogout} />;
  }

  return (
    <div className="app-container">
      <Navbar activeView={activeView} setActiveView={setActiveView} />
      <main className="main-content">
        {activeView === 'register'
          ? <Register onRegisterSuccess={() => setActiveView('login')} onNavigateLogin={() => setActiveView('login')} />
          : <Login onLoginSuccess={handleLoginSuccess} onNavigateRegister={() => setActiveView('register')} />}
      </main>
    </div>
  );
}
