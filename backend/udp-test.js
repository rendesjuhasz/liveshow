const dgram = require('dgram');
const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
    console.log('UDP packet received:', msg.length, 'bytes');
});

server.bind(5004, () => {
    console.log('UDP TEST LISTENER running on port 5004');
});
