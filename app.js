// Simple Wake-on-LAN Web App (MAC + Password Login)
// Run with: npm install express express-session body-parser wake_on_lan
// Then: node wol-webapp-server.js

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const wol = require('wake_on_lan');
const fs = require("node:fs");

// ====== CONFIGURATION ======
const SERVER_PORT = 3000;

// ============================

const app = express();

app.use(bodyParser.urlencoded({extended: false}));
app.use(session({
    secret: 'wol-secret-key',
    resave: false,
    saveUninitialized: false
}));

function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.redirect('/');
}

// Home page (enter MAC + password)
app.get('/', (req, res) => {
    res.send(`
        <h2>Wake-on-LAN Login</h2>
        <form method="POST" action="/login">
            <label>Target Device MAC Address:</label>
            <input type="text" name="targetMac" placeholder="AA:BB:CC:DD:EE:FF" required />
            <br><br>
            <label>Password:</label>
            <input type="password" name="password" required />
            <br><br>
            <button type="submit">Continue</button>
        </form>
    `);
});

// Login handler
app.post('/login', (req, res) => {
    let {targetMac, password} = req.body;

    // Normalize MAC to uppercase
    targetMac = targetMac.toUpperCase();
    const macCredentials = JSON.parse(fs.readFileSync("data/macCredentials.json").toString());
    if (macCredentials[targetMac] && macCredentials[targetMac] === password) {
        req.session.authenticated = true;
        req.session.targetMac = targetMac;
        res.redirect('/confirm');
    } else {
        res.send('<p>Invalid MAC address or password</p><a href="/">Try again</a>');
    }
});

// Confirmation page
app.get('/confirm', requireAuth, (req, res) => {
    res.send(`
        <h2>Confirm Wake-on-LAN</h2>
        <p>Target MAC: ${req.session.targetMac}</p>
        <form method="POST" action="/wake">
            <button type="submit">Send Wake-on-LAN Packet</button>
        </form>
        <br>
        <a href="/logout">Cancel</a>
    `);
});

// Send WOL packet
app.post('/wake', requireAuth, (req, res) => {
    wol.wake(req.session.targetMac, function (error) {
        if (error) {
            res.send(`<p>Error sending WOL packet: ${error}</p><a href="/confirm">Back</a>`);
        } else {
            res.send(`<p>Magic packet sent successfully to ${req.session.targetMac}</p><a href="/confirm">Back</a>`);
        }
    });
});

// Logout / Reset
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.listen(SERVER_PORT, () => {
    console.log(`WOL web app running on http://localhost:${SERVER_PORT}`);
});
