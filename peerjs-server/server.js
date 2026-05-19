const { PeerServer } = require('peer');

const server = PeerServer({
  port: process.env.PORT || 9000,
  path: '/mp',
  allow_discovery: false,
  alive_timeout: 60000,
  cleanup_out_msgs: 1000,
  // Allow all origins
  corsOptions: { origin: '*' },
});

server.on('connection', (client) => {
  console.log(`[+] ${client.getId()}`);
});

server.on('disconnect', (client) => {
  console.log(`[-] ${client.getId()}`);
});

console.log(`PeerJS server running on port ${process.env.PORT || 9000}`);
