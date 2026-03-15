import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { DatabaseTest } from './components/DatabaseTest';
import { initializeMockData, User } from './utils/mockData';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

const UserDashboard = lazy(() =>
  import('./components/UserDashboard').then((module) => ({ default: module.UserDashboard }))
);
const ProviderDashboard = lazy(() =>
  import('./components/ProviderDashboard').then((module) => ({ default: module.ProviderDashboard }))
);
const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard }))
);

function DashboardFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  );
}

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
    toast.success('Logged out successfully');
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
      <Suspense fallback={<DashboardFallback />}>
        {currentUser.role === 'END_USER' && <UserDashboard user={currentUser} onLogout={handleLogout} />}
        {currentUser.role === 'PROVIDER' && <ProviderDashboard user={currentUser} onLogout={handleLogout} />}
        {currentUser.role === 'ADMIN' && <AdminDashboard user={currentUser} onLogout={handleLogout} />}
      </Suspense>
      <Toaster />
    </div>
  );
}
