import { useState, useEffect, lazy, Suspense } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from './components/AuthScreen';
import { initializeMockData, User } from './utils/mockData';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { supabase } from './utils/supabase';
import { signOut } from './utils/auth';
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
    let isMounted = true;
    let initialValidationComplete = false;

    const completeInitialValidation = () => {
      if (!isMounted || initialValidationComplete) return;
      initialValidationComplete = true;
      setIsValidatingSession(false);
    };

    const applySessionState = async (session: Session | null) => {
      try {
        if (session?.user) {
          // User session exists - initialize secure storage
          initSecureStorage(session.user.id);

          // Fetch fresh user data from server to get authoritative role
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('user_id, email, name, role, age, gender, date_of_birth')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (userError) throw userError;
          if (!isMounted) return;

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
            // Only persist user ID - role is always server-validated
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
        console.error('Session validation error:', error);
        if (!isMounted) return;
        secureRemoveItem('healthApp_currentUser');
        setCurrentUser(null);
      } finally {
        completeInitialValidation();
      }
    };

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Keep auth callback non-blocking; async DB work here can stall sign-in completion.
      void applySessionState(session);
    });

    // Bootstrap session on initial load in case auth events are delayed or missed.
    const bootstrapSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        await applySessionState(data.session);
      } catch (error) {
        console.error('Initial session bootstrap error:', error);
        secureRemoveItem('healthApp_currentUser');
        setCurrentUser(null);
        completeInitialValidation();
      }
    };
    void bootstrapSession();

    // Safety net: never block app forever on loading state.
    const validationTimeout = window.setTimeout(() => {
      if (!initialValidationComplete && isMounted) {
        console.warn('Session validation timed out. Proceeding to app.');
        completeInitialValidation();
      }
    }, 10000);

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      window.clearTimeout(validationTimeout);
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

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to log out. Please try again.');
      return;
    }

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
