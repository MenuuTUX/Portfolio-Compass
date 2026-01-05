"use client";

import { motion, Variants } from "framer-motion";
import {
  Share2,
  Github,
  ExternalLink,
  Building2,
  TrendingUp,
  LineChart,
  Target,
  HeartHandshake,
} from "lucide-react";
import Image from "next/image";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      duration: 0.8,
      ease: [0.215, 0.61, 0.355, 1.0],
    },
  }),
};

const PurposeSection = () => {
  const cards = [
    {
      title: "Smart Money Portfolios",
      description:
        "Peek into the portfolios of major financial institutions. See what the giants are buying and use their strategies as a benchmark for your own success.",
      image:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
      icon: <Building2 className="w-5 h-5 text-emerald-400" />,
      tag: "INSIGHTS",
    },
    {
      title: "Mathematical Optimization",
      description:
        "Stop guessing. Our algorithms analyze volatility, correlation, and returns to mathematically optimize your asset allocation for the highest possible Sharpe ratio.",
      image:
        "https://images.unsplash.com/photo-1591696205602-2f950c417cb9?auto=format&fit=crop&w=800&q=80",
      icon: <TrendingUp className="w-5 h-5 text-rose-400" />,
      tag: "ALGORITHM",
    },
    {
      title: "Future Simulation",
      description:
        "Test your portfolio against thousands of potential market scenarios with Monte Carlo simulations. Visualize your range of outcomes and plan with confidence.",
      image:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
      icon: <LineChart className="w-5 h-5 text-cyan-400" />,
      tag: "SIMULATION",
    },
  ];

  return (
    <section className="relative py-24 bg-stone-950 overflow-hidden">
      {/* Organic Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/10 via-stone-950 to-stone-950" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 text-xs font-mono tracking-widest mb-6 backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            ADVANCED ANALYTICS
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-display font-bold text-stone-100 mb-6"
          >
            Intelligent{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Portfolio Management
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-stone-400 leading-relaxed"
          >
            PortfolioCompass simplifies the complex world of investing. We
            provide professional-grade tools to help you build, optimize, and
            simulate your wealth strategy.
          </motion.p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-32">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={cardVariants}
              whileHover={{ y: -10 }}
              className="group relative bg-stone-900/50 border border-stone-800 hover:border-emerald-500/50 rounded-2xl overflow-hidden transition-colors duration-500"
            >
              {/* Image Container */}
              <div className="h-48 overflow-hidden relative">
                <div className="absolute inset-0 bg-stone-900/20 group-hover:bg-transparent transition-colors z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 to-transparent z-10" />
                <Image
                  src={card.image}
                  alt={card.title}
                  width={800}
                  height={600}
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 grayscale group-hover:grayscale-0"
                />
                <div className="absolute top-4 right-4 z-20 bg-stone-950/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono tracking-wider text-emerald-400 border border-emerald-500/20">
                  {card.tag}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 relative">
                <div className="w-10 h-10 rounded-lg bg-stone-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-stone-700 group-hover:border-emerald-500/30">
                  {card.icon}
                </div>
                <h3 className="text-xl font-display font-bold text-stone-100 mb-3 group-hover:text-emerald-400 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-stone-400 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Our Mission Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-32 relative"
        >
          <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-emerald-500/50 to-transparent rounded-full" />
          <div className="pl-8 md:pl-12">
            <div className="flex items-center gap-3 mb-6">
              <HeartHandshake className="text-emerald-400 w-6 h-6" />
              <h3 className="text-2xl font-display font-bold text-stone-100">
                Our Mission
              </h3>
            </div>
            <p className="text-xl md:text-2xl text-stone-300 leading-relaxed font-light mb-6">
              "Investing shouldn't be a mystery. I started this project because
              when I began investing, I was overwhelmed by the noise and lack of
              clear, actionable tools. PortfolioCompass is the tool I wish I had
              - designed to simplify the complex and make advanced analysis
              accessible to everyone."
            </p>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-stone-800" />
              <span className="text-stone-500 text-sm font-mono uppercase tracking-widest">
                The Creator
              </span>
            </div>
          </div>
        </motion.div>

        {/* Support Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden border border-stone-800 bg-stone-900/30 backdrop-blur-sm p-8 md:p-12 text-center"
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <h3 className="text-3xl font-display font-bold text-white">
              Support the <span className="text-emerald-400">Project</span>
            </h3>
            <p className="text-stone-400">
              This project is open-source and powered by the community. If you
              enjoy navigating the markets with us, please consider starring the
              project on GitHub and sharing it with fellow investors.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <a
                href="https://github.com/Shib-Das/Portfolio-Compass"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-stone-100 text-stone-950 font-bold flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors group"
              >
                <Github className="w-5 h-5" />
                <span>Star on GitHub</span>
                <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100" />
              </a>

              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator
                      .share({
                        title: "PortfolioCompass",
                        text: "Navigate the market with PortfolioCompass.",
                        url: window.location.href,
                      })
                      .catch(console.error);
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Link copied to clipboard!");
                  }
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-stone-800 text-white font-medium border border-stone-700 hover:border-emerald-500/50 hover:bg-stone-800/80 flex items-center justify-center gap-2 transition-all"
              >
                <Share2 className="w-5 h-5 text-emerald-400" />
                <span>Share Project</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PurposeSection;
