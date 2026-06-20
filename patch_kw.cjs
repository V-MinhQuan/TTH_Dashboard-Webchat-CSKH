const fs = require('fs');
let content = fs.readFileSync('src/app/components/screens/KeywordAnalysis.tsx', 'utf8');
const lines = content.split('\n');

// We want to delete lines 661 to 825 (1-indexed).
// In 0-indexed, that's lines 660 to 824.
// Let's verify by printing them first.
console.log('Line 661:', lines[660]);
console.log('Line 825:', lines[824]);

lines.splice(660, 825 - 661 + 1);

fs.writeFileSync('src/app/components/screens/KeywordAnalysis.tsx', lines.join('\n'));
console.log('Deleted duplicate lines in KeywordAnalysis');
