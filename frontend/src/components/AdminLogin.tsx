import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Shield, Loader2 } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface AdminLoginProps {
  onSuccess?: () => void;
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { setApiKey, checkAdminStatus } = useAuth();
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!key.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter an API key',
      });
      return;
    }

    setLoading(true);

    try {
      // Check if the key is valid by verifying admin status
      const isAdmin = await checkAdminStatus(key);

      if (isAdmin) {
        await setApiKey(key);
        toast({
          title: 'Success',
          description: 'Logged in successfully with admin privileges',
        });
        onSuccess?.();
      } else {
        // Try to use the key anyway (might be read-only)
        await setApiKey(key);
        toast({
          title: 'Logged In',
          description: 'API key verified (read-only access)',
        });
        onSuccess?.();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Invalid API key',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Admin Login</CardTitle>
          <CardDescription className="text-center">
            Enter your API key to access admin features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="api-key" className="text-sm font-medium">
              API Key
            </label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your API key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleLogin()}
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleLogin}
            className="w-full"
            disabled={loading || !key.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Login'
            )}
          </Button>

          <div className="text-xs text-muted-foreground text-center">
            <p>Don't have an API key?</p>
            <p className="mt-1">Contact your administrator or use the CLI:</p>
            <code className="mt-2 block bg-muted p-2 rounded">
              wrangler secret put API_KEY
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
