import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCsv } from './sentiment-evaluation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const inputPath = path.resolve(
  process.argv[2] || path.resolve(__dirname, '../reports/sentiment_blind_test_template.csv')
);

evaluateCsv({
  inputPath,
  requireManualLabels: true,
  reportPrefix: 'sentiment_blind_test_huggingface'
}).catch(error => {
  console.error(`Blind-test evaluation failed: ${error.message}`);
  process.exitCode = 1;
});
