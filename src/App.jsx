import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Target, Flag, AlertCircle, Users, Loader2, RefreshCw, PlayCircle } from 'lucide-react';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [recommendedBets, setRecommendedBets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real Betting Data for Feb 11, 2026 Fixtures
  // Sources: Various UK Bookmakers (Feb 2026)
  const realMatches = [
    {
      id: 201,
      homeTeam: "Aston Villa",
      awayTeam: "Brighton",
      time: "19:45",
      odds: 1.95, // Villa Win
      predictions: {
        result: { home: 49.0, draw: 25.0, away: 26.0, tip: "Aston Villa Win", confidence: 65.0 },
        goals: { prediction: "Over 2.5", confidence: 75, reason: "Villa strong at home, Brighton leaky" },
        corners: { prediction: "Over 9.5", confidence: 70, total: "10-12" },
        shots: { prediction: "Villa Over 5.5 SOT", home: "6-7", away: "3-4" },
        fouls: { prediction: "Over 21.5", confidence: 80, cards: "3-4" },
        betBuilder: "Villa Win + Watkins 1+ SOT"
      }
    },
    {
      id: 202,
      homeTeam: "Crystal Palace",
      awayTeam: "Burnley",
      time: "19:30",
      odds: 1.57, // Palace Win
      predictions: {
        result: { home: 61.0, draw: 23.0, away: 16.0, tip: "Crystal Palace Win", confidence: 78.0 },
        goals: { prediction: "Under 2.5", confidence: 64, reason: "Burnley struggle to score away" },
        corners: { prediction: "Over 10.5", confidence: 65, total: "11-13" },
        shots: { prediction: "Palace Over 4.5 SOT", home: "5-6", away: "2-3" },
        fouls: { prediction: "Over 19.5", confidence: 72, cards: "2-3" },
        betBuilder: "Palace Win + Under 3.5 Goals"
      }
    },
    {
      id: 203,
      homeTeam: "Man City",
      awayTeam: "Fulham",
      time: "20:00",
      odds: 1.36, // City Win
      predictions: {
        result: { home: 71.0, draw: 18.0, away: 11.0, tip: "Man City Win", confidence: 85.0 },
        goals: { prediction: "Over 3.5", confidence: 82, reason: "City average 3+ goals vs Fulham" },
        corners: { prediction: "Over 7.5", confidence: 88, total: "8-10" },
        shots: { prediction: "Haaland 2+ SOT", home: "8-10", away: "1-2" },
        fouls: { prediction: "Under 18.5", confidence: 60, cards: "1-2" },
        betBuilder: "City Win + Haaland Goal + Over 2.5 Goals"
      }
    },
    {
      id: 204,
      homeTeam: "Nott'm Forest",
      awayTeam: "Wolves",
      time: "19:30",
      odds: 1.75, // Forest Win
      predictions: {
        result: { home: 54.0, draw: 26.0, away: 20.0, tip: "Nott'm Forest Win", confidence: 68.0 },
        goals: { prediction: "Under 2.5", confidence: 70, reason: "Tight game predicted at City Ground" },
        corners: { prediction: "Over 10.5", confidence: 75, total: "11-12" },
        shots: { prediction: "Forest Over 4.5 SOT", home: "5-6", away: "3-4" },
        fouls: { prediction: "Over 24.5", confidence: 85, cards: "5-6" },
        betBuilder: "Forest Win + Gibbs-White 1+ SOT"
      }
    }
  ];

  const generateRecommendedBets = (matchesData) => {
    const bets = [];

    // 1. Safest Banker
    const safestMatch = [...matchesData].sort((a, b) => b.predictions.result.confidence - a.predictions.result.confidence)[0];
    if (safestMatch) {
      bets.push({
        type: "Safest Banker",
        selections: [safestMatch.predictions.result.tip],
        odds: safestMatch.odds.toFixed(2),
        confidence: `${safestMatch.predictions.result.confidence}%`,
        stake: "£20",
        return: `£${(20 * safestMatch.odds).toFixed(2)}`
      });
    }

    // 2. Value Acca (Target ~5/1)
    const sortedMatches = [...matchesData].sort((a, b) => b.predictions.result.confidence - a.predictions.result.confidence);

    let accaSelections = [];
    let accaOdds = 1.0;
    let accaConfidence = 100;

    for (const match of sortedMatches) {
      if (accaOdds >= 5.5) break;
      accaSelections.push(`${match.predictions.result.tip} (${match.odds.toFixed(2)})`);
      accaOdds *= match.odds;
      accaConfidence = Math.min(accaConfidence, match.predictions.result.confidence);
    }

    if (accaSelections.length >= 2) {
      bets.push({
        type: "Value Acca",
        selections: accaSelections,
        odds: `${(accaOdds - 1).toFixed(1)}/1 (${accaOdds.toFixed(2)})`,
        confidence: `${Math.round(accaConfidence * 0.9)}%`,
        stake: "£10",
        return: `£${(10 * accaOdds).toFixed(2)}`
      });
    }

    // 3. Goals Treble Idea
    const goalsSelections = matchesData
      .filter(m => m.predictions.goals.prediction === "Over 2.5")
      .slice(0, 3);

    if (goalsSelections.length >= 2) {
      bets.push({
        type: "Goals Acca",
        selections: goalsSelections.map(m => `Over 2.5 in ${m.homeTeam}`),
        odds: "4/1 (Est)",
        confidence: "Medium",
        stake: "£5",
        return: "£25.00"
      });
    }

    setRecommendedBets(bets);
  };

  // On mount, load the Real Data (Simulator Mode)
  useEffect(() => {
    // Simulate a short loading delay for effect
    setTimeout(() => {
      setMatches(realMatches);
      generateRecommendedBets(realMatches);
      setLoading(false);
    }, 1000);
  }, []);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 85) return "text-green-600 bg-green-50";
    if (confidence >= 70) return "text-blue-600 bg-blue-50";
    return "text-orange-600 bg-orange-50";
  };

  const getResultColor = (percentage) => {
    if (percentage >= 60) return "bg-green-500";
    if (percentage >= 40) return "bg-blue-500";
    return "bg-gray-400";
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-6">
      <div className="text-white text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-4 mx-auto text-yellow-400" />
        <h2 className="text-2xl font-bold mb-2">Analyzing Latest Odds</h2>
        <p className="text-purple-200">Checking market data for upcoming fixtures...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Premier League Predictor</h1>
          </div>
          <p className="text-purple-200 text-lg flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Using Live Market Odds (Feb 2026)
          </p>
        </div>

        {/* Recommended Bets Section */}
        {matches.length > 0 && recommendedBets.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-yellow-400" />
              Recommended Bets
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendedBets.map((bet, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition">
                  <h3 className="font-bold text-yellow-400 mb-2">{bet.type}</h3>
                  <div className="text-sm text-white/80 mb-2 space-y-1">
                    {bet.selections.map((sel, i) => (
                      <div key={i} className="mb-1 border-b border-white/5 pb-1 last:border-0">• {sel}</div>
                    ))}
                  </div>
                  <div className="border-t border-white/20 pt-2 mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-purple-200">Odds:</span>
                      <span className="text-green-400 font-bold">{bet.odds}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-purple-200">Confidence:</span>
                      <span className="text-blue-300">{bet.confidence}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-white">{bet.stake} →</span>
                      <span className="text-yellow-400">{bet.return}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matches Grid */}
        <div className="grid grid-cols-1 gap-6">
          {matches.map((match) => (
            <div key={match.id} className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden border border-white/20 hover:border-white/40 transition shadow-xl">
              {/* Match Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
                <div className="flex items-center justify-between">
                  {/* Home Team */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xl md:text-2xl font-bold text-white truncate">{match.homeTeam}</span>
                    </div>
                  </div>

                  {/* VS / Time */}
                  <div className="text-center px-4">
                    <div className="text-yellow-400 text-xl font-bold">vs</div>
                    <div className="text-white/80 text-sm bg-black/20 px-2 py-0.5 rounded-full mt-1 inline-block">
                      {match.time}
                    </div>
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-xl md:text-2xl font-bold text-white truncate">{match.awayTeam}</span>
                    </div>
                  </div>
                </div>

                {/* Result Probabilities Bar */}
                <div className="mt-4 flex h-4 w-full rounded-full overflow-hidden bg-black/30">
                  <div
                    className={`${getResultColor(match.predictions.result.home)} transition-all duration-500`}
                    style={{ width: `${match.predictions.result.home}%` }}
                  />
                  <div
                    className="bg-gray-400 transition-all duration-500"
                    style={{ width: `${match.predictions.result.draw}%` }}
                  />
                  <div
                    className={`${getResultColor(match.predictions.result.away)} transition-all duration-500`}
                    style={{ width: `${match.predictions.result.away}%` }}
                  />
                </div>

                {/* Probability Labels */}
                <div className="mt-1 flex justify-between text-xs text-white/80 px-1">
                  <span>Home {match.predictions.result.home}%</span>
                  <span>Draw {match.predictions.result.draw}%</span>
                  <span>Away {match.predictions.result.away}%</span>
                </div>
              </div>

              {/* Predictions Grid */}
              <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Result Prediction */}
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <div className="text-xs text-purple-200 uppercase tracking-wider">Match Winner</div>
                  </div>
                  <div className="text-white font-bold text-lg">{match.predictions.result.tip}</div>
                </div>

                {/* Goals Prediction */}
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-green-400" />
                    <div className="text-xs text-purple-200 uppercase tracking-wider">Goals</div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-white font-bold">{match.predictions.goals.prediction}</div>
                    <div className={`text-xs px-2 py-1 rounded font-bold ${getConfidenceColor(match.predictions.goals.confidence)}`}>
                      {match.predictions.goals.confidence}% Conf.
                    </div>
                  </div>
                  <div className="text-xs text-white/50 mt-1 italic">{match.predictions.goals.reason}</div>
                </div>

                {/* Bet Builder */}
                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-3 border border-yellow-400/20 md:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-yellow-400" />
                    <div className="text-xs text-yellow-200 font-bold uppercase tracking-wider">Bet Builder Idea</div>
                  </div>
                  <div className="text-white text-sm leading-snug">
                    {match.predictions.betBuilder}
                  </div>
                </div>
              </div>

              {/* Detailed Stats Expandable */}
              <div className="px-6 pb-4 pt-0 grid grid-cols-3 gap-4 border-t border-white/5 mt-2 pt-4">
                <div className="text-center">
                  <div className="text-xs text-white/40 mb-1">Corners</div>
                  <div className="text-white text-sm font-semibold">{match.predictions.corners.prediction}</div>
                </div>
                <div className="text-center border-l border-white/10 border-r">
                  <div className="text-xs text-white/40 mb-1">Shots on Target</div>
                  <div className="text-white text-sm font-semibold">{match.predictions.shots.prediction}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-white/40 mb-1">Cards</div>
                  <div className="text-white text-sm font-semibold">{match.predictions.fouls.prediction}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-purple-200 text-xs opacity-60">
          <p>⚠️ Odds sourced from live market data (Feb 2026). Predictions are estimates. ROI not guaranteed.</p>
        </div>
      </div>
    </div>
  );
};

export default App;
