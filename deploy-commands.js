// deploy-commands.js
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const config = require('./config.js');
const readline = require('node:readline');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Translated
rl.question('Deploy commands globally or to a specific guild? (global/guild): ', (mode) => {
    if (mode.toLowerCase().trim() === 'guild') {
        // Translated
        rl.question('Please enter the Server ID (Guild ID): ', (guildId) => {
            if (!guildId) {
                // Translated
                console.log('❌ Guild ID cannot be empty.');
                rl.close();
                return;
            }
            // Translated
            console.log(`Deploying commands to guild ${guildId}...`);
            rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, guildId), { body: commands })
                .then(() => console.log('✅ Successfully deployed guild commands.')) // Translated
                .catch(console.error)
                .finally(() => rl.close());
        });
    } else if (mode.toLowerCase().trim() === 'global') {
        // Translated
        console.log('Deploying commands globally...');
        rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands })
            .then(() => console.log('✅ Successfully deployed global commands.')) // Translated
            .catch(console.error)
            .finally(() => rl.close());
    } else {
        // Translated
        console.log('❌ Invalid choice. Please specify "global" or "guild".');
        rl.close();
    }
});