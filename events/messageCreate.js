// events/messageCreate.js

const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { Server } = require('../db/database');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('../config.js');

// --- SPOTIFY API SETUP ---
const SpotifyWebApi = require('spotify-web-api-node');
const spotifyApi = new SpotifyWebApi({ clientId: config.SPOTIFY_CLIENT_ID, clientSecret: config.SPOTIFY_CLIENT_SECRET });
async function refreshSpotifyToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        console.log('[INFO] Spotify access token has been successfully retrieved/refreshed.');
        spotifyApi.setAccessToken(data.body['access_token']);
    } catch (err) {
        console.error('CRITICAL: Could not retrieve Spotify access token. Please check credentials.', err);
    }
}
refreshSpotifyToken();
setInterval(refreshSpotifyToken, 3500 * 1000);
// --- END OF SPOTIFY API SETUP ---


const executableName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(process.cwd(), 'node_modules', 'yt-dlp-wrap', 'bin', executableName);
const ytDlpWrap = new YTDlpWrap(ytDlpPath);

function generateProgressBar(percentage, size = 15) {
    const progress = Math.round((percentage / 100) * size);
    const empty = size - progress;
    return `[${'█'.repeat(progress)}${'░'.repeat(empty)}] ${percentage.toFixed(1)}%`;
}

