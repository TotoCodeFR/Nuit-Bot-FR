import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url'; // ✅ Needed for fixing the error
import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const __dirname = path.resolve();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

export async function loadCommands(client) {
    const commands = [];

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const fileUrl = pathToFileURL(filePath).href; // ✅ Convert path to ESM-compatible URL

            const commandModule = await import(fileUrl);
            const command = commandModule.default || commandModule;

            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            } else {
                console.log(`⚠️ La commande ${filePath} manque la propriété "data" ou "execute".`);
            }
        }
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN); // ✅ Make sure to use `process.env`

    try {
        console.log(`🔄️ En train de préparer ${commands.length} commandes.`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ ${data.length} commandes ont été chargées.`);
    } catch (error) {
        console.error(error);
    }
}

export async function loadEvents(client) {
    console.log('🔄️ En train de charger les événements...');
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const fileUrl = pathToFileURL(filePath).href; // ✅ Convert path to ESM-compatible URL

        const eventModule = await import(fileUrl);
        const event = eventModule.default || eventModule;

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
    console.log('✅ Événements chargés avec succès.');
}