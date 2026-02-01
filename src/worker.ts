import 'dotenv/config';
import { videoWorker } from './queues/worker';

console.log('=================================');
console.log('  Frontier Video Worker Started  ');
console.log('=================================');
console.log('');
console.log('Listening for jobs on queue: video-processing');
console.log('Concurrency: 2 jobs');
console.log('Rate limit: 10 jobs/minute');
console.log('');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('');
  console.log('Received SIGTERM, closing worker...');
  await videoWorker.close();
  console.log('Worker closed gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('');
  console.log('Received SIGINT, closing worker...');
  await videoWorker.close();
  console.log('Worker closed gracefully');
  process.exit(0);
});

// Keep the process running
process.stdin.resume();
