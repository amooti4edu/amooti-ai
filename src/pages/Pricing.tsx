import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Pricing = () => {
  const plans = [
    {
      name: "Free",
      price: "Free",
      description: "Start your learning journey with Amooti",
      features: [
        "Limited questions per day (5)",
        "AI-powered study assistance",
        "Basic progress tracking",
        "Personalized responses based on your curriculum",
      ],
    },
    {
      name: "Basic",
      price: "7,000 UGX",
      description: "Comprehesive student support",
      features: [
        "All the features in free",
        "Stronger AI models with better reasoning",
        "Increased question count per day (10)"
      ],
    },
    {
      name: "Premium",
      price: "15,000 UGX",
      description: "Advanced student and teacher support",
      features: [
        "All the features in basic",
        "Better subject/question understanding",
        "Increased question count (20)",
        "The strongest AI models",
        "Teacher support",
      ],
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "Institutional solution",
      features: [
        "School-wide license",
        "Student management dashboard",
        "Advanced analytics and learning insights",
        "Custom integrations",
      ],
    },
  ];

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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif tracking-wide mb-4 text-secondary text-center">
            Pricing Plans
          </h1>
          <p className="text-center text-gray-600 mb-4 max-w-2xl mx-auto">
            Choose the perfect plan for your learning journey
          </p>
          <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            Amooti makes quality education accessible to every student. Whether you're just exploring or ready for serious study, we have a plan that fits your needs. All plans include AI-powered study assistance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-lg border border-gray-200 p-8 hover:shadow-lg transition"
              >
                <h3 className="text-2xl font-serif font-semibold text-secondary mb-2">
                  {plan.name}
                </h3>
                <p className="text-3xl font-bold text-secondary mb-2">
                  {plan.price}
                </p>
                <p className="text-sm text-gray-600 mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <span className="text-secondary mt-1">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-secondary hover:bg-secondary/90"
                  disabled={plan.name === "Enterprise"}
                >
                  {plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                </Button>
              </div>
            ))}
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

export default Pricing;
