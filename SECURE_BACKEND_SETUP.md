# Secure backend for GitHub Pages

The frontend is hosted on GitHub Pages. Google Sheets credentials must stay in a server-side API and must never be committed to this repository.

## 1. Rotate the exposed Google service-account key first

1. Open Google Cloud Console → IAM & Admin → Service Accounts.
2. Select the service account used by the old dashboard.
3. Open **Keys**, delete/revoke the exposed key, and create a new JSON key only if required.
4. Do not paste the new key into this repository or into any browser JavaScript.
5. If the key was used elsewhere, update those systems too.

Deleting a key in Google Cloud does not remove it from Git history; rotation is required.

## 2. Deploy the API to Vercel

Import this same GitHub repository into Vercel. The API route is `api/dashboard.js`. Deploy the branch after adding the environment variables below, or use the Vercel project settings to configure them before deploying.

Set these **server-side** Vercel Environment Variables for the environments you use:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the service account email.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — the newly rotated private key. In Vercel, paste the full PEM value; escaped `\\n` sequences are supported.
- `GOOGLE_SHEET_ID` — the spreadsheet ID.
- `GOOGLE_SHEET_NAME` — the worksheet/tab name, e.g. the current expense data tab.
- `ALLOWED_ORIGIN` — `https://dme1306.github.io`.

Share the spreadsheet with the service-account email as **Viewer** and ensure the Google Sheets API is enabled in the service account's Google Cloud project. Redeploy after setting variables.

## 3. Point GitHub Pages at the API

After the Vercel API is deployed, edit `js/config.js` and set `API_BASE_URL` to the exact Vercel deployment origin, for example `https://your-project.vercel.app` (no trailing slash). Do not add credentials to this setting.

GitHub Pages deploys from the repository's configured Pages branch/folder. Merge the UI branch only after the API is ready and `API_BASE_URL` has been set, so the live dashboard does not point to an unconfigured endpoint.

## Important access note

CORS restricts which browser origins can read the API, but it is not authentication. If the expense dashboard or its data must be private, put an authentication layer in front of the API and Pages site before publishing the data. Anyone allowed to load a public dashboard can inspect the data the dashboard displays.
