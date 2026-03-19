#!/usr/bin/env node
/**
 * build-version.js — Updates version number and build timestamp in index.html.
 * Run before each commit: node build-version.js
 * Version format: v1.0.{commitCount+1} · Build {YYYY-MM-DD HH:MM}
 */
const fs = require('fs');
const { execSync } = require('child_process');

const htmlPath = 'index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// Get commit count (next commit will be +1)
const commitCount = parseInt(execSync('git rev-list --count HEAD').toString().trim(), 10) + 1;

// Build timestamp in local time
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const buildDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const version = `v1.0.${commitCount}`;
const versionLine = `${version} &middot; Build ${buildDate}`;

// Replace existing version line
html = html.replace(
    /<div class="version-info">.*?<\/div>/,
    `<div class="version-info">${versionLine}</div>`
);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`Updated: ${version} · Build ${buildDate}`);
