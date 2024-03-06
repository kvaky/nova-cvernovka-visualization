const express = require('express');
const passport = require('passport');
const { google } = require('googleapis');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT;
const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_SHEETS_API_KEY });

app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

const fetchSheetData = async (spreadsheetId, sheetName) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}`,
            valueRenderOption: 'UNFORMATTED_VALUE',
        });
        return response.data.values;
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        throw error;
    }
};

const isUserAllowed = async (profile) => {
    try {
        const allowedUsersData = await fetchSheetData(process.env.SPREADSHEET_ID, "allowed_google_users");
        const allowedEmails = allowedUsersData.map(row => row[0]);
        return allowedEmails.includes(profile.emails[0].value);
    } catch (error) {
        console.error('Error checking user permission:', error);
        throw error;
    }
};

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        if (await isUserAllowed(profile)) return done(null, profile);
        return done(null, false, { message: 'Unauthorized user' });
    } catch (error) {
        return done(error);
    }
}));

const isAuthenticated = async (req, res, next) => {
    try {
        if (req.isAuthenticated()) {
            if (await isUserAllowed(req.user)) return next();
            else req.logout(() => res.redirect('/login-error'));
        } else res.redirect('/auth/google');
    } catch (error) {
        next(error);
    }
};

app.get('/auth/google',
    passport.authenticate('google', { scope: ['email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login-error' }),
    (req, res) => res.redirect('/')
);

app.get('/login-error', (req, res) => {
    res.send('Unauthorized access: You do not have permission to access this application.');
});

app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/real_time_diagram.html');
    console.log(req.user);
});

app.get('/fetch-data', isAuthenticated, async (req, res, next) => {
    try {
        const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId: process.env.SPREADSHEET_ID, fields: 'sheets.properties' });
        const sheetNames = sheetMetadata.data.sheets
            .map(sheet => sheet.properties.title)
            .filter(sheetName => sheetName !== "allowed_google_users");
        const allSheetsData = await Promise.all(sheetNames.map(async (sheetName) => {
            return { [sheetName]: await fetchSheetData(process.env.SPREADSHEET_ID, sheetName) };
        })).then((data) => Object.assign({}, ...data));
        res.json(allSheetsData);
    } catch (error) {
        next(error);
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
