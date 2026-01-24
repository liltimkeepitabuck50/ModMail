require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    PermissionsBitField
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

const prefix = process.env.PREFIX;

// GLOBAL EMBED THEME
const THEME = {
    colorPrimary: 0xfb8c00,
    colorSuccess: 0xfb8c00,
    colorError: 0xfb8c00,
    footerText: "Support System",
    footerIcon: null
};

// TICKET TYPES (in your exact order)
const TICKET_TYPES = {
    pr: {
        label: "Public Relation",
        description: "Use these to contact our Public Relations team! Event or Alliance!",
        channelPrefix: "pr"
    },
    staffing: {
        label: "Staffing Support",
        description: "Open these Support Tickets for Appeals, Ranking, And appeals!.",
        channelPrefix: "staffing"
    },
    general: {
        label: "General Support",
        description: "Open this Support Ticket for inquiries NOT under these categorys!",
        channelPrefix: "general"
    }
};

// ACTIVE TICKETS
// userId -> { channelId, type, claimedBy }
const activeTickets = new Map();

// MODMAIL FREEZE STATE
let modmailFrozen = false;

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

/* -----------------------------------------
   USER DMS BOT → START TICKET FLOW
------------------------------------------*/
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // React ONLY to user messages inside ticket channels (not commands)
    const ticketEntryForReaction = [...activeTickets.entries()]
        .find(([_, data]) => data.channelId === message.channel.id);

    if (ticketEntryForReaction && !message.content.startsWith(prefix)) {
        message.react("📨").catch(() => {});
    }

    // DM
    if (message.channel.type === 1) {

        // If ModMail is frozen, block requests
        if (modmailFrozen) {
            const frozenEmbed = new EmbedBuilder()
                .setTitle("⛔ ModMail Paused")
                .setDescription("ModMail is currently not accepting new requests. Please try again later.")
                .setColor(THEME.colorError)
                .setFooter({ text: THEME.footerText });

            return message.reply({ embeds: [frozenEmbed] });
        }

        if (activeTickets.has(message.author.id)) return;

        const embed = new EmbedBuilder()
            .setTitle("📬 OPEN A THREAD")
            .setDescription("Thank you for using our support system! But before this thread is created, do you want to open a support ticket?")
            .setColor(THEME.colorPrimary)
            .setFooter({ text: THEME.footerText });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_ticket")
                .setLabel("✔️")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("cancel_ticket")
                .setLabel("✖️")
                .setStyle(ButtonStyle.Danger)
        );

        return message.reply({ embeds: [embed], components: [row] });
    }

    // STAFF COMMANDS
    if (!message.guild || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const ticketEntry = [...activeTickets.entries()]
        .find(([_, data]) => data.channelId === message.channel.id);

    /* -----------------------------------------
       MMfreeze — stop taking ModMail requests
    ------------------------------------------*/
    if (command === "mmfreeze") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("Only administrators can use this command.")
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        modmailFrozen = true;

        const embed = new EmbedBuilder()
            .setTitle("❄️ ModMail Frozen")
            .setDescription("The bot will no longer take new ModMail requests. To turn them back on, use the unfreeze command!")
            .setColor(THEME.colorError)
            .setFooter({ text: THEME.footerText });

        return message.reply({ embeds: [embed] });
    }

    /* -----------------------------------------
       MMunfreeze — allow ModMail again
    ------------------------------------------*/
    if (command === "mmunfreeze") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("Only administrators can use this command.")
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        modmailFrozen = false;

        const embed = new EmbedBuilder()
            .setTitle("🔥 ModMail Unfrozen")
            .setDescription("The bot is now accepting ModMail requests again. To freeze them again, use the mmfreeze command!")
            .setColor(THEME.colorSuccess)
            .setFooter({ text: THEME.footerText });

        return message.reply({ embeds: [embed] });
    }

    /* -----------------------------------------
       !reply
    ------------------------------------------*/
    if (command === "reply") {
        const replyMessage = args.join(" ");
        if (!replyMessage) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("You must provide a message to send.")
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        if (!ticketEntry) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("This channel is not linked to a ticket.")
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        const [userId] = ticketEntry;
        const user = await client.users.fetch(userId);

        const userEmbed = new EmbedBuilder()
            .setTitle("📩 KINGS STAFF TEAM")
            .setDescription(replyMessage)
            .setColor(THEME.colorPrimary)
            .setFooter({ text: THEME.footerText });

        await user.send({ embeds: [userEmbed] });

        // React to confirm reply sent
        await message.react("📨");
        return;
    }

    /* -----------------------------------------
       !close
    ------------------------------------------*/
    if (command === "close") {
        if (!ticketEntry) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("This channel is not linked to a ticket.")
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        const [userId] = ticketEntry;
        const user = await client.users.fetch(userId);

        const userEmbed = new EmbedBuilder()
            .setTitle("📪 CLOSED")
            .setDescription("Your ticket has been closed. If you need more help, you can open another one by DMing the bot again.")
            .setColor(THEME.colorError)
            .setFooter({ text: THEME.footerText });

        const staffEmbed = new EmbedBuilder()
            .setColor(THEME.colorError)
            .setDescription("This ticket will be closing in **5 seconds**…")
            .setFooter({ text: THEME.footerText });

        await user.send({ embeds: [userEmbed] });
        await message.channel.send({ embeds: [staffEmbed] });

        activeTickets.delete(userId);

        setTimeout(() => message.channel.delete().catch(() => {}), 5000);
        return;
    }

    /* -----------------------------------------
       !transfer <full display name>
       e.g.:
       !transfer Public Relation 
       !transfer Staffing Support 
       !transfer General Support 
    ------------------------------------------*/
    if (command === "transfer") {
        if (!ticketEntry) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("This channel is not linked to a ticket.")
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        const inputName = args.join(" ").trim();
        if (!inputName) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription(
                    "You must provide a ticket type.\n" +
                    "Valid types:\n" +
                    "- Public Relation \n" +
                    "- Staffing Support \n" +
                    "- General Support "
                )
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        const matchEntry = Object.entries(TICKET_TYPES).find(
            ([, data]) => data.label.toLowerCase() === inputName.toLowerCase()
        );

        if (!matchEntry) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription(
                    "Invalid ticket type.\n" +
                    "Valid types:\n" +
                    "- Public Relation 🫂\n" +
                    "- Staffing Support 📄\n" +
                    "- General Support 🧑‍💼"
                )
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        const [newKey, newTypeData] = matchEntry;
        const [userId, data] = ticketEntry;
        const user = await client.users.fetch(userId);

        data.type = newKey;
        activeTickets.set(userId, data);

        const newName = `${newTypeData.channelPrefix}-${user.username}`;
        await message.channel.setName(newName).catch(() => {});
        await message.channel.setTopic(`Ticket for ${user.tag} (${newTypeData.label})`).catch(() => {});

        const embed = new EmbedBuilder()
            .setColor(THEME.colorPrimary)
            .setTitle("🔄 Ticket Transferred")
            .addFields(
                { name: "User", value: `${user.tag} (${user.id})` },
                { name: "New Type", value: newTypeData.label }
            )
            .setFooter({ text: THEME.footerText });

        return message.channel.send({ embeds: [embed] });
    }

    /* -----------------------------------------
       !connect
    ------------------------------------------*/
    if (command === "connect") {
        if (!ticketEntry) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("This channel is not linked to a ticket.")
                .setFooter({ text: THEME.footerText });
            return message.reply({ embeds: [embed] });
        }

        const [userId] = ticketEntry;
        const user = await client.users.fetch(userId);

        const userEmbed = new EmbedBuilder()
            .setTitle("🤝 CONNECTED")
            .setDescription("A staff member has connected to your ticket and will assist you shortly. If you haven't already, please state the reason of your ticket opening!")
            .setColor(THEME.colorPrimary)
            .setFooter({ text: THEME.footerText });

        const staffEmbed = new EmbedBuilder()
            .setTitle("🔗 USER CONNECTED")
            .setDescription(`You are now connected with support with **${user.tag}**.`)
            .setColor(THEME.colorSuccess)
            .setFooter({ text: THEME.footerText });

        await user.send({ embeds: [userEmbed] });
        return message.channel.send({ embeds: [staffEmbed] });
    }
});

