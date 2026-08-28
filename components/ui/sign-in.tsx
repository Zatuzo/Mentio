'use client';
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import ThreeDMarquee from '@/components/ui/3d-marquee';
import { Spinner } from '@/src/components/kibo-ui/spinner';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

// --- TYPE DEFINITIONS ---

interface SignInPageProps {
  logo?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImages?: string[];
  heroTitle?: string;
  heroSubtitle?: string;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
  error?: string;
  loading?: boolean;
  googleLoading?: boolean;
  mode?: 'signin' | 'signup';
}

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card/60 transition-colors focus-within:border-foreground/40 focus-within:bg-card">
    {children}
  </div>
);

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  logo,
  title = <span className="font-light tracking-tighter">Welcome back</span>,
  description = 'Enter your credentials to continue',
  heroImages,
  heroTitle = 'Setiap mention, jadi tugas.',
  heroSubtitle = 'Mentio menangkap setiap mention WhatsApp dari grup kamu dan mengubahnya jadi task yang rapi.',
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
  error,
  loading,
  googleLoading,
  mode = 'signin',
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw]">
      {/* Left — form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-6">
            <div>
              {logo && (
                <div className="animate-element animate-delay-50 mb-5">{logo}</div>
              )}
              <h1 className="animate-element animate-delay-100 text-2xl font-semibold leading-tight tracking-tight">
                {title}
              </h1>
              <p className="animate-element animate-delay-200 text-muted-foreground text-sm mt-1.5">
                {description}
              </p>
            </div>

            {error && (
              <div className="animate-element animate-delay-200 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={onSignIn}>
              {mode === 'signup' && (
                <div className="animate-element animate-delay-250">
                  <label className="text-sm font-medium mb-1.5 block">Name</label>
                  <GlassInputWrapper>
                    <input
                      name="name"
                      type="text"
                      placeholder="Your name"
                      autoComplete="name"
                      autoFocus
                      className="w-full bg-transparent text-sm px-3 py-2.5 rounded-xl focus:outline-none"
                    />
                  </GlassInputWrapper>
                </div>
              )}

              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <GlassInputWrapper>
                  <input
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus={mode === 'signin'}
                    className="w-full bg-transparent text-sm px-3 py-2.5 rounded-xl focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium mb-1.5 block">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      minLength={mode === 'signup' ? 8 : undefined}
                      className="w-full bg-transparent text-sm px-3 py-2.5 pr-10 rounded-xl focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showPassword
                        ? <EyeOff className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                        : <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                      }
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              {mode === 'signin' && (
                <div className="animate-element animate-delay-450 flex justify-end text-sm">
                  <button
                    type="button"
                    onClick={onResetPassword}
                    className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="animate-element animate-delay-500 w-full rounded-xl bg-foreground py-2.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Spinner variant="circle-filled" className="h-4 w-4 text-background" />}
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            {onGoogleSignIn && (
              <>
                <div className="animate-element animate-delay-550 relative flex items-center">
                  <span className="flex-1 border-t border-border" />
                  <span className="px-3 text-xs text-muted-foreground">or</span>
                  <span className="flex-1 border-t border-border" />
                </div>
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={googleLoading}
                  className="animate-element animate-delay-600 w-full flex items-center justify-center gap-2.5 border border-border rounded-xl py-2.5 text-sm hover:bg-card transition-colors disabled:opacity-60"
                >
                  {googleLoading
                    ? <Spinner variant="circle-filled" className="h-4 w-4" />
                    : <GoogleIcon />
                  }
                  Continue with Google
                </button>
              </>
            )}

            <p className="animate-element animate-delay-700 text-center text-sm text-muted-foreground">
              {mode === 'signin' ? "No account? " : "Already have an account? "}
              <button
                type="button"
                onClick={onCreateAccount}
                className="text-foreground font-medium hover:underline underline-offset-4 transition-colors"
              >
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Right — hero (3D marquee of product screenshots) */}
      {heroImages && heroImages.length > 0 && (
        <section className="hidden md:block flex-1 relative p-4">
          <div className="animate-slide-right animate-delay-200 absolute inset-4 rounded-2xl overflow-hidden border border-border bg-card">
            <ThreeDMarquee
              images={heroImages}
              className="h-full max-xl:h-full max-sm:h-full rounded-none"
            />
            {/* Brand-colored fade so the rotated grid melts into the panel */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/10 to-background/40" />
            {/* Tagline */}
            <div className="absolute inset-x-0 bottom-0 p-8">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {heroTitle}
              </h2>
              <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                {heroSubtitle}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
