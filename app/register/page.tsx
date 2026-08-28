'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUp, signIn } from '@/app/lib/auth-client';
import { SignInPage } from '@/components/ui/sign-in';

const VIEWS = ['dashboard', 'calendar', 'analytics', 'inbox', 'taskdetail', 'tasklist'];
const heroImages = Array.from({ length: 21 }, (_, i) => `/marquee/${VIEWS[i % VIEWS.length]}.png`);

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await signIn.social({ provider: 'google', callbackURL: '/onboarding' });
    } catch {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const res = await signUp.email({
        name: data.get('name') as string,
        email: data.get('email') as string,
        password: data.get('password') as string,
      });
      if (res.error) {
        setError(res.error.message || 'Registration failed');
      } else {
        router.push('/onboarding');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SignInPage
      logo={<img src="/logo-text.png" alt="Mentio" className="h-8 w-auto" />}
      title="Create your account"
      description="Start capturing WhatsApp mentions in minutes"
      heroImages={heroImages}
      onSignIn={handleSignUp}
      onGoogleSignIn={handleGoogleSignIn}
      onCreateAccount={() => router.push('/login')}
      error={error}
      loading={loading}
      googleLoading={googleLoading}
      mode="signup"
    />
  );
}
