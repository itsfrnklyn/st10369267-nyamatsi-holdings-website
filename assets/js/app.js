"use strict";

// =====================================================
// NYAMATSI HOLDINGS WEBSITE
// FIREBASE AUTHENTICATION, BOOKINGS AND ADMIN DASHBOARD
// =====================================================

// FIREBASE IMPORTS

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    getDocFromServer,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

import {
    firebaseConfig
} from "./firebase-config.js";


// =====================================================
// 1. INITIALIZE FIREBASE
// =====================================================

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const $ = selector => document.querySelector(selector);

let signedUser = null;
let currentProfile = null;
let authMode = "login";

let isAdmin = false;
let submittingBooking = false;

let unsubscribeBookings = null;
let unsubscribeAdminBookings = null;
let unsubscribeAdminUsers = null;

let sessionVersion = 0;

let adminBookings = [];
let adminUsers = [];

const authDialog = $("#auth-dialog");
const authForm = $("#auth-form");

const bookingForm = $("#booking-form");
const bookingFeedback = $("#booking-feedback");
const bookingButton = $("#booking-submit");


// =====================================================
// 2. GENERAL HELPERS
// =====================================================

function feedback(element, message, success = false) {

    if (!element) return;

    element.textContent = message;

    element.style.color = success
        ? "#217a3c"
        : "#a14523";
}

function friendlyError(error) {

    const messages = {

        "auth/invalid-email":
            "Enter a valid email address.",

        "auth/email-already-in-use":
            "This email is already registered.",

        "auth/invalid-credential":
            "Incorrect email or password.",

        "auth/weak-password":
            "Use a password with at least eight characters.",

        "auth/operation-not-allowed":
            "This sign-in provider is not enabled in Firebase.",

        "auth/unauthorized-domain":
            "This website domain is not authorized in Firebase Authentication.",

        "auth/popup-closed-by-user":
            "The Google Sign-In popup was closed.",

        "auth/popup-blocked":
            "Your browser blocked the Google Sign-In popup.",

        "auth/cancelled-popup-request":
            "The Google Sign-In request was cancelled.",

        "auth/account-exists-with-different-credential":
            "This email is already linked to another sign-in method.",

        "auth/network-request-failed":
            "Network error. Check your internet connection.",

        "permission-denied":
            "Firestore permission denied. Check your Firestore security rules.",

        "unavailable":
            "Firebase is currently unavailable."
    };

    return messages[error?.code] ||
        error?.message ||
        "An unexpected error occurred.";
}

function todayLocal() {

    const now = new Date();

    return new Date(
        now.getTime() -
        now.getTimezoneOffset() * 60000
    )
        .toISOString()
        .slice(0, 10);
}

function splitName(displayName) {

    const parts = (displayName || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    return {
        firstName: parts.shift() || "",
        lastName: parts.join(" ")
    };
}

function accountIsCurrent(uid) {

    return auth.currentUser?.uid === uid;
}

function createElement(tag, className = "", text = "") {

    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text) {
        element.textContent = text;
    }

    return element;
}

function addTextLine(parent, label, value) {

    const line = createElement("p");

    line.style.margin = "6px 0";
    line.style.fontSize = "14px";
    line.style.overflowWrap = "anywhere";

    const strong = createElement(
        "strong",
        "",
        `${label}: `
    );

    const text = createElement(
        "span",
        "",
        String(value ?? "—")
    );

    line.append(strong, text);

    parent.appendChild(line);
}


// =====================================================
// 3. WEBSITE NAVIGATION
// =====================================================

const tabs = new Set([
    "home",
    "bookings",
    "contact",
    "settings"
]);

function openTab(name, changeHash = true) {

    if (!tabs.has(name)) {
        name = "home";
    }

    document.querySelectorAll(".panel").forEach(panel => {

        panel.hidden = panel.id !== name;
    });

    document.querySelectorAll("[data-nav]").forEach(link => {

        const selected = link.dataset.nav === name;

        link.classList.toggle("active", selected);

        if (selected) {
            link.setAttribute(
                "aria-current",
                "page"
            );
        } else {
            link.removeAttribute("aria-current");
        }
    });

    if (
        changeHash &&
        location.hash !== `#${name}`
    ) {

        history.pushState(
            null,
            "",
            `#${name}`
        );
    }

    window.scrollTo(0, 0);
}

document.querySelectorAll("[data-nav]").forEach(link => {

    link.addEventListener("click", event => {

        event.preventDefault();

        openTab(link.dataset.nav);
    });
});

$(".brand").addEventListener("click", event => {

    event.preventDefault();

    openTab("home");
});

