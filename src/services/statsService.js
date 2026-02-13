// Service to load and use real team statistics from scraped data

const FALLBACK_STATS = {
    home: { shots: 12, sot: 4.5, corners: 5.5, fouls: 11 },
    away: { shots: 10, sot: 3.8, corners: 4.5, fouls: 12 }
};

class StatsService {
    constructor() {
        this.teamStats = null;
        this.isLoaded = false;
        this.dataSource = 'simulated';
    }

    async loadTeamStats() {
        try {
            const response = await fetch('/teamStats.json');
            if (!response.ok) throw new Error('Failed to fetch team stats');

            const data = await response.json();
            this.teamStats = data;
            this.isLoaded = true;
            this.dataSource = 'real';

            console.log('✅ Loaded real team statistics');
            console.log(`📅 Last updated: ${data.lastUpdated}`);
            console.log(`⚽ Teams: ${Object.keys(data.teams).length}`);

            return data;
        } catch (error) {
            console.warn('⚠️  Could not load team stats, using simulated data:', error.message);
            this.dataSource = 'simulated';
            return null;
        }
    }

    getTeamStats(teamName, isHome) {
        if (!this.isLoaded || !this.teamStats) {
            return null;
        }

        const team = this.teamStats.teams[teamName];
        if (!team) {
            console.warn(`⚠️  No stats found for ${teamName}, using fallback`);
            return null;
        }

        return isHome ? team.home : team.away;
    }

    calculateMatchStats(homeTeam, awayTeam, homeProb, awayProb) {
        const homeStats = this.getTeamStats(homeTeam, true);
        const awayStats = this.getTeamStats(awayTeam, false);

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

        // Use real averages with slight variance (±15%)
        const variance = 0.15;

        const hShots = Math.round(homeStats.shotsPerGame * (1 + (Math.random() * variance * 2 - variance)));
        const aShots = Math.round(awayStats.shotsPerGame * (1 + (Math.random() * variance * 2 - variance)));

        const hSoT = Math.round(homeStats.shotsOnTargetPerGame * (1 + (Math.random() * variance * 2 - variance)));
        const aSoT = Math.round(awayStats.shotsOnTargetPerGame * (1 + (Math.random() * variance * 2 - variance)));

        const hCorners = Math.round(homeStats.cornersPerGame * (1 + (Math.random() * variance * 2 - variance)));
        const aCorners = Math.round(awayStats.cornersPerGame * (1 + (Math.random() * variance * 2 - variance)));

        const totalCorners = hCorners + aCorners;
        const expectedGoals = (hSoT * 0.3) + (aSoT * 0.25);

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
        // Fallback simulation logic (same as before)
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

    getDataSource() {
        return this.dataSource;
    }

    getLastUpdated() {
        return this.teamStats?.lastUpdated || null;
    }
}

// Export singleton instance
const statsService = new StatsService();
export default statsService;
