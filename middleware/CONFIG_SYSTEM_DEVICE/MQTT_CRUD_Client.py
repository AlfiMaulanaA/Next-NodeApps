import json
import time
import paho.mqtt.client as mqtt
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("MQTT_CRUD_Client")

class MQTT_CRUD_Client:
    def __init__(self, broker="localhost", port=1883):
        self.broker = broker
        self.port = port
        self.client = mqtt.Client(client_id="crud_test_client", clean_session=True)
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        self.responses = {}

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("Terhubung ke MQTT broker")
            # Subscribe ke semua response topics
            client.subscribe("response/data/#")
        else:
            logger.error(f"Gagal terhubung ke broker, kode: {rc}")

    def on_disconnect(self, client, userdata, rc):
        logger.warning(f"Terputus dari broker, kode: {rc}")

    def on_message(self, client, userdata, msg):
        logger.info(f"Pesan diterima dari topik {msg.topic}: {msg.payload.decode()}")
        try:
            response = json.loads(msg.payload.decode())
            self.responses[msg.topic] = response
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response: {e}")

    def connect(self):
        try:
            self.client.connect(self.broker, self.port, 60)
            self.client.loop_start()
            time.sleep(1)  # Tunggu koneksi
            return True
        except Exception as e:
            logger.error(f"Gagal terhubung: {e}")
            return False

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()

    def wait_for_response(self, topic, timeout=5):
        """Tunggu response dari topik tertentu"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if topic in self.responses:
                response = self.responses.pop(topic)
                return response
            time.sleep(0.1)
        return None

    # CRUD Operations
    def create_payload(self, topic, data, interval=10, qos=0, lwt=True, retain=False):
        """CREATE: Tambah payload baru"""
        command = {
            "command": "writeData",
            "data": {
                "topic": topic,
                "data": data
            },
            "interval": interval,
            "qos": qos,
            "lwt": lwt,
            "retain": retain
        }

        logger.info(f"Mengirim perintah CREATE untuk topik: {topic}")
        self.client.publish("command/data/payload", json.dumps(command))

        response = self.wait_for_response("response/data/write")
        return response

    def read_payloads(self):
        """READ: Baca semua payload"""
        command = {
            "command": "getData"
        }

        logger.info("Mengirim perintah READ untuk semua payload")
        self.client.publish("command/data/payload", json.dumps(command))

        response = self.wait_for_response("response/data/payload")
        return response

    def update_payload(self, topic, data, interval=None, qos=None, lwt=None, retain=None):
        """UPDATE: Update payload berdasarkan topik"""
        command = {
            "command": "updateData",
            "topic": topic,
            "data": data
        }

        if interval is not None:
            command["interval"] = interval
        if qos is not None:
            command["qos"] = qos
        if lwt is not None:
            command["lwt"] = lwt
        if retain is not None:
            command["retain"] = retain

        logger.info(f"Mengirim perintah UPDATE untuk topik: {topic}")
        self.client.publish("command/data/payload", json.dumps(command))

        response = self.wait_for_response("response/data/update")
        return response

    def delete_payload(self, topic):
        """DELETE: Hapus payload berdasarkan topik"""
        command = {
            "command": "deleteData",
            "topic": topic
        }

        logger.info(f"Mengirim perintah DELETE untuk topik: {topic}")
        self.client.publish("command/data/payload", json.dumps(command))

        response = self.wait_for_response("response/data/delete")
        return response

    def get_metrics(self):
        """GET METRICS: Ambil data performa"""
        # Metrics request menggunakan topik langsung, bukan command payload
        logger.info("Mengirim request GET METRICS")
        self.client.publish("command/data/metrics", "{}")  # Empty payload untuk trigger

        response = self.wait_for_response("response/data/metrics")
        return response


def print_menu():
    print("\n" + "="*50)
    print("======== MQTT CRUD CLIENT ========")
    print("="*50)
    print("1. CREATE - Tambah Payload Baru")
    print("2. READ   - Baca Semua Payload")
    print("3. UPDATE - Update Payload")
    print("4. DELETE - Hapus Payload")
    print("5. METRICS- Lihat Performa")
    print("6. EXIT   - Keluar")
    print("="*50)


def demo_crud_operations():
    """Demo operasi CRUD"""
    client = MQTT_CRUD_Client()

    if not client.connect():
        logger.error("Tidak dapat terhubung ke broker MQTT")
        return

    try:
        print("\n=== DEMO OPERASI CRUD ===")

        # 1. CREATE
        print("\n1. CREATE - Menambah payload baru...")
        test_data = {
            "temperature": 25.5,
            "humidity": 60,
            "device_id": "demo_sensor_001"
        }
        create_response = client.create_payload("demo/sensor/001", test_data, interval=5)
        print(f"Response CREATE: {json.dumps(create_response, indent=2)}")

        time.sleep(1)

        # 2. READ
        print("\n2. READ - Membaca semua payload...")
        read_response = client.read_payloads()
        print(f"Response READ: {json.dumps(read_response, indent=2)}")

        time.sleep(1)

        # 3. UPDATE
        print("\n3. UPDATE - Mengupdate payload...")
        update_data = [
            {"key": "temperature", "value": 28.3},
            {"key": "humidity", "value": 65},
            {"key": "device_id", "value": "demo_sensor_001_updated"}
        ]
        update_response = client.update_payload("demo/sensor/001", update_data, interval=10)
        print(f"Response UPDATE: {json.dumps(update_response, indent=2)}")

        time.sleep(1)

        # 4. READ lagi untuk verifikasi
        print("\n4. READ - Verifikasi update...")
        read_response2 = client.read_payloads()
        print(f"Response READ setelah update: {json.dumps(read_response2, indent=2)}")

        time.sleep(1)

        # 5. METRICS
        print("\n5. METRICS - Melihat performa...")
        metrics_response = client.get_metrics()
        print(f"Response METRICS: {json.dumps(metrics_response, indent=2)}")

        time.sleep(1)

        # 6. DELETE
        print("\n6. DELETE - Menghapus payload...")
        delete_response = client.delete_payload("demo/sensor/001")
        print(f"Response DELETE: {json.dumps(delete_response, indent=2)}")

        print("\n=== DEMO SELESAI ===")

    except Exception as e:
        logger.error(f"Error dalam demo: {e}")
    finally:
        client.disconnect()


def interactive_mode():
    """Mode interaktif untuk testing manual"""
    client = MQTT_CRUD_Client()

    if not client.connect():
        logger.error("Tidak dapat terhubung ke broker MQTT")
        return

    try:
        while True:
            print_menu()
            choice = input("Pilih operasi (1-6): ").strip()

            if choice == "1":
                # CREATE
                topic = input("Masukkan topik: ").strip()
                data_input = input("Masukkan data JSON: ").strip()
                try:
                    data = json.loads(data_input)
                    interval = int(input("Interval (detik, default 10): ").strip() or "10")
                    qos = int(input("QoS (0-2, default 0): ").strip() or "0")
                    lwt = input("LWT (true/false, default true): ").strip().lower() == "true"
                    retain = input("Retain (true/false, default false): ").strip().lower() == "true"

                    response = client.create_payload(topic, data, interval, qos, lwt, retain)
                    print(f"\nResponse: {json.dumps(response, indent=2)}")
                except json.JSONDecodeError:
                    print("Error: Data JSON tidak valid")
                except ValueError:
                    print("Error: Input tidak valid")

            elif choice == "2":
                # READ
                response = client.read_payloads()
                print(f"\nResponse: {json.dumps(response, indent=2)}")

            elif choice == "3":
                # UPDATE
                topic = input("Masukkan topik yang akan diupdate: ").strip()
                data_input = input("Masukkan data update JSON array: ").strip()
                try:
                    data = json.loads(data_input)
                    interval_input = input("Interval baru (kosongkan jika tidak diubah): ").strip()
                    interval = int(interval_input) if interval_input else None

                    response = client.update_payload(topic, data, interval=interval)
                    print(f"\nResponse: {json.dumps(response, indent=2)}")
                except json.JSONDecodeError:
                    print("Error: Data JSON tidak valid")
                except ValueError:
                    print("Error: Input tidak valid")

            elif choice == "4":
                # DELETE
                topic = input("Masukkan topik yang akan dihapus: ").strip()
                response = client.delete_payload(topic)
                print(f"\nResponse: {json.dumps(response, indent=2)}")

            elif choice == "5":
                # METRICS
                response = client.get_metrics()
                print(f"\nResponse: {json.dumps(response, indent=2)}")

            elif choice == "6":
                # EXIT
                break

            else:
                print("Pilihan tidak valid!")

            input("\nTekan Enter untuk melanjutkan...")

    except KeyboardInterrupt:
        print("\n\nKeluar dari program...")
    except Exception as e:
        logger.error(f"Error dalam mode interaktif: {e}")
    finally:
        client.disconnect()


if __name__ == "__main__":
    print("MQTT CRUD Client untuk PayloadStatic Service")
    print("Pilih mode:")
    print("1. Demo Otomatis")
    print("2. Mode Interaktif")

    mode = input("Pilih mode (1/2): ").strip()

    if mode == "1":
        demo_crud_operations()
    elif mode == "2":
        interactive_mode()
    else:
        print("Mode tidak valid!")