window.addEventListener("hashchange", () => {

    openTab(location.hash.slice(1), false);
});

window.addEventListener("popstate", () => {

    openTab(location.hash.slice(1), false);
});

openTab(location.hash.slice(1), false);


// =====================================================
// 4. AUTHENTICATION DIALOG
// =====================================================

function setAuthMode(mode) {

    authMode = mode;

    const registering = mode === "register";

    $("#register-fields").hidden = !registering;
    $("#forgot-button").hidden = registering;

    $("#auth-heading").textContent = registering
        ? "Create Account"
        : "Sign In";

    $("#auth-subtitle").textContent = registering
        ? "Create an account for the website and Android app."
        : "Use your Nyamatsi Holdings account.";

    $("#auth-submit").textContent = registering
        ? "Create Account"
        : "Sign In";

    $("#auth-switch-text").textContent = registering
        ? "Already have an account?"
        : "Don't have an account?";

    $("#auth-switch-button").textContent = registering
        ? "Sign In"
        : "Register";

    $("#auth-password").minLength = registering
        ? 8
        : 6;

    $("#auth-password").autocomplete = registering
        ? "new-password"
        : "current-password";

    $("#auth-first").required = registering;
    $("#auth-last").required = registering;

    feedback($("#auth-feedback"), "");
}

function showAuth(mode = "login") {

    authForm.reset();

    setAuthMode(mode);

    if (!authDialog.open) {
        authDialog.showModal();
    }
}

function authBusy(busy) {

    $("#auth-submit").disabled = busy;
    $("#google-button").disabled = busy;
}

document.querySelectorAll("[data-open-auth]").forEach(button => {

    button.addEventListener("click", () => {

        showAuth(button.dataset.openAuth);
    });
});

$("#auth-switch-button").addEventListener("click", () => {

    setAuthMode(
        authMode === "login"
            ? "register"
            : "login"
    );
});

document.querySelectorAll("[data-close]").forEach(button => {

    button.addEventListener("click", () => {

        button.closest("dialog").close();
    });
});

authDialog.addEventListener("click", event => {

    if (event.target === authDialog) {
        authDialog.close();
    }
});


// =====================================================
// 5. FIRESTORE CUSTOMER PROFILES
// =====================================================

async function ensureProfile(user, values = null) {

    const reference = doc(
        db,
        "users",
        user.uid
    );

    const snapshot = await getDoc(reference);

    if (snapshot.exists()) {
        return snapshot.data();
    }

    const fallback = splitName(user.displayName);

    const firstName =
        values?.firstName || fallback.firstName;

    const lastName =
        values?.lastName || fallback.lastName;

    const profile = {

        userId: user.uid,

        email: user.email || "",

        firstName,

        lastName,

        displayName:
            `${firstName} ${lastName}`.trim(),

        phone: values?.phone || "",

        createdAt: serverTimestamp()
    };

    await setDoc(reference, profile);

    return profile;
}

async function loadProfile(user) {

    const snapshot = await getDoc(
        doc(db, "users", user.uid)
    );

    return snapshot.exists()
        ? snapshot.data()
        : null;
}

async function refreshProfile(
    user,
    version = sessionVersion
) {

    let profile = null;

    try {

        profile = await loadProfile(user);

    } catch (error) {

        console.error(
            "PROFILE LOAD ERROR:",
            error
        );

        if (
            accountIsCurrent(user.uid) &&
            version === sessionVersion
        ) {

            feedback(
                $("#profile-feedback"),
                friendlyError(error)
            );
        }
    }

    if (
        !accountIsCurrent(user.uid) ||
        version !== sessionVersion
    ) {
        return;
    }

    currentProfile = profile;

    const fallback = splitName(
        user.displayName
    );

    $("#settings-first").value =
        profile?.firstName ??
        fallback.firstName;

    $("#settings-last").value =
        profile?.lastName ??
        fallback.lastName;

    $("#settings-phone").value =
        profile?.phone || "";

    $("#signed-email").textContent =
        user.email || "";

    $("#book-name").value =
        profile?.displayName ||
        user.displayName ||
        "";

    $("#book-email").value =
        user.email || "";

    $("#book-phone").value =
        profile?.phone || "";
}


// =====================================================
// 6. EMAIL REGISTRATION / LOGIN
// =====================================================

