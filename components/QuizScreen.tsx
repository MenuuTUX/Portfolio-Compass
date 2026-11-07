"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import IntroQuiz, { type QuizResult } from "@/components/IntroQuiz";
import QueryProvider from "@/components/QueryProvider";
import { PORTFOLIO_QUERY_KEY } from "@/lib/query-client";
import { loadPortfolio, savePortfolio } from "@/lib/storage";
import { portfolioAfterQuiz, saveRiskProfile } from "@/lib/risk-profile";

type Props = {
  /** Where to go when the quiz ends: the portfolio tab after a result, or the app as it was after a skip. */
  onDone: (destination: "PORTFOLIO" | "APP") => void;
};

function Quiz({ onDone }: Props) {
  const queryClient = useQueryClient();
  const [hasHoldings] = useState(() => loadPortfolio().length > 0);

  const handleComplete = async (result: QuizResult) => {
    if (result.isSkipped) {
      onDone("APP");
      return;
    }
    saveRiskProfile({ profile: result.profile, score: result.score });
    // The example only fills an empty portfolio; real holdings are never replaced.
    const next = portfolioAfterQuiz(loadPortfolio(), result.suggestedPortfolio);
    if (next) {
      savePortfolio(next);
      await queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY });
    }
    onDone("PORTFOLIO");
  };

  return <IntroQuiz onComplete={handleComplete} hasExistingPortfolio={hasHoldings} />;
}

export default function QuizScreen(props: Props) {
  return (
    <QueryProvider>
      <Quiz {...props} />
    </QueryProvider>
  );
}
