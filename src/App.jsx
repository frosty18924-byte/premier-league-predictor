import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Target, Flag, AlertCircle, Users, Loader2, RefreshCw, PlayCircle, Calendar, ChevronRight, Calculator, Database } from 'lucide-react';
import statsService from './services/statsService';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [recommendedBets, setRecommendedBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('loading');
  const [lastUpdated, setLastUpdated] = useState(null);

  // THE ODDS API CONFIGURATION
  const API_KEY = 'c58f0ea18c296b5e55916445cba66cc6';
  const BASE_URL = 'https://api.the-odds-api.com/v4/sports';
  const SPORT_KEY = 'soccer_epl';
  const REGION = 'uk';
  const MARKET = 'h2h';

  // --- Helpers ---
  const calculateProbability = (home, draw, away) => {
    const margin = (1 / home) + (1 / draw) + (1 / away);
    return {
      home: Math.round(((1 / home) / margin) * 100),
      draw: Math.round(((1 / draw) / margin) * 100),
      away: Math.round(((1 / away) / margin) * 100)
    };
  };

  const simulateStats = (homeProb, awayProb, homeTeam, awayTeam) => {
    // Determine which team is stronger based on win probability
    const homeFavored = homeProb > awayProb;
    const probDiff = Math.abs(homeProb - awayProb);

    // Strong favorite if probability difference is > 25%
    const isStrongFavorite = probDiff > 25;
    const isModFavorite = probDiff > 15;

    // Random variance to make it look natural
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    let hShots, aShots, hCorners, aCorners;

    if (isStrongFavorite) {
      // Clear favorite: Dominant team gets significantly more shots
      if (homeFavored) {
        hShots = rand(14, 20);
        aShots = rand(5, 9);
        hCorners = rand(6, 10);
        aCorners = rand(2, 4);
      } else {
        // Away team is strong favorite (rare but happens)
        hShots = rand(5, 9);
        aShots = rand(14, 20);
        hCorners = rand(2, 4);
        aCorners = rand(6, 10);
      }
    } else if (isModFavorite) {
      // Moderate favorite: Some advantage but not dominant
      if (homeFavored) {
        hShots = rand(12, 16);
        aShots = rand(7, 11);
        hCorners = rand(5, 8);
        aCorners = rand(3, 5);
      } else {
        hShots = rand(7, 11);
        aShots = rand(12, 16);
        hCorners = rand(3, 5);
        aCorners = rand(5, 8);
      }
    } else {
      // Balanced game: Even stats with slight home advantage
      hShots = rand(10, 14);
      aShots = rand(9, 13);
      hCorners = rand(4, 6);
      aCorners = rand(3, 6);
    }

    // More realistic SoT conversion (35-45% is typical in Premier League)
    const hSoT = Math.floor(hShots * (rand(35, 45) / 100));
    const aSoT = Math.floor(aShots * (rand(35, 45) / 100));
    const totalCorners = hCorners + aCorners;
    const expectedGoals = (hSoT * 0.3) + (aSoT * 0.25); // Rough xG model

    return {
      goals: {
        prediction: expectedGoals > 2.6 ? "Over 2.5 Goals" : "Under 2.5 Goals",
        confidence: isStrongFavorite ? 75 : 60,
        val: expectedGoals.toFixed(1)
      },
      stats: {
        fouls: `${rand(18, 26)} (Avg)`,
        corners: { home: hCorners, away: aCorners, total: totalCorners },
        shots: { home: hShots, away: aShots },
        sot: { home: hSoT, away: aSoT }
      },
      betBuilder: `${homeFavored ? homeTeam : awayTeam} to Win + ${expectedGoals > 2.2 ? 'Over 1.5 Goals' : 'Under 3.5 Goals'}`
    };
  };

  // Load team statistics on mount
  useEffect(() => {
    const loadStats = async () => {
      const data = await statsService.loadTeamStats();
      setDataSource(statsService.getDataSource());
      setLastUpdated(statsService.getLastUpdated());
    };
    loadStats();
  }, []);

  const processMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BASE_URL}/${SPORT_KEY}/odds/?regions=${REGION}&markets=${MARKET}&oddsFormat=decimal&apiKey=${API_KEY}`
      );

      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      const data = await response.json();

      // Filter for upcoming matches (e.g. within next 7 days) and limit to 10
      const upcoming = data.slice(0, 10);

      const processed = upcoming.map(match => {
        // Get best odds
        const bookmaker = match.bookmakers.find(b => b.key === 'bet365' || b.key === 'williamhill') || match.bookmakers[0];
        const market = bookmaker?.markets[0];
        if (!market) return null;

        const homeOdd = market.outcomes.find(o => o.name === match.home_team)?.price;
        const awayOdd = market.outcomes.find(o => o.name === match.away_team)?.price;
        const drawOdd = market.outcomes.find(o => o.name === 'Draw')?.price;

        if (!homeOdd || !awayOdd) return null;

        const probs = calculateProbability(homeOdd, drawOdd, awayOdd);

        // Determine Tip
        let tip = "Draw";
        let confidence = probs.draw;
        let tipOdd = drawOdd;

        if (probs.home > probs.away && probs.home > probs.draw) {
          tip = `${match.home_team} Win`;
          confidence = probs.home;
          tipOdd = homeOdd;
        } else if (probs.away > probs.home && probs.away > probs.draw) {
          tip = `${match.away_team} Win`;
          confidence = probs.away;
          tipOdd = awayOdd;
        }

        // Double Chance Display for closer games
        if (confidence < 45) {
          if (probs.home >= probs.away) {
            tip = `${match.home_team} or Draw`;
            confidence = probs.home + probs.draw;
            // Approx odds calc for DC
            tipOdd = 1 / ((1 / homeOdd) + (1 / drawOdd));
          } else {
            tip = `${match.away_team} or Draw`;
            confidence = probs.away + probs.draw;
            tipOdd = 1 / ((1 / awayOdd) + (1 / drawOdd));
          }
        }

        const simulated = statsService.calculateMatchStats(match.home_team, match.away_team, probs.home, probs.away);

        return {
          id: match.id,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          rawDate: match.commence_time,
          dateStr: new Date(match.commence_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          timeStr: new Date(match.commence_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          odds: parseFloat(tipOdd).toFixed(2),
          predictions: {
            result: { home: probs.home, draw: probs.draw, away: probs.away, tip, confidence },
            ...simulated
          }
        };
      }).filter(Boolean);

      setMatches(processed);
      generateRecommendedBets(processed);
      setLoading(false);

    } catch (err) {
      console.error("Fetch error", err);
      setError("Failed to load live odds. " + err.message);
      setLoading(false);
    }
  };

  const generateRecommendedBets = (processedMatches) => {
    const bets = [];
    // 1. Banker
    const banker = [...processedMatches].sort((a, b) => b.predictions.result.confidence - a.predictions.result.confidence)[0];
    if (banker) {
      bets.push({
        type: "Safest Banker",
        selections: [banker.predictions.result.tip],
        odds: banker.odds,
        confidence: `${banker.predictions.result.confidence}%`,
        stake: "£20",
        return: `£${(20 * banker.odds).toFixed(2)}`
      });
    }
    setRecommendedBets(bets);
  };

  useEffect(() => {
    processMatches();
  }, []);

  // --- UI Helpers ---
  const getConfidenceColor = (confidence) => {
    if (confidence >= 75) return "text-green-600 bg-green-50";
    if (confidence >= 60) return "text-blue-600 bg-blue-50";
    return "text-orange-600 bg-orange-50";
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-6">
      <div className="text-white text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-4 mx-auto text-yellow-400" />
        <h2 className="text-2xl font-bold mb-2">Scanning Markets...</h2>
        <p className="text-purple-200">Fetching live odds from UK Bookmakers</p>
      </div>
    </div>
  );

  const accumulator = matches.filter(m => m.predictions.result.confidence > 50).slice(0, 5);
  const accaOdds = accumulator.reduce((acc, curr) => acc * curr.odds, 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-6 pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Men's Premier League Predictor</h1>
          </div>
          <p className="text-green-400 text-lg flex items-center justify-center gap-2 font-bold mb-4">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            LIVE ODDS & PREDICTIONS
          </p>
          <div className="flex items-center justify-center gap-2 text-sm">
            {dataSource === 'real' ? (
              <div className="bg-green-500/20 border border-green-500/50 px-3 py-1 rounded-full flex items-center gap-2">
                <Database className="w-3 h-3 text-green-400" />
                <span className="text-green-300 font-semibold">Real Season Stats</span>
              </div>
            ) : dataSource === 'simulated' ? (
              <div className="bg-orange-500/20 border border-orange-500/50 px-3 py-1 rounded-full flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-orange-400" />
                <span className="text-orange-300 font-semibold">Simulated Stats</span>
              </div>
            ) : null}
            {lastUpdated && (
              <span className="text-white/40 text-xs">
                Updated: {new Date(lastUpdated).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="text-center text-red-100 mb-8 bg-red-900/50 p-4 rounded border border-red-500/30">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 mb-12">
          {matches.map((match) => (
            <div key={match.id} className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden border border-white/20 shadow-xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 font-bold text-white text-xl">{match.homeTeam}</div>
                  <div className="px-4 text-center">
                    <div className="text-yellow-400 font-bold text-lg">VS</div>
                    <div className="flex flex-col items-center justify-center mt-1">
                      <div className="text-[10px] uppercase tracking-wider text-white/60 font-bold">{match.dateStr}</div>
                      <div className="text-sm text-white font-mono bg-white/10 px-2 py-0.5 rounded mt-0.5">{match.timeStr}</div>
                    </div>
                  </div>
                  <div className="flex-1 font-bold text-white text-xl text-right">{match.awayTeam}</div>
                </div>
                {/* Probability Bar */}
                <div className="mt-3 flex h-3 w-full rounded-full overflow-hidden bg-black/30">
                  <div className="bg-green-500" style={{ width: `${match.predictions.result.home}%` }} />
                  <div className="bg-gray-400" style={{ width: `${match.predictions.result.draw}%` }} />
                  <div className="bg-blue-500" style={{ width: `${match.predictions.result.away}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-white/80 px-1">
                  <span>{match.predictions.result.home}%</span>
                  <span>{match.predictions.result.draw}%</span>
                  <span>{match.predictions.result.away}%</span>
                </div>
              </div>

              {/* Stats Grid - SIMULATED BASED ON ODDS */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Main Result Prediction */}
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <div className="text-xs text-purple-200 uppercase tracking-wider">Prediction</div>
                  </div>
                  <div className="text-white font-bold text-lg">{match.predictions.result.tip}</div>
                  <div className="text-xs text-white/50 mt-1">Confidence: {match.predictions.result.confidence}%</div>
                </div>

                {/* 2. Goals & Fouls Averages */}
                <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-xs text-purple-200 uppercase">Exp. Goals</span>
                    <div className="text-right">
                      <span className="text-white font-bold block">{match.predictions.goals.prediction}</span>
                      <span className="text-xs text-white/50">{match.predictions.goals.val} Exp.</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-purple-200 uppercase">Avg Fouls/Game</span>
                    <span className="text-white font-bold">{match.predictions.stats.fouls}</span>
                  </div>
                </div>

                {/* 3. Detailed Stats (Season Averages) */}
                <div className="bg-white/5 rounded-lg p-3 border border-white/10 md:col-span-2 lg:col-span-1">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2 text-purple-200 font-bold">
                    <div>Est. Stats</div>
                    <div>Home</div>
                    <div>Away</div>
                  </div>
                  {/* Corners */}
                  <div className="grid grid-cols-3 gap-2 text-center text-sm border-b border-white/5 pb-1 mb-1">
                    <div className="text-left text-white/70">Corners</div>
                    <div className="text-white font-mono">{match.predictions.stats.corners.home}</div>
                    <div className="text-white font-mono">{match.predictions.stats.corners.away}</div>
                  </div>
                  {/* Shots */}
                  <div className="grid grid-cols-3 gap-2 text-center text-sm border-b border-white/5 pb-1 mb-1">
                    <div className="text-left text-white/70">Shots</div>
                    <div className="text-white font-mono">{match.predictions.stats.shots.home}</div>
                    <div className="text-white font-mono">{match.predictions.stats.shots.away}</div>
                  </div>
                  {/* SoT */}
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="text-left text-white/70">On Target</div>
                    <div className="text-white font-mono">{match.predictions.stats.sot.home}</div>
                    <div className="text-white font-mono">{match.predictions.stats.sot.away}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BET BUILDER / ACCA SUMMARY COMPONENT FIXED AT BOTTOM */}
      {accumulator.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-yellow-500/30 p-4 shadow-2xl z-50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500 p-2 rounded-lg text-black">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">The Weekend Acca</h3>
                <p className="text-gray-400 text-xs">{accumulator.length} Selections</p>
              </div>
            </div>

            <div className="flex-1 flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 px-2 mask-linear">
              {accumulator.map((acc, idx) => (
                <div key={idx} className="bg-white/10 rounded px-3 py-1.5 min-w-[140px] flex-shrink-0 border border-white/10">
                  <div className="text-yellow-400 text-xs font-bold truncate">{acc.homeTeam} v {acc.awayTeam}</div>
                  <div className="text-white text-sm font-bold truncate">{acc.predictions.result.tip}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 bg-black/40 p-3 rounded-lg border border-white/10 min-w-[200px]">
              <div>
                <div className="text-xs text-gray-400">Total Odds</div>
                <div className="text-white font-bold text-xl">{accaOdds.toFixed(2)}</div>
              </div>
              <div className="h-8 w-px bg-white/20"></div>
              <div>
                <div className="text-xs text-gray-400">£10 Returns</div>
                <div className="text-green-400 font-bold text-xl">£{(accaOdds * 10).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
