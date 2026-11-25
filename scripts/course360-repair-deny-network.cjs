// Isolated test-run safeguard: no real HTTP, DNS, TCP or TLS connections.
const forbidden = () => { throw new Error('Network forbidden in main-account media server tests'); };
for (const name of ['node:http', 'node:https']) {
  const mod = require(name);
  mod.request = forbidden;
  mod.get = forbidden;
}
const net = require('node:net');
net.connect = forbidden;
net.createConnection = forbidden;
net.Socket.prototype.connect = forbidden;
const tls = require('node:tls');
tls.connect = forbidden;
const dns = require('node:dns');
// Vite resolves localhost during startup; return a static address, never DNS.
dns.lookup = (hostname, options, callback) => {
  if (hostname !== 'localhost') return forbidden();
  if (typeof options === 'function') { callback = options; options = {}; }
  if (options && options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
  else callback(null, '127.0.0.1', 4);
};
for (const name of ['resolve', 'resolve4', 'resolve6', 'reverse']) dns[name] = forbidden;
dns.promises.lookup = async (hostname, options) => {
  if (hostname !== 'localhost') return forbidden();
  return options && options.all ? [{ address: '127.0.0.1', family: 4 }] : { address: '127.0.0.1', family: 4 };
};
for (const name of ['resolve', 'resolve4', 'resolve6', 'reverse']) dns.promises[name] = forbidden;
globalThis.fetch = forbidden;
