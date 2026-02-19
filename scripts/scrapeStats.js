import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEAGUES = {
    PREMIER_LEAGUE: 'PREMIER_LEAGUE',
    CHAMPIONSHIP: 'CHAMPIONSHIP',
    LEAGUE_ONE: 'LEAGUE_ONE',
    LEAGUE_TWO: 'LEAGUE_TWO'
};

// football-data.co.uk CSV endpoints (E0-E3 for top 4 English leagues)
const LEAGUE_CONFIGS = {
    [LEAGUES.PREMIER_LEAGUE]: { code: 'E0', name: 'Premier League' },
    [LEAGUES.CHAMPIONSHIP]: { code: 'E1', name: 'Championship' },
    [LEAGUES.LEAGUE_ONE]: { code: 'E2', name: 'League One' },
    [LEAGUES.LEAGUE_TWO]: { code: 'E3', name: 'League Two' }
};

const SEASON = '2526'; // Format YYZZ for 2025-2026

async function fetchAndAggregateStats(leagueKey) {
    const config = LEAGUE_CONFIGS[leagueKey];
    const url = `https://www.football-data.co.uk/mmz4281/${SEASON}/${config.code}.csv`;

    try {
        console.log(`📡 Fetching match data for ${config.name}...`);
        const { data } = await axios.get(url);

        // Simple CSV parser
        const lines = data.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return {};

        const headers = lines[0].split(',');
        const rows = lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, i) => {
                obj[header] = values[i];
            });
            return obj;
        });

        const teamStats = {};

        rows.forEach(row => {
            const homeTeam = row.HomeTeam;
            const awayTeam = row.AwayTeam;

            if (!homeTeam || !awayTeam) return;

            // Initialize teams if not exists
            if (!teamStats[homeTeam]) teamStats[homeTeam] = { home: { games: 0, s: 0, st: 0, c: 0, f: 0 }, away: { games: 0, s: 0, st: 0, c: 0, f: 0 } };
            if (!teamStats[awayTeam]) teamStats[awayTeam] = { home: { games: 0, s: 0, st: 0, c: 0, f: 0 }, away: { games: 0, s: 0, st: 0, c: 0, f: 0 } };

            // Accumulate Home Stats
            teamStats[homeTeam].home.games++;
            teamStats[homeTeam].home.s += parseFloat(row.HS) || 0;
            teamStats[homeTeam].home.st += parseFloat(row.HST) || 0;
            teamStats[homeTeam].home.c += parseFloat(row.HC) || 0;
            teamStats[homeTeam].home.f += parseFloat(row.HF) || 0;

            // Accumulate Away Stats
            teamStats[awayTeam].away.games++;
            teamStats[awayTeam].away.s += parseFloat(row.AS) || 0;
            teamStats[awayTeam].away.st += parseFloat(row.AST) || 0;
            teamStats[awayTeam].away.c += parseFloat(row.AC) || 0;
            teamStats[awayTeam].away.f += parseFloat(row.AF) || 0;
        });

        // Calculate Averages
        const finalStats = {};
        Object.keys(teamStats).forEach(team => {
            const s = teamStats[team];
            finalStats[team] = {
                home: {
                    shotsPerGame: s.home.games > 0 ? Math.round((s.home.s / s.home.games) * 10) / 10 : 12,
                    shotsOnTargetPerGame: s.home.games > 0 ? Math.round((s.home.st / s.home.games) * 10) / 10 : 4,
                    cornersPerGame: s.home.games > 0 ? Math.round((s.home.c / s.home.games) * 10) / 10 : 5,
                    foulsPerGame: s.home.games > 0 ? Math.round((s.home.f / s.home.games) * 10) / 10 : 10
                },
                away: {
                    shotsPerGame: s.away.games > 0 ? Math.round((s.away.s / s.away.games) * 10) / 10 : 10,
                    shotsOnTargetPerGame: s.away.games > 0 ? Math.round((s.away.st / s.away.games) * 10) / 10 : 3.5,
                    cornersPerGame: s.away.games > 0 ? Math.round((s.away.c / s.away.games) * 10) / 10 : 4,
                    foulsPerGame: s.away.games > 0 ? Math.round((s.away.f / s.away.games) * 10) / 10 : 11
                }
            };
        });

        return finalStats;
    } catch (error) {
        console.error(`Error processing ${config.name}:`, error.message);
        return {};
    }
}

async function scrapeAllStats() {
    console.log('🔍 Starting comprehensive football stats aggregator...\n');

    const allLeaguesStats = {
        lastUpdated: new Date().toISOString(),
        season: '2025-26',
        dataSource: 'Aggregated match-by-match data from football-data.co.uk',
        leagues: {}
    };

    for (const leagueKey of Object.keys(LEAGUE_CONFIGS)) {
        const stats = await fetchAndAggregateStats(leagueKey);
        allLeaguesStats.leagues[leagueKey] = stats;
        console.log(`✅ Processed ${Object.keys(stats).length} teams for ${LEAGUE_CONFIGS[leagueKey].name}`);
    }

    const outputPath = path.join(__dirname, '..', 'public', 'teamStats.json');
    const publicDir = path.dirname(outputPath);
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    fs.writeFileSync(outputPath, JSON.stringify(allLeaguesStats, null, 2));

    console.log('\n✅ Successfully updated teamStats.json');
    console.log(`📁 Location: ${outputPath}`);
    console.log(`📅 Last updated: ${allLeaguesStats.lastUpdated}\n`);
}

scrapeAllStats();
