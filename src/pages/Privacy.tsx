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
                We are committed to protecting your privacy. Amooti collects the following types of information:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2 text-gray-700">
                <li><strong>Account Information:</strong> Email, name, and password when you create an account</li>
                <li><strong>Profile Information:</strong> Education level, subject of study, and class/grade</li>
                <li><strong>Learning Data:</strong> Questions you ask, study materials accessed, and your interactions with the service</li>
                <li><strong>Usage Data:</strong> How often you use Amooti, which features you access, and your subscription tier</li>
                <li><strong>Device Information:</strong> Browser type, IP address, and device type for security and service improvement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                2. How We Use Your Information
              </h2>
              <p>
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2 text-gray-700">
                <li>Providing and personalizing the Amooti service to your educational needs</li>
                <li>Generating relevant AI responses based on your subject and educational level</li>
                <li>Tracking your learning progress and usage statistics</li>
                <li>Enforcing daily usage limits based on your subscription plan</li>
                <li>Improving our AI models and service quality</li>
                <li>Sending you notifications about your account and service updates</li>
                <li>Preventing fraud and ensuring security</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                3. Data Processing and AI Learning
              </h2>
              <p>
                Your learning interactions and questions may be processed by our AI systems to 
                improve the accuracy and relevance of responses we provide. 
                We anonymize and aggregate this data whenever possible. 
                Your personal information is not used to train AI models without your explicit consent.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                4. Information Sharing
              </h2>
              <p>
                We do not sell or rent your personal information to third parties. We may share information in the following limited circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2 text-gray-700">
                <li>With service providers who help operate Amooti (e.g., for data storage)</li>
                <li>As required by law or government request</li>
                <li>If necessary to protect our legal rights or the safety of our users</li>
                <li>With institutional partners if you use Amooti through a school (for enterprise users)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                5. Data Security
              </h2>
              <p>
                We implement industry-standard security measures to protect your personal information, 
                including encryption in transit and at rest. we maintain comprehensive security protocols. 
                However, no security system is completely impenetrable, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                6. Data Retention
              </h2>
              <p>
                We retain your account information as long as you maintain an active account. 
                Learning data and chat history are retained to maintain your progress and conversation context. 
                When you delete your account, we permanently delete your personal information within 30 days, 
                though anonymized data may be retained for service improvement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                7. Your Rights and Choices
              </h2>
              <p>
                You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2 text-gray-700">
                <li>Access your personal information</li>
                <li>Update or correct your profile information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of non-essential communications</li>
                <li>Request information about how your data is being used</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, please contact us at amooti4edu@gmail.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                8. Children's Privacy
              </h2>
              <p>
                Amooti is designed for students of various ages. 
                If you are under 18, please ensure you have parental consent before using our service. 
                We comply with applicable children's privacy laws and do not 
                knowingly collect excessive personal information from minors without appropriate safeguards.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif font-semibold text-secondary mb-4">
                9. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy periodically to reflect changes in our 
                practices or applicable laws. We will notify you of significant changes 
                by posting the updated policy on our website and, where appropriate, by email. 
                Your continued use of Amooti constitutes acceptance of the updated Privacy Policy.
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

export default Privacy;