authForm.addEventListener("submit", async event => {

    event.preventDefault();

    if (!authForm.reportValidity()) {
        return;
    }

    const registering = authMode === "register";

    const email = $("#auth-email")
        .value.trim();

    const password = $("#auth-password").value;

    const firstName = $("#auth-first")
        .value.trim();

    const lastName = $("#auth-last")
        .value.trim();

    const phone = $("#auth-phone")
        .value.trim();

    if (registering) {

        if (
            firstName.length < 2 ||
            lastName.length < 2 ||
            password.length < 8
        ) {

            feedback(
                $("#auth-feedback"),
                "Enter valid names and a password of at least 8 characters."
            );

            return;
        }
    }

    authBusy(true);

    feedback($("#auth-feedback"), "");

    try {

        let credential;

        if (registering) {

            credential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            await updateProfile(
                credential.user,
                {
                    displayName:
                        `${firstName} ${lastName}`
                }
            );

            try {

                await ensureProfile(
                    credential.user,
                    {
                        firstName,
                        lastName,
                        phone
                    }
                );

            } catch (error) {

                console.error(
                    "PROFILE CREATION FAILED:",
                    error
                );

                feedback(
                    $("#profile-feedback"),
                    "Account created but profile creation failed: " +
                    friendlyError(error)
                );
            }

        } else {

            credential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            try {

                await ensureProfile(
                    credential.user
                );

            } catch (error) {

                console.error(
                    "PROFILE CHECK FAILED:",
                    error
                );
            }
        }

        authDialog.close();

        openTab("settings");

        await refreshProfile(
            credential.user
        );

    } catch (error) {

        console.error(
            "EMAIL AUTHENTICATION ERROR:",
            error
        );

        feedback(
            $("#auth-feedback"),
            friendlyError(error)
        );

    } finally {

        authBusy(false);
    }
});


// =====================================================
// 7. GOOGLE SIGN-IN
// =====================================================

$("#google-button").addEventListener("click", async () => {

    authBusy(true);

    feedback($("#auth-feedback"), "");

    try {

        const provider =
            new GoogleAuthProvider();

        provider.setCustomParameters({
            prompt: "select_account"
        });

        const credential = await signInWithPopup(
            auth,
            provider
        );

        try {

            await ensureProfile(
                credential.user
            );

        } catch (profileError) {

            console.error(
                "GOOGLE PROFILE ERROR:",
                profileError
            );
        }

        authDialog.close();

        openTab("settings");

        await refreshProfile(
            credential.user
        );

    } catch (error) {

        // IMPORTANT:
        // This shows the actual Firebase error code.

        console.error(
            "GOOGLE SIGN-IN FAILED:",
            {
                code: error.code,
                message: error.message,
                fullError: error
            }
        );

        feedback(
            $("#auth-feedback"),

            "Google Sign-In failed: " +
            (error.code || "unknown") +
            ". " +
            friendlyError(error)
        );

    } finally {

        authBusy(false);
    }
});


// =====================================================
// 8. PASSWORD RESET
// =====================================================

$("#forgot-button").addEventListener("click", async () => {

    const email = $("#auth-email")
        .value.trim();

    if (!email) {

        feedback(
            $("#auth-feedback"),
            "Enter your email address first."
        );

        return;
    }

    try {

        await sendPasswordResetEmail(
            auth,
            email
        );

        feedback(
            $("#auth-feedback"),
            "If this account is eligible, a password reset email has been requested.",
            true
        );

    } catch (error) {

        feedback(
            $("#auth-feedback"),
            friendlyError(error)
        );
    }
});

$("#reset-button").addEventListener("click", async () => {

    const user = auth.currentUser;

    if (!user?.email) {
        return;
    }

    try {

        await sendPasswordResetEmail(
            auth,
            user.email
        );

        feedback(
            $("#profile-feedback"),
            "Password reset email requested.",
            true
        );

    } catch (error) {

        feedback(
            $("#profile-feedback"),
            friendlyError(error)
        );
    }
});


// =====================================================
// 9. LOGOUT
// =====================================================

async function logout() {

    try {

        await signOut(auth);

        openTab("settings");

    } catch (error) {

        alert(friendlyError(error));
    }
}

$("#logout-button").addEventListener(
    "click",
    logout
);

$("#header-auth").addEventListener(
    "click",
    () => {

        if (auth.currentUser) {

            logout();

        } else {

            showAuth("login");
        }
    }
);


// =====================================================
// 10. SAVE CUSTOMER PROFILE
// =====================================================

