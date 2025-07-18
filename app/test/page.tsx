"use client"; // Ini menandakan bahwa komponen ini adalah Client Component di Next.js

import React, { useEffect, useState, useRef } from 'react';
import PahoMQTT from 'paho-mqtt'; // Pastikan Anda sudah menginstal paho-mqtt

function MqttConnectionManager() {
  // State untuk melacak status koneksi MQTT
  const [mqttConnected, setMqttConnected] = useState(false);
  // State untuk melacak pesan log agar bisa ditampilkan di UI
  const [logs, setLogs] = useState([]);
  // Menggunakan useRef untuk menyimpan instance klien MQTT agar tidak dibuat ulang setiap render
  const mqttClientRef = useRef(null);

  // Fungsi untuk menambahkan log ke state
  const addLog = (message) => {
    setLogs((prevLogs) => [...prevLogs, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  useEffect(() => {
    // URL broker MQTT diambil dari environment variable Next.js atau default
    // Ganti 'ws://broker.hivemq.com:8000' dengan URL broker MQTT WebSocket Anda yang sebenarnya
    const mqttBrokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || 'ws://broker.hivemq.com:8000';
    
    // Client ID unik
    const clientId = `client-nextjs-anon-${new Date().getTime()}`;
    
    // Topik langganan (gunakan topik umum untuk demo)
    const generalTopic = "general/status"; // Contoh topik umum

    addLog(`Mencoba koneksi ke: ${mqttBrokerUrl}/mqtt`);
    addLog(`Client ID: ${clientId}`);
    addLog(`Topik Langganan: ${generalTopic}`);

    // Buat instance klien Paho MQTT
    const client = new PahoMQTT.Client(
      `${mqttBrokerUrl}/mqtt`, // Sesuaikan path jika broker Anda tidak menggunakan /mqtt
      clientId
    );

    // Simpan instance klien di ref agar bisa diakses di cleanup
    mqttClientRef.current = client;

    // --- Callbacks Koneksi ---
    client.onConnectionLost = (responseObject) => {
      if (responseObject.errorCode !== 0) {
        addLog(`Koneksi terputus: ${responseObject.errorMessage}`);
        setMqttConnected(false); // Perbarui state koneksi

        // Coba menyambung ulang secara otomatis
        addLog("Mencoba menyambung ulang MQTT...");
        client.connect({
          onSuccess: () => {
            setMqttConnected(true);
            addLog("MQTT Berhasil Terhubung Kembali! ✨");
            // Berlangganan kembali ke topik setelah reconnect
            client.subscribe(generalTopic);
            addLog("Berlangganan kembali ke topik: " + generalTopic);
          },
          onFailure: (err) => {
            addLog(`Gagal menyambung ulang MQTT: ${err.errorMessage}`);
            setMqttConnected(false);
          }
        });
      }
    };

    // Handler untuk pesan masuk (kita akan log pesan untuk demo UI)
    client.onMessageArrived = (message) => {
      addLog(`Pesan Diterima di Topik '${message.destinationName}': ${message.payloadString}`);
      // Logika penanganan pesan lainnya bisa ditambahkan di sini
    };

    // --- Inisialisasi Koneksi Awal ---
    addLog("Mencoba koneksi MQTT awal...");
    client.connect({
      onSuccess: () => {
        setMqttConnected(true);
        addLog("MQTT Berhasil Terhubung! ✅");
        // Berlangganan ke topik setelah koneksi berhasil
        client.subscribe(generalTopic);
        addLog("Berlangganan ke topik: " + generalTopic);
      },
      onFailure: (err) => {
        addLog(`Gagal koneksi MQTT awal: ${err.errorMessage}`);
        setMqttConnected(false);
      }
    });

    // --- Fungsi Cleanup (PENTING!) ---
    return () => {
      // Pastikan klien ada dan terhubung sebelum memutuskan koneksi
      if (mqttClientRef.current && mqttClientRef.current.isConnected()) {
        addLog("Memutuskan koneksi MQTT saat komponen di-unmount.");
        mqttClientRef.current.disconnect();
      }
    };
  }, []); // Dependency array kosong

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: 'auto', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>Manajer Koneksi MQTT</h2>
      <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          backgroundColor: mqttConnected ? '#e6ffe6' : '#ffe6e6',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#555' }}>Status Koneksi:</h3>
        <p style={{ 
            fontSize: '1.2em', 
            fontWeight: 'bold', 
            color: mqttConnected ? 'green' : 'red' 
        }}>
          {mqttConnected ? 'TERHUBUNG ✅' : 'TERPUTUS ❌'}
        </p>
      </div>

      <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '15px', 
          backgroundColor: '#f9f9f9',
          maxHeight: '300px',
          overflowY: 'auto',
          boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#555' }}>Log Koneksi:</h3>
        <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
          {logs.map((log, index) => (
            <li key={index} style={{ marginBottom: '5px', fontSize: '0.9em', color: '#666' }}>
              {log}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default MqttConnectionManager;
