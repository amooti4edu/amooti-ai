import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col">
      {/* Hero background image */}
      <img
        src="/images/hero.jpg"
        alt="Students studying together in a warm library"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Overlay */}
      <div className="hero-overlay absolute inset-0" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12 lg:px-20">
        <Link to="/" className="text-hero hover:opacity-80 transition">
          <img
            src="/apple-touch-icon.png"
            alt="Amooti Logo"
            className="h-8 w-8 md:h-10 md:w-10"
          />
        </Link>
        <div className="flex items-center gap-4 md:gap-8 text-sm md:text-base font-medium">
          <Link to="/about" className="nav-link-hero hidden sm:inline">
            About
          </Link>
          <Link to="/pricing" className="nav-link-hero hidden sm:inline">
            Pricing
          </Link>
          <Link to="/subjects" className="nav-link-hero hidden sm:inline">
            Subjects
          </Link>
          <Link to="/login/student" className="nav-link-hero">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h2 className="text-hero font-serif text-4xl md:text-6xl lg:text-7xl max-w-3xl leading-tight animate-fade-in">
          Your AI Study Companion
        </h2>
        <p className="text-hero mt-6 max-w-xl text-base md:text-lg opacity-80 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          Ask questions, explore your curriculum, and learn smarter with
          AI-powered educational assistance.
        </p>
        <div className="mt-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <Link
            to="/login/student"
            className="rounded-lg bg-secondary px-8 py-3 font-semibold text-secondary-foreground transition hover:opacity-90 inline-block"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20 bg-black/30 backdrop-blur-sm px-6 py-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-hero text-sm">© 2026 Amooti. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <Link to="/terms" className="nav-link-hero">
              Terms of Service
            </Link>
            <Link to="/privacy" className="nav-link-hero">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
