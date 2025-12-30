import { useState, useEffect } from 'react';
import { UserDashboard } from './components/UserDashboard';
import { ProviderDashboard } from './components/ProviderDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { DatabaseTest } from './components/DatabaseTest';
import { initializeMockData, User } from './utils/mockData';
import { Toaster } from './components/ui/sonner';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showDatabaseTest, setShowDatabaseTest] = useState(false);

  useEffect(() => {
    // Initialize mock data
    initializeMockData();
    
    // Load users
    const storedUsers = JSON.parse(localStorage.getItem('healthApp_users') || '[]');
    setUsers(storedUsers);

    // Check for existing session
    const storedCurrentUser = localStorage.getItem('healthApp_currentUser');
    if (storedCurrentUser) {
      setCurrentUser(JSON.parse(storedCurrentUser));
    }

    // Check URL for database test mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('test') === 'db') {
      setShowDatabaseTest(true);
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('healthApp_currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('healthApp_currentUser');
  };

  // Show database test if in test mode
  if (showDatabaseTest) {
    return (
      <>
        <DatabaseTest />
        <Toaster />
      </>
    );
  }

  // Render authentication screen if not logged in
  if (!currentUser) {
    return (
      <>
        <AuthScreen onLogin={handleLogin} users={users} setUsers={setUsers} />
        <Toaster />
      </>
    );
  }

  // Render appropriate dashboard based on user role
  return (
    <div className="min-h-screen">
      {currentUser.role === 'END_USER' && <UserDashboard user={currentUser} onLogout={handleLogout} />}
      {currentUser.role === 'PROVIDER' && <ProviderDashboard user={currentUser} onLogout={handleLogout} />}
      {currentUser.role === 'ADMIN' && <AdminDashboard user={currentUser} onLogout={handleLogout} />}
      <Toaster />
    </div>
  );
}
