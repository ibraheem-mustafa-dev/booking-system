'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Authentication failed. Please try again.',
  missing_code: 'Invalid sign-in link. Please request a new one.',
  access_denied: 'Access denied. Please try again.',
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast.error(ERROR_MESSAGES[error] || 'Something went wrong. Please try again.');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const redirectTo = searchParams.get('redirect') || '/dashboard';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to send magic link. Please try again.');
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-2xl shadow-black/40">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/20">
          <Zap className="size-6 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Check your email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Magic link sent to <strong className="text-foreground">{email}</strong>.
          <br />Click it to sign in.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-6 w-full text-muted-foreground"
          onClick={() => {
            setSent(false);
            setEmail('');
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-2xl shadow-black/40">
      {/* Logo / brand mark */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-primary">
          <Zap className="size-5 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Small Giants Studio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email to sign in.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="border-border/60 bg-input/30 focus-visible:border-primary focus-visible:ring-primary/30"
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading || !email}
        >
          {loading ? (
            <span className="loading-dots" aria-label="Sending"><span /><span /><span /></span>
          ) : (
            'Send magic link'
          )}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
