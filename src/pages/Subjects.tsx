import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const Subjects = () => {
  const available = [
    "English",
    "Mathematics",
    "Biology",
    "Chemistry",
    "Physics",
    "General Science",
    "History and Political Education",
    "Geography",
  ];

  const subjects = [
    // Core
    "English",
    "Mathematics",
    "Biology",
    "Chemistry",
    "Physics",
    "General Science",
    "History and Political Education",
    "Geography",

    // Electives
    "Agriculture",
    "Entrepreneurship",
    "Kiswahili",
    "Religious Education",
    "Art and Design",
    "Performing Arts",
    "ICT",
    "Technology and Design",
    "Nutrition and Food Technology",
    "Foreign Languages (French / German / Arabic / Latin / Chinese)",
    "Local Languages",
    "Literature in English",
    "Physical Education",
  ];

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-6 md:px-12 lg:px-20 border-b">
        <Link
          to="/"
          className="text-secondary font-serif text-2xl md:text-3xl tracking-wide hover:opacity-80"
        >
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
      <div className="px-6 py-16 md:px-12 lg:px-20 max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-serif tracking-wide mb-6 text-secondary">
          Lower Secondary Curriculum (S1–S4)
        </h1>

        {/* Curriculum Explanation */}
        <div className="max-w-3xl text-gray-600 space-y-4 mb-12">
          <p>
            Uganda’s New Lower Secondary Curriculum is structured around
            compulsory subjects and electives.
          </p>
          <p>
            In <strong>Senior 1–2</strong>, learners study 11 compulsory subjects
            and choose 1 elective. In <strong>Senior 3–4</strong>, learners study
            7 compulsory subjects and select 2 electives based on interest and
            career direction.
          </p>
          <p>
            Amooti is built directly around this structure. Below are the
            subjects we have covered so far and those being added next.
          </p>
        </div>

        {/* Available Count */}
        <div className="mb-8">
          <p className="text-gray-800 font-medium">
            {available.length} subjects currently available • More being added progressively
          </p>
        </div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => {
            const isAvailable = available.includes(subject);

            return (
              <div
                key={subject}
                className={`p-6 rounded-lg border-2 transition ${
                  isAvailable
                    ? "border-secondary bg-secondary/5"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-800">
                    {subject}
                  </h3>

                  {isAvailable ? (
                    <Badge className="bg-secondary text-white">
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="outline">Coming Soon</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Confidence Section */}
        <div className="mt-16 border-t pt-10 max-w-3xl text-gray-600">
          <p>
            Our current focus prioritises the core compulsory subjects of the
            curriculum to ensure strong academic foundations. Elective subjects
            are being added in phases as the platform expands.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50 px-6 py-8 md:px-12 lg:px-20 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-gray-600 text-sm">
            © 2026 Domus Dei Tech | Amooti. All rights reserved.
          </p>
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

export default Subjects;
