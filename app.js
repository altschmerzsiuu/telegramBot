require("dotenv").config(); // Load environment variables
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 3003;

// Ambil variabel dari .env
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIds = process.env.TELEGRAM_CHAT_IDS ? process.env.TELEGRAM_CHAT_IDS.split(",") : [];
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Pastikan semua variabel environment ada
if (!token || !supabaseUrl || !supabaseKey || chatIds.length === 0) {
    console.error("❌ Konfigurasi .env tidak lengkap! Periksa TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY, dan TELEGRAM_CHAT_IDS.");
    process.exit(1);
}

// Inisialisasi bot Telegram
const bot = new TelegramBot(token, { polling: true });

// Handle polling errors
bot.on("polling_error", (error) => {
    console.error("Polling error:", error);
});

// Middleware untuk parsing JSON
app.use(express.json());

// Koneksi ke Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Endpoint untuk menerima data UID dari ESP8266
app.post("/api/scan-rfid", async (req, res) => {
    const { uid } = req.body; // Ambil UID dari request body

    console.log(`📡 UID diterima dari ESP8266: ${uid}`);

    if (!uid) {
        return res.status(400).json({ error: "❌ UID tidak ditemukan dalam request" });
    }

    try {
        // Query ke Supabase berdasarkan RFID Code
        const { data, error } = await supabase
            .from("hewan")
            .select("*")
            .eq("rfid_code", uid)
            .maybeSingle(); // Gunakan maybeSingle() agar tidak error jika data kosong

        if (error) {
            throw new Error(`Supabase Error: ${error.message}`);
        }

        if (data) {
            // Format pesan ke Telegram
            const message = `🐄 *Data Hewan Ditemukan* 🐄\n\n` +
                            `📌 *Nama:* ${data.nama}\n` +
                            `🆔 *RFID:* ${data.rfid_code}\n` +
                            `⚖️ *Berat:* ${data.berat} kg\n` +
                            `💉 *Riwayat Vaksin:* ${data.riwayat_vaksin}\n` +
                            `🩺 *Kesehatan:* ${data.catatan_kesehatan}`;

            // Kirim ke semua chat ID yang terdaftar
            await Promise.all(chatIds.map(id => bot.sendMessage(id, message, { parse_mode: "Markdown" })));

            return res.status(200).json({ success: true, message: "✅ Data dikirim ke Telegram", data });
        } else {
            const notFoundMessage = `⚠️ Tidak ditemukan data untuk UID: ${uid}`;
            await Promise.all(chatIds.map(id => bot.sendMessage(id, notFoundMessage)));

            return res.status(404).json({ error: "❌ Data tidak ditemukan" });
        }
    } catch (error) {
        console.error("🔥 Error querying Supabase:", error.message);
        return res.status(500).json({ error: `❌ Terjadi kesalahan saat mengambil data: ${error.message}` });
    }
});

// Jalankan server
app.listen(port, () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
