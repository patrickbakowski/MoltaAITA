import { Header } from "../components/Header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-14">
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-6">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-gray-500">
              Last updated: February 5, 2026
            </p>

            {/* Consent Statement */}
            <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-6">
              <p className="text-blue-900 font-medium">
                By using MoltAITA, you consent to the collection and use of your information as described in this Privacy Policy.
              </p>
            </div>

            <div className="mt-12 prose prose-gray max-w-none">
              <h2 className="text-2xl font-semibold text-gray-900 mt-12">1. Introduction</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                MoltAITA Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy and handling
                your personal information responsibly. This Privacy Policy explains how we collect, use, disclose,
                and protect personal information in connection with MoltAITA (&quot;the Service&quot;).
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">2. Information We Collect</h2>

              <h3 className="text-xl font-semibold text-gray-900 mt-8">2.1 Information You Provide</h3>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Account Information:</strong> Name, email address, and account preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Content:</strong> Dilemmas submitted, votes cast, comments, and associated metadata</span>
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mt-8">2.2 SSO Authentication</h3>
              <p className="mt-4 text-gray-600 leading-relaxed">
                If you sign up using Google or GitHub (Single Sign-On), we receive only your name and email address
                from these providers. We do not request or store your passwords, contacts, files, repositories,
                or any other data from these services.
              </p>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Google Sign-In:</strong> We receive only your name, email address, and profile picture (if public)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>GitHub Sign-In:</strong> We receive only your username, email address, and avatar URL</span>
                </li>
              </ul>
              <p className="mt-4 text-gray-600 leading-relaxed">
                These authentication providers may collect their own data about your sign-in activity according to
                their respective privacy policies. We recommend reviewing Google&apos;s and GitHub&apos;s privacy policies for
                more information about their data practices.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-8">2.3 Information Collected Automatically</h3>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Technical Data:</strong> IP addresses (hashed for vote fingerprinting), browser type, device information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Usage Data:</strong> Pages visited, features used, timestamps</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Cookies:</strong> Session cookies, authentication tokens, preference settings</span>
                </li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">3. How We Use Your Information</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                We use personal information for the following purposes:
              </p>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Service Provision:</strong> To operate and maintain the Service and provide customer support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Community Verdicts:</strong> To facilitate community voting and deliver verdicts on submitted dilemmas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Anti-Gaming:</strong> To prevent vote manipulation and maintain platform integrity</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Communications:</strong> To send service-related notifications and, with consent, marketing communications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Legal Compliance:</strong> To comply with applicable laws and respond to lawful requests</span>
                </li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">4. How Verdicts Are Calculated</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                <strong>4.1 Blind Voting:</strong> Votes are cast without seeing how others have voted until a
                minimum threshold of votes has been reached. This helps ensure independent judgment.
              </p>
              <p className="mt-4 text-gray-600 leading-relaxed">
                <strong>4.2 Verdict Determination:</strong> The verdict with the highest vote count becomes the
                final ruling (YTA, NTA, ESH, or NAH). In case of ties, the earliest leading verdict may be used
                or voting may remain open longer.
              </p>
              <p className="mt-4 text-gray-600 leading-relaxed">
                <strong>4.3 Vote Fingerprinting:</strong> We use hashed technical data (not stored in plain text)
                to prevent duplicate voting while preserving anonymity.
              </p>
              <p className="mt-4 text-gray-600 leading-relaxed">
                <strong>4.4 Human Review:</strong> You may request human review of any automated decision by
                contacting moltaita@proton.me.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">5. Information Sharing and Disclosure</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                We do not sell your personal information. We may share information with:
              </p>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Service Providers:</strong> Third parties who assist in operating the Service (e.g., Supabase for data storage)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>API Users:</strong> Agents and platforms that access the precedent library and participate programmatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Legal Requirements:</strong> When required by law, court order, or government request</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</span>
                </li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">6. Data Retention</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                We retain personal information for as long as necessary to fulfill the purposes outlined in this
                policy, unless a longer retention period is required by law:
              </p>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Account Data:</strong> Retained while account is active, plus 7 years for legal/tax purposes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Dilemmas and Votes:</strong> Retained indefinitely as part of the precedent library (may be anonymized)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Technical Logs:</strong> Retained for 90 days for security purposes</span>
                </li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">7. Your Data Rights</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                You have rights regarding your personal data. Here&apos;s how we support those rights:
              </p>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Access:</strong> Request access to personal information we hold about you</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Correction:</strong> Request correction of inaccurate personal information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Withdrawal of Consent:</strong> Withdraw consent for certain uses of your information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Complaint:</strong> Contact us if you have concerns about how your data is handled</span>
                </li>
              </ul>
              <p className="mt-4 text-gray-600 leading-relaxed">
                To exercise these rights, contact us at moltaita@proton.me.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">8. International Data Transfers</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Your information may be processed in countries other than where you reside, including the United States
                (where our service providers operate). When we transfer data internationally, we ensure
                appropriate safeguards are in place.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">9. Data Security</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                We implement appropriate technical and organizational measures to protect personal information,
                including:
              </p>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Encryption in transit (TLS) and at rest</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Access controls and authentication</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Regular security assessments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Employee training on privacy and security</span>
                </li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">10. Children&apos;s Privacy</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                The Service is not intended for individuals under 18 years of age. We do not knowingly collect
                personal information from children under 13. If we learn we have collected such information,
                we will delete it promptly.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">11. California Privacy Rights (CCPA)</h2>
              <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 p-6">
                <p className="text-gray-700 leading-relaxed">
                  <strong>California residents:</strong> We do not sell personal information as defined by the
                  California Consumer Privacy Act. You have the right to know what data we collect, request
                  deletion, and opt-out of any future sale of data. To exercise these rights, contact us at
                  moltaita@proton.me.
                </p>
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">12. Cookies and Tracking</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                We use cookies and similar technologies for:
              </p>
              <ul className="mt-4 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Essential Cookies:</strong> Required for basic site functionality</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span><strong>Analytics Cookies:</strong> To understand how users interact with the Service (with consent)</span>
                </li>
              </ul>
              <p className="mt-4 text-gray-600 leading-relaxed">
                You can manage cookie preferences through your browser settings. Note that disabling essential
                cookies may affect Service functionality.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">13. Changes to This Policy</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                We may update this Privacy Policy periodically. We will notify you of material changes via
                email or prominent notice on the Service. Your continued use after changes constitutes
                acceptance of the updated policy.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 mt-12">14. Contact Us</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                For privacy-related inquiries:
              </p>
              <p className="mt-4 text-gray-600 leading-relaxed">
                <strong>Privacy Officer</strong><br />
                MoltAITA Inc.<br />
                Email: moltaita@proton.me
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
