# Dashboard Analisa Anggaran & Kinerja - Dinas PU Bina Marga Provinsi Jawa Timur

Executive Portal & Dashboard Analisis Anggaran interaktif untuk memvisualisasikan alokasi anggaran, tren pertumbuhan tahunan, penyerapan anggaran, dan capaian target kinerja secara real-time.

## 🚀 Fitur Utama

- **Ringkasan**: Visualisasi KPI keuangan, grafik Realisasi Pagu Anggaran tahunan (2021–2026), proporsi unit kerja, serta hierarki program.
- **Anggaran**:
  - **Pagu Anggaran**: Analisis pagu berdasarkan jenis anggaran (APBD / P-APBD) dan daftar pagu anggaran.
  - **Realisasi**: Analisis penyerapan anggaran per unit kerja (Bidang/UPT) dan penyerapan per program.
- **Program**: Pemetaan dan rincian alokasi program, kegiatan, dan subkegiatan.
- **Kinerja**: Monitoring indikator kinerja (Tujuan dan Sasaran Strategis) periode 2019–2030, termasuk indikator RPD 2025.
- **Laporan & Ekspor**: Ringkasan eksekutif, analisis konsentrasi, tren pertumbuhan, dan fitur ekspor CSV.

## 🛠️ Teknologi

- HTML5 & CSS3 (Custom Modern UI, Bootstrap 5)
- JavaScript (ES6+)
- [Chart.js](https://www.chartjs.org/) untuk visualisasi grafik interaktif
- Bootstrap Icons

## 📂 Struktur Project

```text
├── index.html                 # Halaman utama dashboard
├── style.css                  # Desain & styling custom
├── app.js                     # Logika dashboard, chart renderers & event handlers
├── budget_data.js             # Dataset anggaran & realisasi
├── Database Anggaran.xlsx     # Sumber data spreadsheet
├── Desain Dashboard/          # Aset desain & referensi UI
└── .gitignore                 # Konfigurasi ignore file Git
```

## 💻 Cara Menjalankan

Buka file `index.html` secara langsung di browser atau gunakan local web server (misalnya Live Server di VS Code).
