import { Client, Collection, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { loadCommands, loadEvents } from './utility/load.js';
import { log } from './utility/log.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeToConfig, loadConfig } from './utility/server_config.js';

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

  const rolesEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Rôles du serveur')
    .setDescription('Cliquez sur les boutons ci-dessous pour obtenir les rôles correspondants.')
    .setTimestamp();

  const notifsMajBtn = new ButtonBuilder()
    .setCustomId('notifs_maj')
    .setLabel('Notifications Mises à Jour')
    .setStyle(ButtonStyle.Primary);

  const row1 = new ActionRowBuilder().addComponents(notifsMajBtn);

  // Get your target channel
  const guild = client.guilds.cache.get('1385946310347329647');
  const channel = guild.channels.cache.get('1387062987323343019');

  // Check the last 10 messages to see if your embed is already there
  channel.messages.fetch({ limit: 10 }).then(messages => {
    const found = messages.some(msg => {
      return msg.embeds.length > 0 &&
        msg.embeds[0].title === 'Rôles du serveur';
    });

    if (!found) {
      // Send embed if not already there
      channel.send({
        embeds: [rolesEmbed],
        components: [row1]
      });
    } else {
      console.log('Embed already exists in channel. Not sending again.');
    }
  });
});

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

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

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.REDIRECT_URI,
  scope: ['identify', 'guilds'],
}, (accessToken, refreshToken, profile, done) => {
  profile.accessToken = accessToken;
  // You can optionally fetch and attach guilds if needed
  done(null, profile);
}));

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

function checkDashboardAccess(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/auth/discord');

  const guildId = req.params.serverId;
  const userGuilds = req.user.guilds; // Provided by passport-discord
  const botGuild = client.guilds.cache.get(guildId);

  if (!botGuild) return res.status(404).send('Bot not in this server.');

  const matchingGuild = userGuilds.find(g => g.id === guildId);
  if (!matchingGuild) return res.status(403).send('User not in this server.');

  const perms = BigInt(matchingGuild.permissions);
  const hasManage = (perms & BigInt(PermissionFlagsBits.ManageGuild)) === BigInt(PermissionFlagsBits.ManageGuild);

  if (!hasManage) return res.status(403).send('Missing Manage Server permission.');

  // Pass bot + user guilds to route
  req.botGuild = botGuild;
  req.userGuild = matchingGuild;
  next();
}

app.get('/dashboard/:serverId', checkDashboardAccess, (req, res) => {
  res.sendFile('dashboard/config/index.html', { root: './panel' });
});

app.use('/assets', express.static('panel'));

app.get('/dashboard/:serverId/:page', checkDashboardAccess, (req, res) => {
  const { page } = req.params;

  // Whitelist allowed pages
  const allowedPages = ['general'];
  if (!allowedPages.includes(page)) {
    return res.status(404).send('Page not found.');
  }

  res.sendFile(path.join(__dirname, 'panel/dashboard/config/', `${page}`, 'index.html'));
});

app.get('/api/status', (req, res) => {
  const status = client.ws.status === 0 ? '🟢 En ligne' : '🔴 Hors ligne';
  res.send({status});
});
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

app.get('/api/mutual-guilds', checkAuth, async (req, res) => {
  try {
    // Step 1: Get user guilds using Discord API
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${req.user.accessToken}`,
      },
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch user guilds' });
    }

    const userGuilds = await response.json();

    // Step 2: Get bot guilds from Discord.js client
    const botGuilds = client.guilds.cache;

    // Step 3: Match guilds where:
    // - bot is in the server
    // - user has MANAGE_GUILD permission
    const mutualGuilds = userGuilds.filter(guild => {
      const botGuild = botGuilds.get(guild.id);
      if (!botGuild) return false;

      const perms = BigInt(guild.permissions); // convert to BigInt
      return (perms & BigInt(PermissionFlagsBits.ManageGuild)) === BigInt(PermissionFlagsBits.ManageGuild);
    });

    res.json(mutualGuilds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.get('/api/get-channels', checkAuth, async (req, res) => {
  const guildId = req.query.serverId;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }
  const channels = guild.channels.cache
    .filter(channel => channel.isTextBased())
    .map(channel => ({ id: channel.id, name: channel.name }));
    res.json({ channels });
});

app.post('/api/save-log-channel', checkAuth, async (req, res) => {
  const guildId = req.query.serverId;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }

  const { logChannel } = req.body;
  if (!logChannel) {
    return res.status(400).json({ error: 'Log channel is required' });
  }

  // Here you would save the log channel to your config
  // For example, using a utility function to write to a config file
  const logChannelObj = guild.channels.cache.get(logChannel);
  if (!logChannelObj) {
    return res.status(400).json({ error: 'Log channel not found in this guild.' });
  }
  writeToConfig(guildId, { logChannel: logChannelObj.id });
  res.json({ success: true, logChannel: logChannelObj.id });
});

// Endpoint to get the current log channel for a guild
app.get('/api/get-log-channel', checkAuth, async (req, res) => {
  const guildId = req.query.serverId;
  if (!guildId) {
    return res.status(400).json({ error: 'Missing serverId' });
  }
  try {
    const config = loadConfig(guildId);
    if (!config || !config.logChannel) {
      return res.json({ logChannel: null });
    }
    return res.json({ logChannel: config.logChannel });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not load log channel' });
  }
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
