import { Event } from "../lib/Event";

export default new Event("ready", () => {
    console.log("Bot is online");
});