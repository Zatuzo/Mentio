'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CheckCircle2, FolderKanban, Hash, Phone, Loader2 } from 'lucide-react';

const BOT_PHONE = process.env.NEXT_PUBLIC_BOT_PHONE || '6285198629192';
const BOT_DISPLAY = BOT_PHONE.replace(/^62/, '+62 ').replace(/(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');

const STEPS = [
  { id: 1, label: 'Create project', icon: FolderKanban },
  { id: 2, label: 'Add bot to group', icon: Phone },
  { id: 3, label: 'Claim group', icon: Hash },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);

  // If user already has a project, skip step 1
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setStep(2);
        }
      })
      .catch(() => {});
  }, []);

  const createProject = async () => {
    if (!projectName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create project');
      }
      setStep(2);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-start justify-center pt-16">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div>
          <img src="/logo-text.png" alt="Mentio" className="h-8 w-auto mb-2" />
          <h1 className="text-2xl font-bold tracking-tight">Let's get you set up</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up in 3 steps — takes about 2 minutes.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    done ? 'bg-emerald-500/20 text-emerald-400' :
                    active ? 'bg-foreground text-background' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 transition-colors ${done ? 'bg-emerald-500/40' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="border border-border rounded-lg bg-card/40 p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-base">Name your project</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  A project groups your tasks. You can create more later.
                </p>
              </div>
              <Input
                autoFocus
                placeholder="e.g. Work, Freelance, Personal"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createProject()}
              />
              <Button
                className="w-full"
                disabled={!projectName.trim() || loading}
                onClick={createProject}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create project
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold text-base">Add Mentio bot to your WhatsApp group</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Add this number to the WhatsApp group you want to monitor.
                </p>
              </div>
              <div className="flex items-center gap-3 bg-muted/30 border border-border rounded-md px-4 py-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-mono font-semibold tracking-wide">{BOT_DISPLAY}</span>
                <button
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { navigator.clipboard.writeText(BOT_PHONE); toast.success('Copied'); }}
                >
                  Copy
                </button>
              </div>
              <div className="text-sm text-muted-foreground space-y-1.5">
                <p>1. Open WhatsApp and go to your group</p>
                <p>2. Add the number above as a participant</p>
                <p>3. Once added, continue to the next step</p>
              </div>
              <Button className="w-full" onClick={() => setStep(3)}>
                I've added the bot
              </Button>
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setStep(3)}
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold text-base">Claim your WhatsApp group</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate a claim code and post it in your group so Mentio can link it to your account.
                </p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>1. Go to <strong className="text-foreground">Settings / WhatsApp</strong></p>
                <p>2. Under <strong className="text-foreground">Monitored Groups</strong>, click <strong className="text-foreground">Generate claim code</strong></p>
                <p>3. Copy the code and post it as a message in your group</p>
                <p>4. Mentio will automatically link the group to your account</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push('/settings/whatsapp')}
                >
                  Go to settings
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => router.push('/dashboard')}
                >
                  Go to dashboard
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Skip */}
        {step === 1 && (
          <div className="text-center">
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => router.push('/dashboard')}
            >
              Skip setup and go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
