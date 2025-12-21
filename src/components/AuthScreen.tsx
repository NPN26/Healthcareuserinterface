import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Activity, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { User } from '../utils/mockData';

interface AuthScreenProps {
  onLogin: (user: User) => void;
  users: User[];
  setUsers: (users: User[]) => void;
}

export function AuthScreen({ onLogin, users, setUsers }: AuthScreenProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleLogin = () => {
    if (!loginEmail || !loginPassword) {
      toast.error('Please enter both email and password');
      return;
    }

    const user = users.find(u => u.email === loginEmail);
    if (!user) {
      toast.error('User not found');
      return;
    }

    if (user.password !== loginPassword) {
      toast.error('Incorrect password');
      return;
    }

    onLogin(user);
    toast.success(`Welcome back, ${user.name}!`);
  };

  const handleSignup = () => {
    if (!signupName || !signupEmail || !signupPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (signupPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const existingUser = users.find(u => u.email === signupEmail);
    if (existingUser) {
      toast.error('An account with this email already exists');
      return;
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: signupName,
      email: signupEmail,
      password: signupPassword,
      role: 'user',
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem('healthApp_users', JSON.stringify(updatedUsers));

    onLogin(newUser);
    toast.success('Account created successfully!');
  };

  const quickLogin = (userEmail: string) => {
    const user = users.find(u => u.email === userEmail);
    if (user) {
      onLogin(user);
      toast.success(`Welcome back, ${user.name}!`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 dark:from-custom-blue dark:via-custom-purple dark:to-custom-pink flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple mb-4">
            <Activity className="w-12 h-12 text-white dark:text-custom-white" />
          </div>
          <h1 className="mb-2">HealthSync</h1>
          <p className="text-muted-foreground">
            Advanced Health Monitoring System
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <div className="space-y-4">
              <div>
                <Label htmlFor="login-email">Email Address</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="login-password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button className="w-full" onClick={handleLogin}>
                Sign In
              </Button>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">Quick Login (Demo)</p>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => quickLogin('john@example.com')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="text-sm">J</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm">John Doe (Patient)</p>
                        <p className="text-xs text-muted-foreground">john@example.com</p>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => quickLogin('emily@healthcare.com')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <span className="text-sm">E</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm">Dr. Emily Brown (Provider)</p>
                        <p className="text-xs text-muted-foreground">emily@healthcare.com</p>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => quickLogin('admin@system.com')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <span className="text-sm">A</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm">Admin User (Admin)</p>
                        <p className="text-xs text-muted-foreground">admin@system.com</p>
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signup">
            <div className="space-y-4">
              <div>
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Enter your full name"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="signup-email">Email Address</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="Enter your email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    placeholder="Create a password (min. 6 characters)"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSignup()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button className="w-full" onClick={handleSignup}>
                Create Account
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-xs text-blue-900 dark:text-blue-100 mb-2">System Features:</p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Real-time biomarker monitoring</li>
            <li>• AI-powered health insights</li>
            <li>• Multi-device integration</li>
            <li>• Set and track health goals</li>
            <li>• Manual data logging</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