$("#profile-form").addEventListener("submit", async event => {

    event.preventDefault();

    const user = auth.currentUser;

    if (!user) {

        showAuth("login");

        return;
    }

    const firstName = $("#settings-first")
        .value.trim();

    const lastName = $("#settings-last")
        .value.trim();

    const phone = $("#settings-phone")
        .value.trim();

    if (
        firstName.length < 2 ||
        lastName.length < 2
    ) {

        feedback(
            $("#profile-feedback"),
            "Enter valid first and last names."
        );

        return;
    }

    if (
        phone &&
        !/^[+0-9][0-9 \-]{8,19}$/.test(phone)
    ) {

        feedback(
            $("#profile-feedback"),
            "Enter a valid phone number."
        );

        return;
    }

    const button = $("#profile-save");

    button.disabled = true;

    try {

        const reference = doc(
            db,
            "users",
            user.uid
        );

        const snapshot = await getDoc(reference);

        if (!accountIsCurrent(user.uid)) {
            return;
        }

        const changes = {

            firstName,

            lastName,

            displayName:
                `${firstName} ${lastName}`,

            phone
        };

        if (snapshot.exists()) {

            await updateDoc(
                reference,
                changes
            );

        } else {

            await ensureProfile(
                user,
                changes
            );
        }

        if (!accountIsCurrent(user.uid)) {
            return;
        }

        await updateProfile(
            user,
            {
                displayName:
                    `${firstName} ${lastName}`
            }
        );

        await refreshProfile(user);

        feedback(
            $("#profile-feedback"),
            "Profile saved successfully.",
            true
        );

    } catch (error) {

        console.error(
            "PROFILE SAVE ERROR:",
            error
        );

        feedback(
            $("#profile-feedback"),
            friendlyError(error)
        );

    } finally {

        button.disabled = false;
    }
});


// =====================================================
// 11. BOOKING HISTORY
// =====================================================

const bookingHistory =
    $("#booking-history-list");

function showHistoryMessage(message) {

    bookingHistory.replaceChildren();

    const card = createElement(
        "div",
        "card padded muted",
        message
    );

    bookingHistory.appendChild(card);
}

function renderBookingHistory(documents) {

    bookingHistory.replaceChildren();

    if (documents.length === 0) {

        showHistoryMessage(
            "No booking requests yet. Your bookings will appear here."
        );

        return;
    }

    documents.forEach(snapshot => {

        const booking = snapshot.data();

        const statuses = [
            "Pending",
            "Approved",
            "Rejected",
            "Completed"
        ];

        const status = statuses.includes(
            booking.status
        )
            ? booking.status
            : "Pending";

        const card = createElement(
            "article",
            "card booking-history-card"
        );

        const header = createElement(
            "div",
            "booking-history-header"
        );

        const title = createElement(
            "h3",
            "",
            booking.service || "Service Request"
        );

        const badge = createElement(
            "span",
            `booking-status status-${status.toLowerCase()}`,
            status
        );

        header.append(
            title,
            badge
        );

        card.appendChild(header);

        addTextLine(
            card,
            "Booking",
            "#" + snapshot.id.slice(0, 8)
        );

        addTextLine(
            card,
            "Preferred Date",
            booking.preferredDate || "—"
        );

        addTextLine(
            card,
            "Service Address",
            booking.address || "—"
        );

        const descriptions = {

            Pending:
                "Your booking is awaiting review.",

            Approved:
                "Your booking has been approved.",

            Rejected:
                "Your booking request was declined.",

            Completed:
                "This service request has been completed."
        };

        const description = createElement(
            "p",
            "booking-description",
            descriptions[status]
        );

        card.appendChild(description);

        bookingHistory.appendChild(card);
    });
}


// =====================================================
// 12. LIVE BOOKING HISTORY
// =====================================================

function startBookingListener(userId, version) {

    if (unsubscribeBookings) {

        unsubscribeBookings();

        unsubscribeBookings = null;
    }

    showHistoryMessage(
        "Loading your booking requests..."
    );

    const bookingsQuery = query(

        collection(db, "bookings"),

        where("userId", "==", userId)

    );

    unsubscribeBookings = onSnapshot(

        bookingsQuery,

        snapshot => {

            if (
                !accountIsCurrent(userId) ||
                version !== sessionVersion
            ) {
                return;
            }

            const documents = [...snapshot.docs];

            documents.sort((a, b) => {

                const aTime =
                    a.data().createdAt
                        ?.toMillis?.() ?? 0;

                const bTime =
                    b.data().createdAt
                        ?.toMillis?.() ?? 0;

                return bTime - aTime;
            });

            renderBookingHistory(documents);
        },

        error => {

            console.error(
                "BOOKING HISTORY FIRESTORE ERROR:",
                {
                    code: error.code,
                    message: error.message,
                    userId
                }
            );

            if (
                accountIsCurrent(userId) &&
                version === sessionVersion
            ) {

                showHistoryMessage(
                    "Could not load bookings: " +
                    friendlyError(error)
                );
            }
        }
    );
}


// =====================================================
// 13. BOOKING DATE
// =====================================================

