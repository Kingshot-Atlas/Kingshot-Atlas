#!/usr/bin/env node

/**
 * SEO Validation Script
 * 
 * Validates structured data and meta tags to prevent GSC issues.
 * Run as part of CI/CD or locally: npm run validate:seo
 * 
 * Created after GSC "Deceptive pages" incident on 2026-02-05.
 */

const fs = require('fs');
const path = require('path');

const ERRORS = [];
const WARNINGS = [];

// Patterns that indicate fabricated/deceptive content
const FORBIDDEN_PATTERNS = {
  fakeRating: /"aggregateRating"\s*:\s*\{/i,
  fakeReviews: /"review"\s*:\s*\[/i,
  ratingValue: /"ratingValue"\s*:\s*"?\d/i,
  ratingCount: /"ratingCount"\s*:\s*"?\d/i,
};

// Maximum allowed keywords (prevent keyword stuffing)
const MAX_KEYWORDS = 10;

function validateIndexHtml() {
  console.log('\n📄 Validating index.html...');
  
  const indexPath = path.join(__dirname, '../index.html');
  
  if (!fs.existsSync(indexPath)) {
    ERRORS.push('index.html not found');
    return;
  }
  
  const content = fs.readFileSync(indexPath, 'utf-8');
  
  // Check for fabricated aggregate ratings
  if (FORBIDDEN_PATTERNS.fakeRating.test(content)) {
    // Only error if ratingValue/ratingCount are present (indicates real fake data)
    if (FORBIDDEN_PATTERNS.ratingValue.test(content) && FORBIDDEN_PATTERNS.ratingCount.test(content)) {
      ERRORS.push(
        'CRITICAL: aggregateRating with ratingValue/ratingCount found in index.html. ' +
        'This caused the GSC "Deceptive pages" flag. Remove unless backed by real user reviews.'
      );
    }
  }
  
  // Check for fake review arrays
  if (FORBIDDEN_PATTERNS.fakeReviews.test(content)) {
    ERRORS.push(
      'Review array found in structured data. ' +
      'Remove unless these are real, verified user reviews.'
    );
  }
  
  // Check for keyword stuffing
  const keywordsMatch = content.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
  if (keywordsMatch) {
    const keywords = keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k);
    if (keywords.length > MAX_KEYWORDS) {
      WARNINGS.push(
        `Keywords meta tag has ${keywords.length} items (max: ${MAX_KEYWORDS}). ` +
        'Reduce to avoid keyword stuffing penalties.'
      );
    }
    
    // Check for excessive repetition of same word
    const wordCounts = {};
    keywords.forEach(kw => {
      const words = kw.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) { // Ignore short words
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });
    
    Object.entries(wordCounts).forEach(([word, count]) => {
      if (count > 5) {
        WARNINGS.push(
          `Word "${word}" appears ${count} times in keywords. ` +
          'This may be seen as keyword stuffing.'
        );
      }
    });
  }
  
  // Check required meta tags exist
  const requiredMeta = [
    { name: 'description', pattern: /<meta\s+name=["']description["']/i },
    { name: 'og:title', pattern: /<meta\s+property=["']og:title["']/i },
    { name: 'og:description', pattern: /<meta\s+property=["']og:description["']/i },
    { name: 'twitter:card', pattern: /<meta\s+name=["']twitter:card["']/i },
  ];
  
  requiredMeta.forEach(({ name, pattern }) => {
    if (!pattern.test(content)) {
      WARNINGS.push(`Missing meta tag: ${name}`);
    }
  });
  
  // Check canonical URL exists
  if (!/<link\s+rel=["']canonical["']/.test(content)) {
    WARNINGS.push('Missing canonical URL link tag');
  }
  
  // Validate JSON-LD syntax
  const jsonLdMatches = content.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    jsonLdMatches.forEach((match, index) => {
      const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      try {
        JSON.parse(jsonContent);
        console.log(`  ✅ JSON-LD block ${index + 1}: Valid JSON`);
      } catch (e) {
        ERRORS.push(`JSON-LD block ${index + 1} has invalid JSON: ${e.message}`);
      }
    });
  }
  
  console.log('  ✅ index.html validation complete');
}

function validateUseMetaTags() {
  console.log('\n📄 Validating useMetaTags.ts...');
  
  const metaTagsPath = path.join(__dirname, '../src/hooks/useMetaTags.ts');
  
  if (!fs.existsSync(metaTagsPath)) {
    WARNINGS.push('useMetaTags.ts not found');
    return;
  }
  
  const content = fs.readFileSync(metaTagsPath, 'utf-8');
  
  // Check for hardcoded fake ratings in dynamic meta
  if (/aggregateRating|ratingValue|ratingCount/i.test(content)) {
    WARNINGS.push(
      'useMetaTags.ts contains rating-related code. ' +
      'Ensure ratings come from real user data, not hardcoded values.'
    );
  }
  
  console.log('  ✅ useMetaTags.ts validation complete');
}

function validateStructuredDataHook() {
  console.log('\n📄 Validating useStructuredData.ts...');
  
  const structuredDataPath = path.join(__dirname, '../src/hooks/useStructuredData.ts');
  
  if (!fs.existsSync(structuredDataPath)) {
    WARNINGS.push('useStructuredData.ts not found');
    return;
  }
  
  const content = fs.readFileSync(structuredDataPath, 'utf-8');
  
  // Check for hardcoded fake ratings
  if (/aggregateRating|"ratingValue"|"ratingCount"/i.test(content)) {
    WARNINGS.push(
      'useStructuredData.ts may contain rating-related code. ' +
      'Verify ratings are only added when real user reviews exist.'
    );
  }
  
  console.log('  ✅ useStructuredData.ts validation complete');
}

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('SEO VALIDATION RESULTS');
  console.log('='.repeat(60));
  
  if (ERRORS.length === 0 && WARNINGS.length === 0) {
    console.log('\n✅ All SEO validations passed!\n');
    return 0;
  }
  
  if (ERRORS.length > 0) {
    console.log('\n❌ ERRORS (must fix):');
    ERRORS.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }
  
  if (WARNINGS.length > 0) {
    console.log('\n⚠️  WARNINGS (should review):');
    WARNINGS.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
  }
  
  console.log('');
  
  // Return exit code 1 if there are errors (fail CI)
  return ERRORS.length > 0 ? 1 : 0;
}

// Main execution
console.log('🔍 SEO Validation Script');
console.log('Checking for patterns that could trigger GSC security flags...');

validateIndexHtml();
validateUseMetaTags();
validateStructuredDataHook();

const exitCode = printResults();
process.exit(exitCode);
