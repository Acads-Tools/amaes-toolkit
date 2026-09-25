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

console.log('Building AMAES Toolkit from src/ modules...');

if (!fs.existsSync(SRC_DIR)) {
    console.error(`Error: Source directory not found: ${SRC_DIR}`);
    process.exit(1);
}

const files = fs.readdirSync(SRC_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

if (files.length === 0) {
    console.error('Error: No source files found in src/');
    process.exit(1);
}

let bundled = '';
files.forEach(f => {
    const filePath = path.join(SRC_DIR, f);
    const content = fs.readFileSync(filePath, 'utf8');
    bundled += content;
    console.log(`  + Bundled ${f} (${content.split('\n').length} lines)`);
});

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