/* -----------------------------------------
   BUTTONS & MENUS
------------------------------------------*/
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const user = interaction.user;

    /* CONFIRM TICKET */
    if (interaction.customId === "confirm_ticket") {
        const embed = new EmbedBuilder()
            .setTitle("🎫 SELECT THREAD TYPE")
            .setDescription("Choose the type of ticket you want to open.")
            .setColor(THEME.colorPrimary)
            .setFooter({ text: THEME.footerText });

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("ticket_type")
                .setPlaceholder("Choose your ticket type")
                .addOptions(
                    Object.entries(TICKET_TYPES).map(([value, data]) => ({
                        label: data.label,
                        value,
                        description: data.description
                    }))
                )
        );

        return interaction.update({ embeds: [embed], components: [menu] });
    }

    /* CANCEL */
    if (interaction.customId === "cancel_ticket") {
        const embed = new EmbedBuilder()
            .setTitle("❌ TICKET CANCELED")
            .setDescription("You canceled the ticket creation process and your thread has not been sent out to staff.")
            .setColor(THEME.colorError)
            .setFooter({ text: THEME.footerText });

        return interaction.update({ embeds: [embed], components: [] });
    }

    /* TICKET TYPE SELECTED */
    if (interaction.customId === "ticket_type") {
        const typeKey = interaction.values[0];
        const typeData = TICKET_TYPES[typeKey];

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const category = guild.channels.cache.get(process.env.CATEGORY_ID);

        const channelName = `${typeData.channelPrefix}-${user.username}`;

        const channel = await guild.channels.create({
            name: channelName,
            type: 0,
            parent: category?.id || null,
            topic: `Ticket for ${user.tag} (${typeData.label})`
        });

        activeTickets.set(user.id, {
            channelId: channel.id,
            type: typeKey,
            claimedBy: null
        });

        const infoEmbed = new EmbedBuilder()
            .setTitle("📬 NEW THREAD")
            .setColor(THEME.colorPrimary)
            .addFields(
                { name: "User", value: `${user.tag} (${user.id})` },
                { name: "Ticket Type", value: typeData.label },
                { name: "Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>` },
                { name: "Claimed By", value: "Not claimed" }
            )
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: THEME.footerText });

        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_claim")
                .setLabel("Claim")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("ticket_unclaim")
                .setLabel("Unclaim")
                .setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ embeds: [infoEmbed], components: [controlRow] });

        const userEmbed = new EmbedBuilder()
            .setTitle("🎫 THREAD CREATED")
            .setDescription(`Your **${typeData.label}** ticket has been opened. Please be patient as staff will contact you soon. If you have not already, please state the reason you have opened this ticket.`)
            .setColor(THEME.colorSuccess)
            .setFooter({ text: THEME.footerText });

        return interaction.update({ embeds: [userEmbed], components: [] });
    }

    /* CLAIM / UNCLAIM */
    const ticketEntry = [...activeTickets.entries()]
        .find(([_, data]) => data.channelId === interaction.channel.id);

    if (!ticketEntry) return;

    const [userId, data] = ticketEntry;

    if (interaction.customId === "ticket_claim") {
        if (data.claimedBy && data.claimedBy !== interaction.user.id) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("This ticket is already claimed by another staff member. If the member unclaims it, you will be allowed to claim it.")
                .setFooter({ text: THEME.footerText });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        data.claimedBy = interaction.user.id;
        activeTickets.set(userId, data);

        const embed = new EmbedBuilder()
            .setColor(THEME.colorSuccess)
            .setTitle("✅ THREAD CLAIMED")
            .setDescription(`This ticket has been claimed by **${interaction.user.tag}**.`)
            .setFooter({ text: THEME.footerText });

        return interaction.reply({ embeds: [embed] });
    }

    if (interaction.customId === "ticket_unclaim") {
        if (!data.claimedBy) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("This ticket is not currently claimed.")
                .setFooter({ text: THEME.footerText });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (data.claimedBy !== interaction.user.id) {
            const embed = new EmbedBuilder()
                .setColor(THEME.colorError)
                .setDescription("Only the staff member who claimed this ticket can unclaim it.")
                .setFooter({ text: THEME.footerText });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        data.claimedBy = null;
        activeTickets.set(userId, data);

        const embed = new EmbedBuilder()
            .setColor(THEME.colorPrimary)
            .setTitle("♻ THREAD UNCLAIMED")
            .setDescription(`This ticket has been unclaimed by **${interaction.user.tag}**.`)
            .setFooter({ text: THEME.footerText });

        return interaction.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);
