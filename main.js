import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import 'dotenv/config';
import express from 'express';
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

app.use(express.static('panel'));

app.get('/ping', (req, res) => {
    res.send('Le bot est en ligne et fonctionne correctement !');
});

app.listen(process.env.PORT, () => {
    console.log('✅ Serveur connecté!');
});
