'use client';
import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from '@/app/lib/auth-client';
import { SignInPage } from '@/components/ui/sign-in';

const VIEWS = ['dashboard', 'calendar', 'analytics', 'inbox', 'taskdetail', 'tasklist'];
const heroImages = Array.from({ length: 21 }, (_, i) => `/marquee/${VIEWS[i % VIEWS.length]}.png`);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();

  // Redirect to dashboard if already authenticated (handles stale cookie + valid session)
  useEffect(() => {
    if (!isPending && session) {
      router.replace(searchParams.get('next') || '/dashboard');
    }
  }, [session, isPending, router, searchParams]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const res = await signIn.email({
        email: data.get('email') as string,
        password: data.get('password') as string,
      });
      if (res.error) {
        setError(res.error.message || 'Invalid email or password');
      } else {
        router.push(searchParams.get('next') || '/dashboard');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: searchParams.get('next') || '/dashboard',
      });
    } catch {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  }

  return (
    <SignInPage
      logo={<img src="/logo-text.png" alt="Mentio" className="h-8 w-auto" />}
      title="Welcome back"
      description="Sign in to your account"
      heroImages={heroImages}
      onSignIn={handleSignIn}
      onGoogleSignIn={handleGoogleSignIn}
      onCreateAccount={() => router.push('/register')}
      error={error}
      loading={loading}
      googleLoading={googleLoading}
      mode="signin"
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
