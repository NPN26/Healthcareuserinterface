import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { initializeMockData, User } from './utils/mockData';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { supabase } from './utils/supabase';
import { initSecureStorage, clearSecureStorage, secureGetItem, secureSetItem, secureRemoveItem } from './utils/secureStorage';
import { HeartbeatLoader } from './components/ui/HeartbeatLoader';

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
      <HeartbeatLoader label="Loading dashboard…" size="lg" />
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isValidatingSession, setIsValidatingSession] = useState(true);

  useEffect(() => {
    // Initialize mock data
    initializeMockData();

    // Load users from secure storage immediately
    const loadUsers = async () => {
      const rawUsers = await secureGetItem('healthApp_users');
      const storedUsers = JSON.parse(rawUsers || '[]');
      setUsers(storedUsers);
    };
    loadUsers();

    // Set up auth state change listener to handle session restoration
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session?.user) {
            // User session exists - initialize secure storage
            initSecureStorage(session.user.id);

            // Fetch fresh user data from server to get authoritative role
            const { data: userData } = await supabase
              .from('users')
              .select('user_id, email, name, role, age, gender, date_of_birth')
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
                dateOfBirth: userData.date_of_birth,
              };
              setCurrentUser(validatedUser);
              // Only persist user ID — role is always server-validated
              await secureSetItem('healthApp_currentUser', JSON.stringify({ user_id: userData.user_id }));
            } else {
              secureRemoveItem('healthApp_currentUser');
              setCurrentUser(null);
            }
          } else {
            // No valid session - clear user data
            secureRemoveItem('healthApp_currentUser');
            clearSecureStorage();
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          secureRemoveItem('healthApp_currentUser');
          setCurrentUser(null);
        } finally {
          setIsValidatingSession(false);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    // Initialize secure storage with user ID before storing PHI
    initSecureStorage(user.id);
    // Only store the user ID for session resumption — role is always re-fetched
    // from the server on page load via validateSession() to prevent role spoofing.
    secureSetItem('healthApp_currentUser', JSON.stringify({ user_id: user.id }));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    secureRemoveItem('healthApp_currentUser');
    clearSecureStorage();
    toast.success('Logged out successfully');
  };

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
