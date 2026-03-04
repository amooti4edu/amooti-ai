import { Link } from "react-router-dom";

const sections = [
  { id: "origin", label: "01 — Origin" },
  { id: "vision", label: "02 — Vision" },
  { id: "membership", label: "03 — Membership" },
  { id: "usage", label: "04 — How to Use" },
  { id: "closing", label: "05 — Closing" },
];

const About = () => {
  return (
    <div className="min-h-screen w-full bg-[#FAF8F4]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');

        .about-root {
          font-family: 'EB Garamond', Georgia, serif;
          background: #FAF8F4;
          color: #1a1814;
        }

        .about-root nav {
          font-family: 'EB Garamond', Georgia, serif;
        }

        .display-font {
          font-family: 'Playfair Display', Georgia, serif;
        }

        .rule-thick {
          border: none;
          border-top: 3px solid #1a1814;
        }

        .rule-thin {
          border: none;
          border-top: 1px solid #c8b99a;
        }

        .section-label {
          font-family: 'EB Garamond', Georgia, serif;
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #8a7a62;
        }

        .index-item {
          font-family: 'EB Garamond', Georgia, serif;
          font-size: 0.75rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #6b5e48;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .index-item::after {
          content: '';
          flex: 1;
          border-bottom: 1px dotted #c8b99a;
        }

        .drop-cap::first-letter {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 4.5rem;
          font-weight: 700;
          line-height: 0.8;
          float: left;
          margin-right: 0.1em;
          margin-top: 0.05em;
          color: #1a1814;
        }

        .pull-quote {
          border-left: 3px solid #8a7a62;
          padding-left: 1.5rem;
          margin: 2rem 0;
          font-style: italic;
          font-size: 1.1rem;
          color: #3d3528;
          line-height: 1.7;
        }

        .pull-quote cite {
          display: block;
          margin-top: 0.5rem;
          font-size: 0.75rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-style: normal;
          color: #8a7a62;
        }

        .section-anchor {
          scroll-margin-top: 6rem;
        }

        .body-text {
          font-size: 1.05rem;
          line-height: 1.85;
          color: #2d2820;
          font-family: 'EB Garamond', Georgia, serif;
        }

        .mode-card {
          background: #fff;
          border: 1px solid #e0d5c3;
          padding: 1.25rem 1.5rem;
          margin-bottom: 0.75rem;
        }

        .mode-label {
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.05em;
          color: #1a1814;
          display: block;
          margin-bottom: 0.3rem;
        }

        .nav-link {
          font-family: 'EB Garamond', Georgia, serif;
          font-size: 1rem;
          letter-spacing: 0.06em;
          color: #1a1814;
          text-decoration: none;
          transition: opacity 0.2s;
        }

        .nav-link:hover { opacity: 0.55; }

        .footer-link {
          font-family: 'EB Garamond', Georgia, serif;
          font-size: 0.85rem;
          letter-spacing: 0.08em;
          color: #5a4e3c;
          text-decoration: none;
          text-transform: uppercase;
        }

        .footer-link:hover { opacity: 0.6; }

        .colophon {
          font-family: 'EB Garamond', Georgia, serif;
          font-style: italic;
          font-size: 0.9rem;
          color: #8a7a62;
        }

        .kicker {
          font-family: 'EB Garamond', Georgia, serif;
          font-size: 0.7rem;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #8a7a62;
        }

        ul.styled-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        ul.styled-list li {
          padding: 0.4rem 0;
          padding-left: 1.2rem;
          position: relative;
        }

        ul.styled-list li::before {
          content: '—';
          position: absolute;
          left: 0;
          color: #8a7a62;
        }
      `}</style>

      <div className="about-root">

        {/* Navigation */}
        <nav style={{ borderBottom: '1px solid #d4c8b0', background: '#FAF8F4' }}
          className="flex items-center justify-between px-6 py-5 md:px-12 lg:px-20">
          <Link to="/" className="nav-link">
            <img src="/apple-touch-icon.png" alt="Amooti Logo" className="h-8 w-8" />
          </Link>
          <div className="flex items-center gap-6 md:gap-10">
            <Link to="/about" className="nav-link">About</Link>
            <Link to="/pricing" className="nav-link">Pricing</Link>
            <Link to="/subjects" className="nav-link">Subjects</Link>
            <Link to="/login/student" className="nav-link">Sign In</Link>
          </div>
        </nav>

        {/* Hero Header */}
        <header className="px-6 pt-14 pb-8 md:px-12 lg:px-20" style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <p className="kicker mb-4">Domus Dei Tech · Est. 2026</p>
          <hr className="rule-thick mb-6" />
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <h1 className="display-font" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 700, lineHeight: 1.0, letterSpacing: '-0.01em', color: '#1a1814' }}>
              About<br />Amooti
            </h1>
            <div style={{ maxWidth: '22rem' }}>
              <p className="body-text" style={{ fontSize: '1rem', color: '#6b5e48', fontStyle: 'italic' }}>
                Artificial Intelligence Mentor Optimised for Ongoing Tutelage and Innovation
              </p>
            </div>
          </div>
          <hr className="rule-thin" />
        </header>

        {/* Body — two-column layout on desktop */}
        <div className="px-6 pb-16 md:px-12 lg:px-20" style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">

            {/* Sidebar index */}
            <aside style={{ width: '100%', maxWidth: '14rem', flexShrink: 0 }}>
              <div style={{ position: 'sticky', top: '5rem' }}>
                <p className="section-label mb-4">Contents</p>
                <hr className="rule-thin mb-4" />
                <nav className="flex flex-col gap-3">
                  {sections.map(s => (
                    <a key={s.id} href={`#${s.id}`} className="index-item hover:opacity-70" style={{ textDecoration: 'none' }}>
                      <span>{s.label}</span>
                    </a>
                  ))}
                </nav>
                <hr className="rule-thin mt-6 mb-5" />
                <p className="colophon" style={{ fontSize: '0.78rem' }}>
                  Uganda's AI study companion, built on the NCDC secondary school curriculum.
                </p>
              </div>
            </aside>

            {/* Main text */}
            <main className="flex-1" style={{ minWidth: 0 }}>

              {/* Section 01 — Origin */}
              <section id="origin" className="section-anchor mb-14">
                <p className="section-label mb-2">01 — Origin</p>
                <hr className="rule-thin mb-6" />

                <p className="body-text drop-cap mb-5">
                  Welcome to <strong>Amooti</strong>, an acronym of <em>Artificial Intelligence Mentor Optimised for Ongoing Tutelage and Innovation</em> — in short, your AI study companion.
                </p>

                <p className="body-text mb-5">
                  It is also a tribute to my late mother, Nyangoma Catherine Amooti, who every evening after work would sit with us and help us go through what we had learnt that day, to help us understand it better and put it in context. This is the goal and vision of Amooti — to help students understand both the content and the context of what they are learning. I am sure that today, as it was during our days in school, students still ask, "Why am I learning this?". Amooti is here to help answer that.
                </p>

                <p className="body-text">
                  As smart as Amooti is, it can never replace a teacher — and it is not trying to. That is precisely why it is a tutor, not a teacher. Think of Amooti as a very, very knowledgeable study companion: always available, always patient, and always ready to help you get to grips with what you are learning.
                </p>
              </section>

              {/* Section 02 — Vision */}
              <section id="vision" className="section-anchor mb-14">
                <p className="section-label mb-2">02 — Vision</p>
                <hr className="rule-thin mb-6" />

                <p className="body-text mb-5">
                  Amooti has been trained on the new NCDC secondary school curriculum to:
                </p>

                <div className="pull-quote">
                  "Promote inquisitive minds that do not shy away from asking 'Why' until they can get a grip on what it is they are supposed to learn, which in turn creates understanding and skills for a lifetime."
                  <cite>Curriculum Framework, p. 1</cite>
                </div>

                <p className="body-text mb-5">
                  To see the number of subjects we have covered so far, tap on the <strong>Subjects</strong> button.
                </p>

                <p className="body-text mb-5">As such, the app has adopted the vision:</p>

                <div className="pull-quote">
                  "The new curriculum focuses on four 'Key Learning Outcomes':
                  <br />· self-assured individuals
                  <br />· responsible and patriotic citizens
                  <br />· lifelong learners
                  <br />· positive contributors to society."
                  <cite>Curriculum Framework, p. 6</cite>
                </div>

                <p className="body-text">
                  To further understand how we work I encourage you to read our Terms of Service and Privacy Policy.
                </p>
              </section>

              {/* Section 03 — Membership */}
              <section id="membership" className="section-anchor mb-14">
                <p className="section-label mb-2">03 — Membership</p>
                <hr className="rule-thin mb-6" />

                <p className="body-text mb-5">
                  Currently, we have four tiers of membership. We have a Free Tier because we understand our situation as Ugandans. Education is becoming more and more untenable for many low-income earners. With the Free Tier, we hope to serve as many students as possible without them needing to pay anything. However, because of how expensive it is to use AI, we can only currently offer 5 queries a day — with the hope that as the app grows and our resources increase, we will be able to raise this limit significantly.
                </p>

                <p className="body-text mb-5">
                  The underlying structure of all the tiers is the same; the major difference is in the AI models we use, which become progressively more powerful and therefore more "intelligent," and the usage rate is also increased. The Enterprise Tier is aimed at school level, where instead of individual student accounts, we provide one account for the whole school. This too has its benefits.
                </p>

                <p className="body-text">
                  That being said, I encourage each student to have their own personal account. This is important because it is the only way Amooti will be able to know what you have discussed so far, identify where you need further support, and what you have grasped.
                </p>
              </section>

              {/* Section 04 — How to Use */}
              <section id="usage" className="section-anchor mb-14">
                <p className="section-label mb-2">04 — How to Use</p>
                <hr className="rule-thin mb-6" />

                <p className="body-text mb-6">
                  Usage is very simple. You have two main ways/modes you can use the app as a student:
                </p>

                <div className="mb-6">
                  <div className="mode-card">
                    <span className="mode-label">Mode 1 — Ask</span>
                    <p className="body-text" style={{ margin: 0, fontSize: '0.98rem' }}>
                      You can ask a question — e.g., "Explain phototropism" or "What is phototropism?" And Amooti will answer you accordingly.
                    </p>
                  </div>
                  <div className="mode-card">
                    <span className="mode-label">Mode 2 — Quiz Me</span>
                    <p className="body-text" style={{ margin: 0, fontSize: '0.98rem' }}>
                      You can tell Amooti to quiz you — e.g., "Quiz me about phototropism." And you will be asked questions and after you have answered, you will be marked and corrected.
                    </p>
                  </div>
                </div>

                <p className="body-text mb-5">
                  So make sure to select the appropriate mode you want to properly use it.
                </p>

                <p className="body-text">
                  Teachers can also use it to get ideas on how to teach a certain concept, and it is capable of generating a scheme for a particular topic as a downloadable document. However Teacher Mode is only accessible under the Premium Tier of membership.
                </p>
              </section>

              {/* Section 05 — Closing */}
              <section id="closing" className="section-anchor">
                <p className="section-label mb-2">05 — Closing</p>
                <hr className="rule-thin mb-6" />

                <p className="body-text mb-8">
                  You are most welcome to the future. I hope Amooti will bring you as much joy as it did me as I was building it — for God and my Country. Feel free to contact us any time with feedback and any other questions or communications.
                </p>

                <hr className="rule-thin mb-6" />

                <div className="body-text" style={{ lineHeight: 2 }}>
                  <p style={{ marginBottom: '0.25rem' }}>With my best regards,</p>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.1rem' }}>Amanyire Daniel</p>
                  <p className="section-label" style={{ marginBottom: '0.25rem' }}>CEO / Founder</p>
                  <a
                    href="https://domusdeitech.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3d3528', textDecoration: 'underline', fontSize: '0.95rem', fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Domus Dei Tech
                  </a>
                  <p className="colophon" style={{ marginTop: '0.25rem' }}>Propter Amorem Dei</p>
                </div>
              </section>

            </main>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid #d4c8b0', background: '#f0ece4' }}
          className="px-6 py-8 md:px-12 lg:px-20">
          <div style={{ maxWidth: '72rem', margin: '0 auto' }}
            className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="colophon" style={{ fontSize: '0.8rem', color: '#8a7a62' }}>
              © 2026 Domus Dei Tech | Amooti. All rights reserved.
            </p>
            <div className="flex gap-8">
              <Link to="/terms" className="footer-link">Terms of Service</Link>
              <Link to="/privacy" className="footer-link">Privacy Policy</Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default About;
