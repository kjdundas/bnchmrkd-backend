import { ChevronLeft } from 'lucide-react'

// Draft Terms of Service for bnchmrkd.
// NOT A SUBSTITUTE FOR LEGAL REVIEW — have a UAE-qualified lawyer review
// before public launch, particularly disclaimers, liability limits, and
// governing law provisions.

export default function TermsOfService({ onBack }) {
  return (
    <div className="min-h-screen bg-gray-950 text-slate-300 landing-font">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-white mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-xs text-slate-500 mb-8">Last updated: 7 April 2026</p>

        <div className="space-y-6 text-[14px] leading-relaxed">
          <p className="text-slate-400 italic">
            These Terms of Service ("Terms") govern your access to and use of bnchmrkd., a sports analytics platform
            for track and field athletics (the "Service"), operated by [COMPANY NAME] ("we", "us", "our"). By creating
            an account or otherwise using the Service, you agree to be bound by these Terms. If you do not agree, do
            not use the Service.
          </p>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Description of the Service</h2>
            <p>
              bnchmrkd. provides tools for athletes, coaches, and analysts to track, visualise, and compare track and
              field performance data, including features for importing data from public sources, managing athlete
              rosters, and using AI-assisted extraction of results from documents. The Service is currently in a beta
              stage of development and is offered on an "as is" basis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Eligibility</h2>
            <p className="mb-2">
              You must be at least 18 years old to create an account independently. If you are between 13 and 17, you
              may use the Service only with the verifiable consent and supervision of a parent or legal guardian, who
              must accept these Terms on your behalf. Users under 13 are not permitted to create accounts.
            </p>
            <p>
              By creating an account you represent that all information you provide is accurate, that you have the
              legal capacity to enter into these Terms, and that your use of the Service will not violate any
              applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Account responsibilities</h2>
            <p className="mb-2">
              You are responsible for maintaining the confidentiality of your login credentials and for all activity
              that occurs under your account. You agree to notify us promptly at [CONTACT EMAIL] if you suspect
              unauthorised access to your account.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms, misuse the Service, or
              pose a risk to other users or the integrity of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Acceptable use</h2>
            <p className="mb-2">When using the Service, you agree not to:</p>
            <p className="mb-1">— Upload content you do not have the legal right to share, including copyrighted material or competition documents you are not authorised to distribute.</p>
            <p className="mb-1">— Upload content that is unlawful, defamatory, harassing, or infringes the rights of others.</p>
            <p className="mb-1">— Use the Service to harvest, scrape, or otherwise extract data about other users without their consent.</p>
            <p className="mb-1">— Attempt to reverse-engineer, disassemble, or interfere with the security of the Service.</p>
            <p className="mb-1">— Use the Service to impersonate another person, including another athlete or coach.</p>
            <p className="mb-1">— Upload or store personal data of minors without the required parental or guardian consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Coach accounts and athlete rosters</h2>
            <p>
              If you use a coach account, you are responsible for ensuring that you have the authority to add each
              athlete to your roster and to process their performance data on our platform. You represent that,
              for any athlete under 18, you have obtained parental or guardian consent to upload, store, and analyse
              their personal and performance information via the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. AI Scanner and automated analysis</h2>
            <p className="mb-2">
              The Service includes features that use artificial intelligence to extract structured information from
              unstructured documents and to generate performance analyses. You acknowledge and accept that:
            </p>
            <p className="mb-1">— AI outputs may contain errors, omissions, or misattributions, and must be reviewed by you before being treated as accurate.</p>
            <p className="mb-1">— The AI Scanner transmits the content you upload to our third-party AI provider (OpenAI) for processing, as described in our Privacy Policy.</p>
            <p className="mb-1">— You must not upload confidential, medical, legal, or financial documents to the AI Scanner.</p>
            <p className="mb-1">— Performance analyses and benchmark comparisons are informational only and are <strong className="text-white">not</strong> medical, coaching, training, or professional advice. They should not be used as a substitute for qualified human judgment.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Content ownership</h2>
            <p className="mb-2">
              You retain ownership of any content you upload to the Service, including your profile, race results,
              documents, and rosters ("User Content"). By uploading User Content, you grant us a limited, worldwide,
              non-exclusive, royalty-free licence to store, process, display, and transmit it strictly for the purpose
              of operating and providing the Service to you.
            </p>
            <p>
              All other aspects of the Service, including its design, code, logos, database schema, and the aggregated
              elite performance datasets we compile, are the intellectual property of [COMPANY NAME] and are protected
              by applicable intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. Third-party data</h2>
            <p>
              Portions of the Service retrieve data from publicly accessible third-party sources, such as
              worldathletics.org. We do not claim ownership of such data, and we make no representations about its
              accuracy, completeness, or currency. Your use of such data is subject to the terms of the originating
              source.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. Disclaimers</h2>
            <p className="mb-2">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, ACCURACY, OR NON-INFRINGEMENT.
            </p>
            <p className="mb-2">
              We do not warrant that the Service will be uninterrupted, error-free, or secure, or that any information
              provided will be accurate or reliable. You use the Service at your own risk.
            </p>
            <p>
              Nothing in the Service constitutes medical, sports-medicine, coaching, nutritional, or professional
              advice. Always consult a qualified professional before making training or health decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">10. Limitation of liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL [COMPANY NAME], ITS OFFICERS,
              EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF, OR
              INABILITY TO USE, THE SERVICE. OUR AGGREGATE LIABILITY TO YOU FOR ANY CLAIM RELATED TO THE SERVICE SHALL
              NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU HAVE PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM, OR
              (B) ONE HUNDRED AED.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">11. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless [COMPANY NAME] from any claims, damages, liabilities, or
              expenses (including reasonable legal fees) arising from your violation of these Terms, your misuse of
              the Service, or your infringement of any third-party right.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">12. Termination</h2>
            <p>
              You may terminate your account at any time by contacting us at [CONTACT EMAIL] or using an in-app delete
              function if provided. We may suspend or terminate your access to the Service at any time, with or
              without notice, if we believe you have violated these Terms or applicable law, or if continuing to
              provide the Service becomes commercially or legally impractical.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">13. Changes to the Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated via the Service or
              by email at least 14 days before they take effect. Continued use of the Service after the effective
              date constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">14. Governing law and dispute resolution</h2>
            <p>
              These Terms are governed by the laws of the United Arab Emirates, without regard to its conflict-of-law
              provisions. You agree that any dispute arising out of or relating to these Terms or the Service will be
              subject to the exclusive jurisdiction of the competent courts of Dubai, UAE, unless a different
              jurisdiction is mandatorily required by applicable consumer protection law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">15. Contact</h2>
            <p>
              Questions about these Terms should be directed to [CONTACT EMAIL].
            </p>
          </section>

          <p className="text-[11px] text-slate-600 italic mt-10 pt-6 border-t border-slate-800">
            This document is a draft. It should be reviewed by a qualified legal professional before the Service is
            offered publicly, particularly with regard to UAE-specific contract, consumer protection, and data
            protection requirements, as well as the enforceability of the limitation of liability and indemnification
            clauses in your target jurisdictions.
          </p>
        </div>
      </div>
    </div>
  )
}
