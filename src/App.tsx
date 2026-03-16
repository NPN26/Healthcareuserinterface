import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { DatabaseTest } from './components/DatabaseTest';
import { initializeMockData, User } from './utils/mockData';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { supabase } from './utils/supabase';
import { initSecureStorage, clearSecureStorage, secureGetItem, secureSetItem, secureRemoveItem } from './utils/secureStorage';

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
  const [isValidatingSession, setIsValidatingSession] = useState(true);

  useEffect(() => {
    // Initialize mock data
    initializeMockData();

    // Validate session server-side before trusting localStorage
    const validateSession = async () => {
      // Load users from secure storage
      const rawUsers = await secureGetItem('healthApp_users');
      const storedUsers = JSON.parse(rawUsers || '[]');
      setUsers(storedUsers);

      const storedCurrentUser = await secureGetItem('healthApp_currentUser');
      if (!storedCurrentUser) {
        setIsValidatingSession(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Initialize encrypted storage with session-derived key
          initSecureStorage(session.access_token);

          // Fetch fresh user data from server to get authoritative role
          const { data: userData } = await supabase
            .from('users')
            .select('user_id, email, name, role, age, gender')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (userData) {
            const validatedUser: User = {
              id: userData.user_id,
              name: userData.name,
              email: userData.email,
              role: userData.role,
              age: userData.age,
              gender: userData.gender,
            };
            setCurrentUser(validatedUser);
            // Only persist user ID — role is always server-validated
            await secureSetItem('healthApp_currentUser', JSON.stringify({ user_id: userData.user_id }));
          } else {
            secureRemoveItem('healthApp_currentUser');
          }
        } else if (import.meta.env.DEV) {
          // In dev mode, allow mock accounts but ONLY with their hardcoded roles
          // (mock accounts have fixed roles that cannot be spoofed via localStorage)
          const parsed = JSON.parse(storedCurrentUser);
          const { getMockAccounts } = await import('./utils/auth');
          const mockAccounts = getMockAccounts();
          const mockUser = mockAccounts.find(
            (m: any) => m.user_id === (parsed.user_id || parsed.id)
          );
          if (mockUser) {
            setCurrentUser(mockUser as User);
          } else {
            // Unknown user in dev with no session — reject
            secureRemoveItem('healthApp_currentUser');
          }
        } else {
          // In production, no valid server session means log out
          secureRemoveItem('healthApp_currentUser');
        }
      } catch {
        if (import.meta.env.DEV) {
          const parsed = JSON.parse(storedCurrentUser);
          const { getMockAccounts } = await import('./utils/auth');
          const mockAccounts = getMockAccounts();
          const mockUser = mockAccounts.find(
            (m: any) => m.user_id === (parsed.user_id || parsed.id)
          );
          if (mockUser) {
            setCurrentUser(mockUser as User);
          } else {
            secureRemoveItem('healthApp_currentUser');
          }
        } else {
          secureRemoveItem('healthApp_currentUser');
        }
      }
      setIsValidatingSession(false);
    };

    validateSession();

    // Check URL for database test mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('test') === 'db') {
      setShowDatabaseTest(true);
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    // Only store the user ID for session resumption — role is always re-fetched
    // from the server on page load via validateSession() to prevent role spoofing.
    secureSetItem('healthApp_currentUser', JSON.stringify({ user_id: user.id || user.user_id }));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    secureRemoveItem('healthApp_currentUser');
    clearSecureStorage();
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

  // Show loading while validating session
  if (isValidatingSession) {
    return (
      <>
        <DashboardFallback />
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
