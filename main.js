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
    testGuild,
    '1385989726082957412'
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

  // Le salon où envoyer l'embed
  const guild = client.guilds.cache.get('1385946310347329647');
  const channel = guild.channels.cache.get('1387062987323343019');

  // Est-ce que l'embed existe déjà ?
  channel.messages.fetch({ limit: 10 }).then(messages => {
    const found = messages.some(msg => {
      return msg.embeds.length > 0 &&
        msg.embeds[0].title === 'Rôles du serveur';
    });

    if (!found) {
      // On envoie l'embed si il n'existe pas
      channel.send({
        embeds: [rolesEmbed],
        components: [row1]
      });
    }
  });
});

const app = express();

// Permet d'utiliser JSON dans les requêtes
app.use(express.json());

// ====== Setup sessions Discord depuis la mémoire (A CHANGER) ======
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: false,
  })
);

// ====== Passport + Applis autorisées Discord ======

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
  done(null, profile);
}));

// ====== Chemins web ======

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
  const userGuilds = req.user.guilds; // (Donné par passport Discord)
  const botGuild = client.guilds.cache.get(guildId);

  if (!botGuild) return res.status(404).send('Le bot ne se trouve pas dans ce serveur.');

  const matchingGuild = userGuilds.find(g => g.id === guildId);
  if (!matchingGuild) return res.status(403).send('L\'utilisateur n\'est pas dans ce serveur.');

  const perms = BigInt(matchingGuild.permissions);
  const hasManage = (perms & BigInt(PermissionFlagsBits.ManageGuild)) === BigInt(PermissionFlagsBits.ManageGuild);

  if (!hasManage) return res.status(403).send('L\'utilisateur manque la permission Gérer le serveur.');

  // Donne le bot et l'utilisateur dans la requête pour les utiliser plus tard
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

  const allowedPages = ['general', 'moderation'];
  if (!allowedPages.includes(page)) {
    return res.status(404).send('Page introuvable.');
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
    // Etape 1 : Récupérer les serveurs de l'utilisateur via l'API Discord
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${req.user.accessToken}`,
      },
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Impossible de récupérer les serveurs de l\'utilisateur' });
    }

    const userGuilds = await response.json();

    // Etape 2 : Récupérer les serveurs du bot
    const botGuilds = client.guilds.cache;

    // Etape 3 : Filtrer les serveurs pour ne garder que ceux où :
    // - le bot est dans le serveur 
    // - l'utilisateur a la permission de gérer le serveur (ManageGuild)
    const mutualGuilds = userGuilds.filter(guild => {
      const botGuild = botGuilds.get(guild.id);
      if (!botGuild) return false;

      const perms = BigInt(guild.permissions); // convert to BigInt
      return (perms & BigInt(PermissionFlagsBits.ManageGuild)) === BigInt(PermissionFlagsBits.ManageGuild);
    });

    res.json(mutualGuilds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Une erreur est survenue.' });
  }
});

app.get('/api/get-channels', checkAuth, async (req, res) => {
  const guildId = req.query.serverId;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Serveur introuvable.' });
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
    return res.status(404).json({ error: 'Serveur introuvable.' });
  }

  const { logChannel } = req.body;
  if (!logChannel) {
    return res.status(400).json({ error: 'Le salon de logs est requis.' });
  }

  const logChannelObj = guild.channels.cache.get(logChannel);
  if (!logChannelObj) {
    return res.status(400).json({ error: 'Salon de log introuvable dans ce serveur.' });
  }
  writeToConfig(guildId, { logChannel: logChannelObj.id });
  res.json({ success: true, logChannel: logChannelObj.id });
});

// Chemin pour obtenir le salon de logs du serveur
app.get('/api/get-log-channel', checkAuth, async (req, res) => {
  const guildId = req.query.serverId;
  if (!guildId) {
    return res.status(400).json({ error: 'Identifiant du serveur introuvable.' });
  }
  try {
    const config = loadConfig(guildId);
    if (!config || !config.logChannel) {
      return res.json({ logChannel: null });
    }
    return res.json({ logChannel: config.logChannel });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Impossible de charger le serveur de logs.' });
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

// Démarrer le serveur Express
app.listen(process.env.PORT, () => {
  console.log('✅ Serveur connecté!');
});
