const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

const docsDir = path.join(__dirname, 'docs');

// Serve static assets from the docs directory
app.use(express.static(docsDir));

// Route /app and /app/ to docs/app/app.html
app.get('/app', (req, res) => {
  res.sendFile(path.join(docsDir, 'app', 'app.html'));
});

app.get('/app/', (req, res) => {
  res.sendFile(path.join(docsDir, 'app', 'app.html'));
});

// Fallback to index.html for any other requests
app.use((req, res) => {
  res.sendFile(path.join(docsDir, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
