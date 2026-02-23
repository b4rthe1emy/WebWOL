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
app.use(express.json());
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

function checkUserInfo(username, password) {
    const users = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'data/users.json')).toString()
    );

    for (const user of users) {
        if (user.username === username && user.password === password) {
            return true;
        }
    }
    return false;
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

    if (checkUserInfo(username, password)) {
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
    const users = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'data/users.json')).toString()
    );
    const user = users.find(u => u.username === req.session.username);

    res.render('dashboard', {
        title: 'Wake Device',
        error: null,
        username: req.session.username,
        savedMacAddresses: user?.savedMacAddresses || []
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

    try {
        wol.wake(targetMac);

        res.render('result', {
            title: 'Success',
            targetMac
        });
    } catch (error) {
        res.status(500).render('dashboard', {
            title: 'Wake Device',
            username: req.session.username,
            error: `Error sending WOL packet: ${error}`
        });
    }
});

// Add to favorites
app.post('/favorites/add', requireAuth, (req, res) => {
    const {MAC, label} = req.body;
    const users = JSON.parse(fs.readFileSync('data/users.json').toString());
    const user = users.find(u => u.username === req.session.username);

    if (!user.savedMacAddresses) user.savedMacAddresses = [];

    if (!user.savedMacAddresses.some(d => d.MAC === MAC)) {
        user.savedMacAddresses.push({MAC, label: label || MAC});
        fs.writeFileSync('data/users.json', JSON.stringify(users, null, 2));
    }

    res.json({success: true});
});

// Remove from favorites
app.post('/favorites/remove', requireAuth, (req, res) => {
    const {MAC} = req.body;
    const users = JSON.parse(fs.readFileSync('data/users.json').toString());
    const user = users.find(u => u.username === req.session.username);

    if (user.savedMacAddresses) {
        user.savedMacAddresses = user.savedMacAddresses.filter(d => d.MAC !== MAC);
        fs.writeFileSync('data/users.json', JSON.stringify(users, null, 2));
    }

    res.json({success: true});
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// 404 handler
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