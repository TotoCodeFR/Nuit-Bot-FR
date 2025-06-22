import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import 'dotenv/config';
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