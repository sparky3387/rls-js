// test-runner.js
//
// This script runs the test suite against the rls.js library.
// It requires the 'tests.yaml' file to be present in the same directory.

const { Rls } = require('./rls.js');
const fs = require('fs');
const path = require('path');
const { inspect } = require('util');

// --- ANSI Colors for better output ---
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
};

// --- Helper function to convert a Release object to a dict ---
function _buildRlsDict(r) {
    const d = {
        "type": r.type !== 'unknown' ? r.type : "",
        "artist": r.artist,
        "title": r.title,
        "subtitle": r.subtitle,
        "alt": r.alt,
        "platform": r.platform,
        "arch": r.arch,
        "source": r.source,
        "resolution": r.resolution,
        "collection": r.collection,
        "year": r.year,
        "month": r.month,
        "day": r.day,
        "series": r.series,
        "episode": r.episode,
        "seriesEpisodes": r.seriesEpisodes().length > 1 ? r.seriesEpisodes().map(([s, e]) => `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`).join(" ") : "",
        "version": r.version,
        "disc": r.disc,
        "codec": r.codec.sort().join(" "),
        "hdr": r.hdr.sort().join(" "),
        "audio": r.audio.sort().join(" "),
        "channels": r.channels,
        "other": r.other.sort().join(" "),
        "cut": r.cut.sort().join(" "),
        "edition": r.edition.sort().join(" "),
        "language": r.language.sort().join(" "),
        "size": r.size,
        "region": r.region,
        "container": r.container,
        "genre": r.genre,
        "id": r.id,
        "group": r.group,
        "meta": r.meta.sort().join(" "),
        "site": r.site,
        "sum": r.sum,
        "pass_": r.pass_,
        "req": r.req ? 1 : 0,
        "ext": r.ext,
        "unused": r.getUnused().map(t => t.text()).sort().join(" ")
    };
    // Return only non-empty/non-zero values for cleaner comparison
    return Object.fromEntries(Object.entries(d).filter(([_, v]) => v));
}

// --- Helper function to load tests from YAML-like file ---
function _loadTestsFromFile(yamlPath) {
    let tests = [], currentTest = null;
    try {
        const content = fs.readFileSync(yamlPath, 'utf-8').replace(/^\uFEFF/, ''); // Handle BOM
        for (const line of content.split(/\r?\n/)) {
            if (!line.trim() || line.trim().startsWith('#')) continue;

            if (!line.startsWith('  ')) {
                if (currentTest) tests.push(currentTest);
                const releaseStringRaw = line.trim().replace(/:$/, '');
                let releaseString;
                try {
                    // Correctly handle quoted strings with escapes
                    releaseString = JSON.parse(releaseStringRaw);
                } catch (e) {
                    releaseString = releaseStringRaw;
                }
                currentTest = { release_string: releaseString, expected: {} };
            } else if (currentTest) {
                const [key, ...valueParts] = line.split(':');
                const valueStr = valueParts.join(':').trim();
                let value;

                if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
                   value = valueStr.slice(1, -1);
                } else {
                    value = valueStr;
                }

                const cleanKey = key.trim();
                if (['year', 'month', 'day', 'series', 'episode', 'req'].includes(cleanKey)) {
                    currentTest.expected[cleanKey] = parseInt(value, 10);
                } else if (cleanKey === 'pass') {
                    currentTest.expected['pass_'] = value;
                } else {
                    currentTest.expected[cleanKey] = value;
                }
            }
        }
        if (currentTest) tests.push(currentTest);
    } catch (e) {
        console.error(`Error reading ${yamlPath}: ${e}`);
        process.exit(1);
    }
    return tests;
}

// --- Main test execution ---
function runTestSuite() {
    const isVerbose = process.argv.includes('-v') || process.argv.includes('--verbose');
	
    const yamlFilePath = path.resolve(__dirname, 'tests.yaml');
	
    if (!fs.existsSync(yamlFilePath)) {
        console.error(`ERROR: Test file not found at ${yamlFilePath}`);
        console.error("Please ensure 'tests.yaml.txt' is in the same directory.");
        process.exit(1);
    }
    
    const tests = _loadTestsFromFile(yamlFilePath);
    console.log(`Running ${tests.length} tests from ${path.basename(yamlFilePath)}...`);

    const rls = new Rls();
    let passedCount = 0;
    let failedCount = 0;
    const seen = new Set();

    for (const testCase of tests) {
        const { release_string: releaseName, expected: expectedDict } = testCase;
        
        if (isVerbose) {
            console.log(`\n=== RUN   Test: "${releaseName}"`);
        }
	    
        if (seen.has(releaseName)) {
            console.log(`\n${colors.yellow}!! DUPLICATE TEST: "${releaseName}"${colors.reset}`);		
        }
        seen.add(releaseName);

        const parsedRelease = rls.parseRelease(releaseName);
        const resultDict = _buildRlsDict(parsedRelease);
        
        const originalStrOk = parsedRelease.toString() === releaseName;

        const diffs = [];
        const allKeys = [...new Set([...Object.keys(resultDict), ...Object.keys(expectedDict)])].sort();

        for (const key of allKeys) {
            let resVal = resultDict[key];
            let expVal = expectedDict[key];

            // Sort space-separated strings for consistent comparison
            if (typeof resVal === 'string' && resVal.includes(' ')) {
                resVal = resVal.split(' ').sort().join(' ');
            }
            if (typeof expVal === 'string' && expVal.includes(' ')) {
                expVal = expVal.split(' ').sort().join(' ');
            }

            if (String(resVal ?? '') !== String(expVal ?? '')) {
                diffs.push({ key, exp: expVal ?? '', got: resVal ?? '' });		    
            }
        }

        if (originalStrOk && diffs.length === 0) {
            passedCount++;
            if (isVerbose) {
                console.log(`--- PASS: "${releaseName}"`);
            }		
        } else {
            failedCount++;
            console.log(`\n--- ${colors.red}FAIL:${colors.reset} "${releaseName}"`);		
            if (!originalStrOk) {
                console.log(`  String mismatch:`);
                console.log(`    expected:`);
                console.log(`      "${releaseName}"`);
                console.log(`    got:`);
                console.log(`      "${parsedRelease.toString()}"`);
            }
            if (diffs.length > 0) {
                console.log(`  Field mismatch:`);
                console.log(`    --- expected`);
                console.log(`    +++ got`);
                for(const diff of diffs) {
                    console.log(`    @@ ${diff.key} @@`);
                    console.log(`    ${colors.red}- ${diff.key}: "${diff.exp}"${colors.reset}`);
                    console.log(`    ${colors.green}+ ${diff.key}: "${diff.got}"${colors.reset}`);
                }
            }
        }
    }

    const totalCount = passedCount + failedCount;
    console.log("\n" + "-".repeat(50));
    console.log(`Test run finished. Passed: ${colors.green}${passedCount}${colors.reset}, Failed: ${colors.red}${failedCount}${colors.reset}`);
    if (totalCount > 0) {
        const successPercentage = (passedCount / totalCount) * 100;
        console.log(`Success Rate: ${successPercentage.toFixed(2)}%`);
    }

    if (failedCount > 0) {
        process.exit(1); // Exit with a non-zero code on failure
    }
}

// Run the suite
runTestSuite();
