import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Mentio',
  description: 'The terms governing your use of Mentio.',
};

const LAST_UPDATED = 'May 30, 2026';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/"><img src="/logo-text.png" alt="Mentio" className="h-7 w-auto" /></Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to home
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Mentio, you agree to these Terms of Service. If you do not agree,
              do not use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p>
              Mentio monitors WhatsApp groups you connect, captures messages that mention your watched
              number, turns them into tasks, and optionally syncs those tasks to Google Calendar.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Your Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You are responsible for the accuracy of data you provide and the groups you connect.</li>
              <li>You must have the right to monitor any WhatsApp group you connect to Mentio.</li>
              <li>You must not use Mentio for spam, harassment, or any unlawful purpose.</li>
              <li>You are responsible for keeping your account credentials secure.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. WhatsApp Connectivity</h2>
            <p>
              Mentio connects to WhatsApp through an unofficial library for read-only monitoring.
              WhatsApp is a trademark of Meta and Mentio is not affiliated with or endorsed by Meta.
              Use of WhatsApp connectivity is at your own risk and subject to WhatsApp&apos;s own terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Third-Party Integrations</h2>
            <p>
              Google Calendar integration is optional and governed by Google&apos;s terms in addition to
              these. You may disconnect it at any time in Settings → Integrations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Service Availability</h2>
            <p>
              Mentio is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
              uninterrupted availability and may modify or discontinue features at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Mentio is not liable for any indirect, incidental,
              or consequential damages arising from your use of the service, including missed tasks or
              data loss.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Changes to These Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of Mentio after changes
              constitutes acceptance of the revised terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
            <p>
              Questions about these terms? Email{' '}
              <a href="mailto:resansaint@gmail.com" className="text-primary underline">resansaint@gmail.com</a>.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
