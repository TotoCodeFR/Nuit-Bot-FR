import { Client, Collection, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { loadCommands, loadEvents } from './utility/load.js';
import { log } from './utility/log.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN);

client.once('ready', () => {
  const testGuild = client.guilds.cache.get('1385946310347329647');

  log(
    {
      title: 'Bot démarré',
      description: 'Le bot a été démarré avec succès.',
      color: '#64ff64',
    },
    testGuild
  );
});

const app = express();

// ====== In-memory session setup ======
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: false,
  })
);

// ====== Passport and Discord OAuth2 setup ======

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.REDIRECT_URI,
      scope: ['identify', 'guilds'],
    },
    (accessToken, refreshToken, profile, done) => {
      // You could save profile info to a DB here
      return done(null, profile);
    }
  )
);

// ====== Routes ======

app.get('/auth/discord', passport.authenticate('discord'));

app.get(
  '/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

app.use(express.static(path.join(__dirname, 'panel')));

app.get('/ping', (req, res) => {
  res.send('Le bot est en ligne et fonctionne correctement !');
});

app.get('/api/user', checkAuth, (req, res) => {
  res.json({
    username: req.user.username,
    discriminator: req.user.discriminator,
    id: req.user.id,
    avatar: req.user.avatar
  });
});

app.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'panel', 'index.html'));
});

// Start Express server
app.listen(process.env.PORT, () => {
  console.log('✅ Serveur connecté!');
});
