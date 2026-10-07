import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const HTTP_PORT = 4321;
const WS_PORT = 4322;

let activeFigmaClients = new Set();

// WebSocket server for Figma Plugin
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('[Bridge WS] Figma Plugin connected!');
  activeFigmaClients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('[Bridge WS] Message from Figma:', data);
    } catch (e) {
      console.log('[Bridge WS] Raw message:', message.toString());
    }
  });

  ws.on('close', () => {
    console.log('[Bridge WS] Figma Plugin disconnected.');
    activeFigmaClients.delete(ws);
  });
});

// HTTP server for Agent / CLI / REST / MCP commands
const server = http.createServer((req, res) => {
  // CORS headers so web clients or local tools can post
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      connectedClients: activeFigmaClients.size
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/render') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        if (activeFigmaClients.size === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'No Figma Plugin currently connected. Please run the local plugin in Figma first.'
          }));
          return;
        }

        const msgString = JSON.stringify(payload);
        for (const client of activeFigmaClients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(msgString);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `Sent design command to ${activeFigmaClients.size} Figma plugin instance(s).`
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(HTTP_PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Figma Bridge Server Running!`);
  console.log(`   HTTP Endpoint: http://localhost:${HTTP_PORT}/render`);
  console.log(`   Status Check:  http://localhost:${HTTP_PORT}/status`);
  console.log(`   WebSocket URL: ws://localhost:${WS_PORT}`);
  console.log(`=========================================`);
});
