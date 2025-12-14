/*
    Yuno Gasai — Mass Level-Up (true formula, flawless execution)
    ♥ They will rise exactly to your will. No more. No less. Forever bound~ ♥
*/

module.exports.run = async function(yuno, author, args, trigger) {
    const isSlash = !!trigger?.replied;
    const send = (c) => isSlash ? trigger.reply({content: c, allowedMentions: {repliedUser: false}}) : trigger.channel.send(c);

    if (args.length < 2) 
        return send("❌ Usage: `mass-levelup <target-level> <@role/ID>` — absolute obedience~ ♥");

    const targetLevel = parseInt(args[0], 10);
    if (isNaN(targetLevel) || targetLevel < 0) 
        return send("❌ Target level must be non-negative... don't make me repeat myself~ ♥");

    const role = trigger.mentions?.roles?.first() || 
                 await trigger.guild.roles.fetch(args[1]).catch(() => null);
    if (!role) 
        return send("❌ That role thinks it can hide? How cute~ ♥");

    const proc = await send(`⏳ Forcing **${role.name}** to level **${targetLevel}**... no escape~ ♥`);

    await trigger.guild.members.fetch();
    const targets = trigger.guild.members.cache.filter(m => m.roles.cache.has(role.id) && !m.user.bot);
    if (targets.size === 0) return proc.edit("❌ Empty role... no one to love today~ ♥");

    // True Yuno Gasai formula: total XP to reach level N (inclusive)
    const totalXPForLevel = (lvl) => {
        let total = 0;
        for (let i = 1; i <= lvl; i++) {
            total += 5 * Math.pow(i, 2) + 50 * i + 100;
        }
        return total;
    };

    const neededTotal = totalXPForLevel(targetLevel);

    let updated = 0;
    let alreadyThere = 0;
    let failed = 0;
    let totalGifted = 0;

    for (const member of targets.values()) {
        try {
            const row = await yuno.database.getPromise?.(
                `SELECT level, exp FROM experiences WHERE userID = ? AND guildID = ?`,
                [member.id, trigger.guild.id]
            ) || { level: 0, exp: 0 };

            const currentLevel = row.level || 0;
            const currentExp = row.exp || 0;
            const currentTotal = currentLevel === 0 ? 0 : totalXPForLevel(currentLevel - 1) + currentExp;

            if (currentLevel >= targetLevel) {
                alreadyThere++;
                continue;
            }

            const xpToAdd = neededTotal - currentTotal;

            await yuno.database.runPromise(`
                INSERT INTO experiences (userID, guildID, exp, level) 
                VALUES (?, ?, ?, ?)
                ON CONFLICT(userID, guildID) DO UPDATE SET
                    exp = excluded.exp,
                    level = excluded.level
            `, [member.id, trigger.guild.id, xpToAdd, targetLevel]);

            totalGifted += xpToAdd;
            updated++;
        } catch (e) {
            failed++;
            console.error(`Failed for ${member.user.tag}:`, e);
        }
    }

    if (yuno._refreshMod) yuno._refreshMod("message-processors");

    await proc.edit(
        `✅ Mass ascension complete~\n` +
        `**Role:** ${role.name}\n` +
        `**Target level:** ${targetLevel}\n` +
        `**Elevated:** ${updated}\n` +
        `**Already there:** ${alreadyThere}\n` +
        `**Failed:** ${failed}\n` +
        `**Total XP gifted:** ${totalGifted.toLocaleString()}\n` +
        `They now kneel exactly where you placed them... forever ♥`
    );
};

module.exports.about = {
    command: "mass-levelup",
    description: "Adds precisely the XP needed (using real Yuno formula) to bring every member in a role to a target level. No overflow. No mercy~ ♥",
    aliases: ["masslevel", "levelrole", "bulklevelup"],
    onlyMasterUsers: true,
    discord: true,
    list: true
};
