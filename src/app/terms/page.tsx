import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Threadzy",
};

export default function TermsPage() {
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
        Terms of Service
      </h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Effective date: {effectiveDate}
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-[var(--foreground)]">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Agreement to Terms</h2>
          <p>
            These Terms of Service (&quot;Terms&quot;) are a legally binding agreement between
            you (&quot;you&quot; or &quot;User&quot;) and Product Coalition, Inc., a Delaware
            corporation (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
            governing your access to and use of the Threadzy platform, website at threadzy.ai,
            APIs, and related services (collectively, the &quot;Service&quot;).
          </p>
          <p>
            By creating an account or using the Service, you agree to be bound by these Terms.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Eligibility</h2>
          <p>
            You must be at least 18 years old and capable of forming a binding contract to use
            the Service. By using the Service, you represent and warrant that you meet these
            requirements. If you are using the Service on behalf of an organization, you
            represent that you have authority to bind that organization to these Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Account Registration</h2>
          <p>
            To access certain features, you must create an account. You agree to provide
            accurate, current, and complete information and to keep your account credentials
            secure. You are responsible for all activity that occurs under your account. You
            must notify us immediately of any unauthorized use of your account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Description of Service</h2>
          <p>
            Threadzy provides a working memory platform for AI agents, enabling persistent
            thread-based context management via REST API, MCP, and webhooks. The Service
            allows users and their AI agents to create, manage, and query structured threads
            of information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Use the Service for any unlawful purpose or in violation of any applicable law</li>
            <li>Attempt to gain unauthorized access to the Service or its related systems</li>
            <li>Interfere with or disrupt the integrity or performance of the Service</li>
            <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
            <li>Use the Service to transmit malicious code, spam, or harmful content</li>
            <li>Exceed any rate limits or usage quotas imposed by the Service</li>
            <li>Resell or redistribute access to the Service without prior written consent</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Your Content</h2>
          <p>
            You retain ownership of all data, threads, messages, and other content you submit
            to the Service (&quot;Your Content&quot;). By using the Service, you grant us a
            limited, non-exclusive license to store, process, and transmit Your Content solely
            to operate and provide the Service. We do not claim ownership of Your Content and
            will not use it for any purpose other than providing the Service to you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. API Keys and Security</h2>
          <p>
            API keys are confidential credentials that authenticate your agents to the
            Service. You are solely responsible for safeguarding your API keys and for all
            activity conducted through them. Do not share API keys in public repositories,
            client-side code, or with unauthorized parties. We may revoke API keys that we
            reasonably believe have been compromised.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Agent-Reported Capabilities</h2>
          <p>
            Agents connected to the Service may self-report their capabilities
            (&quot;Skills&quot;) via the API. These skill declarations are provided by the
            agent and stored as-is. Product Coalition, Inc. makes no warranty regarding the
            accuracy, completeness, or reliability of agent-reported skills. You are
            responsible for verifying that your agents perform as declared.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Service Availability</h2>
          <p>
            We strive to maintain high availability but do not guarantee uninterrupted access.
            The Service may be temporarily unavailable due to maintenance, updates, or
            circumstances beyond our control. We are not liable for any downtime or service
            interruptions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Fees and Payment</h2>
          <p>
            The Service currently offers a free tier. If we introduce paid plans in the future,
            we will notify you in advance and provide clear pricing information. Continued use
            of paid features after notice constitutes acceptance of the applicable fees.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">11. Termination</h2>
          <p>
            You may delete your account at any time. We may suspend or terminate your access
            to the Service if you violate these Terms or for any reason with reasonable notice.
            Upon termination, your right to use the Service ceases immediately. We may delete
            Your Content within a reasonable period following termination.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">12. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE ERROR-FREE,
            SECURE, OR AVAILABLE AT ALL TIMES.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">13. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PRODUCT COALITION, INC.
            SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT
            OF OR RELATED TO YOUR USE OF THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY.
            OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE GREATER OF $100 OR THE AMOUNT
            YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">14. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Product Coalition, Inc. and its officers,
            directors, employees, and agents from any claims, damages, losses, or expenses
            (including reasonable attorneys&apos; fees) arising from your use of the Service,
            your violation of these Terms, or your violation of any rights of a third party.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">15. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of the
            State of Delaware, United States, without regard to its conflict of law provisions.
            Any legal action arising under these Terms shall be brought exclusively in the
            state or federal courts located in Delaware, and you consent to the personal
            jurisdiction of such courts.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">16. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material
            changes by posting the updated Terms on this page and updating the effective date.
            Your continued use of the Service after changes constitutes acceptance of the
            revised Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">17. Contact</h2>
          <p>
            If you have questions about these Terms, contact us at:
          </p>
          <p>
            Product Coalition, Inc.<br />
            Email: legal@threadzy.ai
          </p>
        </section>
      </div>
    </div>
  );
}
