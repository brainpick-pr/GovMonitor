import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

export function GoogleLoginButton({ onSuccess, onError, className }: GoogleLoginButtonProps) {
  const { loginWithGoogle, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Generate OAuth URL
  const getGoogleAuthUrl = useCallback(() => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = encodeURIComponent('openid email profile');
    const state = crypto.randomUUID(); // For CSRF protection

    // Store state for verification
    sessionStorage.setItem('oauth_state', state);

    return `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&state=${state}` +
      `&access_type=offline` +
      `&prompt=consent`;
  }, []);

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    // Check if this is a callback
    if (!code && !error) return;

    // Clear URL params
    window.history.replaceState({}, document.title, window.location.pathname);

    if (error) {
      const errorMessage = urlParams.get('error_description') || 'Authentication cancelled';
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage
      });
      onError?.(new Error(errorMessage));
      return;
    }

    // Verify state for CSRF protection
    const storedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');

    if (state !== storedState) {
      const errorMessage = 'Invalid state parameter';
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage
      });
      onError?.(new Error(errorMessage));
      return;
    }

    // Exchange code for session
    if (!code) return; // Type guard - code must exist at this point
    setIsLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      await loginWithGoogle(code, redirectUri);

      toast({
        variant: 'success',
        title: 'Welcome!',
        description: 'You have been signed in successfully'
      });

      onSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Login failed');
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message
      });
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [loginWithGoogle, onSuccess, onError, toast]);

  // Check for OAuth callback on mount
  useEffect(() => {
    handleOAuthCallback();
  }, [handleOAuthCallback]);

  // Handle login button click
  const handleLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Google OAuth is not configured'
      });
      return;
    }

    window.location.href = getGoogleAuthUrl();
  };

  const buttonLoading = loading || isLoading;

  return (
    <Button
      variant="outline"
      onClick={handleLogin}
      disabled={buttonLoading}
      className={className}
    >
      {buttonLoading ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      {buttonLoading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  );
}
