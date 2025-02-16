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

// Inisialisasi bot Telegram tanpa polling
const bot = new TelegramBot(token, { polling: false });

// Middleware untuk parsing JSON
app.use(express.json());

// Koneksi ke Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔹 MENU UTAMA TELEGRAM
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            keyboard: [
                ["📡 Scan RFID", "🔍 Lihat Data"],
                ["✏️ Edit Data", "🗑 Hapus Data"]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    bot.sendMessage(chatId, "⚡ Pilih tindakan:", { ...options });
});

// 🔹 API UNTUK MENERIMA RFID DARI ESP8266 DAN MENYIMPAN WAKTU SCAN
app.post("/api/scan-rfid", async (req, res) => {
    const { uid } = req.body;
    console.log(`📡 UID diterima dari ESP8266: ${uid}`);

    if (!uid) {
        return res.status(400).json({ error: "❌ UID tidak ditemukan dalam request" });
    }

    try {
        // Query ke Supabase berdasarkan UID
        const { data, error } = await supabase
            .from("hewan")
            .select("*")
            .eq("id", uid)
            .maybeSingle();

        if (error) throw new Error(`Supabase Error: ${error.message}`);

        if (data) {
            // Update last_scanned timestamp di Supabase
            await supabase
                .from("hewan")
                .update({ last_scanned: new Date().toISOString() })
                .eq("id", uid);

            // Set waktu sesuai dengan zona waktu Balikpapan (Asia/Makassar)
            const waktuTerakhir = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" });

            const message = `🐄 *Data Hewan Ditemukan* 🐄\n\n` +
                `📌 *Nama:* ${data.nama}\n` +
                `🆔 *RFID:* ${data.id}\n` +
                `⚖️ *Jenis:* ${data.jenis}\n` +
                `💉 *Usia:* ${data.usia} tahun\n` +
                `🩺 *Kesehatan:* ${data.status_kesehatan || "Tidak ada catatan"}\n` +
                `⏳ *Terakhir Scan:* ${waktuTerakhir}`;

            // Kirim data ke semua chat ID
            await Promise.all(chatIds.map(id => bot.sendMessage(id, message, { parse_mode: "Markdown" })));

            return res.status(200).json({ success: true, message: "✅ Data dikirim ke Telegram & waktu diperbarui", data });
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

// 🔹 JALANKAN SERVER
app.listen(port, () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
