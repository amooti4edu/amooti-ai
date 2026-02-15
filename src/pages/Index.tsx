import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
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
        <h1 className="text-hero font-serif text-2xl md:text-3xl tracking-wide">
          Amooti
        </h1>
        <div className="flex items-center gap-4 md:gap-8 text-sm md:text-base font-medium">
          <Link to="/login/student" className="nav-link-hero">
            Student
          </Link>
          <Link to="/login/school" className="nav-link-hero">
            School
          </Link>
          <Link to="/about" className="nav-link-hero hidden sm:inline">
            About
          </Link>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex min-h-[calc(100vh-88px)] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-hero font-serif text-4xl md:text-6xl lg:text-7xl max-w-3xl leading-tight animate-fade-in">
          Your AI Study Companion
        </h2>
        <p className="text-hero mt-6 max-w-xl text-base md:text-lg opacity-80 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          Ask questions, explore your curriculum, and learn smarter with
          AI-powered educational assistance.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <Link
            to="/login/student"
            className="rounded-lg bg-secondary px-8 py-3 font-semibold text-secondary-foreground transition hover:opacity-90"
          >
            I'm a Student
          </Link>
          <Link
            to="/login/school"
            className="rounded-lg border border-secondary/40 px-8 py-3 font-semibold text-hero transition hover:bg-secondary/20"
          >
            School Access
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
