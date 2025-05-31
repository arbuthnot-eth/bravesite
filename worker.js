// Define fetchIPFS at the top to ensure it's in scope
async function fetchIPFS(ipfsHash, retries = 3, delay = 1000) {
  const gateways = [
    `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
    `https://ipfs.io/ipfs/${ipfsHash}`,
    `https://dweb.link/ipfs/${ipfsHash}`
  ];

  const fetchPromises = gateways.map(gateway => 
    fetch(gateway)
      .then(response => {
        if (!response.ok) {
          // Convert non-ok responses into a rejected promise for Promise.race
          console.log(`Gateway ${gateway} failed non-ok: ${response.status} ${response.statusText}`);
          return Promise.reject(new Error(`Gateway ${gateway} returned status ${response.status}`));
        }
        console.log(`Success with gateway: ${gateway}`);
        return response; // This is a successful response
      })
      .catch(error => {
        // Catch network errors or errors from the .then block above
        console.log(`Gateway ${gateway} caught error: ${error.message}`);
        return Promise.reject(error); // Ensure it remains a rejected promise
      })
  );

  try {
    // Promise.race will settle as soon as one promise fulfills or rejects.
    // We want the first one that *fulfills*.
    // A common pattern is to map rejections to a special value if you need to inspect all results,
    // but here we want to short-circuit. If the first settled promise is a rejection, it will be caught below.
    const firstSuccessfulResponse = await Promise.race(fetchPromises);
    // If Promise.race resolves, it means at least one gateway responded successfully and was .ok
    return firstSuccessfulResponse;
  } catch (error) {
    // This catch block executes if Promise.race itself rejects.
    // This happens if the *first* promise to settle is a rejection.
    // It does NOT mean all promises rejected. 
    // However, given our .then(response => if (!response.ok) reject() ), 
    // a resolved promise from race() should always be an OK response.
    // So, if we are here, it implies the fastest gateway failed.
    // We could log this specific error if needed.
    console.log('Promise.race resulted in a rejection (fastest gateway failed or all failed quickly), proceeding to fallback. Error:', error.message);
  }

  // Fallback to original sequential retry logic
  console.log('Falling back to sequential gateway retries...');
  for (const gateway of gateways) {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Fallback Attempt ${i + 1} for gateway: ${gateway}`);
        const response = await fetch(gateway);
        if (response.ok) {
          console.log(`Fallback Success with gateway: ${gateway}`);
          return response;
        }
        console.log(`Fallback Gateway ${gateway} failed: ${response.status} ${response.statusText}`);
        if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.log(`Fallback Gateway ${gateway} error: ${error.message}`);
        // If a specific attempt fails, continue to the next, or next gateway
      }
    }
  }

  console.log('All IPFS gateways and fallbacks failed');
  return null;
}

// Basic cache implementation (in-memory, consider KV store for production)
const apiCache = new Map();

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

    const url = new URL(request.url);
    const hostname = url.hostname;
    let braveDomainToQuery;

    // Ensure the domain ends with .brave.site
    if (!hostname.endsWith('.brave.site')) {
      // If it's just brave.site, show a welcome message.
      if (hostname === 'brave.site') {
        return new Response('Welcome to the .brave domain resolver. Access a .brave domain like yourdomain.brave.site or a subdomain like sub.yourdomain.brave.site.', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      // Otherwise, it's an invalid/unsupported format.
      console.log('Invalid or unsupported domain format:', hostname);
      return new Response('Invalid or unsupported domain format. Must end with .brave.site', { status: 400 });
    }

    // Remove .brave.site part and replace with .brave
    // Example: sunspot.brave.site -> sunspot.brave
    // Example: sub.sunspot.brave.site -> sub.sunspot.brave
    const parts = hostname.split('.');
    if (parts.length < 3) { // Should be at least something.brave.site
        console.log('Invalid domain format (too few parts):', hostname);
        return new Response('Invalid domain format.', { status: 400 });
    }

    // The parts before 'brave.site' join to form the Unstoppable domain name or subdomain.
    // e.g., for 'myai.sunspot.brave.site', targetParts would be ['myai', 'sunspot']
    // which becomes 'myai.sunspot.brave'
    // e.g., for 'sunspot.brave.site', targetParts would be ['sunspot']
    // which becomes 'sunspot.brave'
    const targetDomainParts = parts.slice(0, -2); // Remove 'brave' and 'site'
    if (targetDomainParts.length === 0) {
        // This case should ideally be caught by `hostname === 'brave.site'` earlier
        // but as a safeguard:
        console.log('Accessed base brave.site without specific domain.');
        return new Response('Please specify a domain, e.g., yourdomain.brave.site.', { status: 400 });
    }
    braveDomainToQuery = targetDomainParts.join('.') + '.brave';
    
    console.log(`Parsed hostname: ${hostname}, Querying Unstoppable for: ${braveDomainToQuery}`);

    // Check cache first
    if (apiCache.has(braveDomainToQuery)) {
      console.log(`Cache hit for ${braveDomainToQuery}`);
      const cachedData = apiCache.get(braveDomainToQuery);
      return processApiResponse(cachedData, request, env);
    }
    console.log(`Cache miss for ${braveDomainToQuery}, fetching from API.`);

    // Query Unstoppable Domains
    const response = await fetch(`https://api.unstoppabledomains.com/resolve/domains/${braveDomainToQuery}`, {
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

    // Cache the successful API response
    if (response.ok) {
      apiCache.set(braveDomainToQuery, record); 
      // Optional: Set a timeout to remove the cache entry after some time (TTL)
      // setTimeout(() => apiCache.delete(braveDomainToQuery), 3600 * 1000); // Example: 1 hour TTL
    }
    
    return processApiResponse(record, request, env);
  } catch (error) {
    console.log(`Server Error: ${error.message}`);
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}

// New function to process the API response, enables caching and cleaner code
async function processApiResponse(record, request, env) {
  // This function will contain the logic originally after fetching from Unstoppable Domains API
  // It's called either with fresh data from API or cached data.

  console.log(`Processing API record: ${JSON.stringify(record)}`);
  console.log(`Available record keys: ${Object.keys(record.records || record.data?.records || {})}`);

  // Check for redirect URL first (Added for redirect functionality)
  const redirectUrl = record.records?.['browser.redirect_url'];
  if (redirectUrl) {
    console.log(`Redirecting to: ${redirectUrl}`);
    // Perform a 301 or 302 redirect. 302 is often better for temporary/dynamic redirects.
    return Response.redirect(redirectUrl, 302); 
  }

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
    else contentType = 'text/html'; // Default to HTML
  }
  console.log(`Content-Type: ${contentType}`);

  // Serve content
  const content = await ipfsResponse.blob();
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600', // Client-side cache for 1 hour
      'Access-Control-Allow-Origin': '*' // CORS header
    }
  });
}