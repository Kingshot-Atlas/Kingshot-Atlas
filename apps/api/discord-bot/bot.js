/**
 * Kingshot Atlas Discord Bot
 * 
 * Commands:
 * /kingdom <number> - Get kingdom stats
 * /compare <k1> <k2> - Compare two kingdoms
 * /leaderboard - Show top 10 kingdoms
 * /upcoming - Show next KvK and Transfer dates
 * 
 * Setup:
 * 1. Create Discord Application at https://discord.com/developers/applications
 * 2. Create Bot and get token
 * 3. Set DISCORD_TOKEN and DISCORD_CLIENT_ID in .env
 * 4. Run: npm install discord.js
 * 5. Run: node bot.js
 */

require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const API_URL = process.env.API_URL || 'http://localhost:3000';

// Command definitions
const commands = [
  new SlashCommandBuilder()
    .setName('kingdom')
    .setDescription('Get stats for a Kingshot kingdom')
    .addIntegerOption(option =>
      option.setName('number')
        .setDescription('Kingdom number (e.g., 1001)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Compare two kingdoms')
    .addIntegerOption(option =>
      option.setName('kingdom1')
        .setDescription('First kingdom number')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('kingdom2')
        .setDescription('Second kingdom number')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show top 10 kingdoms by Atlas Score'),
  new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('Show upcoming KvK and Transfer events'),
].map(cmd => cmd.toJSON());

// Initialize client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Helper: Fetch kingdom data
async function fetchKingdom(number) {
  try {
    const res = await fetch(`${API_URL}/api/v1/kingdoms/${number}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('API Error:', e);
    return null;
  }
}

// Helper: Get tier color
function getTierColor(tier) {
  switch (tier) {
    case 'S': return 0xfbbf24;
    case 'A': return 0x22c55e;
    case 'B': return 0x3b82f6;
    default: return 0x6b7280;
  }
}

// Helper: Get tier from score
function getTier(score) {
  if (score >= 12) return 'S';
  if (score >= 8) return 'A';
  if (score >= 5) return 'B';
  return 'C';
}

// Command: /kingdom
async function handleKingdom(interaction) {
  const number = interaction.options.getInteger('number');
  await interaction.deferReply();

  const kingdom = await fetchKingdom(number);
  
  if (!kingdom) {
    return interaction.editReply(`❌ Kingdom ${number} not found.`);
  }

  const tier = getTier(kingdom.overall_score);
  const embed = new EmbedBuilder()
    .setColor(getTierColor(tier))
    .setTitle(`🏰 Kingdom ${kingdom.kingdom_number}`)
    .setURL(`https://kingshot-atlas.com/kingdom/${kingdom.kingdom_number}`)
    .addFields(
      { name: '📊 Atlas Score', value: `**${kingdom.overall_score.toFixed(1)}** (Tier ${tier})`, inline: true },
      { name: '⚔️ Total KvKs', value: `${kingdom.total_kvks}`, inline: true },
      { name: '🚀 Status', value: kingdom.most_recent_status || 'Unannounced', inline: true },
      { name: '🛡️ Prep Phase', value: `${kingdom.prep_wins}W - ${kingdom.prep_losses}L (${Math.round(kingdom.prep_win_rate * 100)}%)`, inline: true },
      { name: '⚔️ Battle Phase', value: `${kingdom.battle_wins}W - ${kingdom.battle_losses}L (${Math.round(kingdom.battle_win_rate * 100)}%)`, inline: true },
      { name: '👑 Dominations', value: `${kingdom.high_kings || 0}`, inline: true }
    )
    .setFooter({ text: 'Kingshot Atlas • kingshot-atlas.com' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// Command: /compare
async function handleCompare(interaction) {
  const k1 = interaction.options.getInteger('kingdom1');
  const k2 = interaction.options.getInteger('kingdom2');
  await interaction.deferReply();

  const [kingdom1, kingdom2] = await Promise.all([
    fetchKingdom(k1),
    fetchKingdom(k2)
  ]);

  if (!kingdom1 || !kingdom2) {
    return interaction.editReply(`❌ One or both kingdoms not found.`);
  }

  const tier1 = getTier(kingdom1.overall_score);
  const tier2 = getTier(kingdom2.overall_score);

  const embed = new EmbedBuilder()
    .setColor(0x22d3ee)
    .setTitle(`⚔️ Kingdom ${k1} vs Kingdom ${k2}`)
    .setURL(`https://kingshot-atlas.com/compare?k1=${k1}&k2=${k2}`)
    .addFields(
      { name: `K${k1}`, value: '═══════════', inline: true },
      { name: 'Stats', value: '═══════════', inline: true },
      { name: `K${k2}`, value: '═══════════', inline: true },
      { name: `${kingdom1.overall_score.toFixed(1)} (${tier1})`, value: '​', inline: true },
      { name: '📊 Atlas Score', value: '​', inline: true },
      { name: `${kingdom2.overall_score.toFixed(1)} (${tier2})`, value: '​', inline: true },
      { name: `${Math.round(kingdom1.prep_win_rate * 100)}%`, value: '​', inline: true },
      { name: '🛡️ Prep WR', value: '​', inline: true },
      { name: `${Math.round(kingdom2.prep_win_rate * 100)}%`, value: '​', inline: true },
      { name: `${Math.round(kingdom1.battle_win_rate * 100)}%`, value: '​', inline: true },
      { name: '⚔️ Battle WR', value: '​', inline: true },
      { name: `${Math.round(kingdom2.battle_win_rate * 100)}%`, value: '​', inline: true },
      { name: `${kingdom1.total_kvks}`, value: '​', inline: true },
      { name: '📈 Total KvKs', value: '​', inline: true },
      { name: `${kingdom2.total_kvks}`, value: '​', inline: true }
    )
    .setFooter({ text: 'Kingshot Atlas • kingshot-atlas.com' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// Command: /leaderboard
async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  try {
    const res = await fetch(`${API_URL}/api/v1/leaderboard?limit=10`);
    const kingdoms = await res.json();

    const leaderboard = kingdoms.map((k, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **K${k.kingdom_number}** - ${k.overall_score.toFixed(1)} pts`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('🏆 Kingshot Atlas Leaderboard')
      .setDescription(leaderboard)
      .setFooter({ text: 'Based on Atlas Score • kingshot-atlas.com' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (e) {
    return interaction.editReply('❌ Failed to fetch leaderboard.');
  }
}

// Command: /upcoming
async function handleUpcoming(interaction) {
  const now = new Date();
  const nextKvK = new Date('2026-01-31T00:00:00Z');
  const nextTransfer = new Date('2026-03-02T00:00:00Z');

  const daysUntilKvK = Math.ceil((nextKvK - now) / (1000 * 60 * 60 * 24));
  const daysUntilTransfer = Math.ceil((nextTransfer - now) / (1000 * 60 * 60 * 24));

  const embed = new EmbedBuilder()
    .setColor(0x22d3ee)
    .setTitle('📅 Upcoming Kingshot Events')
    .addFields(
      { 
        name: '⚔️ Next KvK', 
        value: `${nextKvK.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n**${daysUntilKvK} days away**`,
        inline: true 
      },
      { 
        name: '🚀 Next Transfer Event', 
        value: `${nextTransfer.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n**${daysUntilTransfer} days away**`,
        inline: true 
      }
    )
    .setFooter({ text: 'Kingshot Atlas • kingshot-atlas.com' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

// Event: Ready
client.once('ready', () => {
  console.log(`✅ Kingshot Atlas Bot logged in as ${client.user.tag}`);
});

// Event: Interaction
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'kingdom':
        await handleKingdom(interaction);
        break;
      case 'compare':
        await handleCompare(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboard(interaction);
        break;
      case 'upcoming':
        await handleUpcoming(interaction);
        break;
    }
  } catch (error) {
    console.error('Command error:', error);
    const reply = { content: '❌ An error occurred.', ephemeral: true };
    if (interaction.deferred) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Register commands & start bot
async function main() {
  if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
    console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
    console.log('\nSetup instructions:');
    console.log('1. Create app at https://discord.com/developers/applications');
    console.log('2. Create bot and copy token');
    console.log('3. Create .env file with:');
    console.log('   DISCORD_TOKEN=your_bot_token');
    console.log('   DISCORD_CLIENT_ID=your_client_id');
    process.exit(1);
  }

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }

  // Login
  await client.login(DISCORD_TOKEN);
}

main();
