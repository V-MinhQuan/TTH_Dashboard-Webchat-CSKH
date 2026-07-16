'use strict';

// DEPRECATED: the old report compared internal rule/PhoBERT/ViSoBERT adapter
// fields. The production Backend now exposes one Hugging Face result and does
// not fabricate those removed audit fields.
console.error('DEPRECATED: the multi-adapter dry-run is unavailable in the Hugging Face architecture.');
console.error('Run: node backend/scripts/evaluate-sentiment.js <reviewed-csv>');
console.error('The replacement evaluation calls FASTAPI_URL (default http://127.0.0.1:5000) and never writes SQL.');
process.exitCode = 2;
