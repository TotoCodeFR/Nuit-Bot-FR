import { Client, Collection, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import connectRedis from 'connect-redis';
import { createClient } from 'redis';
import { loadCommands, loadEvents } from './utility/load.js';
import { log } from './utility/log.js';

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

// ====== Upstash Redis session store setup ======

const RedisStore = connectRedis(session);

const redisClient = createClient({
  url: process.env.UPSTASH_REDIS_URL,
  password: process.env.UPSTASH_REDIS_PASSWORD,
  socket: {
    tls: true,
    rejectUnauthorized: false, // helpful in some cloud environments
  },
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

await redisClient.connect();

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
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

app.use(express.static('panel'));

app.get('/ping', (req, res) => {
  res.send('Le bot est en ligne et fonctionne correctement !');
});

app.get('/dashboard', checkAuth, (req, res) => {
  const user = req.user;
  res.send(`
    <h1>Bienvenue, ${user.username}#${user.discriminator}</h1>
    <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" alt="avatar" />
    <p>ID: ${user.id}</p>
    <p><a href="/logout">Se déconnecter</a></p>
  `);
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.listen(process.env.PORT, () => {
  console.log('✅ Serveur connecté!');
});
