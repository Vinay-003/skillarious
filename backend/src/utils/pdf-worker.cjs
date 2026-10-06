const { parentPort, workerData } = require('node:worker_threads');
const pdf = require('pdf-parse/lib/pdf-parse.js');
pdf(Buffer.from(workerData), { max: 80 }).then(result => {
  parentPort.postMessage({ text: result.text.slice(0, 150000), pages: result.numpages });
}).catch(() => parentPort.postMessage({ error: true }));
