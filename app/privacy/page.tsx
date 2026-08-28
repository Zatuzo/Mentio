import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Mentio',
  description: 'How Mentio collects, uses, and protects your data.',
};

const LAST_UPDATED = 'June 7, 2026';

export default function PrivacyPolicy() {
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

      <article className="max-w-3xl mx-auto px-6 py-16 prose-sm">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Overview</h2>
            <p>
              Mentio (&quot;we&quot;, &quot;our&quot;, &quot;the service&quot;) helps developers and small teams
              turn WhatsApp group mentions into organized tasks. This policy explains what data we collect,
              how we use it, and the controls you have over it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account data:</strong> your name and email address when you register or sign in (via email or Google).</li>
              <li><strong>WhatsApp messages:</strong> only messages in groups you connect, and only those that mention your watched number. We store the message text, sender name, and timestamp to create tasks.</li>
              <li><strong>Task data:</strong> tasks you create or that are generated from mentions, including titles, descriptions, dates, and status.</li>
              <li><strong>Google Calendar data:</strong> if you connect Google Calendar, we create, update, and delete calendar events that correspond to your Mentio tasks. See section 4.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To capture task requests from WhatsApp groups you monitor.</li>
              <li>To generate AI summaries and infer task priority from message content.</li>
              <li>To display your tasks on a dashboard and calendar.</li>
              <li>To sync tasks to your Google Calendar when you enable the integration.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Google User Data &amp; Limited Use</h2>
            <p>
              When you connect Google Calendar, Mentio requests access to the
              <code className="px-1 mx-1 rounded bg-muted text-xs">https://www.googleapis.com/auth/calendar</code>
              scope solely to create, update, and delete calendar events that mirror your Mentio tasks.
            </p>
            <p>
              Mentio&apos;s use and transfer of information received from Google APIs adheres to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Specifically:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>We only use Google Calendar data to provide the task-sync feature you explicitly enable.</li>
              <li>We do not transfer or sell Google user data to third parties.</li>
              <li>We do not use Google user data for advertising.</li>
              <li>We do not allow humans to read your Google data unless you give explicit consent, it is required for security, or required by law.</li>
              <li>You can disconnect Google Calendar at any time in Settings → Integrations, which deletes the stored access and refresh tokens.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Data Storage &amp; Security</h2>
            <p>
              We implement the following technical and organizational measures to protect your data:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Encryption in transit:</strong> All communication between your browser, our servers,
                and third-party APIs (Google, WhatsApp) is transmitted over TLS (HTTPS). Unencrypted
                connections are rejected.
              </li>
              <li>
                <strong>Encryption at rest:</strong> The database and all backups are encrypted at rest.
                OAuth access tokens and refresh tokens are additionally encrypted at the application
                level before being written to the database, using AES-256 encryption with keys stored
                separately from the data.
              </li>
              <li>
                <strong>Sensitive data minimization:</strong> We store only the minimum WhatsApp message
                content necessary to create a task (the mention message, sender name, and timestamp).
                Full chat history is never stored.
              </li>
              <li>
                <strong>Access control:</strong> Each user can only access their own data. All API
                endpoints enforce session-based authentication. Database access is restricted to
                application service accounts with least-privilege permissions.
              </li>
              <li>
                <strong>Token security:</strong> Google OAuth tokens are stored per-user in encrypted
                form and are immediately purged when you disconnect the integration. Tokens are never
                logged or included in error reports.
              </li>
              <li>
                <strong>Infrastructure security:</strong> Application servers run in an isolated
                environment with restricted inbound network access. Database ports are not exposed
                to the public internet.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Data Retention &amp; Deletion</h2>
            <p>
              You can delete tasks, disconnect integrations, or request full account deletion at any time.
              Disconnecting Google Calendar immediately removes the stored tokens. To delete your account
              and all associated data, contact us at the email below.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Third-Party Services</h2>
            <p>
              Mentio uses Google (authentication and Calendar), Anthropic/Claude (AI summaries), and
              WhatsApp connectivity via the Baileys library. Each processes data only as needed to provide
              their respective features.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
            <p>
              Questions about this policy or your data? Email{' '}
              <a href="mailto:resansaint@gmail.com" className="text-primary underline">resansaint@gmail.com</a>.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
