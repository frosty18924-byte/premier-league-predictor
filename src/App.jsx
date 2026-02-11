import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Target, Flag, AlertCircle, Users, Loader2, RefreshCw, PlayCircle, Calendar, ChevronRight } from 'lucide-react';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [recommendedBets, setRecommendedBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState('this_week'); // 'this_week' | 'next_week'

  // LIVE API CONFIGURATION
  const API_KEY = 'd05b6997aa4a2a03c4a0c5a0ecf5f0a3';
  const SPORT_KEY = 'soccer_epl'; // Premier League
  const REGIONS = 'uk';
  const MARKETS = 'h2h';

  // --- Utility: Calculate Probability from Decimal Odds ---
  const getImpliedProbability = (odds) => {
    return Math.round((1 / odds) * 100);
  };

  const isDateInThisWeek = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    // Reset time part for accurate date comparison if needed, but simple comparison is okay
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    return date >= now && date < nextWeek;
  };

  const isDateInNextWeek = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const startOfNext = new Date();
    startOfNext.setDate(now.getDate() + 7);
    const endOfNext = new Date();
    endOfNext.setDate(now.getDate() + 14);
    return date >= startOfNext && date < endOfNext;
  };

  // --- Betting Logic ---
  const generatePredictions = (match) => {
    // Extract odds
    const outcomes = match.bookmakers[0]?.markets[0]?.outcomes;
    if (!outcomes) return null;

    const home = outcomes.find(o => o.name === match.home_team);
    const away = outcomes.find(o => o.name === match.away_team);
    const draw = outcomes.find(o => o.name === 'Draw');

    if (!home || !away || !draw) return null;

    const homeProb = getImpliedProbability(home.price);
    const awayProb = getImpliedProbability(away.price);
    const drawProb = getImpliedProbability(draw.price);

    // Normalize to 100%
    const total = homeProb + awayProb + drawProb;
    const normHome = Math.round((homeProb / total) * 100);
    const normAway = Math.round((awayProb / total) * 100);
    const normDraw = Math.round((drawProb / total) * 100);

    // Determine Prediction
    let tip = "Avoid";
    let confidence = 0;
    let tipOdds = 0;

    if (normHome > 55) { tip = `${match.home_team} Win`; confidence = normHome; tipOdds = home.price; }
    else if (normAway > 55) { tip = `${match.away_team} Win`; confidence = normAway; tipOdds = away.price; }
    else if (normDraw > 35) { tip = "Draw"; confidence = normDraw; tipOdds = draw.price; }
    else { tip = "Double Chance 1X"; confidence = normHome + normDraw; tipOdds = 1.30; } // Fallback

    const isHighScoring = (normHome + normAway) > 80; // Rough heuristic

    return {
      id: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      rawDate: match.commence_time,
      time: new Date(match.commence_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      odds: tipOdds,
      predictions: {
        result: { home: normHome, draw: normDraw, away: normAway, tip, confidence },
        goals: {
          prediction: isHighScoring ? "Over 2.5" : "Under 2.5",
          confidence: isHighScoring ? 65 : 60,
          reason: isHighScoring ? "OPEN GAME EXPECTED" : "TIGHT AFFAIR LIKELY"
        },
        corners: { prediction: "Over 9.5", confidence: 60, total: "?" },
        shots: { prediction: "High Shots", home: "?", away: "?" },
        fouls: { prediction: "Avg", confidence: 50, cards: "?" },
        betBuilder: `${tip} + ${isHighScoring ? 'Over 1.5 Goals' : 'Under 3.5 Goals'}`
      }
    };
  };

  const generateRecommendedBets = (processedMatches) => {
    const bets = [];
    const validMatches = processedMatches.filter(m => m && m.predictions.result.tip !== "Avoid");

    if (validMatches.length === 0) return;

    // 1. SAFEST BANKER
    const riskSorted = [...validMatches].sort((a, b) => b.predictions.result.confidence - a.predictions.result.confidence);
    const banker = riskSorted[0];
    if (banker) {
      bets.push({
        type: "Safest Banker",
        selections: [banker.predictions.result.tip],
        odds: banker.odds.toFixed(2),
        confidence: `${banker.predictions.result.confidence}%`,
        stake: "£20",
        return: `£${(20 * banker.odds).toFixed(2)}`
      });
    }

    // 2. VALUE ACCA (Top 3 Favorites)
    const accaPicks = riskSorted.slice(0, 3);
    if (accaPicks.length >= 2) {
      let accaOdds = 1.0;
      const names = [];
      accaPicks.forEach(p => {
        accaOdds *= p.odds;
        names.push(`${p.predictions.result.tip} (${p.odds.toFixed(2)})`);
      });

      bets.push({
        type: "Value Acca",
        selections: names,
        odds: accaOdds.toFixed(2),
        confidence: "High",
        stake: "£10",
        return: `£${(10 * accaOdds).toFixed(2)}`
      });
    }

    setRecommendedBets(bets);
  };

  // --- Fetch Function ---
  const fetchLiveOdds = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds/?regions=${REGIONS}&markets=${MARKETS}&apiKey=${API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.length === 0) {
        setError("No odds currently available for Premier League. Season might be over or on break.");
        setLoading(false);
        return;
      }

      const processed = data.map(generatePredictions).filter(Boolean);
      setMatches(processed);
      generateRecommendedBets(processed);
      setLoading(false);

    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load live odds. Check API Key quota.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveOdds();
  }, []);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 75) return "text-green-600 bg-green-50";
    if (confidence >= 60) return "text-blue-600 bg-blue-50";
    return "text-orange-600 bg-orange-50";
  };

  const getResultColor = (percentage) => {
    if (percentage >= 60) return "bg-green-500";
    if (percentage >= 40) return "bg-blue-500";
    return "bg-gray-400";
  };

  const displayedMatches = matches.filter(match => {
    if (filterMode === 'this_week') return isDateInThisWeek(match.rawDate);
    if (filterMode === 'next_week') return isDateInNextWeek(match.rawDate);
    return true;
  });

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-6">
      <div className="text-white text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-4 mx-auto text-yellow-400" />
        <h2 className="text-2xl font-bold mb-2">Connecting to Live Markets</h2>
        <p className="text-purple-200">Fetching real-time odds...</p>
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
          <p className="text-green-400 text-lg flex items-center justify-center gap-2 font-bold mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            LIVE ODDS ACTIVE
          </p>

          {/* Date Filter Toggles */}
          <div className="inline-flex bg-white/10 p-1 rounded-lg backdrop-blur-sm border border-white/20">
            <button
              onClick={() => setFilterMode('this_week')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${filterMode === 'this_week' ? 'bg-yellow-400 text-purple-900 shadow-lg' : 'text-white hover:bg-white/10'}`}
            >
              <Calendar className="w-4 h-4" />
              This Week
            </button>
            <button
              onClick={() => setFilterMode('next_week')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${filterMode === 'next_week' ? 'bg-yellow-400 text-purple-900 shadow-lg' : 'text-white hover:bg-white/10'}`}
            >
              Next Week
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="text-center text-red-100 mb-8 bg-red-900/50 p-4 rounded border border-red-500/30">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
            {error}
          </div>
        )}

        {/* Recommended Bets Section */}
        {matches.length > 0 && recommendedBets.length > 0 && filterMode === 'this_week' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-yellow-400" />
              Live Value Bets (This Week)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          {displayedMatches.length === 0 && !loading && (
            <div className="text-center text-white/50 py-12 bg-white/5 rounded-xl border border-dashed border-white/10">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No matches found for {filterMode === 'this_week' ? 'this week' : 'next week'}.</p>
              <p className="text-sm mt-2">Check back later for updated fixtures.</p>
            </div>
          )}

          {displayedMatches.map((match) => (
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
