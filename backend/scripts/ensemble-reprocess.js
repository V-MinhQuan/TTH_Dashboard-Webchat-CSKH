'use strict';

// DEPRECATED: this script previously performed a destructive bulk rewrite using
// multi-adapter fields that the Hugging Face single-model compatibility API does
// not provide. Reconstructing missing rule/audit fields would corrupt analytics.
console.error('DEPRECATED: bulk sentiment reprocess is disabled for the Hugging Face architecture.');
console.error('Use the SQL-backed FastAPI analysis queue to retry reviewed failed records.');
console.error('No database connection was opened and no data was changed.');
process.exitCode = 2;
