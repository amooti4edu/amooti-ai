import { Link } from "react-router-dom";

const About = () => {
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
          <Link to="/about" className="text-secondary hover:opacity-80">About</Link>
          <Link to="/pricing" className="text-secondary hover:opacity-80">Pricing</Link>
          <Link to="/subjects" className="text-secondary hover:opacity-80">Subjects</Link>
          <Link to="/login/student" className="text-secondary hover:opacity-80">Sign In</Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="px-6 py-12 md:px-12 lg:px-20 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-serif tracking-wide mb-2 text-secondary">
          About Amooti
        </h1>
        <p className="text-sm text-gray-400 italic mb-10 tracking-widest uppercase">
          Artificial Intelligence Mentor Optimised for Ongoing Tutelage and Innovation
        </p>

        <div className="prose prose-lg max-w-none text-gray-700 space-y-6">

          {/* Intro & Origin */}
          <p>
            Welcome to <strong>Amooti</strong> — your AI study companion. The name is an acronym
            for <em>Artificial Intelligence Mentor Optimised for Ongoing Tutelage and Innovation</em>,
            but it carries a deeper meaning too.
          </p>

          <p>
            Amooti is also a heartfelt tribute to my late mother, <strong>Nyangoma Catherine Amooti</strong>.
            Every evening after work, without fail, she would sit with us and walk us through what we had
            learned that day — helping us understand it, make sense of it, and see where it fit in the
            bigger picture of life. That spirit of patient, contextual learning is the very soul of this app.
          </p>

          {/* Vision */}
          <p>
            The goal and vision of Amooti is simple: <em>to help students not just learn content, but
            truly understand it — and understand why it matters.</em> Students today, as in every generation,
            still ask, <strong>"Why am I learning this?"</strong> Amooti exists to answer that question.
          </p>

          {/* Not a teacher */}
          <p>
            As smart as Amooti is, it can never replace a teacher — and it is not trying to. That is
            precisely why it is a <em>tutor</em>, not a teacher. Think of Amooti as a very, very
            knowledgeable study companion: always available, always patient, and always ready to help
            you get to grips with what you are supposed to be learning.
          </p>

          {/* Curriculum */}
          <p>
            Amooti has been trained on <strong>Uganda's new secondary school curriculum</strong>.
            To explore the subjects we have covered so far,{" "}
            <Link to="/subjects" className="text-secondary underline hover:opacity-80">
              tap on the Subjects button
            </Link>.
          </p>

          {/* Curriculum quotes */}
          <div className="border-l-4 border-secondary pl-5 my-6 space-y-4">
            <p className="text-gray-600 italic">
              "Promoting inquisitive minds that do not shy away from asking 'Why', until they can get
              a grip on what it is they are supposed to learn — which in turn creates understanding and
              skills for a lifetime."
            </p>
            <p className="text-xs text-gray-400">— Uganda Curriculum Framework, p. 1</p>
          </div>

          <p>
            In line with this, Amooti has also adopted the vision of the new curriculum's four
            Key Learning Outcomes:
          </p>

          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
            <li>Self-assured individuals</li>
            <li>Responsible and patriotic citizens</li>
            <li>Lifelong learners</li>
            <li>Positive contributors to society</li>
          </ul>
          <p className="text-xs text-gray-400 -mt-2 ml-2">— Uganda Curriculum Framework, p. 6</p>

          {/* Membership tiers */}
          <h2 className="text-2xl font-serif text-secondary mt-10 mb-2">Membership Tiers</h2>

          <p>
            Amooti currently offers <strong>four tiers of membership</strong>.
          </p>

          <p>
            We offer a <strong>Free Tier</strong> because we understand the reality many Ugandan families
            face. Education is becoming increasingly out of reach for low-income earners, and we want to
            serve as many students as possible — at no cost. The free tier currently allows <strong>5
            queries per day</strong>. As the app grows and our resources increase, we hope to raise this
            limit significantly.
          </p>

          <p>
            The three paid tiers — <strong>Basic, Premium, and Enterprise</strong> — share the same
            underlying structure. The key differences are the AI models used (which become progressively
            more powerful and capable) and the daily usage limits (which increase with each tier).
          </p>

          <p>
            The <strong>Enterprise Tier</strong> is designed for schools: rather than individual student
            accounts, a single institutional account covers the entire school — with significant benefits
            for administration, teachers, and students alike.
          </p>

          {/* Personal accounts */}
          <p>
            We encourage every student to maintain their own <strong>personal account</strong>. This is
            important — it is the only way Amooti can keep track of what you have discussed, identify
            where you need further support, and recognise what you have already understood.
          </p>

          {/* How to use */}
          <h2 className="text-2xl font-serif text-secondary mt-10 mb-2">How to Use Amooti</h2>

          <p>
            As a student, you have two main ways to engage with Amooti:
          </p>

          <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
            <li>
              <strong>Ask</strong> — pose a question directly, e.g. <em>"Explain phototropism to me"</em>{" "}
              or <em>"What is phototropism?"</em>
            </li>
            <li>
              <strong>Quiz Me</strong> — ask Amooti to test your understanding, e.g.{" "}
              <em>"Quiz me about phototropism."</em>
            </li>
          </ul>

          <p>Always make sure to select the appropriate mode before you begin.</p>

          <p>
            <strong>Teachers</strong> can also use Amooti to explore ideas for teaching a concept, or
            to generate a scheme of work for a particular topic — downloadable as a document. Teacher
            Mode is available under the <strong>Premium Tier</strong> and above.
          </p>

          {/* Terms */}
          <p>
            We encourage you to read our{" "}
            <Link to="/terms" className="text-secondary underline hover:opacity-80">Terms of Service</Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-secondary underline hover:opacity-80">Privacy Policy</Link>{" "}
            to understand how we handle your data and protect your privacy.
          </p>

          {/* Closing */}
          <div className="border-t pt-8 mt-10">
            <p className="text-gray-600 italic">
              I hope Amooti brings you as much joy as it brought me while building it —
              for God and for my Country.
            </p>
            <div className="mt-4">
              <p className="font-semibold text-secondary">Amanyire Daniel</p>
              <p className="text-sm text-gray-500">CEO &amp; Founder, Domus Dei Tech</p>
              <p className="text-sm text-gray-400 italic">Propter Amorem Dei</p>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50 px-6 py-8 md:px-12 lg:px-20 mt-12">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-gray-600 text-sm">© 2026 Domus Dei Tech | Amooti. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <Link to="/terms" className="text-secondary hover:opacity-80">Terms of Service</Link>
            <Link to="/privacy" className="text-secondary hover:opacity-80">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;
