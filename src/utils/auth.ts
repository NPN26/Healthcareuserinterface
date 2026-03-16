import { supabase } from './supabase'
import { checkUserIsActive } from './supabase'

export interface User {
  user_id: string
  email: string
  name: string
  role: 'END_USER' | 'PROVIDER' | 'ADMIN'
  age?: number
  gender?: string
  height?: number
  weight?: number
  health_preferences?: any
  practice_id?: string
  practice_name?: string
  speciality?: string
  is_verified?: boolean
  created_at?: string
  last_login?: string
}

// Mock accounts for development only - stripped from production builds
const MOCK_ACCOUNTS = import.meta.env.DEV ? {
  'john@example.com': {
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'john@example.com',
    name: 'John Doe',
    role: 'END_USER' as const,
    age: 45,
    gender: 'male',
    password: 'password123'
  },
  'sarah@example.com': {
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'sarah@example.com',
    name: 'Sarah Smith',
    role: 'END_USER' as const,
    age: 32,
    gender: 'female',
    password: 'password123'
  },
  'emily@healthcare.com': {
    user_id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'emily@healthcare.com',
    name: 'Dr. Emily Brown',
    role: 'PROVIDER' as const,
    age: 38,
    gender: 'female',
    password: 'password123'
  },
  'admin@system.com': {
    user_id: '550e8400-e29b-41d4-a716-446655440004',
    email: 'admin@system.com',
    name: 'Admin User',
    role: 'ADMIN' as const,
    age: 40,
    gender: 'male',
    password: 'password123'
  }
} as Record<string, { user_id: string; email: string; name: string; role: 'END_USER' | 'PROVIDER' | 'ADMIN'; age: number; gender: string; password: string }> : {} as Record<string, { user_id: string; email: string; name: string; role: 'END_USER' | 'PROVIDER' | 'ADMIN'; age: number; gender: string; password: string }>

/**
 * Check if an email is a mock account (dev only)
 */
function isMockAccount(email: string): boolean {
  if (!import.meta.env.DEV) return false
  return email in MOCK_ACCOUNTS
}

/**
 * Authenticate mock account (dev only, bypasses Supabase)
 */
function authenticateMockAccount(email: string, password: string): { user: User | null, error: string | null } {
  if (!import.meta.env.DEV) {
    return { user: null, error: 'Mock auth is not available in production' }
  }
  const mockAccount = MOCK_ACCOUNTS[email]

  if (!mockAccount) {
    return { user: null, error: 'Mock account not found' }
  }

  if (mockAccount.password !== password) {
    return { user: null, error: 'Invalid password' }
  }

  // Return mock user without password
  const { password: _, ...userWithoutPassword } = mockAccount
  return { user: userWithoutPassword, error: null }
}

/**
 * Sign up a new user
 */
export async function signUp(email: string, password: string, name: string) {
  try {
    // Prevent signup with mock account emails
    if (isMockAccount(email)) {
      throw new Error('This email is reserved for testing. Please use a different email or sign in with the test account.')
    }

    // First, create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('No user returned from signup')

    // Then create user record in our users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        user_id: authData.user.id,
        email,
        name,
        role: 'END_USER',
      })
      .select()
      .single()

    if (userError) throw userError

    return { user: userData, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

/**
 * Sign in an existing user
 */
export async function signIn(email: string, password: string) {
  try {
    // Check if this is a mock account first
    if (isMockAccount(email)) {
      const result = authenticateMockAccount(email, password)

      // Check if mock user is disabled via Supabase
      if (result.user) {
        const isActive = await checkUserIsActive(result.user.user_id)
        if (!isActive) {
          return { user: null, error: 'Your account has been disabled. Please contact an administrator.' }
        }
      }

      return result
    }

    // Otherwise, use real Supabase Auth for new accounts
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('No user returned from signin')

    // Check if user account is active
    const isActive = await checkUserIsActive(authData.user.id)
    if (!isActive) {
      // Sign out the Supabase session since account is disabled
      await supabase.auth.signOut()
      return { user: null, error: 'Your account has been disabled. Please contact an administrator.' }
    }

    // Get user details from our users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (userError) throw userError

    // If authenticated but no profile row exists, create one automatically.
    // This handles cases where signup partially succeeded or the table was reset.
    if (!userData) {
      const newProfile = {
        user_id: authData.user.id,
        email: authData.user.email || email,
        name: authData.user.user_metadata?.name || email.split('@')[0],
        role: 'END_USER' as const,
      }

      const { error: insertError } = await supabase
        .from('users')
        .insert(newProfile)

      if (insertError) {
        console.error('Profile insert error:', insertError)
        throw new Error(`Failed to create user profile: ${insertError.message}`)
      }
      return { user: newProfile, error: null }
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', authData.user.id)

    return { user: userData, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

/**
 * Get list of mock accounts for testing (dev only, for quick login UI)
 */
export function getMockAccounts() {
  if (!import.meta.env.DEV) return []
  return Object.values(MOCK_ACCOUNTS).map(({ password, ...account }) => ({
    ...account,
    isMock: true
  }))
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

/**
 * Get the current session
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return { session, error: null }
  } catch (error: any) {
    return { session: null, error: error.message }
  }
}

/**
 * Get current user details
 */
export async function getCurrentUser() {
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError) throw authError
    if (!authUser) return { user: null, error: null }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (userError) throw userError

    return { user: userData, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    // Try to query the users table
    const { data, error } = await supabase
      .from('users')
      .select('user_id, email, name, role')
      .limit(1)

    if (error) throw error

    return { connected: true, error: null }
  } catch (error: any) {
    return { connected: false, error: error.message }
  }
}

/**
 * Get all users (for testing/demo purposes)
 */
export async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, email, name, role')
      .order('created_at', { ascending: false })

    if (error) throw error

    return { users: data, error: null }
  } catch (error: any) {
    return { users: null, error: error.message }
  }
}
