# Fix Vercel serverless crash (session store / deployment)

## Root cause
- The pasted error `Error setting ... to Session` comes from `connect-mongodb-session`
  (unused in code, incompatible with the hoisted `mongodb@7` driver). That log is from an
  OLD deployment (timestamp 14:09 predates the restore commit 14:22). The restore is now on
  `origin/main` but the app was never hardened for serverless.
- Even after restore, `app.js` has serverless landmines: unconditional `app.listen()` at
  module load, no mongoose error listener, no fail-fast DB timeouts.

## Changes

### 1. `app.js` — harden for Vercel serverless
- Add mongoose error listener so a DB outage logs instead of crashing:
  ```js
  mongoose.connection.on("error", (err) => console.error("Mongoose Connection Error:", err));
  ```
- Add fail-fast timeout to the DB connect:
  ```js
  await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 5000 });
  ```
- Pass the same timeout to the session store:
  ```js
  mongoOptions: { serverSelectionTimeoutMS: 5000 }
  ```
- Guard `app.listen` so Vercel doesn't bind a port on module load:
  ```js
  if (require.main === module) {
      app.listen(PORT, () => { ... });
  }
  ```

### 2. `package.json` — remove the unused, broken dependency
- Remove `"connect-mongodb-session": "^5.0.0"` (only `connect-mongo` is used).
- Run `npm uninstall connect-mongodb-session` to update `package-lock.json`.

### 3. Verify
- `node --check app.js`
- Confirm app module loads (no ReferenceError).

### 4. Redeploy
- Commit + push; Vercel auto-deploys from `origin/main`.
- Hard-refresh the URL; test POST `/signup`.
- If it still 500s, paste a FRESH runtime log (timestamp after redeploy) — the hardened
  error logging will now surface the real underlying Mongo error.

## Out of scope
- Google OAuth / Cloudinary / email config (env vars already set on Vercel).
- Atlas network access (Mongoose writes succeeded on the old deployment, so not blocked).
