# Bravesite: Web2 Gateway for Unstoppable Domains `.brave` via Cloudflare Workers

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## Overview

**Bravesite** is an open-source Cloudflare Worker that acts as a seamless bridge between Web2 and Web3, enabling any browser to access content associated with Unstoppable Domains `.brave` addresses—simply by appending `.site` to the `.brave` domain.

**Example:**  
If you own `sunspot.brave`, you can serve your IPFS-hosted site at `https://sunspot.brave.site`—no browser plugins, no special gateways, no extra setup.

---

## How It Works

1. **DNS Mapping:**  
   When a user visits `https://<domain-or-subdomain>.brave.site`, the Worker extracts `<domain-or-subdomain>` and constructs the corresponding Unstoppable Domain: `<domain-or-subdomain>.brave`.

2. **Unstoppable Domains API:**  
   The Worker queries the Unstoppable Domains API to resolve the domain. It first checks for a `browser.redirect_url` record.

3. **Redirect Handling (New):**
   If a `browser.redirect_url` is found in the domain's records, the Worker immediately issues an HTTP 302 redirect to that URL. This takes precedence over IPFS content.

4. **IPFS Content Fetching:**  
   If no redirect URL is found, the Worker fetches the associated IPFS content hash (from records like `dweb.ipfs.hash`, `ipfs.html.value`, or `crypto.IPFS.value`).

5. **IPFS Content Delivery:**  
   The Worker attempts to fetch the content from multiple public IPFS gateways (Cloudflare, ipfs.io, dweb.link) concurrently, using the first successful response. A fallback to sequential retries is in place for resilience.

6. **Content Serving:**  
   The fetched IPFS content is served directly to the browser with appropriate content-type headers, CORS, and caching.

---

## Features

- **Web2/Web3 Bridge:**  
  Access decentralized IPFS content or Web2 redirect URLs from any browser using familiar URLs.
- **Redirect URL Support:**
  If a `.brave` domain has a `browser.redirect_url` record, users will be seamlessly redirected, allowing for easy pointing to existing Web2 sites.
- **Subdomain and Base Domain Support:**
  Resolves both `yourdomain.brave.site` (to `yourdomain.brave`) and `sub.yourdomain.brave.site` (to `sub.yourdomain.brave`).
- **Optimized IPFS Fetching:**  
  Uses `Promise.race` for faster IPFS gateway responses, with fallback to sequential retries.
- **API Response Caching:**
  Caches responses from the Unstoppable Domains API to improve performance for repeated requests.
- **Multi-Gateway Resilience:**  
  Tries several IPFS gateways and retries on failure for robust content delivery.
- **No Plugins Required:**  
  Works out-of-the-box in any browser—no extensions or wallet required.
- **Open Source & Extensible:**  
  Apache 2.0 licensed. Easily adapt for other TLDs or decentralized protocols.

---

## File Structure

```
.
├── worker.js                # Main Cloudflare Worker logic (Web2/Web3 bridge)
├── wrangler.jsonc           # Cloudflare Worker configuration
├── package.json             # Project scripts and dependencies
├── LICENSE                  # Apache 2.0 License
├── src/
│   └── index.ts             # Example starter worker (not used in main logic)
├── test/
│   └── index.spec.ts        # Example tests (not for main worker.js)
└── ...                      # Other config and support files
```

---

## worker.js: Core Logic

- **Entry Point:**  
  The Worker listens for all fetch events and processes requests to `*.brave.site`.

- **Subdomain Extraction:**  
  Parses the subdomain from the request (e.g., `sunspot` from `sunspot.brave.site`).

- **Unstoppable Domains Lookup:**  
  Uses the Unstoppable Domains API (requires an API key) to resolve the `.brave` domain and extract the IPFS hash.

- **IPFS Fetching:**  
  Attempts to fetch the content from multiple gateways, with retries and error handling.

- **Content-Type Detection:**  
  Sets the correct `Content-Type` header based on the file extension or gateway response.

- **CORS & Caching:**  
  Adds `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=3600` for broad compatibility and performance.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/bravesite.git
cd bravesite
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

- Copy your Unstoppable Domains API key.
- Set it as a secret in your Cloudflare Worker environment:

```bash
npx wrangler secret put UNSTOPPABLE_API_KEY
```

### 4. Development

Start a local development server:

```bash
npm run dev
```

Visit [http://localhost:8787](http://localhost:8787) and test with a custom hosts entry if needed.

### 5. Deploy to Cloudflare

```bash
npm run deploy
```

---

## Usage

- Register a `.brave` domain via [Unstoppable Domains](https://unstoppabledomains.com/).
- Set your IPFS hash in the domain records (e.g., `dweb.ipfs.hash`) OR set a redirect URL in the `browser.redirect_url` record.
- Access your decentralized site or redirect at:  
  `https://<yourdomain>.brave.site`  
  or for subdomains:  
  `https://<subdomain>.<yourdomain>.brave.site`

**Example (IPFS):**  
If you own `sunspot.brave` and set its IPFS hash, visit:  
`https://sunspot.brave.site`

**Example (Redirect):**
If you own `mysite.brave` and set `browser.redirect_url` to `https://myothersite.com`, visiting `https://mysite.brave.site` will redirect to `https://myothersite.com`.

---

## Configuration

- **wrangler.jsonc**  
  Main configuration for Cloudflare deployment.  
  Example:
  ```json
  {
    "name": "bravesite",
    "main": "worker.js",
    "account_id": "<your-cloudflare-account-id>",
    "compatibility_date": "2025-05-21"
  }
  ```

- **Environment Variable:**  
  - `UNSTOPPABLE_API_KEY`: Your Unstoppable Domains API key (set as a secret).

---

## Extending

- **Add More Gateways:**  
  Edit the `gateways` array in `worker.js` to add more IPFS gateways.
- **Support More TLDs:**  
  Adjust the domain parsing logic to support other Unstoppable TLDs.

---

## License

This project is licensed under the [Apache 2.0 License](LICENSE).

---

## Contributing

Pull requests and issues are welcome! Please open an issue to discuss major changes.

---

## Acknowledgements

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Unstoppable Domains](https://unstoppabledomains.com/)
- [IPFS](https://ipfs.tech/)

---

**Bravesite** makes decentralized web content accessible to everyone, everywhere. 