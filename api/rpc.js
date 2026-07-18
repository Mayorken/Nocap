const READ_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'net_version',
]);

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const payloads = Array.isArray(request.body) ? request.body : [request.body];
  if (!payloads.length || payloads.some(item => !item || !READ_METHODS.has(item.method))) {
    return response.status(403).json({ error: 'Only read-only RPC methods are allowed' });
  }

  const rpcUrl = process.env.MONAD_RPC_URL
    || process.env.EXPO_PUBLIC_MONAD_RPC_URL
    || 'https://rpc-testnet.monadinfra.com';

  try {
    const upstream = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    const body = await upstream.text();
    response.status(upstream.status);
    response.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    response.setHeader('cache-control', 's-maxage=2, stale-while-revalidate=8');
    return response.send(body);
  } catch {
    return response.status(502).json({ error: 'Monad RPC is temporarily unavailable' });
  }
};
