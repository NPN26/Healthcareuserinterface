import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Activity, Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { testConnection, getAllUsers } from '../utils/auth';
import { supabase } from '../utils/supabase';

export function DatabaseTest() {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [envCheck, setEnvCheck] = useState<{ url: boolean; key: boolean }>({ url: false, key: false });

  useEffect(() => {
    // Check if environment variables are set
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setEnvCheck({
      url: !!url && url !== 'your-project-url',
      key: !!key && key !== 'your-anon-key',
    });
  }, []);

  const runTest = async () => {
    setTesting(true);
    setConnectionStatus('idle');
    setErrorMessage('');
    setUsers([]);

    try {
      // Test 1: Basic connection
      const { connected, error: connError } = await testConnection();

      if (!connected) {
        throw new Error(connError || 'Failed to connect to database');
      }

      // Test 2: Fetch users
      const { users: fetchedUsers, error: usersError } = await getAllUsers();

      if (usersError) {
        throw new Error(usersError);
      }

      setUsers(fetchedUsers || []);
      setConnectionStatus('success');
    } catch (error: any) {
      setConnectionStatus('error');
      setErrorMessage(error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 dark:from-custom-blue dark:via-custom-purple dark:to-custom-pink flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple mb-4">
            <Database className="w-12 h-12 text-white dark:text-custom-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Database Connection Test</h1>
          <p className="text-muted-foreground">
            Test your Supabase database connection
          </p>
        </div>

        {/* Environment Check */}
        <div className="mb-6 space-y-2">
          <h3 className="font-semibold mb-3">Environment Variables</h3>
          <div className="flex items-center gap-2">
            {envCheck.url ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">
              VITE_SUPABASE_URL: {envCheck.url ? 'Configured ✓' : 'Not configured'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {envCheck.key ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">
              VITE_SUPABASE_ANON_KEY: {envCheck.key ? 'Configured ✓' : 'Not configured'}
            </span>
          </div>

          {(!envCheck.url || !envCheck.key) && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                <strong>Environment variables not configured!</strong>
                <br />
                Update your <code>.env</code> file with your Supabase credentials.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Test Button */}
        <Button
          onClick={runTest}
          disabled={testing || !envCheck.url || !envCheck.key}
          className="w-full mb-6"
          size="lg"
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing Connection...
            </>
          ) : (
            <>
              <Activity className="w-4 h-4 mr-2" />
              Run Connection Test
            </>
          )}
        </Button>

        {/* Results */}
        {connectionStatus === 'success' && (
          <Alert className="mb-6 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>✅ Connection Successful!</strong>
              <br />
              Database is connected and working properly.
            </AlertDescription>
          </Alert>
        )}

        {connectionStatus === 'error' && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>❌ Connection Failed</strong>
              <br />
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Users List */}
        {users.length > 0 && (
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Users in Database ({users.length})</h3>
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-3 bg-muted rounded-md"
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-xs text-blue-900 dark:text-blue-100 mb-2 font-semibold">
            Setup Instructions:
          </p>
          <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
            <li>Update <code>.env</code> file with your Supabase credentials</li>
            <li>Run the schema migration (001_initial_schema.sql) in Supabase</li>
            <li>Run the seed data migration (002_seed_data.sql) in Supabase</li>
            <li>Click "Run Connection Test" above</li>
            <li>If successful, you can proceed to test login/signup</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
