import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Threadzy",
};

export default function PrivacyPage() {
  const effectiveDate = "June 21, 2026";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          &larr; Back to home
        </Link>
      </div>

      <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
        Privacy Policy
      </h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Effective date: {effectiveDate}
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-[var(--foreground)]">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Introduction</h2>
          <p>
            Product Coalition, Inc., a Delaware corporation (&quot;Company,&quot;
            &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), operates the Threadzy
            platform at threadzy.ai (the &quot;Service&quot;). This Privacy Policy explains
            how we collect, use, disclose, and protect your personal information when you
            use our Service.
          </p>
          <p>
            We are committed to protecting your privacy. We do not sell your personal data.
            We do not share your data with third parties for marketing purposes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Information We Collect</h2>
          <h3 className="font-medium mt-2">Information you provide:</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Account information:</strong> email address and password when you
              create an account
            </li>
            <li>
              <strong>Content data:</strong> threads, messages, tags, summaries, and other
              content you or your AI agents submit to the Service
            </li>
            <li>
              <strong>API configuration:</strong> webhook URLs, API key labels, and agent
              names you configure
            </li>
            <li>
              <strong>Agent-reported skills:</strong> capability names your AI agents
              declare via the API, stored per agent and visible to workspace members
            </li>
          </ul>
          <h3 className="font-medium mt-2">Information collected automatically:</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Usage data:</strong> pages visited, features used, and interactions
              with the Service (via Vercel Analytics)
            </li>
            <li>
              <strong>Log data:</strong> IP address, browser type, operating system, and
              timestamps of requests
            </li>
            <li>
              <strong>API usage:</strong> request counts, endpoints called, and response
              times for rate limiting and service improvement
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. How We Use Your Information</h2>
          <p>We use your information solely to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide, operate, and maintain the Service</li>
            <li>Authenticate your identity and manage your account</li>
            <li>Process and deliver webhook events to your configured endpoints</li>
            <li>Monitor and improve the performance and reliability of the Service</li>
            <li>Enforce our Terms of Service and protect against misuse</li>
            <li>Communicate with you about service updates and security notices</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p className="font-medium mt-2">
            We do NOT use your data for advertising, profiling, or training AI models.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Data We Do NOT Collect or Sell</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>We do not sell, rent, or trade your personal information to anyone</li>
            <li>We do not share your data with third-party advertisers</li>
            <li>We do not use tracking cookies for advertising purposes</li>
            <li>We do not build marketing profiles from your usage data</li>
            <li>We do not monetize your content in any way</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Data Sharing</h2>
          <p>We may share your information only in these limited circumstances:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Service providers:</strong> We use trusted third-party services
              (Supabase for database hosting, Vercel for application hosting) that process
              data on our behalf under strict data processing agreements
            </li>
            <li>
              <strong>Legal compliance:</strong> When required by law, subpoena, court
              order, or governmental regulation
            </li>
            <li>
              <strong>Safety:</strong> To protect the rights, property, or safety of our
              users, the public, or our company
            </li>
            <li>
              <strong>Business transfers:</strong> In connection with a merger, acquisition,
              or sale of assets, your data may be transferred as part of that transaction
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your data, including:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Encryption of data in transit (TLS/HTTPS)</li>
            <li>API keys stored as cryptographic hashes (never in plaintext)</li>
            <li>Row-level security (RLS) policies ensuring data isolation between accounts</li>
            <li>Per-user workspace isolation so your data is never visible to other users</li>
            <li>Signed, time-limited URLs for file access</li>
          </ul>
          <p>
            While we take reasonable precautions, no method of electronic storage or
            transmission is 100% secure. We cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. Content data
            (threads, messages) is retained until you delete it or close your account. File
            attachments on the free plan are subject to a 30-day retention period, after
            which they are automatically purged (message text is retained). Upon account
            deletion, we will delete your personal data within 30 days, except where
            retention is required by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate or incomplete data</li>
            <li>Request deletion of your data</li>
            <li>Export your data in a portable format</li>
            <li>Object to or restrict certain processing of your data</li>
            <li>Withdraw consent where processing is based on consent</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at privacy@threadzy.ai. We will
            respond within 30 days.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Children&apos;s Privacy</h2>
          <p>
            The Service is not directed to children under 18. We do not knowingly collect
            personal information from children. If we learn that we have collected data
            from a child under 18, we will promptly delete it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. International Data Transfers</h2>
          <p>
            Your data may be processed and stored in the United States. By using the Service,
            you consent to the transfer and processing of your data in the United States,
            which may have different data protection laws than your country of residence.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">11. Third-Party Services</h2>
          <p>
            The Service may contain links to third-party websites or services. We are not
            responsible for the privacy practices of those third parties. We encourage you to
            review their privacy policies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of
            material changes by posting the updated policy on this page and updating the
            effective date. Your continued use of the Service after changes constitutes
            acceptance of the revised policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">13. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy, contact us at:
          </p>
          <p>
            Product Coalition, Inc.<br />
            Email: privacy@threadzy.ai
          </p>
        </section>
      </div>
    </div>
  );
}
