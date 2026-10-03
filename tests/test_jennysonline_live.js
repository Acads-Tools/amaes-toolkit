const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

if (typeof fetch !== 'function') {
    throw new Error('This live test requires a Node.js runtime with global fetch.');
}

const source = fs.readFileSync(path.join(__dirname, '../src/sync/jennysonline.js'), 'utf8');
const sandbox = {
    URL,
    normalizeText: value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    normalizeChoice: value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()
};
vm.runInNewContext(`${source}\nglobalThis.selectCourseEntries = selectJennysonlineCourseEntries;\nglobalThis.parseCsv = parseJennysonlineCsv;`, sandbox);

const courses = [
    { code: 'IT6205A', title: 'Information Assurance and Security 1' },
    { code: 'IT6206', title: 'Information Assurance and Security 2' }
];

async function fetchText(url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'AMAES-Toolkit-live-test/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
    return response.text();
}

async function findSheetForCourse(course) {
    const feedUrl = new URL('https://jennysonline.blogspot.com/feeds/posts/default');
    feedUrl.searchParams.set('q', course.title);
    feedUrl.searchParams.set('alt', 'json');
    feedUrl.searchParams.set('max-results', '100');
    const feed = JSON.parse(await fetchText(feedUrl.href));
    const [postUrl] = sandbox.selectCourseEntries(feed, course.code, course.title);
    assert.ok(postUrl, `No exact Jenny post matched ${course.code}: ${course.title}`);

    const postHtml = await fetchText(postUrl);
    const iframeTag = postHtml.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    assert.ok(iframeTag, `Matched post has no sheet iframe: ${postUrl}`);
    const iframeUrl = new URL(iframeTag[1].replace(/&amp;/g, '&'), postUrl);
    assert.strictEqual(iframeUrl.hostname, 'docs.google.com');
    assert.match(iframeUrl.pathname, /\/spreadsheets\/d\/e\/[^/]+\/pubhtml$/);

    iframeUrl.pathname = iframeUrl.pathname.replace(/\/pubhtml$/, '/pub');
    iframeUrl.search = '?output=csv';
    const csv = await fetchText(iframeUrl.href);
    const rows = sandbox.parseCsv(csv, postUrl);
    assert.ok(rows.length > 0, `Matched public sheet has no usable CSV rows: ${postUrl}`);
    assert.ok(rows.every(row => row.source === 'jennysonline' && row.verified === false &&
        row.evidenceType === 'study_guide_candidate'), 'Live sheet rows must all be unconfirmed Jenny candidates');

    return { code: course.code, title: course.title, postUrl, rows: rows.length };
}

(async () => {
    const robots = await fetchText('https://jennysonline.blogspot.com/robots.txt');
    assert.match(robots, /Disallow:\s*\/search/i, 'Expected Jenny robots policy to continue disallowing /search');
    assert.ok(!source.includes("jennysonline.blogspot.com/search"), 'Scraper must not request the disallowed Blogger search path');

    for (const course of courses) {
        const result = await findSheetForCourse(course);
        console.log(`LIVE PASS ${result.code}: ${result.title}; ${result.rows} unconfirmed rows from ${result.postUrl}`);
    }
    console.log(`LIVE PASS: robots.txt respected; ${courses.length} real Jenny courses discovered, sheet CSVs parsed, and rows classified unconfirmed.`);
})().catch(error => {
    console.error(`LIVE FAIL: ${error.stack || error.message}`);
    process.exitCode = 1;
});
