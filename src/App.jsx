import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Target, Flag, AlertCircle, Users, Loader2, RefreshCw, PlayCircle } from 'lucide-react';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [recommendedBets, setRecommendedBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('YOUR_API_KEY_HERE'); // User to replace this
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Mock Data for Demo Mode
  const mockMatches = [
    {
      id: 101,
      homeTeam: "Arsenal",
      awayTeam: "Everton",
      time: "19:45",
      odds: 1.25,
      predictions: {
        result: { home: 75.0, draw: 18.0, away: 7.0, tip: "Arsenal Win", confidence: 75.0 },
        goals: { prediction: "Over 2.5", confidence: 88, reason: "Strong attack from Arsenal" },
        corners: { prediction: "Over 9.5", confidence: 85, total: "10-12" },
        shots: { prediction: "Arsenal Over 6.5 SOT", home: "7-9", away: "2-3" },
        fouls: { prediction: "Over 18.5", confidence: 72, cards: "2-3" },
        betBuilder: "Arsenal Win + Over 2.5 + Over 9.5 Corners"
      }
    },
    {
      id: 102,
      homeTeam: "Wolves",
      awayTeam: "Bournemouth",
      time: "20:00",
      odds: 2.40,
      predictions: {
        result: { home: 40.0, draw: 32.0, away: 28.0, tip: "Wolves Win", confidence: 40.0 },
        goals: { prediction: "Under 2.5", confidence: 65, reason: "Tight game expected" },
        corners: { prediction: "Under 10.5", confidence: 60, total: "8-10" },
        shots: { prediction: "Under 8.5 Total SOT", home: "4-5", away: "3-4" },
        fouls: { prediction: "Over 22.5", confidence: 78, cards: "4-5" },
        betBuilder: "Wolves Win + Under 2.5 Goals"
      }
    },
    {
      id: 103,
      homeTeam: "Liverpool",
      awayTeam: "Chelsea",
      time: "20:15",
      odds: 1.85,
      predictions: {
        result: { home: 52.0, draw: 26.0, away: 22.0, tip: "Liverpool Win", confidence: 52.0 },
        goals: { prediction: "Over 2.5", confidence: 82, reason: "High tempo match expected" },
        corners: { prediction: "Over 10.5", confidence: 75, total: "11-13" },
        shots: { prediction: "Liverpool Over 5.5 SOT", home: "6-8", away: "4-6" },
        fouls: { prediction: "Over 24.5", confidence: 88, cards: "5-6" },
        betBuilder: "Liverpool Win + Salah To Score + Over 3.5 Cards"
      }
    },
    {
      id: 104,
      homeTeam: "Man United",
      awayTeam: "Luton",
      time: "15:00",
      odds: 1.30,
      predictions: {
        result: { home: 72.0, draw: 18.0, away: 10.0, tip: "Man United Win", confidence: 72.0 },
        goals: { prediction: "Over 2.5", confidence: 80, reason: "United strong at home" },
        corners: { prediction: "Over 9.5", confidence: 82, total: "10-12" },
        shots: { prediction: "United Over 6.5 SOT", home: "7-8", away: "2-3" },
        fouls: { prediction: "Over 19.5", confidence: 70, cards: "2-3" },
        betBuilder: "Man United Win + Rashford To Score"
      }
    }
  ];

  // Helper to calculate probability from odds
  const calculateProbability = (home, draw, away) => {
    const margin = (1 / home) + (1 / draw) + (1 / away);
    return {
      home: Math.round(((1 / home) / margin) * 100 * 10) / 10,
      draw: Math.round(((1 / draw) / margin) * 100 * 10) / 10,
      away: Math.round(((1 / away) / margin) * 100 * 10) / 10
    };
  };

  // Helper to simulate detailed stats based on win probability
  const simulateStats = (prob, teamName) => {
    // If a team is heavily favored (>60%), they likely have more corners/shots
    const isFavorite = prob > 55;
    const isHeavyFavorite = prob > 70;

    return {
      goals: {
        prediction: isFavorite ? "Over 2.5" : "Under 2.5",
        confidence: isHeavyFavorite ? 85 : 65,
        reason: isFavorite ? `Strong attack from ${teamName}` : "Tight game expected"
      },
      corners: {
        prediction: isFavorite ? "Over 9.5" : "Under 10.5",
        confidence: isHeavyFavorite ? 80 : 60,
        total: isFavorite ? "10-12" : "8-10",
      },
      shots: {
        prediction: isFavorite ? `${teamName} Over 5.5 SOT` : "Under 8.5 Total SOT",
        home: isFavorite ? "6-8" : "3-5",
        away: isFavorite ? "2-4" : "3-5"
      },
      fouls: {
        prediction: "Over 20.5",
        confidence: 70 + Math.floor(Math.random() * 10),
        cards: "3-4"
      }
    };
  };

  const generateRecommendedBets = (matchesData) => {
    const bets = [];

    // 1. Find the safest single bet (highest win probability)
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

    // 2. Build a "Value Acca" around 5/1 (6.0)
    // Sort matches by confidence to include the best ones first
    const sortedMatches = [...matchesData].sort((a, b) => b.predictions.result.confidence - a.predictions.result.confidence);

    let accaSelections = [];
    let accaOdds = 1.0;
    let accaConfidence = 100;

    for (const match of sortedMatches) {
      // Stop if we are already above 5.0 (4/1) and adding another would make it too risky/high
      // We target roughly 6.0 (5/1)
      if (accaOdds >= 5.5) break;

      accaSelections.push(`${match.predictions.result.tip} (${match.odds.toFixed(2)})`);
      accaOdds *= match.odds;
      accaConfidence = Math.min(accaConfidence, match.predictions.result.confidence);
    }

    if (accaSelections.length >= 2) {
      bets.push({
        type: "Target 5/1 Acca",
        selections: accaSelections,
        odds: `${(accaOdds - 1).toFixed(1)}/1 (${accaOdds.toFixed(2)})`, // Display fractional approx + decimal
        confidence: `${Math.round(accaConfidence * 0.8)}% (Combined)`, // Heuristic combined confidence
        stake: "£10",
        return: `£${(10 * accaOdds).toFixed(2)}`
      });
    }

    // 3. High Risk / High Reward (Bet Builders combined)
    // Just take the top 2 matches and combine their bet builders? 
    // For now, let's just do a "Goals Treble" - Over 2.5 in top 3 games
    const goalsMatches = matchesData.slice(0, 3);
    if (goalsMatches.length === 3) {
      bets.push({
        type: "Goals Treble",
        selections: goalsMatches.map(m => `Over 2.5 in ${m.homeTeam} vs ${m.awayTeam}`),
        odds: "6/1 (Est)",
        confidence: "Medium",
        stake: "£5",
        return: "£35.00"
      });
    }

    setRecommendedBets(bets);
  };

  const loadDemoData = () => {
    setIsDemoMode(true);
    setLoading(true);
    setError(null);

    // Simulate network delay
    setTimeout(() => {
      setMatches(mockMatches);
      generateRecommendedBets(mockMatches);
      setLoading(false);
    }, 800);
  };

  const fetchFixtures = async () => {
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      setError("Please enter a valid API Key from the-odds-api.com");
      setShowApiKeyInput(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsDemoMode(false);

    try {
      // Get odds for upcoming matches
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?regions=uk&markets=h2h&oddsFormat=decimal&apiKey=${apiKey}`
      );

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();

      // Filter for matches happening today/soon
      // Note: In production, better date comparison is needed. This just takes the first 10 for now.
      const processedMatches = data.slice(0, 10).map((match) => {
        const outcome = match.bookmakers[0]?.markets[0]?.outcomes;
        if (!outcome) return null;

        const homeOdd = outcome.find(o => o.name === match.home_team)?.price || 2.0;
        const awayOdd = outcome.find(o => o.name === match.away_team)?.price || 2.0;
        const drawOdd = outcome.find(o => o.name === 'Draw')?.price || 3.0;

        const probs = calculateProbability(homeOdd, drawOdd, awayOdd);

        // Determine tip and odds for that tip
        let tip = "Draw";
        let tipConfidence = probs.draw;
        let tipOdds = drawOdd;

        if (probs.home > probs.away && probs.home > probs.draw) {
          tip = `${match.home_team} Win`;
          tipConfidence = probs.home;
          tipOdds = homeOdd;
        } else if (probs.away > probs.home && probs.away > probs.draw) {
          tip = `${match.away_team} Win`;
          tipConfidence = probs.away;
          tipOdds = awayOdd;
        }

        const stats = simulateStats(tipConfidence, tip.replace(' Win', ''));

        return {
          id: match.id,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          time: new Date(match.commence_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          odds: tipOdds, // Store the odds for the predicted outcome
          predictions: {
            result: { home: probs.home, draw: probs.draw, away: probs.away, tip, confidence: tipConfidence },
            ...stats,
            betBuilder: `${tip} + ${stats.goals.prediction} + ${stats.corners.prediction}`
          }
        };
      }).filter(Boolean);

      setMatches(processedMatches);
      generateRecommendedBets(processedMatches);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch data');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey !== 'YOUR_API_KEY_HERE') {
      fetchFixtures();
    } else {
      setLoading(false);
      setError("Please enter a valid API Key from the-odds-api.com");
    }
  }, [apiKey]);

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
        <h2 className="text-2xl font-bold mb-2">Analyzing Live Markets</h2>
        <p className="text-purple-200">Fetching latest odds...</p>
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
          <p className="text-purple-200 text-lg">
            {isDemoMode ? "Live Odds & Smart Predictions (DEMO MODE)" : "Live Odds & Smart Predictions"}
          </p>

          <div className="flex justify-center gap-4 mt-4">
            {!isDemoMode && (
              <button
                onClick={fetchFixtures}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full flex items-center gap-2 transition border border-white/20"
              >
                <RefreshCw className="w-4 h-4" /> Refresh Odds
              </button>
            )}
            {isDemoMode && (
              <button
                onClick={() => window.location.reload()}
                className="bg-red-500/20 hover:bg-red-500/40 text-white px-4 py-2 rounded-full flex items-center gap-2 transition border border-red-500/50"
              >
                <RefreshCw className="w-4 h-4" /> Exit Demo & Enter API Key
              </button>
            )}
          </div>
        </div>

        {/* Error / API Key Input State */}
        {error && !isDemoMode && (
          <div className="max-w-md mx-auto mb-8 bg-red-500/20 border border-red-500/50 p-6 rounded-xl text-center backdrop-blur-sm">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-white font-bold mb-2">Setup Required</p>
            <p className="text-sm text-white/80 mb-4">{error}</p>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={apiKey === 'YOUR_API_KEY_HERE' ? '' : apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste API Key from the-odds-api.com"
                className="w-full p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
              />
              <button
                onClick={fetchFixtures}
                className="bg-yellow-400 hover:bg-yellow-500 text-purple-900 font-bold px-4 py-2 rounded transition"
              >
                Save & Retry
              </button>
              <div className="flex items-center justify-between mt-2 px-1">
                <a
                  href="https://the-odds-api.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-300 hover:text-blue-200 underline"
                >
                  Get a free API key here
                </a>
                <button
                  onClick={loadDemoData}
                  className="text-xs text-white/60 hover:text-white flex items-center gap-1"
                >
                  <PlayCircle className="w-3 h-3" /> Use Demo Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recommended Bets Section - Now Dynamic! */}
        {!loading && matches.length > 0 && recommendedBets.length > 0 && (
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
          {matches.length === 0 && !loading && !error && (
            <div className="text-center text-white/60 py-12 bg-white/5 rounded-xl border border-white/10">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
              No live matches found right now. Check back later!
            </div>
          )}

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

              {/* Detailed Stats Expandable (Simulated) */}
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
          <p>⚠️ Predictions are estimates based on live market odds. This tool does not guarantee results.</p>
          <p className="mt-1">Data provided by The Odds API. Odds subject to change.</p>
        </div>
      </div>
    </div>
  );
};

export default App;
