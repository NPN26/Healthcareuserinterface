import { supabase } from './supabase'
import { checkUserIsActive } from './supabase'
import {
  logAuthSuccess,
  logAuthFailure,
  logAuthLockout,
  logSignup,
  logSignupFailure,
  logLogout,
  logApiError,
} from './securityLogger'
import { checkRateLimit, peekRateLimit, resetRateLimit } from './rateLimiter'
import { isLikelyBot } from './botDetection'

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

/**
 * Sign up a new user
 */
export async function signUp(email: string, password: string, name: string) {
  try {
    // Rate-limit signups
    const rateCheck = checkRateLimit('signup', email.trim().toLowerCase())
    if (!rateCheck.allowed) {
      return { user: null, error: rateCheck.message }
    }

    // Bot detection for account creation
    if (isLikelyBot()) {
      logSignupFailure(email, 'Bot-like behavior detected')
      return { user: null, error: 'Unable to create account. Please try again later.' }
    }

    // Create auth user in Supabase Auth
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

    logSignup(authData.user.id, email)
    return { user: userData, error: null }
  } catch (error: any) {
    logSignupFailure(email, error.message)
    return { user: null, error: error.message }
  }
}

/**
 * Sign in an existing user
 */
export async function signIn(email: string, password: string) {
  try {
    // Rate limiting: check if this email is rate-limited
    const rateCheck = checkRateLimit('login', email.trim().toLowerCase())
    if (!rateCheck.allowed) {
      logAuthLockout(email, rateCheck.retryAfterMs)
      return {
        user: null,
        error: rateCheck.message
      }
    }

    // Use Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      logAuthFailure(email, authError.message)
      // Check if we've now hit the limit
      const postFailCheck = peekRateLimit('login', email.trim().toLowerCase())
      if (!postFailCheck.allowed) {
        logAuthLockout(email, postFailCheck.retryAfterMs)
        return {
          user: null,
          error: postFailCheck.message
        }
      }
      // Return generic error message to prevent user enumeration
      return { user: null, error: 'Invalid email or password' }
    }

    if (!authData.user) {
      logAuthFailure(email, 'No user returned')
      return { user: null, error: 'Invalid email or password' }
    }

    // Successful login — clear rate limit record
    resetRateLimit('login', email.trim().toLowerCase())

    // Check if user account is active
    const isActive = await checkUserIsActive(authData.user.id)
    if (!isActive) {
      logAuthFailure(email, 'Account disabled')
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
        logApiError('signIn.insertProfile', insertError, authData.user.id)
        throw new Error(`Failed to create user profile: ${insertError.message}`)
      }
      logAuthSuccess(authData.user.id, email)
      return { user: newProfile, error: null }
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', authData.user.id)

    logAuthSuccess(authData.user.id, email)
    return { user: userData, error: null }
  } catch (error: any) {
    logApiError('signIn', error, undefined)
    return { user: null, error: error.message }
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    // Capture user ID before sign out clears the session
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    if (user) logLogout(user.id)
    return { error: null }
  } catch (error: any) {
    logApiError('signOut', error)
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
 * Check if current session is a password recovery session
 */
export async function isPasswordRecoverySession() {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    // Check if there's a session and if it's from a recovery flow
    // In recovery flow, user needs to update password
    if (session?.user) {
      // Check user metadata for recovery indicator
      const { data: { user } } = await supabase.auth.getUser()

      // If user is authenticated but needs to update password
      // This happens after clicking recovery link
      return { isRecovery: false, error: null }
    }

    return { isRecovery: false, error: null }
  } catch (error: any) {
    return { isRecovery: false, error: error.message }
  }
}

/**
 * Request password reset
 */
export async function resetPassword(email: string) {
  try {
    // Set a flag in localStorage to track password reset flow
    localStorage.setItem('password_reset_flow', 'true')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    })

    if (error) throw error

    return { error: null }
  } catch (error: any) {
    localStorage.removeItem('password_reset_flow')
    logApiError('resetPassword', error, undefined)
    return { error: error.message }
  }
}

/**
 * Update password (called after user clicks reset link)
 */
export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error

    return { error: null }
  } catch (error: any) {
    logApiError('updatePassword', error, undefined)
    return { error: error.message }
  }
}


