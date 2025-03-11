import paho.mqtt.client as mqtt
import sqlite3
import json

# Database connection
def get_db():
    conn = sqlite3.connect("iot_database.db")
    return conn

# Callback when message is received
def on_message(client, userdata, msg):
    try:
        message = msg.payload.decode("utf-8")

        # Attempt to parse JSON
        data = json.loads(message)
        
        # Ensure all required fields exist
        required_keys = {"device_id", "device_timestamp", "temperature", "voltage", "current", "watts"}
        if not required_keys.issubset(data.keys()):
            print(f"❌ Missing required keys in JSON: {data.keys()}")
            return

        # Extract data
        device_id = data["device_id"]
        device_timestamp = data["device_timestamp"]
        temperature = data["temperature"]
        voltage = data["voltage"]
        current = data["current"]
        watts = data["watts"]

        # Check if the data is a **single reading** (not a list)
        if isinstance(device_timestamp, str):
            device_timestamp = [device_timestamp]
            temperature = [temperature]
            voltage = [voltage]
            current = [current]
            watts = [watts]

        # Ensure all lists have the same length
        num_readings = len(device_timestamp)
        if not all(len(lst) == num_readings for lst in [temperature, voltage, current, watts]):
            print("❌ Mismatch in the number of readings across different fields.")
            return

        # Insert each reading into database
        conn = get_db()
        cursor = conn.cursor()

        for i in range(num_readings):
            cursor.execute("""
                INSERT INTO sensor_data (device_id, device_timestamp, temperature, voltage, current, watts)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (device_id, device_timestamp[i], temperature[i], voltage[i], current[i], watts[i]))

        conn.commit()
        conn.close()
        print(f"✅ {num_readings} data entries successfully inserted into database!")

    except json.JSONDecodeError:
        print(f"❌ Invalid JSON format: {message}")
    except Exception as e:
        print(f"❌ Error processing message: {e}")

# MQTT Configuration
MQTT_BROKER = "129.151.218.246"
MQTT_PORT = 1883
MQTT_TOPIC = "sensor/data"

client = mqtt.Client()
client.on_message = on_message

# Connect and subscribe
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.subscribe(MQTT_TOPIC)

print(f"📡 Listening for messages on topic: {MQTT_TOPIC}")
client.loop_forever()
