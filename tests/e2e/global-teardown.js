/**
 * Global Teardown for E2E Tests
 * Cleans up the test environment after all tests complete
 */

const fs = require('fs').promises;
const path = require('path');

async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment...');
  
  try {
    // Generate final test report
    await generateFinalReport();
    
    // Clean up temporary files
    await cleanupTempFiles();
    
    // Archive screenshots and videos if configured
    await archiveTestArtifacts();
    
    // Display test summary
    await displayTestSummary();
    
    console.log('✅ E2E test environment cleanup complete');
    
  } catch (error) {
    console.error('⚠️  E2E test environment cleanup failed:', error);
    // Don't fail the build on cleanup errors
  }
}

async function generateFinalReport() {
  const reportPath = path.join(__dirname, 'reports', 'final-e2e-report.json');
  
  const report = {
    testRun: {
      completed: new Date().toISOString(),
      framework: 'Playwright + Custom E2E Framework',
      platform: process.platform,
      nodeVersion: process.version
    },
    summary: {
      // These would be populated from actual test results
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    },
    businessMetrics: {
      productivityImprovementTarget: '25-40%',
      userSatisfactionTargets: {
        powerUsers: '85%',
        contentCreators: '90%',
        enterpriseUsers: '85%',
        hardwareEnthusiasts: '90%'
      },
      setupCompletionTarget: '90%'
    },
    artifacts: {
      screenshots: await countArtifacts('screenshots', '.png'),
      videos: await countArtifacts('test-results', '.webm'),
      reports: await countArtifacts('reports', '.json')
    }
  };
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
}

async function countArtifacts(directory, extension) {
  try {
    const fullPath = path.join(__dirname, directory);
    const files = await fs.readdir(fullPath);
    return files.filter(file => file.endsWith(extension)).length;
  } catch (error) {
    return 0;
  }
}

async function cleanupTempFiles() {
  const tempDir = path.join(__dirname, 'temp');
  
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Temp directory might not exist or be empty
  }
}

async function archiveTestArtifacts() {
  // Only archive if running in CI or if environment variable is set
  if (!process.env.CI && !process.env.ARCHIVE_E2E_ARTIFACTS) {
    return;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveDir = path.join(__dirname, 'archives', timestamp);
  
  await fs.mkdir(archiveDir, { recursive: true });
  
  // Copy important artifacts to archive
  const artifactDirs = ['screenshots', 'reports', 'test-results'];
  
  for (const dir of artifactDirs) {
    const sourcePath = path.join(__dirname, dir);
    const targetPath = path.join(archiveDir, dir);
    
    try {
      await fs.cp(sourcePath, targetPath, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  }
}

async function displayTestSummary() {
  console.log('');
  console.log('📊 E2E Test Summary');
  console.log('==================');
  console.log('');
  
  // Try to read test results
  try {
    const resultsPath = path.join(__dirname, 'reports', 'test-results.json');
    const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
    
    console.log(`Total Tests: ${results.stats?.total || 'Unknown'}`);
    console.log(`Passed: ${results.stats?.expected || 'Unknown'}`);
    console.log(`Failed: ${results.stats?.failed || 'Unknown'}`);
    console.log(`Duration: ${results.stats?.duration ? Math.round(results.stats.duration / 1000) + 's' : 'Unknown'}`);
    
  } catch (error) {
    console.log('Test results summary not available');
  }
  
  console.log('');
  console.log('📁 Test Artifacts:');
  console.log(`   Screenshots: ${await countArtifacts('screenshots', '.png')}`);
  console.log(`   Videos: ${await countArtifacts('test-results', '.webm')}`);
  console.log(`   Reports: ${await countArtifacts('reports', '.json')}`);
  console.log('');
  
  // Display business metrics targets
  console.log('🎯 Business Targets:');
  console.log('   Productivity Improvement: 25-40%');
  console.log('   Setup Completion Rate: 90%');
  console.log('   Power User Satisfaction: 85%+');
  console.log('   Content Creator Satisfaction: 90%+');
  console.log('');
}

module.exports = globalTeardown;