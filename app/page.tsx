import Link from 'next/link';
import { MessageSquare, Kanban, Sparkles, Bell, ArrowRight, CheckCircle2, Zap, GitBranch } from 'lucide-react';

export const metadata = {
  title: 'Mentio — Turn WhatsApp mentions into tasks',
  description: 'Mentio listens to your WhatsApp groups, captures every task request, and organizes them on a kanban board. Stay in code, not in chat.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <img src="/logo-text.png" alt="Mentio" className="h-7 w-auto" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-foreground text-background px-3 py-1.5 rounded-md font-medium hover:bg-foreground/90 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1 mb-6">
            Built for freelance devs & small dev teams
          </div>
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-5">
            WhatsApp mentions become tasks.{' '}
            <span className="text-muted-foreground">Automatically.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
            Mentio monitors your group chats, captures every task request, and organizes them on a kanban board — so you stay in code instead of scrolling WA.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-md font-medium text-sm hover:bg-foreground/90 transition-colors"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </section>

      {/* Product mockup */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="rounded-xl border border-border bg-card/30 overflow-hidden shadow-2xl">
          {/* Fake browser chrome */}
          <div className="border-b border-border/50 bg-card/50 px-4 py-2.5 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-muted" />
              <div className="w-3 h-3 rounded-full bg-muted" />
              <div className="w-3 h-3 rounded-full bg-muted" />
            </div>
            <div className="flex-1 bg-muted/40 rounded-md h-5 mx-4 max-w-xs text-xs text-muted-foreground flex items-center px-3">
              mentio.space/dashboard
            </div>
          </div>
          {/* Kanban mockup */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">My Project</h3>
              <div className="flex gap-2">
                {['All', 'Overdue', 'Today', 'This week'].map((f) => (
                  <span key={f} className={`text-xs px-2.5 py-1 rounded-md border ${f === 'All' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground'}`}>{f}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  col: 'To Do', count: 3, color: 'text-muted-foreground',
                  tasks: [
                    { title: 'Fix login bug on mobile', group: 'Dev Team', priority: 'bg-red-500', requester: 'Budi' },
                    { title: 'Update API docs', group: 'Dev Team', priority: 'bg-orange-400', requester: 'Sari' },
                    { title: 'Review PR #42', group: 'Freelance', priority: 'bg-yellow-400', requester: 'Andi' },
                  ]
                },
                {
                  col: 'In Progress', count: 1, color: 'text-primary',
                  tasks: [
                    { title: 'Dark mode feature', group: 'Dev Team', priority: 'bg-blue-400', requester: 'You' },
                  ]
                },
                {
                  col: 'Done', count: 4, color: 'text-emerald-400',
                  tasks: [
                    { title: 'Setup CI/CD pipeline', group: 'Dev Team', priority: 'bg-muted-foreground/30', requester: 'Reza' },
                    { title: 'Fix 404 on /profile', group: 'Freelance', priority: 'bg-muted-foreground/30', requester: 'Client' },
                  ]
                },
              ].map((col) => (
                <div key={col.col} className="bg-card/40 border border-border/50 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
                    <span className="text-xs font-semibold">{col.col}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{col.count}</span>
                  </div>
                  <div className="p-2 space-y-2">
                    {col.tasks.map((task) => (
                      <div key={task.title} className="bg-card border border-border rounded-md p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.priority}`} />
                          <span className="text-xs text-muted-foreground bg-muted/50 border border-border px-1.5 py-0.5 rounded">{task.group}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{task.requester}</span>
                        </div>
                        <p className="text-xs font-medium leading-snug">{task.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border/50 bg-card/20">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Sound familiar?</p>
          <h2 className="text-3xl font-bold tracking-tight mb-10">Every dev team has this problem</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: MessageSquare, title: 'Buried in notifications', desc: 'Clients and teammates tag you in group chats. Finding what needs action means scrolling through 200 messages.' },
              { icon: Zap, title: 'Context switching kills flow', desc: 'Every time you open WhatsApp to check a task, you lose 20 minutes re-entering your code mental model.' },
              { icon: Bell, title: 'Tasks fall through the cracks', desc: 'Important requests get lost in chat history. Two weeks later someone asks why it was never done.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">How it works</p>
        <h2 className="text-3xl font-bold tracking-tight mb-14">Setup in 3 steps, works forever after</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Add Mentio to your group', desc: 'Invite the Mentio bot number to any WhatsApp group you want to monitor. That\'s it for setup.' },
            { step: '02', title: 'Get mentioned, task created', desc: 'Every time someone tags you or your watched number, Mentio captures the message and creates a task with AI-inferred priority.' },
            { step: '03', title: 'Work from your board', desc: 'Open Mentio\'s dashboard to see all tasks across all groups. Drag to update status, add due dates, generate coding prompts.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="space-y-3">
              <span className="text-4xl font-bold text-muted-foreground/20 font-mono">{step}</span>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border/50 bg-card/20">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Features</p>
          <h2 className="text-3xl font-bold tracking-tight mb-14">Built for the way developers actually work</h2>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            {[
              { icon: Sparkles, title: 'AI priority inference', desc: 'Mentio reads the urgency from message tone. "ASAP fix this bug" becomes urgent. "Whenever you\'re free" becomes low.' },
              { icon: Kanban, title: 'Kanban + list view', desc: 'Switch between a visual board and a dense list view. Both support group filters and due date filters.' },
              { icon: GitBranch, title: 'Generate coding prompts', desc: 'One click to generate a structured prompt for Claude or Cursor, pre-filled with task context and your codebase setup.' },
              { icon: MessageSquare, title: 'Unified inbox', desc: 'See all mentions from all groups in one feed. Create tasks or dismiss directly from the inbox without switching apps.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-4">
          Stop letting task requests get lost in chat
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Join developers who use Mentio to stay focused. Free to get started — no credit card required.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-md font-medium hover:bg-foreground/90 transition-colors"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground flex-wrap">
          {['Free to start', 'No credit card', 'Setup in 5 minutes'].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-muted-foreground">
          <img src="/logo-text.png" alt="Mentio" className="h-6 w-auto" />
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
