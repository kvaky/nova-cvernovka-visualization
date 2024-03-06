const express = require('express');
const passport = require('passport');
const { google } = require('googleapis');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const fs = require('fs');
require('dotenv').config();

// Initialize Express
const app = express();
const port = process.env.PORT;

// Configure session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Passport session setup
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_SHEETS_API_KEY });

// Function to check if user is allowed
const isUserAllowed = async (profile) => {
    try {
        const allowedUsersData = await fetchSheetData(process.env.SPREADSHEET_ID, "allowed_google_users");
        const allowedEmails = allowedUsersData.map(row => row[0]);

        const userEmail = profile.emails[0].value;
        return allowedEmails.includes(userEmail);
    } catch (error) {
        console.error('Error checking if user is allowed:', error);
        return false;
    }
};

// Use Google OAuth 2.0 Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            if (await isUserAllowed(profile)) {
                return done(null, profile);
            } else {
                return done(null, false, { message: 'Unauthorized user' });
            }
        } catch (error) {
            console.error('Error checking if user is allowed:', error);
            return done(error);
        }
    }
));

// Middleware to check authentication and allowed users
const isAuthenticated = async (req, res, next) => {
    if (req.isAuthenticated()) {
        try {
            if (await isUserAllowed(req.user)) {
                return next();
            } else {
                req.logout(() => {
                    res.redirect('/');
                });
            }
        } catch (error) {
            console.error('Error checking if user is allowed:', error);
            return res.status(500).send('Error checking authentication');
        }
    } else {
        res.redirect('/auth/google');
    }
};


// Define routes

// Google Authentication Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login-error' }),
    (req, res) => {
        // Successful authentication, redirect home.
        res.redirect('/');
    }
);

app.get('/login-error', (req, res) => {
    res.send('Unauthorized access: You do not have permission to access this application.');
});

// Logout Route
app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

// Main Route - Requires Authentication
app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/real_time_diagram.html');
    console.log(req.user);
});

const fetchSheetData = async (spreadsheetId, sheetName) => {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}`,
        valueRenderOption: 'UNFORMATTED_VALUE',
    });
    return response.data.values;
};

// Function to fetch data from Google Sheets
async function fetchDataFromSpreadSheet(spreadsheetId, sheetsToGet = [], sheetsToExclude = []) {
    let sheetNames;
    if ((sheetsToGet.length !== 0) && (sheetsToExclude.length !== 0)){
        throw new Error('Error: sheetsToGet and sheetsToExclude are both provided');
    } else if (sheetsToExclude.length !== 0) {
        const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
        sheetNames = sheetMetadata.data.sheets
            .filter(sheet => !sheetsToExclude.includes(sheet.properties.title))
            .map(sheet => sheet.properties.title);
    } else {
        sheetNames = sheetsToGet;
    }

    return await Promise.all(sheetNames.map(async (sheetName) => {
        return { [sheetName]: await fetchSheetData(spreadsheetId, sheetName) };
    })).then((data) => Object.assign({}, ...data));
}

// Data Fetching Route - Requires Authentication
app.get('/fetch-data', isAuthenticated, async (req, res) => {
    try {
        const allSheetsData = await fetchDataFromSpreadSheet(process.env.SPREADSHEET_ID, undefined, ["allowed_google_users"]);
        res.json(allSheetsData);
    } catch (error) {
        console.error('The API returned an error: ' + error);
        res.status(500).send('Error fetching data');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
