# Nyamatsi Holdings — Android-matching website UI (Phase 1)

This is a responsive static website built to follow the existing Nyamatsi Holdings Android app's colours, logo, images, four navigation tabs, booking form and account settings. Images were reused from the website archive previously provided, with navigation icons from the Android work.

## Start in VS Code

1. Open this folder in Visual Studio Code.
2. Right-click `index.html` and choose **Open with Live Server** if you have the VS Code Live Server extension.
3. Alternatively run `python -m http.server 8000` from this folder and open http://localhost:8000.
4. `index.html` may also open directly in a browser, but use a local server for the future Firebase integration.

## Functional scope

**Working in Phase 1:** Home/Bookings/Contact/Settings navigation, service detail dialogs, service preselection, responsive layout, contact links, form browser validation, locally saved notice preference.

**Not yet implemented:** Firebase login or registration, Google Sign-In, profile changes, actual booking submission, booking history, password changes, admin dashboard. UI explicitly warns instead of implying that data was saved.

## Next phase

Register a **Web app** inside the existing Firebase project, use its web Firebase configuration (public identifiers, not Admin SDK credentials), connect Auth + Firestore, and test existing Firestore rules carefully. Keep server-side admin credentials out of all website files.

This package does not modify the Android project or the user's original website.
