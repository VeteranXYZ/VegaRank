# VegaRank Deployment Cutover

Use this checklist for the production domain and API cutover. Do not paste secrets,
database URLs, private keys, or certificate material into this document or commit
them to the repo.

## Frontend Domain

1. Update Cloudflare Pages custom domain from the old frontend domain to
   `vegarank.com`.
2. Confirm `www.vegarank.com` handling if the deployment should support it.
3. Wait for Cloudflare Pages domain verification and DNS propagation.

## API Domain

1. Configure DNS for `api.vegarank.com` to point at the VPS or reverse proxy.
2. Configure the reverse proxy for `api.vegarank.com` to forward to
   `127.0.0.1:3000`.
3. Issue and install a TLS certificate for `api.vegarank.com`.
4. Keep the existing API process name and local port unless a separate
   infrastructure migration is planned.

## Frontend API Base

1. Set the frontend API base environment variable, if the Pages deployment uses
   one:

   ```bash
   NEXT_PUBLIC_TRADE_API_BASE_URL=https://api.vegarank.com
   ```

2. Redeploy the frontend after the environment variable is updated.

## VPS Code And Runtime

1. Pull the latest code on the VPS from the production branch.
2. Install dependencies with the existing locked package manager command.
3. Build the app if the VPS workflow requires a build before restart.
4. Restart the PM2 API process:

   ```bash
   pm2 restart trade-api --update-env
   ```

5. Run cleanup only if the scoring or code-contract version changed and the
   cleanup is part of the release plan.
6. Run the production ranking tasks for the supported production timeframes.

## Validation

1. Validate the new API routes:

   ```bash
   curl -fsS 'https://api.vegarank.com/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=5'
   curl -fsS 'https://api.vegarank.com/api/rankings/mtf-latest?assetClass=crypto'
   ```

2. Confirm the old API routes are not available and do not redirect:

   ```bash
   curl -i 'https://api.vegarank.com/api/scan/latest'
   curl -i 'https://api.vegarank.com/api/history/snapshots'
   ```

3. Validate the frontend pages:

   ```txt
   https://vegarank.com/
   https://vegarank.com/rankings
   https://vegarank.com/screener
   https://vegarank.com/watchlist
   https://vegarank.com/archive
   ```

4. Remove the old `api.auere.com` DNS/proxy/TLS configuration only after the new
   frontend and API routes have been validated.