const dateInput = $("#book-date");

dateInput.min = todayLocal();


// =====================================================
// 14. SUBMIT BOOKING
// =====================================================

bookingForm.addEventListener("submit", async event => {

    event.preventDefault();

    if (submittingBooking) {
        return;
    }

    const user = auth.currentUser;

    if (!user) {

        feedback(
            bookingFeedback,
            "Please sign in before making a booking."
        );

        showAuth("login");

        return;
    }

    if (!bookingForm.reportValidity()) {
        return;
    }

    const name = $("#book-name").value.trim();

    const email = $("#book-email").value.trim();

    const phone = $("#book-phone").value.trim();

    const address = $("#book-address").value.trim();

    const service = $("#book-service").value;

    const preferredDate = dateInput.value;

    const emailPattern =
        /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

    const phonePattern =
        /^[+0-9][0-9 \-]{8,19}$/;

    if (
        name.length < 2 ||
        name.length > 80
    ) {

        feedback(
            bookingFeedback,
            "Enter a valid full name."
        );

        return;
    }

    if (
        email.length > 254 ||
        !emailPattern.test(email)
    ) {

        feedback(
            bookingFeedback,
            "Enter a valid email address."
        );

        return;
    }

    if (!phonePattern.test(phone)) {

        feedback(
            bookingFeedback,
            "Enter a valid phone number."
        );

        return;
    }

    if (
        address.length < 8 ||
        address.length > 240
    ) {

        feedback(
            bookingFeedback,
            "Enter a valid service address."
        );

        return;
    }

    if (
        !["Cleaning", "Construction"].includes(service)
    ) {

        feedback(
            bookingFeedback,
            "Select a valid service."
        );

        return;
    }

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ||
        preferredDate < todayLocal()
    ) {

        feedback(
            bookingFeedback,
            "Select today or a future date."
        );

        return;
    }

    submittingBooking = true;

    bookingButton.disabled = true;

    feedback(
        bookingFeedback,
        "Submitting your booking..."
    );

    try {

        const profileReference = doc(
            db,
            "users",
            user.uid
        );

        const profileSnapshot =
            await getDoc(profileReference);

        if (!profileSnapshot.exists()) {

            throw new Error(
                "Your customer profile does not exist. Please finish setting up your account."
            );
        }

        if (
            profileSnapshot.data()
                .bookingAccessPaused === true
        ) {

            throw new Error(
                "Booking access is paused for this account."
            );
        }

        if (!accountIsCurrent(user.uid)) {

            throw new Error(
                "Your account has changed. Please try again."
            );
        }

        const bookingData = {

            userId: user.uid,

            name,

            email,

            phone,

            address,

            service,

            preferredDate,

            status: "Pending",

            createdAt: serverTimestamp()
        };

        const reference = await addDoc(

            collection(db, "bookings"),

            bookingData
        );

        if (!accountIsCurrent(user.uid)) {
            return;
        }

        feedback(
            bookingFeedback,

            "Booking submitted successfully! Reference #" +
            reference.id.slice(0, 8),

            true
        );

        $("#book-address").value = "";
        dateInput.value = "";

    } catch (error) {

        console.error(
            "BOOKING SUBMISSION ERROR:",
            error
        );

        if (accountIsCurrent(user.uid)) {

            feedback(
                bookingFeedback,
                "Booking could not be submitted: " +
                friendlyError(error)
            );
        }

    } finally {

        submittingBooking = false;

        bookingButton.disabled = false;
    }
});


// =====================================================
// 15. CREATE ADMIN DASHBOARD INTERFACE
// =====================================================

