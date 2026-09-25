#!/usr/bin/env node
/**
 * Build Script for AMAES Toolkit
 * Bundles modular src/ components into distribution file: amaes-toolkit.user.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const OUTPUT_FILE = path.join(ROOT_DIR, 'amaes-toolkit.user.js');
const PARENT_OUTPUT = path.join(ROOT_DIR, '..', 'amaes-toolkit.user.js');

/**
 * Explicit lifecycle order for assembling the userscript IIFE.
 */
const BUILD_MANIFEST = [
    'meta.js',
    'core/config.js',
    'sync/updater.js',
    'ui/theme.js',
    'ui/icons.js',
    'moodle/detector.js',
    'sync/amauoed.js',
    'quiz/solver.js',
    'moodle/highlighter.js',
    'dev/diagnostics.js',
    'ai/prompts.js',
    'ai/gemini.js',
    'sync/harvester.js',
    'dev/console.js',
    'ui/modals.js',
    'ui/panel.js',
    'quiz/events.js',
    'init.js'
];

console.log('Building AMAES Toolkit from src/ modules...');

let bundled = '';
for (const relPath of BUILD_MANIFEST) {
    const fullPath = path.join(SRC_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
        console.error(`Error: Module file not found: ${fullPath}`);
        process.exit(1);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    bundled += content;
    console.log(`  + Bundled ${relPath} (${content.split('\n').length} lines)`);
}

fs.writeFileSync(OUTPUT_FILE, bundled, 'utf8');
console.log(`\nSuccessfully built: ${OUTPUT_FILE}`);
console.log(`Total Lines: ${bundled.split('\n').length}`);
console.log(`File Size: ${(Buffer.byteLength(bundled, 'utf8') / 1024).toFixed(1)} KB`);

// Sync to parent workspace if present
if (fs.existsSync(path.dirname(PARENT_OUTPUT))) {
    try {
        fs.writeFileSync(PARENT_OUTPUT, bundled, 'utf8');
        console.log(`Synced to: ${PARENT_OUTPUT}`);
    } catch (_) {}
}

// Validate JavaScript syntax
try {
    execSync(`node -c "${OUTPUT_FILE}"`);
    console.log('Syntax Validation: PASSED');
} catch (err) {
    console.error('Syntax Validation: FAILED');
    process.exit(1);
}
