import { Link } from "react-router-dom";

const About = () => {
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
      <div className="px-6 py-12 md:px-12 lg:px-20 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-serif tracking-wide mb-8 text-secondary">
          About Amooti
        </h1>

        <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
          <p>
            Welcome to <strong>Amooti</strong>, an acronym of <em>
              Artificial Intelligence Mentor Optimised for Ongoing Tutelage and Innovation
            </em>{" "}
            — in short, your AI study companion.
          </p>

          <p>
            It is also a tribute to my late mother, Nyangoma Catherine Amooti,
            who every evening after work would sit with us and help us go
            through what we had learnt that day, to help us understand it better
            and put it in context. This is the goal and vision of Amooti — to
            help students understand both the content and the context of what they are
            learning. I am sure that today, as it was during our days in school, students
            still ask, “Why am I learning this?”. Amooti is here to help answer that.
          </p>

          <p>
            As smart as Amooti is, it can never replace a teacher — and it is not trying to. 
            That is precisely why it is a tutor, not a teacher. 
            Think of Amooti as a very, very knowledgeable study companion: 
            always available, always patient, and always ready to help you get to grips with 
            what you are learning.
          </p>

          <p>
            Amooti has been trained on the new NCDC secondary school curriculum to:
          </p>

          <blockquote>
            “Promote inquisitive minds that do not shy away from asking ‘Why’
            until they can get a grip on what it is they are supposed to learn,
            which in turn creates understanding and skills for a lifetime.”
            <br />
            <span className="text-sm">— Curriculum Framework, p. 1</span>
          </blockquote>

          <p>
          To see the number of subjects we have covered so far, tap on the
            <strong> Subjects </strong> button.
          </p>

          <p>
            As such, the app has adopted the vision:
          </p>

          <blockquote>
            “The new curriculum focuses on four ‘Key Learning Outcomes’:
            <br />• self-assured individuals
            <br />• responsible and patriotic citizens
            <br />• lifelong learners
            <br />• positive contributors to society.”
            <br />
            <span className="text-sm">— Curriculum Framework, p. 6</span>
          </blockquote>

          <p>
            To further understand how we work 
            I encourage you to read our Terms of Service and Privacy Policy.
          </p>

          <p>
            Currently, we have four tiers of membership. We have a Free Tier
            because we understand our situation as Ugandans. Education is
            becoming more and more untenable for many low-income earners. With
            the Free Tier, we hope to serve as many students as possible without
            them needing to pay anything. However, because of how expensive it
            is to use AI, we can only currently offer 5 queries a day — with the hope that
            as the app grows and our resources increase, we will be able to
            raise this limit significantly.
          </p>

          <p>
            The underlying structure of all the tiers is the same; the major
            difference is in the AI models we use, which become progressively
            more powerful and therefore more “intelligent,” and the usage rate
            is also increased. The Enterprise Tier is aimed at school level,
            where instead of individual student accounts, we provide one account
            for the whole school. This too has its benefits.
          </p>

          <p>
            That being said, I encourage each student to have their own personal
            account. This is important because it is the only way Amooti will be
            able to know what you have discussed so far, identify where you need further support, 
            and what you have grasped.
          </p>

          <p>
            Usage is very simple. You have two main ways/modes you can use the app as
            a student:
          </p>

          <ul>
            <li>
              Mode 1: You can ask a question (<strong>Ask</strong>) — e.g., “Explain
              phototropism” or “What is phototropism?” And Amooti will answer you accordingly.
            </li>
            <li>
              Mode 2: You can tell Amooti to quiz you (<strong>Quiz Me</strong>) —
              e.g., “Quiz me about phototropism.” And you will be asked questions and after 
              you have answered, you will be marked and corrected.
            </li>
          </ul>

          <p>
            So make sure to select the appropriate mode you want to properly use it.
          </p>

          <p>
            Teachers can also use it to get ideas on how to teach a certain
            concept, and it is capable of generating a scheme for a particular
            topic as a downloadable document. However Teacher Mode is only accessible
            under the Premium Tier of membership.
          </p>

          <p>
            You are most welcome to the future. I hope Amooti will bring you as much joy as it did me as I was
            building it — for God and my Country.
            Feel free to contact us any time with feedback and any other questions or communications.
          </p>

          <p className="pt-4">
            With my best regards,
            <br />
            <strong>Amanyire Daniel</strong>
            <br />
            CEO/Founder
            <br />
            <a
              href="https://domusdeitech.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:opacity-80 underline"
            >
              Domus Dei Tech
            </a>
            <br />
            <em>Propter Amorem Dei</em>
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

export default About;
