import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import 'dotenv/config';
import express from 'express';
import session from 'express-session'; // NEW
import passport from 'passport';      // NEW
import { Strategy as DiscordStrategy } from 'passport-discord'; // NEW
import { loadCommands, loadEvents } from './utility/load.js';
import { log } from './utility/log.js';

const client = new Client({ intents: [ GatewayIntentBits.Guilds ] });
client.commands = new Collection();

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN);

client.once('ready', () => {
    const testGuild = client.guilds.cache.get('1385946310347329647');

    log({
        title: 'Bot démarré',
        description: 'Le bot a été démarré avec succès.',
        color: '#64ff64'
    }, testGuild);
});

const app = express();

// =========== DISCORD OAUTH2 SETUP ============

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'defaultsecret', // set SESSION_SECRET in env!
    resave: false,
    saveUninitialized: false,
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport serialize/deserialize
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Discord OAuth2 strategy
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URI,
    scope: ['identify', 'guilds'],
}, (accessToken, refreshToken, profile, done) => {
    // You could save profile info to a DB here
    return done(null, profile);
}));

// Routes for authentication
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        // Successful login, redirect to dashboard
        res.redirect('/dashboard');
    }
);

// Middleware to protect routes
function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

// Serve static files (your existing dashboard files)
app.use(express.static('panel'));

// Simple ping endpoint
app.get('/ping', (req, res) => {
    res.send('Le bot est en ligne et fonctionne correctement !');
});

// Protected dashboard route
app.get('/dashboard', checkAuth, (req, res) => {
    const user = req.user;
    res.send(`
        <h1>Bienvenue, ${user.username}#${user.discriminator}</h1>
        <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" alt="avatar" />
        <p>ID: ${user.id}</p>
        <p><a href="/logout">Se déconnecter</a></p>
    `);
});

// Logout route
app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Start Express server
app.listen(process.env.PORT, () => {
    console.log('✅ Serveur connecté!');
});