function withTimeout(promise, ms) {
    const timeoutPromise = new Promise((_, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error(`Operation timed out after ${ms / 1000} seconds.`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]);
}

const EMOJI_PROCESSING = '⚙️', EMOJI_DOWNLOAD = '📥', EMOJI_LINK = '🔗', EMOJI_INFO = 'ℹ️', EMOJI_SPOTIFY = '<:spotify:123456>', EMOJI_YOUTUBE = '<:youtube:123456>';

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;
        const serverConfig = await Server.findOne({ where: { guildId: message.guild.id } });
        if (!serverConfig || serverConfig.channelId !== message.channel.id) return;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = message.content.match(urlRegex);
        if (!urls) return;

        let sourceUrl = urls[0];
        let processingMessage;
        let outputPath;
        const statusEmbed = new EmbedBuilder().setColor('#3B82F6').setTitle('Music Conversion Status');
        
        try {
            console.log(`\n[STEP 1/5] Received request for URL: ${sourceUrl}`);
            await message.channel.sendTyping();
            
            let metadataSourceUrl = sourceUrl;
            // This regex will find and reject common unwanted video types
            const rejectTitleRegex = 'reaction|cover|remix|live|tutorial|instrumental|karaoke|parody';

            if (sourceUrl.includes('spotify.com')) {
                console.log('[INFO] Spotify link detected. Using Official Spotify API.');
                statusEmbed.setDescription(`**[1/4]** ${EMOJI_SPOTIFY} Spotify link found, searching...`);
                processingMessage = await message.reply({ embeds: [statusEmbed] });
                const trackId = sourceUrl.split('track/')[1].split('?')[0];
                const trackInfo = await spotifyApi.getTrack(trackId);
                const songTitle = trackInfo.body.name;
                
                // --- IMPROVEMENT #1: Get ALL artists to make the search more precise ---
                const songArtists = trackInfo.body.artists.map(artist => artist.name).join(' ');

                const searchQuery = `ytsearch1:"${songTitle} ${songArtists}"`;
                console.log(`[INFO] Created Youtube query: "${searchQuery}"`);
                metadataSourceUrl = searchQuery;
            } else if (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be')) {
                console.log('[INFO] YouTube link detected.');
                statusEmbed.setDescription(`**[1/4]** ${EMOJI_YOUTUBE} YouTube link detected, processing...`);
                processingMessage = await message.reply({ embeds: [statusEmbed] });
            } else {
                statusEmbed.setDescription(`**[1/4]** ${EMOJI_LINK} Processing link...`);
                processingMessage = await message.reply({ embeds: [statusEmbed] });
            }
            
            console.log('[STEP 2/5] Fetching final metadata from source...');
            
            const metadataJson = await withTimeout(
                ytDlpWrap.execPromise([
                    metadataSourceUrl,
                    '--dump-json',
                    '--no-playlist',
                    '-f', 'best',
                    // --- IMPROVEMENT #2: Reject unwanted titles to get the official song ---
                    '--reject-title', rejectTitleRegex
                ]),
                20000
            );
            const metadata = JSON.parse(metadataJson);
            
            statusEmbed.setDescription(`**[2/4]** ${EMOJI_INFO} Information found, starting download...`);
            await processingMessage.edit({ embeds: [statusEmbed] });
            console.log(`[INFO] Found video: "${metadata.title}"`);
            
            const title = metadata.title || 'Unknown Title';
            const finalUrl = metadata.webpage_url || sourceUrl;
            const thumbnail = metadata.thumbnail || null;
            
            const tempDir = os.tmpdir();
            const safeTitle = title.replace(/[^a-z0-9\s-]/gi, '_').substring(0, 50).trim();
            outputPath = path.join(tempDir, `${safeTitle}_${Date.now()}.mp3`);
            
            console.log('[STEP 3/5] Starting download and conversion...');
            await new Promise((resolve, reject) => {
                // We use the direct URL of the video we found to be precise
                const ytDlpProcess = ytDlpWrap.exec([
                    metadata.webpage_url, 
                    '-x', '--audio-format', 'mp3', '--audio-quality', '5',
                    '--postprocessor-args', 'ffmpeg:-preset ultrafast',
                    '--no-playlist',
                    '-o', outputPath,
                ]);
                
                let lastUpdateTime = 0;
                const updateInterval = 1500;
                ytDlpProcess.on('progress', (progress) => {
                    const now = Date.now();
                    if (now - lastUpdateTime > updateInterval) {
                        const progressBar = generateProgressBar(progress.percent);
                        const eta = progress.eta ? `(ETA: ${progress.eta})` : '';
                        statusEmbed.setDescription(`**[3/4]** ${EMOJI_DOWNLOAD} Downloading...\n\n${progressBar} ${eta}`);
                        processingMessage.edit({ embeds: [statusEmbed] }).catch(() => {});
                        lastUpdateTime = now;
                    }
                });
                ytDlpProcess.on('close', () => {
                    process.stdout.write("\n");
                    console.log('[SUCCESS] Download and conversion complete.');
                    statusEmbed.setDescription(`**[4/4]** ${EMOJI_PROCESSING} Download complete, preparing file...`);
                    processingMessage.edit({ embeds: [statusEmbed] }).catch(() => {});
                    resolve();
                });
                ytDlpProcess.on('error', reject);
            });
            
            console.log('[STEP 4/5] Preparing and sending file to Discord...');
            const stats = fs.statSync(outputPath);
            const fileSizeInMB = stats.size / (1024 * 1024);
            if (fileSizeInMB > 25) {
                statusEmbed.setColor('#EF4444').setDescription(`❌ File is too large (${fileSizeInMB.toFixed(2)} MB).`);
                await processingMessage.edit({ embeds: [statusEmbed] });
                fs.unlinkSync(outputPath);
                return;
            }

            const finalEmbed = new EmbedBuilder()
                .setTitle(title.substring(0, 256))
                .setURL(finalUrl).setColor('#22C55E')
                .setDescription(`Your MP3 file is ready!`)
                .setThumbnail(thumbnail)
                .setFooter({ text: `Sent by ${message.author.username}`, iconURL: message.author.displayAvatarURL() }).setTimestamp();

            const attachment = new AttachmentBuilder(outputPath, { name: `${safeTitle}.mp3` });

            await processingMessage.delete();
            await message.channel.send({ embeds: [finalEmbed] });
            await message.channel.send({ files: [attachment] });
            
            console.log('[STEP 5/5] Task finished. Cleaning up files...');
            fs.unlinkSync(outputPath);
            try { 
                await message.delete();
                console.log('[INFO] Cleaned up original user message.');
            } catch (e) { console.error("Could not delete user message:", e); }

        } catch (error) {
            console.error('\n[ERROR] An error occurred during the process:', error);
            const errorMessage = error.body?.error?.message || error.message;
            statusEmbed.setColor('#EF4444').setDescription(`❌ An error occurred: ${errorMessage.substring(0,1500)}\n\n*(The video may be private, region-locked, or part of a faulty playlist)*`);
            if (processingMessage) {
                await processingMessage.edit({ embeds: [statusEmbed] }).catch(() => {
                    console.log("[INFO] Could not edit the original status message. Sending new one.");
                    message.channel.send({ embeds: [statusEmbed] });
                });
            } else {
                await message.reply({ embeds: [statusEmbed] });
            }
            if (outputPath && fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        }
    },
};