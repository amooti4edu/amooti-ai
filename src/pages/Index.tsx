import { Link } from "react-router-dom";

// ─────────────────────────────────────────────
// 🎛️  EASY EDIT ZONE — add / remove items here
// ─────────────────────────────────────────────

const SUBJECTS: { label: string; accent: string }[] = [
  { label: "Mathematics",        accent: "#60a5fa" },
  { label: "Chemistry",          accent: "#34d399" },
  { label: "Physics",            accent: "#a78bfa" },
  { label: "Biology",            accent: "#4ade80" },
  { label: "Geography",          accent: "#f97316" },
  { label: "History & Political Education",            accent: "#fbbf24" },
  { label: "English",            accent: "#f472b6" },
  { label: "General Science",         accent: "#38bdf8" },
];

// Schools: just the name — each becomes its own individual card
const SCHOOLS: string[] = [
//  "Uganda Martyrs High School Rubaga",
//  "Makerere College School",
//  "Gayaza High School",
//  "St. Mary's Seminary FortPortal",
//  "St. Mary's College Kisubi",
//  "Ntare School",
//  "Nabisunsa Girls School",
//  "Mwiri Secondary School",
//  "Namilyango College",
//  "Kibuli Secondary School",
//  "St. Joseph's College Layibi",
//  "Kyambogo College School",
];

// ─────────────────────────────────────────────

interface SubjectRowProps {
  items: { label: string; accent: string }[];
  direction?: "left" | "right";
  speed?: number;
}

interface SchoolRowProps {
  items: string[];
  direction?: "left" | "right";
  speed?: number;
}

const buildStyle = (
  count: number,
  direction: "left" | "right",
  speed: number
): React.CSSProperties => ({
  animationName: direction === "left" ? "marquee-left" : "marquee-right",
  animationDuration: `${count * speed}s`,
  animationTimingFunction: "linear",
  animationIterationCount: "infinite",
});

/** Subjects — small coloured dot + subject name */
const SubjectRow = ({ items, direction = "left", speed = 3.5 }: SubjectRowProps) => {
  const doubled = [...items, ...items];
  return (
    <div className="marquee-track">
      <div className="marquee-inner" style={buildStyle(items.length, direction, speed)}>
        {doubled.map((item, i) => (
          <div key={i} className="marquee-card">
            <span className="marquee-dot" style={{ background: item.accent }} />
            <span className="marquee-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Schools — each school in its own card, text only */
const SchoolRow = ({ items, direction = "right", speed = 4 }: SchoolRowProps) => {
  const doubled = [...items, ...items];
  return (
    <div className="marquee-track">
      <div className="marquee-inner" style={buildStyle(items.length, direction, speed)}>
        {doubled.map((school, i) => (
          <div key={i} className="marquee-card">
            <span className="marquee-label">{school}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Index = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col">
      {/* Hero background */}
      <img
        src="/images/hero.jpg"
        alt="Students studying together in a warm library"
        className="absolute inset-0 h-full w-full object-cover"
      />
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
          <Link to="/about"    className="nav-link-hero hidden sm:inline">About</Link>
          <Link to="/pricing"  className="nav-link-hero hidden sm:inline">Pricing</Link>
          <Link to="/subjects" className="nav-link-hero hidden sm:inline">Subjects</Link>
          <Link to="/login/student" className="nav-link-hero">Sign In</Link>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h2 className="text-hero font-serif text-4xl md:text-6xl lg:text-7xl max-w-3xl leading-tight animate-fade-in">
          Your AI Study Companion
        </h2>
        <p
          className="text-hero mt-6 max-w-xl text-base md:text-lg opacity-80 animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          Ask questions, Quiz yourself, and learn smarter with
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

      {/* ── Carousels ── */}
      <div className="relative z-10 mt-16 flex flex-col gap-4 py-6 carousel-section">
        <div className="carousel-fade-left" />
        <div className="carousel-fade-right" />

        <div className="carousel-label">Subjects</div>
        <SubjectRow items={SUBJECTS} direction="left" />

        <div className="carousel-label mt-2">Our Schools</div>
        <SchoolRow items={SCHOOLS} direction="right" />
      </div>

      {/* ── Footer — plain, no glass ── */}
      <footer className="relative z-10 px-6 py-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-2">
      
          <div className="text-sm">
            <Link to="/terms" className="nav-link-hero">Terms of Service</Link>
            <span className="mx-2">|</span>
            <Link to="/privacy" className="nav-link-hero">Privacy Policy</Link>
          </div>
      
          <p className="text-hero text-sm opacity-70">
            © 2026 Domus Dei Tech | Amooti. All rights reserved.
          </p>
      
        </div>
      </footer>
    </div>
  );
};

export default Index;
