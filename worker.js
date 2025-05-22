// Define fetchIPFS at the top to ensure it's in scope
async function fetchIPFS(ipfsHash, retries = 3, delay = 1000) {
  const gateways = [
    `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
    `https://ipfs.io/ipfs/${ipfsHash}`,
    `https://dweb.link/ipfs/${ipfsHash}`
  ];
  for (const gateway of gateways) {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Attempt ${i + 1} for gateway: ${gateway}`);
        const response = await fetch(gateway);
        if (response.ok) {
          console.log(`Success with gateway: ${gateway}`);
          return response;
        }
        console.log(`Gateway ${gateway} failed: ${response.status} ${response.statusText}`);
        if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.log(`Gateway ${gateway} error: ${error.message}`);
      }
    }
  }
  console.log('All IPFS gateways failed');
  return null;
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  try {
    const apiKey = env.UNSTOPPABLE_API_KEY;
    if (!apiKey) {
      console.log('API key not configured');
      return new Response('API key not valid', { status: 500 });
    }

    // Parse subdomain (e.g., sunspot from sunspot.brave.site)
    const url = new URL(request.url);
    const hostnameParts = url.hostname.split('.');
    const isValidDomain = hostnameParts.length >= 3 && hostnameParts.slice(-2).join('.') === 'brave.site';
    const subdomain = isValidDomain ? hostnameParts[0] : null;
    if (!subdomain) {
      console.log('Invalid or missing subdomain');
      return new Response('Invalid or missing subdomain', { status: 400 });
    }
    const braveDomain = `${subdomain}.brave`;
    console.log(`Subdomain: ${subdomain}, Brave Domain: ${braveDomain}`);

    // Query Unstoppable Domains
    const response = await fetch(`https://api.unstoppabledomains.com/resolve/domains/${braveDomain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`API Response Status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`API Error: ${errorText}`);
      return new Response(`Error querying Unstoppable Domains: ${response.statusText} - ${errorText}`, { status: 500 });
    }

    const record = await response.json();
    console.log(`API Response: ${JSON.stringify(record)}`);
    console.log(`Available record keys: ${Object.keys(record.records || record.data?.records || {})}`);
    const ipfsHash = record.records?.['dweb.ipfs.hash'] || 
                    record.records?.['ipfs.html.value'] || 
                    record.records?.['crypto.IPFS.value'] || 
                    null;
    if (!ipfsHash) {
      console.log(`Records found: ${JSON.stringify(record.records || record.data?.records || {})}`);
      return new Response('No IPFS hash found for domain', { status: 404 });
    }
    console.log(`Resolved IPFS Hash: ${ipfsHash}`);

    // Fetch IPFS content
    const ipfsResponse = await fetchIPFS(ipfsHash);
    if (!ipfsResponse) {
      return new Response('Error fetching IPFS content: All gateways failed', { status: 500 });
    }

    // Determine Content-Type
    let contentType = ipfsResponse.headers.get('Content-Type');
    if (!contentType) {
      const path = new URL(ipfsResponse.url).pathname;
      if (path.endsWith('.png')) contentType = 'image/png';
      else if (path.endsWith('.jpg')) contentType = 'image/jpeg';
      else if (path.endsWith('.json')) contentType = 'application/json';
      else contentType = 'text/html';
    }
    console.log(`Content-Type: ${contentType}`);

    // Serve content
    const content = await ipfsResponse.blob();
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.log(`Server Error: ${error.message}`);
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}