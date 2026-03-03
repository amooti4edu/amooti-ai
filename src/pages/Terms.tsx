import { Link } from "react-router-dom";

const Terms = () => {
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
            Terms of Service
          </h1>
          <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                1. Acceptance of Terms
              </h2>
              <p>
                By using Amooti, you agree to these Terms of Service and all
                applicable laws and regulations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                2. Use License
              </h2>
              <p>
                Permission is granted to temporarily download one copy of the
                materials (information or software) on Amooti for personal,
                non-commercial transitory viewing only.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                3. Disclaimer
              </h2>
              <p>
                The materials on Amooti are provided on an 'as is' basis. Amooti
                makes no warranties, expressed or implied, and hereby disclaims
                and negates all other warranties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                4. Limitations
              </h2>
              <p>
                In no event shall Amooti or its suppliers be liable for any
                damages (including, without limitation, damages for loss of data
                or profit, or due to business interruption) arising out of the
                use or inability to use materials on Amooti.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                5. Accuracy of Materials
              </h2>
              <p>
                The materials appearing on Amooti could include technical,
                typographical, or photographic errors. Amooti does not warrant
                that any of the materials on Amooti are accurate, complete, or
                current.
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

export default Terms;
