#!/usr/bin/env node
/* regression-runner.mjs v1.1.0 — V3 파서 + 3-layer 가드 회귀 테스트 실행기
 *
 * patch-v5 wire-up: runPipeline() 이 analyzeSingle() 을 호출합니다.
 *
 * Exit codes:
 *   0 = 전체 통과
 *   1 = 일반 fail
 *   2 = DISTORTION 발생 (CI 블로커)
 *   3 = schema 오류
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { analyzeSingle } from './src/ai/analyze-v3.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function runPipeline(input, { baseline = false } = {}) {
  const result = analyzeSingle(input, { baseline });
  return {
    status: result.status,
    l1: result.l1 || null,
    l2: result.l2 || null,
    l3: result.l3 || null,
    l4: result.l4 || null,
    tag: result.tag || result.l4 || null,
    confidence: result.confidence ?? 0,
    reason: result.reason || null,
    source: result.source || null,
    level: result.level || null,
  };
}

function validateFixture(fixture) {
  const errors = [];
  for (const tc of fixture.test_cases) {
    const exp = tc.expected || {};
    if (exp.must_include_l1 != null && exp.must_include_l1_any_of != null) {
      errors.push(`${tc.id}: both must_include_l1 and must_include_l1_any_of present`);
    }
    if (exp.must_include_l1_any_of != null && !Array.isArray(exp.must_include_l1_any_of)) {
      errors.push(`${tc.id}: must_include_l1_any_of must be an array`);
    }
    if (exp.must_include_l1_any_of?.length === 0) {
      errors.push(`${tc.id}: must_include_l1_any_of is empty`);
    }
    if (exp.must_exclude_l1 && !Array.isArray(exp.must_exclude_l1)) {
      errors.push(`${tc.id}: must_exclude_l1 must be an array`);
    }
  }
  return errors;
}

function judge(testCase, actual) {
  const { expected, id } = testCase;
  const failures = [];

  if (expected.status && actual.status !== expected.status) {
    failures.push(`status: expected=${expected.status} actual=${actual.status}`);
  }
  if (expected.must_include_l1 != null) {
    if (actual.l1 !== expected.must_include_l1) {
      failures.push(`l1: expected=${expected.must_include_l1} actual=${actual.l1 ?? 'none'}`);
    }
  }
  if (expected.must_include_l1_any_of != null) {
    if (!actual.l1 || !expected.must_include_l1_any_of.includes(actual.l1)) {
      failures.push(`l1: expected in [${expected.must_include_l1_any_of.join(', ')}] actual=${actual.l1 ?? 'none'}`);
    }
  }
  if (expected.must_exclude_l1?.includes(actual.l1)) {
    failures.push(`⚠️ DISTORTION: l1=${actual.l1} in exclude list [${expected.must_exclude_l1.join(', ')}]`);
  }
  if (expected.reject_tags?.includes(actual.tag)) {
    failures.push(`⚠️ REJECTED TAG MATCHED: tag=${actual.tag}`);
  }
  if (expected.min_confidence != null && actual.confidence < expected.min_confidence) {
    failures.push(`confidence below min: ${actual.confidence} < ${expected.min_confidence}`);
  }
  if (expected.max_confidence != null && actual.confidence > expected.max_confidence) {
    failures.push(`confidence above max: ${actual.confidence} > ${expected.max_confidence}`);
  }

  return { id, passed: failures.length === 0, failures };
}

const args = new Set(process.argv.slice(2));
const argList = [...args];
const catFilter = argList.find(a => a.startsWith('--cat='))?.slice(6);
const fixtureArg = argList.find(a => a.startsWith('--fixture='))?.slice(10);
const bail = args.has('--bail');
const baseline = args.has('--baseline');
const opinionatedOnly = args.has('--opinionated');

const fixturePath = fixtureArg
  ? path.resolve(fixtureArg)
  : path.join(__dirname, 'regression-v1.1.json');

if (!fs.existsSync(fixturePath)) {
  console.error(`✗ fixture not found: ${fixturePath}`);
  process.exit(3);
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
console.log(`▶ Fixture: ${path.basename(fixturePath)} v${fixture.version} (${fixture.test_cases.length} cases)`);

const schemaErrors = validateFixture(fixture);
if (schemaErrors.length > 0) {
  console.error('✗ Fixture schema errors:');
  schemaErrors.forEach(e => console.error(`    ${e}`));
  process.exit(3);
}

let cases = fixture.test_cases;
if (catFilter) cases = cases.filter(c => c.category.startsWith(catFilter));
if (opinionatedOnly) cases = cases.filter(c => c.expected.must_include_l1_any_of != null);

console.log(`▶ Running ${cases.length} cases`
  + (catFilter ? ` [cat=${catFilter}]` : '')
  + (opinionatedOnly ? ' [opinionated only]' : '')
  + (baseline ? ' [BASELINE mode — 3 layers bypassed]' : '')
  + '\n');

const results = { pass: 0, fail: 0, distortions: 0, byCategory: {}, byStatus: {} };
const failedCases = [];

for (const tc of cases) {
  const actual = runPipeline(tc.input, { baseline });
  const verdict = judge(tc, actual);

  const cat = tc.category;
  results.byCategory[cat] ??= { pass: 0, fail: 0 };
  const expStatus = tc.expected.status || 'UNKNOWN';
  results.byStatus[expStatus] ??= { pass: 0, fail: 0 };

  if (verdict.passed) {
    results.pass++;
    results.byCategory[cat].pass++;
    results.byStatus[expStatus].pass++;
  } else {
    results.fail++;
    results.byCategory[cat].fail++;
    results.byStatus[expStatus].fail++;
    if (verdict.failures.some(f => f.includes('DISTORTION') || f.includes('REJECTED TAG'))) {
      results.distortions++;
    }
    failedCases.push({ tc, actual, verdict });
    if (bail) {
      console.log(`✗ ${tc.id} "${tc.input}"`);
      verdict.failures.forEach(f => console.log(`    ${f}`));
      process.exit(1);
    }
  }
}

const total = results.pass + results.fail;
const pct = total > 0 ? ((results.pass / total) * 100).toFixed(1) : '0.0';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Total:       ${total}`);
console.log(`Pass:        ${results.pass} (${pct}%)`);
console.log(`Fail:        ${results.fail}`);
console.log(`DISTORTIONS: ${results.distortions}   ${results.distortions > 0 ? '⚠️  BLOCKER' : '✅'}`);

console.log('\nBy category:');
for (const [cat, r] of Object.entries(results.byCategory).sort()) {
  const t = r.pass + r.fail;
  const p = t > 0 ? ((r.pass / t) * 100).toFixed(0) : '0';
  console.log(`  ${cat.padEnd(26)} ${String(r.pass).padStart(3)}/${String(t).padStart(3)}  (${p.padStart(3)}%)`);
}

console.log('\nBy expected status:');
for (const [st, r] of Object.entries(results.byStatus).sort()) {
  const t = r.pass + r.fail;
  const p = t > 0 ? ((r.pass / t) * 100).toFixed(0) : '0';
  console.log(`  ${st.padEnd(20)} ${String(r.pass).padStart(3)}/${String(t).padStart(3)}  (${p.padStart(3)}%)`);
}

if (failedCases.length > 0) {
  console.log('\n━━━ Failed cases (최대 30건) ━━━');
  failedCases.slice(0, 30).forEach(({ tc, actual, verdict }) => {
    console.log(`\n✗ ${tc.id} [${tc.category}] "${tc.input}"`);
    console.log(`  actual: status=${actual.status}, l1=${actual.l1 ?? '-'}, level=${actual.level ?? '-'}, src=${actual.source ?? '-'}`);
    verdict.failures.forEach(f => console.log(`    ${f}`));
  });
  if (failedCases.length > 30) console.log(`\n  ... +${failedCases.length - 30}건 더`);
}

if (results.distortions > 0) process.exit(2);
if (results.fail > 0) process.exit(1);
process.exit(0);
