import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCsv } from './sentiment-evaluation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const inputPath = path.resolve(
  process.argv[2] || path.resolve(__dirname, '../reports/sentiment_evaluation_template.csv')
);

evaluateCsv({
  inputPath,
  requireManualLabels: false,
  reportPrefix: 'sentiment_evaluation_huggingface'
}).catch(error => {
  console.error(`Sentiment evaluation failed: ${error.message}`);
  process.exitCode = 1;
});
