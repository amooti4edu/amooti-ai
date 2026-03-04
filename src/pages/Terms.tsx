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
                By accessing and using Amooti, you agree to comply with these Terms of Service and all applicable 
                laws and regulations. Amooti is an AI-powered study companion designed specifically 
                for students in Uganda. If you do not agree to these terms, you may not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                2. Use License and Restrictions
              </h2>
              <p>
                Amooti grants you a limited, non-exclusive, non-transferable license to use our service for personal,
                educational, non-commercial purposes only. 
                You agree to use Amooti solely to develop your own educational knowledge and understanding. 
                You may not:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2 text-gray-700">
                <li>Reproduce, distribute, or transmit any content without written permission</li>
                <li>Use Amooti for commercial purposes or to compete with our service</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Share your account credentials with others</li>
                <li>Violate any applicable laws or regulations in your jurisdiction</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                3. AI-Generated Content Disclaimer
              </h2>
              <p>
                Amooti uses artificial intelligence to generate educational responses and study materials. 
                While we strive to provide accurate and helpful content, 
                AI-generated materials may contain errors, omissions, or limitations. 
                We recommend:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2 text-gray-700">
                <li>Verifying important information with your textbooks and teacher</li>
                <li>Using Amooti as a learning aid, not a sole source of information</li>
                <li>Consulting with your educators for official guidance on curriculum content</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                4. Usage Limits and Fair Use
              </h2>
              <p>
                Your access to Amooti is subject to daily usage limits based on your subscription tier.
              </p>
              <p className="mt-3">
                We may suspend access to students who abuse the service or attempt to circumvent usage limits.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                5. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, Amooti and its creators shall not be liable for any 
                indirect, incidental, special, or consequential damages resulting from your use or inability 
                to use the service. This includes, but is not limited to, lost grades, academic performance issues, 
                or any other damages whether based on warranty, contract, tort, or any other legal theory.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                6. Academic Integrity
              </h2>
              <p>
                You agree to use Amooti in accordance with your school's academic integrity policies. 
                Amooti is designed to help you learn and understand concepts. 
                Submitting AI-generated responses as your own work without proper attribution or understanding 
                may violate your institution's honor code. We recommend discussing appropriate 
                use of AI tools with your teachers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                7. Changes to Terms
              </h2>
              <p>
                Amooti reserves the right to modify these Terms of Service at any time. 
                Changes will be effective immediately upon posting to the website. 
                Your continued use of the service constitutes acceptance of the updated terms.
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50 px-6 py-8 md:px-12 lg:px-20 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-gray-600 text-sm">© 2026 Domus Dei Tech | Amooti. All rights reserved.</p>
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
