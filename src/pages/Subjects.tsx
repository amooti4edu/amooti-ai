import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const Subjects = () => {
  // O Level subjects - 8 covered and 12 not yet covered
  const coveredSubjects = [
    "Mathematics",
    "English Language",
    "Physics",
    "Chemistry",
    "Biology",
    "History",
    "Geography",
    "Economics",
  ];

  const allSubjects = [
    "Mathematics",
    "English Language",
    "Physics",
    "Chemistry",
    "Biology",
    "History",
    "Geography",
    "Economics",
    "Literature in English",
    "French",
    "Kiswahili",
    "Islamic Studies",
    "Christian Religious Education",
    "Computer Science",
    "Agriculture",
    "Technical Drawing",
    "Music",
    "Visual Art",
    "Physical Education",
    "Entrepreneurship",
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
          <h1 className="text-4xl md:text-5xl font-serif tracking-wide mb-4 text-secondary">
            O Level Subjects
          </h1>
          <p className="text-gray-600 mb-8 text-lg">
            {coveredSubjects.length} of {allSubjects.length} subjects covered
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allSubjects.map((subject) => {
              const isCovered = coveredSubjects.includes(subject);
              return (
                <div
                  key={subject}
                  className={`p-6 rounded-lg border-2 transition ${
                    isCovered
                      ? "border-secondary bg-secondary/5"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {subject}
                    </h3>
                    {isCovered && (
                      <Badge className="bg-secondary text-white">Covered</Badge>
                    )}
                  </div>
                  {!isCovered && (
                    <p className="text-sm text-gray-500 mt-2">Coming soon</p>
                  )}
                </div>
              );
            })}
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

export default Subjects;
