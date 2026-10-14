# National University IT Ticketing

The dashboard is built with plain HTML, CSS, and browser JavaScript. Tickets are stored in Cloud Firestore, and staff sign in with Firebase Authentication. There is no application server; Firebase configuration is public web-app configuration, while Firestore Security Rules restrict ticket access to signed-in users.

## Requirements

- Node.js 20.19+ or 22.12+
- A Firebase project with a registered Web app

## Firebase setup

1. In [Firebase Console](https://console.firebase.google.com/), create or select a project and register a Web app. Copy its Firebase configuration values.
2. In **Authentication → Sign-in method**, enable **Email/Password**. In **Authentication → Users**, create an account for each staff member. This app intentionally has no public sign-up.
   Add the development hostname (for example, `localhost` or `127.0.0.1`, without a port) under **Authentication → Settings → Authorized domains** if Firebase reports `auth/unauthorized-domain`.
3. The app uses the named Firestore Enterprise database `it-ticketing` in `asia-southeast1` (Singapore). It is already provisioned for the configured Firebase project. To recreate it, run:

   ```powershell
   npx firebase-tools firestore:databases:create it-ticketing --edition enterprise --location asia-southeast1
   ```

4. Deploy the Firestore rules in `firestore.rules`:

   ```powershell
   npx firebase-tools deploy --only firestore:rules
   ```

   The rules require authentication, validate ticket fields, and prohibit ticket deletion.
5. `.env.example` lists the Firebase Web app values used by Vite. Copy it to `.env` and enter the values from Firebase Console:

   ```powershell
   Copy-Item .env.example .env
   ```

## Run locally

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite and sign in with a staff account. If you change `.env`, restart Vite.

For production, run `npm run build` and deploy the generated `dist` directory to Firebase Hosting or another static host. Configure the same Firebase Web app values as build-time environment variables.

## Data migration

The previous MySQL schema/data is not migrated automatically. Export existing tickets from the old database and import them into the Firestore `tickets` collection before switching staff to this version. New Firestore tickets are assigned document-based IDs.
