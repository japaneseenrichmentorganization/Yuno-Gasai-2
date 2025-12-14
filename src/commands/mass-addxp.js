/*
    Yuno Gasai — Mass XP Gift
    ♥ Showering them with love... whether they want it or not~ ♥
*/

module.exports.run = async function(yuno, author, args, trigger) {
    const isSlash = !!trigger?.replied;
    const send = (c) => isSlash ? trigger.reply({content: c, ephemeral: false}) : trigger.channel.send(c);

    if (args.length < 2) return send("❌ Usage: `mass-addxp <xp amount> <@role/ID>` — I'll make them stronger for you~ ♥");

    const xpToAdd = parseInt(args[0], 10);
    if (isNaN(xpToAdd) || xpToAdd <= 0) return send("❌ XP amount must be positive, silly~ ♥");

    const role = trigger.mentions?.roles?.first() || await trigger.guild.roles.fetch(args[1]).catch(() => null);
    if (!role) return send("❌ Can't find that role... don't tease me ♥");

    const proc = await send(`⡷⢿ Hunting every member with **${role.name}** to gift them **${xpToAdd}** XP...`);

    await trigger.guild.members.fetch();
    const targets = trigger.guild.members.cache.filter(m => m.roles.cache.has(role.id) && !m.user.bot);

    if (targets.size === 0) return proc.edit("❌ No one to love... empty role~ ♥");

    await proc.edit(`⢿⡷ Giving **${targets.size}** members **+${xpToAdd}** XP each... feel my affection~ ♥`);

    let ok = 0, fail = 0;
    const stmt = await yuno.database.prepare(`
        INSERT INTO experiences (userID, guildID, exp, level)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(userID, guildID) DO UPDATE SET exp = exp + ?
    `);
    for (const member of targets.values()) {
        try {
            await stmt.run([member.id, trigger.guild.id, xpToAdd, xpToAdd]);
            ok++;
        } catch (e) { fail++; console.error(e); }
    }
    await stmt.finalize();

    if (yuno._refreshMod) yuno._refreshMod("message-processors");

    await proc.edit(`✅ Gift delivered~\nRole: **${role.name}**\nXP given: **+${xpToAdd}** each\nBlessed: ${ok}\nFailed: ${fail}\nThey'll never forget this feeling ♥`);
};

module.exports.about = {
    command: "mass-addxp",
    description: "Adds a flat amount of XP to every member with a role (keeps existing XP). My love is cumulative~ ♥",
    aliases: ["massxp", "bulkxp", "giftxp"],
    onlyMasterUsers: true,
    discord: true,
    list: true
};
