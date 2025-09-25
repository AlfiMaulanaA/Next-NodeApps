7. Analisa pada halaman /settings/system MQTT Broker yang digunakan untuk aplikasi ini tidak muncul dicard MQTT Broker, seharusnya muncul dari pilihan MQTT Connection Mode baik dari ENV file atau dari Database. Yang muncul saat ini hanyalah Status Disconnected, Connected No, Name : Current Active Configuration, Broker : Manage by MQTT Client.
   seharusnya broker dan statusnya dimunculkan sesuai dengan MQTT Connction mode

Modifikasi file deploy.sh untuk fitur deploy aplikasi ini ke server

1. Buat pengecekan untuk package dan Library Dulu, lakukan pengecekan untuk Library, mosquitto, ngnix, node, pm2 dan jika ada yang belum terinstall maka install tersebut dahulu hingga benar benar semuanya terinstall. Tapi jika ada yang gagal terus bisa skip saja
2. Lakukan command untuk npm install lalu npm build untuk membuild frontend ini lalu running di pm2 jika berhasil, jika gagal skip saja dan bisa lanjut ke step ke 3.
3. buat konfigurasi agar frontend ini menggunakan proxy reverve nginx dari port 3000 ke 8080
4. Buat konfigurasi untuk pindahkan file dari /middleware/SERVICE_FILE/multiprocessing.service ke /etc/systemd/system dan aktifkan servicenya.
5. Buat resume apa saja yang berhasil berapa portnya dll, dan buat handling jika gagal disalah satu stepnya maka skip dan lanjutkan ke step berikutnya.
6. Buat kan fitur tersebut dan modifikasi file deploy.sh