function buildAdminDashboard() {

    if ($("#admin-panel")) {
        return;
    }

    const settingsSection = $("#settings .narrow");

    const adminPanel = createElement(
        "section",
        "card padded"
    );

    adminPanel.id = "admin-panel";

    adminPanel.hidden = true;

    adminPanel.style.marginTop = "20px";

    adminPanel.innerHTML = `
        <h2 style="color:#003b70;margin-bottom:8px;">
            Admin Dashboard
        </h2>

        <p class="muted">
            Nyamatsi Holdings Management
        </p>

        <div
            id="admin-status"
            style="font-size:13px;margin-bottom:15px;"
        >
            Loading dashboard...
        </div>

        <div
            id="admin-stats"
            style="
                display:grid;
                grid-template-columns:repeat(2,minmax(0,1fr));
                gap:12px;
                margin-bottom:20px;
            "
        ></div>

        <button
            type="button"
            id="admin-show-bookings"
            class="btn blue"
        >
            Booking Management
        </button>

        <button
            type="button"
            id="admin-show-users"
            class="btn outline"
        >
            View Registered Users
        </button>

        <div
            id="admin-bookings-section"
            style="margin-top:22px;"
        >
            <h3>Booking Management</h3>

            <div id="admin-booking-list"></div>
        </div>

        <div
            id="admin-users-section"
            style="margin-top:22px;"
            hidden
        >
            <h3>Registered Users</h3>

            <input
                id="admin-user-search"
                type="search"
                placeholder="Search name, email or phone"
                aria-label="Search registered users"
                style="
                    width:100%;
                    padding:13px;
                    border:1px solid #adbac7;
                    border-radius:12px;
                    margin-bottom:15px;
                "
            >

            <div id="admin-user-list"></div>
        </div>
    `;

    settingsSection.appendChild(adminPanel);

    $("#admin-show-bookings").addEventListener(
        "click",
        () => {

            $("#admin-bookings-section").hidden = false;
            $("#admin-users-section").hidden = true;
        }
    );

    $("#admin-show-users").addEventListener(
        "click",
        () => {

            $("#admin-bookings-section").hidden = true;
            $("#admin-users-section").hidden = false;
        }
    );

    $("#admin-user-search").addEventListener(
        "input",
        renderAdminUsers
    );
}

buildAdminDashboard();


// =====================================================
// 16. VERIFY ADMIN ACCESS
// =====================================================

async function checkAdminAccess(user) {

    if (!user) {
        return false;
    }

    try {

        const reference = doc(
            db,
            "admins",
            user.uid
        );

        const snapshot = await getDocFromServer(
            reference
        );

        return (
            snapshot.exists() &&
            snapshot.data().active === true
        );

    } catch (error) {

        console.error(
            "ADMIN VERIFICATION ERROR:",
            {
                code: error.code,
                message: error.message,
                uid: user.uid
            }
        );

        return false;
    }
}


// =====================================================
// 17. ADMIN STATISTICS
// =====================================================

function countAdminBookings(status) {

    return adminBookings.filter(snapshot => {

        return snapshot.data().status === status;

    }).length;
}

function renderAdminStats() {

    const container = $("#admin-stats");

    container.replaceChildren();

    const values = [

        ["Registered Users", adminUsers.length],

        ["Total Bookings", adminBookings.length],

        ["Pending", countAdminBookings("Pending")],

        ["Approved", countAdminBookings("Approved")],

        ["Completed", countAdminBookings("Completed")],

        ["Rejected", countAdminBookings("Rejected")]
    ];

    values.forEach(([title, value]) => {

        const card = createElement(
            "div"
        );

        card.style.cssText = `
            background:#f6fbfe;
            padding:16px;
            border-radius:14px;
            border:1px solid #dbeaf2;
        `;

        const label = createElement(
            "div",
            "",
            title
        );

        label.style.cssText = `
            font-size:12px;
            color:#68717d;
            margin-bottom:8px;
        `;

        const number = createElement(
            "strong",
            "",
            String(value)
        );

        number.style.cssText = `
            font-size:27px;
            color:#003b70;
        `;

        card.append(label, number);

        container.appendChild(card);
    });
}


// =====================================================
// 18. ADMIN BOOKING MANAGEMENT
// =====================================================

function renderAdminBookings() {

    const container =
        $("#admin-booking-list");

    container.replaceChildren();

    if (adminBookings.length === 0) {

        container.appendChild(
            createElement(
                "p",
                "muted",
                "No bookings available."
            )
        );

        return;
    }

    adminBookings.forEach(snapshot => {

        const booking = snapshot.data();

        const status =
            booking.status || "Pending";

        const card = createElement(
            "article",
            "card padded"
        );

        card.style.marginBottom = "14px";

        const title = createElement(
            "h3",
            "",
            booking.name || "Unknown Customer"
        );

        title.style.marginTop = "0";

        card.appendChild(title);

        addTextLine(
            card,
            "Reference",
            snapshot.id.slice(0, 8)
        );

        addTextLine(
            card,
            "Email",
            booking.email
        );

        addTextLine(
            card,
            "Phone",
            booking.phone
        );

        addTextLine(
            card,
            "Service",
            booking.service
        );

        addTextLine(
            card,
            "Date",
            booking.preferredDate
        );

        addTextLine(
            card,
            "Address",
            booking.address
        );

        addTextLine(
            card,
            "Status",
            status
        );


        // PENDING BOOKINGS

        if (status === "Pending") {

            addAdminActionButton(
                card,
                snapshot.id,
                "Approve Booking",
                "Pending",
                "Approved"
            );

            addAdminActionButton(
                card,
                snapshot.id,
                "Reject Booking",
                "Pending",
                "Rejected"
            );
        }


        // APPROVED BOOKINGS

        if (status === "Approved") {

            addAdminActionButton(
                card,
                snapshot.id,
                "Mark as Completed",
                "Approved",
                "Completed"
            );
        }

        container.appendChild(card);
    });
}

