import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Target, Flag, AlertCircle, Users, Loader2, RefreshCw, PlayCircle, Calendar, ChevronRight, Calculator } from 'lucide-react';

const App = () => {
  const [matches, setMatches] = useState([]);
  const [recommendedBets, setRecommendedBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState('next_matches'); // 'next_matches' is default

  // API-FOOTBALL CONFIGURATION
  const API_KEY = '30b42a43d11b68ae3d0e5105b565f4d';
  const BASE_URL = 'https://v3.football.api-sports.io';
  const LEAGUE_ID = 39; // Premier League
  const SEASON = 2024; // Current season

  // --- Helpers ---
  const fetchAPI = async (endpoint) => {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io"
      }
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return await response.json();
  };

  const getTeamStats = async (teamId) => {
    try {
      const data = await fetchAPI(`/teams/statistics?league=${LEAGUE_ID}&season=${SEASON}&team=${teamId}`);
      return data.response;
    } catch (e) {
      console.error("Stats fetch error", e);
      return null; // Return null if stats fail, handled later
    }
  };

  const calculatePrediction = (homeTeam, awayTeam, homeStats, awayStats, odds) => {
    // 1. Result Prediction based on Odds (most reliable for result) + Stats
    let tip = "Avoid";
    let confidence = 0;
    let betBuilderTip = "";

    // Odds Analysis (if available)
    const homeOdd = odds?.values?.find(o => o.value === 'Home')?.odd || 0;
    const awayOdd = odds?.values?.find(o => o.value === 'Away')?.odd || 0;
    const drawOdd = odds?.values?.find(o => o.value === 'Draw')?.odd || 0;

    // Implied Probabilities from Odds, defaulting to 33% if missing
    let homeProb = homeOdd ? (1 / homeOdd) * 100 : 33;
    let awayProb = awayOdd ? (1 / awayOdd) * 100 : 33;
    let drawProb = drawOdd ? (1 / drawOdd) * 100 : 33;

    // Normalize probabilities
    const total = homeProb + awayProb + drawProb;
    const normHome = Math.round((homeProb / total) * 100);
    const normAway = Math.round((awayProb / total) * 100);
    const normDraw = Math.round((drawProb / total) * 100);

    if (normHome >= 55) {
      tip = `${homeTeam.name} Win`;
      confidence = normHome;
      betBuilderTip = `${homeTeam.name} to Win`;
    } else if (normAway >= 55) {
      tip = `${awayTeam.name} Win`;
      confidence = normAway;
      betBuilderTip = `${awayTeam.name} to Win`;
    } else if (normDraw >= 35) {
      tip = "Draw";
      confidence = normDraw;
      betBuilderTip = "Draw";
    } else {
      // Double Chance logic
      if (normHome > normAway) {
        tip = `${homeTeam.name} or Draw`;
        confidence = normHome + normDraw;
        betBuilderTip = `${homeTeam.name} Double Chance`;
      } else {
        tip = `${awayTeam.name} or Draw`;
        confidence = normAway + normDraw;
        betBuilderTip = `${awayTeam.name} Double Chance`;
      }
    }

    // 2. Stats-based Predictions (Real Data!)
    // Safe accessors with default fallbacks
    const hGoals = parseFloat(homeStats?.goals?.for?.average?.total || 1.5);
    const aGoals = parseFloat(awayStats?.goals?.for?.average?.total || 1.2);
    const expectedGoals = hGoals + aGoals;

    const hCorners = homeStats?.corners?.total || 0;
    const hGames = homeStats?.fixtures?.played?.total || 1;
    const hAvgCorners = (hCorners / hGames) || 5;

    const aCorners = awayStats?.corners?.total || 0;
    const aGames = awayStats?.fixtures?.played?.total || 1;
    const aAvgCorners = (aCorners / aGames) || 4;

    const totalCorners = hAvgCorners + aAvgCorners;

    const hFouls = parseFloat(homeStats?.fouls?.average?.total || 10);
    const aFouls = parseFloat(awayStats?.fouls?.average?.total || 10);
    const totalFouls = hFouls + aFouls;

    // Determine specific goal prediction based on average
    const goalPrediction = expectedGoals > 2.5 ? "Over 2.5 Goals" : "Under 2.5 Goals";
    const goalConfidence = (expectedGoals > 2.8 || expectedGoals < 2.2) ? 65 : 55;

    return {
      result: { home: normHome, draw: normDraw, away: normAway, tip, confidence },
      goals: {
        prediction: goalPrediction,
        confidence: goalConfidence,
        val: expectedGoals.toFixed(1)
      },
      stats: {
        fouls: `${totalFouls.toFixed(1)} (Avg)`,
        corners: { home: hAvgCorners.toFixed(1), away: aAvgCorners.toFixed(1), total: totalCorners.toFixed(1) },
        shots: {
          home: (homeStats?.shots?.total?.total / hGames || 12).toFixed(1),
          away: (awayStats?.shots?.total?.total / aGames || 10).toFixed(1)
        },
        sot: {
          home: (homeStats?.shots?.on?.total / hGames || 4).toFixed(1),
          away: (awayStats?.shots?.on?.total / aGames || 3).toFixed(1)
        }
      },
      betBuilder: `${betBuilderTip} + ${expectedGoals > 2.0 ? 'Over 1.5 Goals' : 'Under 3.5 Goals'}`
    };
  };

  const processMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Next 5 Fixtures to respect rate limits
      const fixturesData = await fetchAPI(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}&next=5`);
      const fixtures = fixturesData.response;

      if (!fixtures || fixtures.length === 0) {
        setError("No upcoming matches found.");
        setLoading(false);
        return;
      }

      // 2. Process each fixture
      const processed = await Promise.all(fixtures.map(async (fixture) => {
        // Fetch Bookmaker Odds (Bwin = 6)
        let odds = null;
        try {
          const oddsData = await fetchAPI(`/odds?fixture=${fixture.fixture.id}&bookmaker=6`);
          odds = oddsData.response[0]?.bookmakers[0]?.bets?.find(b => b.name === 'Match Winner');
        } catch (e) {
          console.log("No odds for", fixture.fixture.id);
        }

        // Fetch Team Stats
        const hStats = await getTeamStats(fixture.teams.home.id);
        const aStats = await getTeamStats(fixture.teams.away.id);

        const predictions = calculatePrediction(fixture.teams.home, fixture.teams.away, hStats, aStats, odds);

        // Determine display odds
        const bestOdd = odds ? odds.values.find(v =>
          (predictions.result.tip.includes(fixture.teams.home.name) && v.value === 'Home') ||
          (predictions.result.tip.includes(fixture.teams.away.name) && v.value === 'Away') ||
          (predictions.result.tip === 'Draw' && v.value === 'Draw')
        )?.odd || 1.5 : 1.5;

        return {
          id: fixture.fixture.id,
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          rawDate: fixture.fixture.date,
          // Split date and time for cleaner UI
          dateStr: new Date(fixture.fixture.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          timeStr: new Date(fixture.fixture.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          odds: parseFloat(bestOdd),
          predictions: predictions
        };
      }));

      setMatches(processed);
      generateRecommendedBets(processed);
      setLoading(false);

    } catch (err) {
      console.error("Master fetch error", err);
      setError("Failed to load data. API Rate limit may be exceeded.");
      setLoading(false);
    }
  };

  const generateRecommendedBets = (processedMatches) => {
    const bets = [];
    const validMatches = processedMatches.filter(m => m && m.predictions.result.confidence > 50);

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

  // New helper for stats comparison color
  const getMetaColor = (val1, val2) => {
    // Return green if better, could implement logic here
    return "text-white";
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-6">
      <div className="text-white text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-4 mx-auto text-yellow-400" />
        <h2 className="text-2xl font-bold mb-2">Analyzing Season Stats...</h2>
        <p className="text-purple-200">Processing fixtures, average shots, corners & fouls.</p>
      </div>
    </div>
  );

  const accumulator = matches.filter(m => m.predictions.result.confidence > 55).slice(0, 5);
  const accaOdds = accumulator.reduce((acc, curr) => acc * curr.odds, 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-6 pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Men's Premier League Predictor</h1>
          </div>
          <p className="text-green-400 text-lg flex items-center justify-center gap-2 font-bold mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            SEASON 2024/25 LIVE DATA
          </p>
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

              {/* Stats Grid - REAL DATA */}
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
                    <div>Season Avg</div>
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
