// events/ready.js
const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`✅ Prêt ! Connecté en tant que ${client.user.tag}`);
    },
};