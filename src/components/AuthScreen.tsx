import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Activity, Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../utils/mockData';
import { signIn, signUp, resetPassword, updatePassword } from '../utils/auth';
import { HeartbeatLoader } from './ui/HeartbeatLoader';
import {
  validateEmail,
  validateName,
  validatePassword,
  containsDangerousPatterns,
  sanitizeEmail,
  sanitizeName,
} from '../utils/inputValidation';
import { supabase } from '../utils/supabase';

interface AuthScreenProps {
  onLogin: (user: User) => void;
  users: User[];
  setUsers: (users: User[]) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  useEffect(() => {
    // Check if this is part of a password reset flow
    const isPasswordResetFlow = localStorage.getItem('password_reset_flow') === 'true';
    const urlParams = new URLSearchParams(window.location.search);
    const hasCodeParam = urlParams.has('code'); // PKCE code from Supabase

    console.log('URL params:', window.location.search);
    console.log('Hash params:', window.location.hash);
    console.log('Is password reset flow:', isPasswordResetFlow);
    console.log('Has code param:', hasCodeParam);

    // If we have a code parameter and we're in a password reset flow
    if (isPasswordResetFlow && hasCodeParam) {
      console.log('Password reset detected - showing reset form');
      setIsResettingPassword(true);
      // Don't remove the flag yet - wait until password is actually updated
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);

      // Check for PASSWORD_RECOVERY event (might not fire with PKCE flow)
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event detected');
        setIsResettingPassword(true);
      }

      // If signed in during password reset flow
      if (event === 'SIGNED_IN' && isPasswordResetFlow) {
        console.log('Signed in during password reset flow');
        setIsResettingPassword(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    // Validate email
    const emailValidation = validateEmail(loginEmail);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error || 'Please enter a valid email address');
      return;
    }

    // Check for dangerous patterns in password (SQL injection, etc.)
    const passwordDangerCheck = containsDangerousPatterns(loginPassword);
    if (passwordDangerCheck.dangerous) {
      toast.error('Invalid input detected');
      return;
    }

    if (!loginPassword) {
      toast.error('Please enter your password');
      return;
    }

    const sanitizedEmail = sanitizeEmail(loginEmail);

    setIsLoading(true);
    try {
      const { user, error } = await signIn(sanitizedEmail, loginPassword);

      if (error) {
        toast.error(error);
        return;
      }

      if (!user) {
        toast.error('Invalid email or password');
        return;
      }

      const appUser: User = {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        age: user.age,
        gender: user.gender,
        dateOfBirth: user.date_of_birth,
      };

      onLogin(appUser);
      toast.success(`Welcome back, ${user.name}!`);
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    // Validate email
    const emailValidation = validateEmail(resetEmail);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error || 'Please enter a valid email address');
      return;
    }

    const sanitizedEmail = sanitizeEmail(resetEmail);

    setIsLoading(true);
    try {
      const { error } = await resetPassword(sanitizedEmail);

      if (error) {
        toast.error('Failed to send reset email. Please try again.');
        return;
      }

      toast.success('Password reset link sent! Check your email.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    // Validate password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.error || 'Password does not meet requirements');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await updatePassword(newPassword);

      if (error) {
        toast.error('Failed to update password. Please try again.');
        return;
      }

      // Clear the password reset flow flag
      localStorage.removeItem('password_reset_flow');

      toast.success('Password updated successfully! Please sign in.');
      setIsResettingPassword(false);
      setNewPassword('');
      setConfirmNewPassword('');
      // Clear the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    // Validate name
    const nameValidation = validateName(signupName, { minLength: 2, maxLength: 100 });
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error || 'Please enter a valid name');
      return;
    }

    // Validate email
    const emailValidation = validateEmail(signupEmail);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error || 'Please enter a valid email address');
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(signupPassword);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.error || 'Password does not meet requirements');
      return;
    }

    if (signupPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Check for dangerous patterns in all inputs
    const dangerChecks = [
      containsDangerousPatterns(signupName),
      containsDangerousPatterns(signupEmail),
    ];
    if (dangerChecks.some(check => check.dangerous)) {
      toast.error('Invalid input detected');
      return;
    }

    const sanitizedEmail = sanitizeEmail(signupEmail);
    const sanitizedName = sanitizeName(signupName);

    setIsLoading(true);
    try {
      const { user, error } = await signUp(sanitizedEmail, signupPassword, sanitizedName);

      if (error) {
        toast.error('Failed to create account. Please try again.');
        return;
      }

      if (!user) {
        toast.info('Check your inbox to confirm sign up.');
        return;
      }

      // Convert to User format
      const appUser: User = {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        dateOfBirth: user.date_of_birth,
      };

      onLogin(appUser);
      toast.success('Account created successfully! Please check your email to verify your account.');
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // If user is resetting password, show reset form
  if (isResettingPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 dark:from-custom-blue dark:via-custom-purple dark:to-custom-pink flex items-center justify-center p-4">
        {isLoading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <HeartbeatLoader label="Updating password…" size="lg" />
          </div>
        )}
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple mb-4">
              <Activity className="w-12 h-12 text-white dark:text-custom-white" />
            </div>
            <h1 className="mb-2">Reset Password</h1>
            <p className="text-muted-foreground">
              Enter your new password below
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative mt-1">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Min. 8 chars, upper, lower, number, special"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <div className="relative mt-1">
                <Input
                  id="confirm-new-password"
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  placeholder="Confirm your new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdatePassword()}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full" onClick={handleUpdatePassword} disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 dark:from-custom-blue dark:via-custom-purple dark:to-custom-pink flex items-center justify-center p-4">
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <HeartbeatLoader label="Please wait…" size="lg" />
        </div>
      )}
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/images/healthsync_logo.svg" alt="HealthSync Logo" className="w-24 h-24 mx-auto mb-4" />
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
                  maxLength={254}
                  autoComplete="email"
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
                    maxLength={128}
                    autoComplete="current-password"
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

              <Button className="w-full" onClick={handleLogin} disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot password?
                </button>
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
                  maxLength={100}
                  autoComplete="name"
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
                  maxLength={254}
                  autoComplete="email"
                />
              </div>

              <div>
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    placeholder="Min. 8 chars, upper, lower, number, special"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    maxLength={128}
                    autoComplete="new-password"
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
                    maxLength={128}
                    autoComplete="new-password"
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

              <Button className="w-full" onClick={handleSignup} disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
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

      {/* Forgot Password Dialog */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Reset Password</h2>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="reset-email">Email Address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleForgotPassword()}
                  className="mt-1"
                  maxLength={254}
                  autoComplete="email"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleForgotPassword}
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