function addAdminActionButton(
    parent,
    bookingId,
    label,
    expectedStatus,
    newStatus
) {

    const button = createElement(
        "button",
        "btn blue",
        label
    );

    button.type = "button";

    button.style.marginTop = "13px";

    if (newStatus === "Rejected") {

        button.style.background = "#ad3030";
    }

    if (newStatus === "Completed") {

        button.style.background = "#217a3c";
    }

    button.addEventListener("click", async () => {

        const confirmed = confirm(
            `Change booking ${bookingId.slice(0, 8)} to ${newStatus}?`
        );

        if (!confirmed) {
            return;
        }

        button.disabled = true;

        try {

            if (!auth.currentUser || !isAdmin) {
                throw new Error(
                    "Administrator access is required."
                );
            }

            const reference = doc(
                db,
                "bookings",
                bookingId
            );

            await runTransaction(
                db,
                async transaction => {

                    const snapshot =
                        await transaction.get(reference);

                    if (!snapshot.exists()) {

                        throw new Error(
                            "This booking no longer exists."
                        );
                    }

                    if (
                        snapshot.data().status !==
                        expectedStatus
                    ) {

                        throw new Error(
                            "This booking's status has already changed."
                        );
                    }

                    transaction.update(
                        reference,
                        {
                            status: newStatus,
                            updatedAt: serverTimestamp()
                        }
                    );
                }
            );

            alert(
                `Booking updated to ${newStatus}.`
            );

        } catch (error) {

            console.error(
                "ADMIN BOOKING UPDATE ERROR:",
                error
            );

            alert(friendlyError(error));

        } finally {

            button.disabled = false;
        }
    });

    parent.appendChild(button);
}


// =====================================================
// 19. ADMIN REGISTERED USERS (VIEW ONLY)
// =====================================================

function renderAdminUsers() {

    const container = $("#admin-user-list");

    container.replaceChildren();

    const search = $("#admin-user-search")
        .value.trim().toLowerCase();

    const filtered = adminUsers.filter(snapshot => {

        const data = snapshot.data();

        const searchable = [

            data.firstName || "",

            data.lastName || "",

            data.displayName || "",

            data.email || "",

            data.phone || ""

        ]
            .join(" ")
            .toLowerCase();

        return searchable.includes(search);
    });

    if (filtered.length === 0) {

        container.appendChild(
            createElement(
                "p",
                "muted",
                "No matching registered users."
            )
        );

        return;
    }

    filtered.forEach(snapshot => {

        const user = snapshot.data();

        const name = (
            `${user.firstName || ""} ${user.lastName || ""}`
        ).trim() ||
            user.displayName ||
            "Unnamed Customer";

        const card = createElement(
            "article",
            "card padded"
        );

        card.style.marginBottom = "12px";

        const title = createElement(
            "h3",
            "",
            name
        );

        title.style.marginTop = "0";

        card.appendChild(title);

        addTextLine(
            card,
            "Email",
            user.email || "Not provided"
        );

        addTextLine(
            card,
            "Phone",
            user.phone || "Not provided"
        );

        addTextLine(
            card,
            "UID",
            snapshot.id
        );

        addTextLine(
            card,
            "Booking access",
            user.bookingAccessPaused === true
                ? "Paused"
                : "Active"
        );

        // View-only:
        // No edit, delete or deactivate controls.

        container.appendChild(card);
    });
}


// =====================================================
// 20. LIVE ADMIN DASHBOARD
// =====================================================

function startAdminListeners(userId, version) {

    stopAdminListeners();

    const adminStatus = $("#admin-status");

    adminStatus.textContent =
        "Loading admin information...";

    unsubscribeAdminBookings = onSnapshot(

        collection(db, "bookings"),

        snapshot => {

            if (
                !accountIsCurrent(userId) ||
                version !== sessionVersion ||
                !isAdmin
            ) {
                return;
            }

            adminBookings = [...snapshot.docs];

            adminBookings.sort((a, b) => {

                const aTime =
                    a.data().createdAt
                        ?.toMillis?.() ?? 0;

                const bTime =
                    b.data().createdAt
                        ?.toMillis?.() ?? 0;

                return bTime - aTime;
            });

            renderAdminBookings();

            renderAdminStats();

            adminStatus.textContent =
                "Dashboard updated";
        },

        error => {

            console.error(
                "ADMIN BOOKINGS ERROR:",
                error
            );

            if (
                accountIsCurrent(userId) &&
                version === sessionVersion
            ) {

                adminStatus.textContent =
                    "Could not load admin bookings: " +
                    friendlyError(error);
            }
        }
    );

    unsubscribeAdminUsers = onSnapshot(

        collection(db, "users"),

        snapshot => {

            if (
                !accountIsCurrent(userId) ||
                version !== sessionVersion ||
                !isAdmin
            ) {
                return;
            }

            adminUsers = [...snapshot.docs];

            renderAdminUsers();

            renderAdminStats();
        },

        error => {

            console.error(
                "ADMIN USERS ERROR:",
                error
            );

            if (
                accountIsCurrent(userId) &&
                version === sessionVersion
            ) {

                adminStatus.textContent =
                    "Could not load registered users: " +
                    friendlyError(error);
            }
        }
    );
}

