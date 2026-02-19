// Service to load and use real team statistics from scraped data for multiple leagues

class StatsService {
    constructor() {
        this.allLeaguesStats = null;
        this.isLoaded = false;
        this.dataSource = 'simulated';
    }

    async loadTeamStats() {
        try {
            const response = await fetch('/teamStats.json');
            if (!response.ok) throw new Error('Failed to fetch team stats');

            const data = await response.json();
            this.allLeaguesStats = data;
            this.isLoaded = true;
            this.dataSource = 'real';

            console.log('✅ Loaded real multi-league team statistics');
            console.log(`📅 Last updated: ${data.lastUpdated}`);

            return data;
        } catch (error) {
            console.warn('⚠️  Could not load team stats, using simulated data:', error.message);
            this.dataSource = 'simulated';
            return null;
        }
    }

    _normalizeTeamName(name) {
        if (!name) return "";
        const mapping = {
            'Wolverhampton Wanderers': 'Wolves',
            'Manchester United': 'Man United',
            'Manchester City': 'Man City',
            'Nottingham Forest': "Nott'm Forest",
            'Tottenham Hotspur': 'Tottenham',
            'Brighton and Hove Albion': 'Brighton',
            'West Ham United': 'West Ham',
            'Newcastle United': 'Newcastle',
            'Leicester City': 'Leicester',
            'Ipswich Town': 'Ipswich',
            'Luton Town': 'Luton',
            'Norwich City': 'Norwich',
            'Leeds United': 'Leeds',
            'Sheffield Wednesday': 'Sheffield Weds',
            'West Bromwich Albion': 'West Brom',
            'Queens Park Rangers': 'QPR',
            'Blackburn Rovers': 'Blackburn',
            'Preston North End': 'Preston',
            'Hull City': 'Hull',
            'Bristol City': 'Bristol City',
            'Cardiff City': 'Cardiff',
            'Swansea City': 'Swansea',
            'Burnley FC': 'Burnley',
            'Chelsea FC': 'Chelsea'
        };

        return mapping[name] || name;
    }

    getTeamStats(teamName, isHome, leagueId) {
        if (!this.allLeaguesStats) return null;

        const normalizedName = this._normalizeTeamName(teamName);
        const leagueMap = {
            'premier-league': 'PREMIER_LEAGUE',
            'championship': 'CHAMPIONSHIP',
            'league-one': 'LEAGUE_ONE',
            'league-two': 'LEAGUE_TWO'
        };

        const leagueKey = leagueMap[leagueId] || 'PREMIER_LEAGUE';
        const teamStats = this.allLeaguesStats.leagues[leagueKey]?.[normalizedName];

        if (!teamStats) return null;

        return isHome ? teamStats.home : teamStats.away;
    }

    calculateMatchStats(homeTeam, awayTeam, homeProb, awayProb, leagueId) {
        const homeStats = this.getTeamStats(homeTeam, true, leagueId);
        const awayStats = this.getTeamStats(awayTeam, false, leagueId);

        // If we have real stats, use them
        if (homeStats && awayStats) {
            return this.calculateFromRealStats(homeStats, awayStats, homeProb, awayProb, homeTeam, awayTeam);
        }

        // Otherwise fall back to simulated stats
        return this.simulateStats(homeProb, awayProb, homeTeam, awayTeam);
    }

    calculateFromRealStats(homeStats, awayStats, homeProb, awayProb, homeTeam, awayTeam) {
        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const homeFavored = homeProb > awayProb;

        // Match Dynamic Multiplier (Weighting based on WIN probability diff)
        // High prob = higher share of shots/corners than season average
        const probDiff = (homeProb - awayProb) / 100;
        const weightFactor = 0.6; // Sensitivity
        const hMultiplier = 1 + (probDiff * weightFactor);
        const aMultiplier = 1 - (probDiff * weightFactor);

        const variance = 0.12; // ±12% match-day variance

        const hShots = Math.round(homeStats.shotsPerGame * hMultiplier * (1 + (Math.random() * variance * 2 - variance)));
        const aShots = Math.round(awayStats.shotsPerGame * aMultiplier * (1 + (Math.random() * variance * 2 - variance)));

        const hSoT = Math.round(homeStats.shotsOnTargetPerGame * hMultiplier * (1 + (Math.random() * variance * 2 - variance)));
        const aSoT = Math.round(awayStats.shotsOnTargetPerGame * aMultiplier * (1 + (Math.random() * variance * 2 - variance)));

        const hCorners = Math.round(homeStats.cornersPerGame * hMultiplier * (1 + (Math.random() * variance * 2 - variance)));
        const aCorners = Math.round(awayStats.cornersPerGame * aMultiplier * (1 + (Math.random() * variance * 2 - variance)));

        const totalCorners = hCorners + aCorners;
        const expectedGoals = (hSoT * 0.32) + (aSoT * 0.28); // Adjusted coefficient

        return {
            goals: {
                prediction: expectedGoals > 2.6 ? "Over 2.5 Goals" : "Under 2.5 Goals",
                confidence: Math.abs(homeProb - awayProb) > 25 ? 75 : 60,
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
    }

    simulateStats(homeProb, awayProb, homeTeam, awayTeam) {
        const homeFavored = homeProb > awayProb;
        const probDiff = Math.abs(homeProb - awayProb);

        const isStrongFavorite = probDiff > 25;
        const isModFavorite = probDiff > 15;

        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        let hShots, aShots, hCorners, aCorners;

        if (isStrongFavorite) {
            if (homeFavored) {
                hShots = rand(14, 20);
                aShots = rand(5, 9);
                hCorners = rand(6, 10);
                aCorners = rand(2, 4);
            } else {
                hShots = rand(5, 9);
                aShots = rand(14, 20);
                hCorners = rand(2, 4);
                aCorners = rand(6, 10);
            }
        } else if (isModFavorite) {
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
            hShots = rand(10, 14);
            aShots = rand(9, 13);
            hCorners = rand(4, 6);
            aCorners = rand(3, 6);
        }

        const hSoT = Math.floor(hShots * (rand(35, 45) / 100));
        const aSoT = Math.floor(aShots * (rand(35, 45) / 100));
        const totalCorners = hCorners + aCorners;
        const expectedGoals = (hSoT * 0.3) + (aSoT * 0.25);

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
    }

    getRawTeamStats(teamName, leagueId) {
        if (!this.isLoaded || !this.allLeaguesStats) return null;

        const normalizedName = this._normalizeTeamName(teamName);
        const leagueMap = {
            'premier-league': 'PREMIER_LEAGUE',
            'championship': 'CHAMPIONSHIP',
            'league-one': 'LEAGUE_ONE',
            'league-two': 'LEAGUE_TWO'
        };

        const leagueKey = leagueMap[leagueId] || 'PREMIER_LEAGUE';
        return this.allLeaguesStats.leagues[leagueKey]?.[normalizedName] || null;
    }

    getDataSource() {
        return this.dataSource;
    }

    getLastUpdated() {
        return this.allLeaguesStats?.lastUpdated || null;
    }
}

const statsService = new StatsService();
export default statsService;
