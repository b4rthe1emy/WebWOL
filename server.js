const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const wol = require('wake_on_lan');
const fs = require('node:fs');
const path = require('node:path');
const expressLayouts = require('express-ejs-layouts');

const SERVER_PORT = 3000;

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware
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

// ===== Routes =====

// Login page
app.get('/', (req, res) => {
    res.render('login', {
        title: 'Login',
        error: null
    });
});

// Login handler
app.post('/login', (req, res) => {
    const {username, password} = req.body;

    const users = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'data/users.json'))
    );

    if (users[username] && users[username] === password) {
        req.session.authenticated = true;
        req.session.username = username;
        res.redirect('/dashboard');
    } else {
        res.status(401).render('login', {
            title: 'Login',
            error: 'Invalid username or password.'
        });
    }
});

// Dashboard (enter MAC)
app.get('/dashboard', requireAuth, (req, res) => {
    res.render('dashboard', {
        title: 'Wake Device',
        error: null,
        username: req.session.username
    });
});

// Confirmation page
app.get('/confirm', requireAuth, (req, res) => {
    res.render('confirm', {
        title: 'Confirm Wake-on-LAN',
        targetMac: req.session.targetMac
    });
});

// Send WOL packet
app.post('/wake', requireAuth, (req, res) => {
    const targetMac = req.body.targetMac.toUpperCase();

    wol.wake(targetMac, function (error) {
        if (error) {
            res.status(500).render('dashboard', {
                title: 'Wake Device',
                username: req.session.username,
                error: `Error sending WOL packet: ${error}`
            });
        } else {
            res.render('result', {
                title: 'Success',
                targetMac
            });
        }
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// 404 handler (must be last route)
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
        url: req.originalUrl,
        isAuthenticated: req.session?.authenticated || false
    });
});

app.listen(SERVER_PORT, () => {
    console.log(`WOL web app running on http://localhost:${SERVER_PORT}`);
});