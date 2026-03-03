import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <div className="min-h-screen w-full bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-6 md:px-12 lg:px-20 border-b">
        <Link to="/" className="text-secondary font-serif text-2xl md:text-3xl tracking-wide hover:opacity-80">
          <img
            src="/apple-touch-icon.png"
            alt="Amooti Logo"
            className="h-8 w-8"
          />
        </Link>
        <div className="flex items-center gap-4 md:gap-8 text-sm md:text-base font-medium">
          <Link to="/about" className="text-secondary hover:opacity-80">
            About
          </Link>
          <Link to="/pricing" className="text-secondary hover:opacity-80">
            Pricing
          </Link>
          <Link to="/subjects" className="text-secondary hover:opacity-80">
            Subjects
          </Link>
          <Link
            to="/login/student"
            className="text-secondary hover:opacity-80"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="px-6 py-12 md:px-12 lg:px-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif tracking-wide mb-8 text-secondary">
            Privacy Policy
          </h1>
          <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                1. Information We Collect
              </h2>
              <p>
                We collect information you provide directly to us, such as when
                you create an account, subscribe to a plan, or contact us for
                support.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                2. How We Use Your Information
              </h2>
              <p>
                We use the information we collect to provide, maintain, and
                improve our services, process transactions, and send you
                technical notices and support messages.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                3. Information Sharing
              </h2>
              <p>
                We do not share your personal information with third parties
                except as necessary to provide our services or as required by
                law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                4. Data Security
              </h2>
              <p>
                We implement appropriate technical and organizational measures
                to protect your personal information against unauthorized
                access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                5. Your Rights
              </h2>
              <p>
                You have the right to access, update, or delete your personal
                information at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                6. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by posting the new policy on our
                website.
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50 px-6 py-8 md:px-12 lg:px-20 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-gray-600 text-sm">© 2026 Amooti. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <Link to="/terms" className="text-secondary hover:opacity-80">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-secondary hover:opacity-80">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
