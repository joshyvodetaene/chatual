import type { User } from '@shared/schema';

/**
 * Helper function to update user auth state and notify the global context
 */
export function updateUserAuth(user: User | null) {
  if (user) {
    localStorage.setItem('chatual_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('chatual_user');
  }
  
  // Emit custom event to notify App component
  window.dispatchEvent(new CustomEvent('userAuthChanged', { detail: user }));
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser(): User | null {
  const saved = localStorage.getItem('chatual_user');
  return saved ? JSON.parse(saved) : null;
}