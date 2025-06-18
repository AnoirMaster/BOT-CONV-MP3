// index.js
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const config = require('./config.js'); // MODIFIÉ : Importation de notre configuration

// Créer une nouvelle instance de client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// --- Chargement des commandes ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.log(`[AVERTISSEMENT] La commande à ${filePath} manque une propriété "data" ou "execute" requise.`);
    }
}

// --- Enregistrement des commandes Slash ---
const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN); 

(async () => {
    try {
        console.log(`Début du rafraîchissement de ${commands.length} commandes d'application (/).`);

        // MODIFIÉ : Utilisation de config.CLIENT_ID
        const data = await rest.put(
            Routes.applicationCommands(config.CLIENT_ID),
            { body: commands },
        );

        console.log(`Rechargement réussi de ${data.length} commandes d'application (/).`);
    } catch (error) {
        console.error(error);
    }
})();


// --- Chargement des événements ---
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Se connecter à Discord avec le token du client
client.login(config.DISCORD_TOKEN);