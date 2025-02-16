require("dotenv").config(); // Load environment variables
const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

const app = express();
const port = 3003;

// Ambil variabel dari .env
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIds = process.env.TELEGRAM_CHAT_IDS.split(","); // Konversi string ke array
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Inisialisasi bot Telegram
const bot = new TelegramBot(token, { polling: true });

// Middleware untuk parsing JSON
app.use(bodyParser.json());

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
            .single(); // Ambil satu data

        if (error) throw error;

        if (data) {
            // Format pesan ke Telegram
            const message = `🐄 *Data Hewan Ditemukan* 🐄\n\n` +
                            `📌 *Nama:* ${data.nama}\n` +
                            `🆔 *RFID:* ${data.rfid_code}\n` +
                            `⚖️ *Berat:* ${data.berat} kg\n` +
                            `💉 *Riwayat Vaksin:* ${data.riwayat_vaksin}\n` +
                            `🩺 *Kesehatan:* ${data.catatan_kesehatan}`;

            // Kirim ke semua chat ID yang terdaftar
            for (let id of chatIds) {
                await bot.sendMessage(id, message, { parse_mode: "Markdown" });
            }

            return res.status(200).json({ success: true, message: "✅ Data dikirim ke Telegram", data });
        } else {
            for (let id of chatIds) {
                await bot.sendMessage(id, `⚠️ Tidak ditemukan data untuk UID: ${uid}`);
            }
            return res.status(404).json({ error: "❌ Data tidak ditemukan" });
        }
    } catch (error) {
        console.error("🔥 Error querying Supabase:", error);
        return res.status(500).json({ error: "❌ Terjadi kesalahan saat mengambil data" });
    }
});

// Jalankan server
app.listen(port, () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
});

// k@EJB5paJUG6Bd*