function stopAdminListeners() {

    if (unsubscribeAdminBookings) {

        unsubscribeAdminBookings();

        unsubscribeAdminBookings = null;
    }

    if (unsubscribeAdminUsers) {

        unsubscribeAdminUsers();

        unsubscribeAdminUsers = null;
    }

    adminBookings = [];
    adminUsers = [];
}


// =====================================================
// 21. AUTHENTICATION STATE
// =====================================================

onAuthStateChanged(auth, async user => {

    sessionVersion += 1;

    const version = sessionVersion;

    // STOP PREVIOUS ACCOUNT LISTENERS

    if (unsubscribeBookings) {

        unsubscribeBookings();

        unsubscribeBookings = null;
    }

    stopAdminListeners();

    signedUser = user;

    currentProfile = null;

    isAdmin = false;

    $("#admin-panel").hidden = true;

    $("#header-user").textContent =
        user?.email || "Not signed in";

    $("#header-auth").textContent =
        user ? "Log Out" : "Sign In";

    $("#signed-out-card").hidden =
        Boolean(user);

    $("#profile-form").hidden =
        !user;

    $("#account-actions").hidden =
        !user;

    $("#booking-auth-notice").hidden =
        Boolean(user);


    // CLEAR PREVIOUS ACCOUNT DATA

    const fields = [

        "settings-first",

        "settings-last",

        "settings-phone",

        "book-name",

        "book-email",

        "book-phone",

        "book-address",

        "book-date"
    ];

    fields.forEach(id => {

        const input = $("#" + id);

        if (input) {
            input.value = "";
        }
    });

    feedback(
        $("#profile-feedback"),
        ""
    );

    feedback(
        bookingFeedback,
        ""
    );

    showHistoryMessage(
        user
            ? "Loading booking history..."
            : "Sign in to view your bookings."
    );

    $("#admin-booking-list").replaceChildren();

    $("#admin-user-list").replaceChildren();

    renderAdminStats();


    if (!user) {
        return;
    }


    // LOAD CUSTOMER INFORMATION

    await refreshProfile(
        user,
        version
    );

    if (
        !accountIsCurrent(user.uid) ||
        version !== sessionVersion
    ) {
        return;
    }


    // START CUSTOMER BOOKING HISTORY

    startBookingListener(
        user.uid,
        version
    );


    // VERIFY ADMIN PRIVILEGES

    const adminAccess =
        await checkAdminAccess(user);

    if (
        !accountIsCurrent(user.uid) ||
        version !== sessionVersion
    ) {
        return;
    }

    isAdmin = adminAccess;

    if (isAdmin) {

        $("#admin-panel").hidden = false;

        startAdminListeners(
            user.uid,
            version
        );

    } else {

        $("#admin-panel").hidden = true;
    }
});


// =====================================================
// 22. SERVICE CARD SELECTION
// =====================================================

document.querySelectorAll(".service-btn").forEach(button => {

    button.addEventListener("click", () => {

        $("#book-service").value =
            button.dataset.service;

        openTab("bookings");
    });
});


// =====================================================
// 23. INITIALIZATION COMPLETE
// =====================================================

console.log(
    "Nyamatsi Holdings website initialized."
);







/* =========================================
   WELCOME SECTION - EXPLORE SERVICES BUTTON
========================================= */

document.addEventListener("click", function (event) {

    const button = event.target.closest("[data-scroll-target]");

    if (!button) return;

    const targetId = button.dataset.scrollTarget;
    const targetSection = document.getElementById(targetId);

    if (!targetSection) {
        console.error("Section not found:", targetId);
        return;
    }

    event.preventDefault();

    // Scroll smoothly to the selected section
    targetSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    // Update the URL hash without reloading the page
    history.replaceState(null, "", "#" + targetId);

});