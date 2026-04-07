import { ChevronLeft } from 'lucide-react'

// Draft Privacy Policy for bnchmrkd. Tailored to actual data flows.
// NOT A SUBSTITUTE FOR LEGAL REVIEW — have a UAE-qualified tech/data lawyer
// review before public launch, especially sections on minors and data transfers.

export default function PrivacyPolicy({ onBack }) {
  return (
    <div className="min-h-screen bg-gray-950 text-slate-300 landing-font">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-white mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-500 mb-8">Last updated: 7 April 2026</p>

        <div className="space-y-6 text-[14px] leading-relaxed">
          <p className="text-slate-400 italic">
            This Privacy Policy explains how bnchmrkd. ("we", "us", "our") collects, uses, stores, and protects
            personal information of users of the bnchmrkd. platform (the "Service"), available at bnchmrkd.org.
            It is intended to comply with the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021,
            "PDPL") and, where applicable, other international frameworks including the EU General Data Protection
            Regulation (GDPR) and the US Children's Online Privacy Protection Act (COPPA).
          </p>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Who we are</h2>
            <p>
              bnchmrkd. is a sports analytics platform for track and field athletics, operated by [COMPANY NAME],
              a [JURISDICTION]-registered entity. For questions about this policy or your data, contact us at
              [CONTACT EMAIL].
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Information we collect</h2>
            <p className="mb-2">When you use the Service, we collect the following categories of personal information:</p>
            <p className="mb-2"><strong className="text-white">Account information:</strong> Email address, encrypted password (or Google OAuth identifier if you sign in with Google), and the date your account was created.</p>
            <p className="mb-2"><strong className="text-white">Profile information:</strong> Full name, gender, date of birth, country, city, club or school affiliation, and (for athlete accounts) height and weight. This information is provided voluntarily during onboarding.</p>
            <p className="mb-2"><strong className="text-white">Performance data:</strong> Race and competition results you enter manually, import from public World Athletics profiles, or upload via our AI Scanner feature. This may include dates, times, marks, competition names, wind readings, and implement weights.</p>
            <p className="mb-2"><strong className="text-white">Uploaded documents and images:</strong> If you use the AI Scanner, we temporarily process documents, PDFs, or images you upload to extract athlete results. These files are sent to our AI processing provider (see Section 6) and are not stored after processing completes.</p>
            <p className="mb-2"><strong className="text-white">Coach-athlete roster data:</strong> If you are a coach, any athletes you add to your roster (including names, dates of birth, and performance history scraped from public sources).</p>
            <p className="mb-2"><strong className="text-white">Usage analytics:</strong> Anonymous, aggregated page view data collected via Cloudflare Web Analytics. Cloudflare Web Analytics is cookieless and does not track individual users across sessions or websites.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. How we use your information</h2>
            <p className="mb-2">We use the information we collect to:</p>
            <p className="mb-1">— Create and maintain your account and provide the Service.</p>
            <p className="mb-1">— Generate performance analyses, trajectories, and benchmark comparisons.</p>
            <p className="mb-1">— Allow coaches to manage their athlete rosters and scan competition documents.</p>
            <p className="mb-1">— Improve the Service through aggregated usage analytics.</p>
            <p className="mb-1">— Communicate with you about service updates, security notices, and account-related matters.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Legal basis for processing</h2>
            <p>
              We process your personal data on the basis of your <strong className="text-white">consent</strong> (given
              when you create an account and accept this policy), the <strong className="text-white">performance of a contract</strong> (delivering
              the Service you signed up for), and our <strong className="text-white">legitimate interests</strong> in
              maintaining and improving the Service in ways that do not override your fundamental rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Minors (users under 18)</h2>
            <p className="mb-2">
              bnchmrkd. is not directed at children under 13, and we do not knowingly collect personal information from
              children under 13 without verifiable parental consent. If you are between 13 and 17, you may use the
              Service only with the involvement and consent of a parent or legal guardian.
            </p>
            <p className="mb-2">
              Coaches who add minors to their roster represent and warrant that they have the legal authority and
              parental/guardian consent to do so, and that they will not upload performance data for minors without
              appropriate authorisation.
            </p>
            <p>
              If you believe we have collected personal information from a child in violation of this policy, please
              contact us at [CONTACT EMAIL] and we will delete that information promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Third-party services we use</h2>
            <p className="mb-2">We share personal information with the following service providers strictly for the purpose of delivering the Service:</p>
            <p className="mb-2"><strong className="text-white">Supabase</strong> — database and authentication infrastructure. All user profile and performance data is stored in Supabase. Supabase processes data in the regions disclosed in its own privacy documentation.</p>
            <p className="mb-2"><strong className="text-white">Railway</strong> — application hosting for our backend services.</p>
            <p className="mb-2"><strong className="text-white">OpenAI</strong> — the AI Scanner feature sends the text and images you upload to OpenAI's API for extraction of athlete results. Per OpenAI's policy for API customers, these submissions are not used to train OpenAI's models. OpenAI is a US-based provider and your data may be transferred to, and processed in, the United States.</p>
            <p className="mb-2"><strong className="text-white">Cloudflare</strong> — DNS, CDN, and cookieless Web Analytics.</p>
            <p className="mb-2"><strong className="text-white">Google</strong> — if you choose to sign in with Google, Google handles authentication.</p>
            <p>
              We do not sell, rent, or otherwise share your personal information with third parties for their own
              marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Public data sources</h2>
            <p>
              bnchmrkd. retrieves athlete performance data from publicly accessible sources such as worldathletics.org
              when you provide an athlete profile URL. We only retrieve data that is already public and do so on your
              explicit instruction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. International data transfers</h2>
            <p>
              Because we rely on Supabase, Railway, OpenAI, and Cloudflare — providers that operate globally — your
              personal data may be transferred to and processed in jurisdictions outside the United Arab Emirates,
              including the United States and the European Union. We take reasonable measures to ensure that such
              transfers comply with applicable data protection laws, including the UAE PDPL.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. Data retention</h2>
            <p>
              We retain your personal information for as long as your account is active, or as necessary to provide
              the Service. If you delete your account, we will delete or anonymise your personal information within a
              reasonable period, except where retention is required for legal, accounting, or legitimate operational
              reasons. Uploaded AI Scanner files are deleted immediately after processing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">10. Your rights</h2>
            <p className="mb-2">Subject to applicable law, you have the right to:</p>
            <p className="mb-1">— Access the personal information we hold about you.</p>
            <p className="mb-1">— Request correction of inaccurate data.</p>
            <p className="mb-1">— Request deletion of your data ("right to erasure").</p>
            <p className="mb-1">— Object to or restrict certain types of processing.</p>
            <p className="mb-1">— Request a copy of your data in a portable format.</p>
            <p className="mb-1">— Withdraw your consent at any time.</p>
            <p className="mt-2">To exercise any of these rights, contact [CONTACT EMAIL]. We will respond within the timeframes required by applicable law.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">11. Cookies and local storage</h2>
            <p>
              bnchmrkd. does not use advertising or tracking cookies. We use browser local storage to maintain your
              authentication session after login (this is a requirement of our authentication provider, Supabase). Our
              analytics provider, Cloudflare Web Analytics, is cookieless.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">12. Security</h2>
            <p>
              We implement reasonable technical and organisational measures to protect your personal information,
              including encryption in transit (HTTPS), authenticated API access, and access controls on our database.
              However, no method of transmission over the internet or electronic storage is completely secure, and we
              cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">13. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date
              at the top of this page. If changes are material, we will notify you by email or through the Service
              before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">14. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your data, contact us at [CONTACT EMAIL].
            </p>
          </section>

          <p className="text-[11px] text-slate-600 italic mt-10 pt-6 border-t border-slate-800">
            This document is a draft. It should be reviewed by a qualified legal professional before the Service is
            offered publicly, particularly with regard to UAE PDPL specifics, cross-border data transfer mechanisms,
            and the processing of personal data of minors.
          </p>
        </div>
      </div>
    </div>
  )
}
