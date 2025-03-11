-- Users Table (Authentication)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Devices Table (Pre-registered IoT devices)
CREATE TABLE devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    device_key TEXT NOT NULL
);

-- User-Device Mapping (Which user claims which device)
CREATE TABLE user_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    claimed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- Sensor Data Table (Stores IoT Readings)
CREATE TABLE sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    device_timestamp TEXT NOT NULL,
    temperature REAL NOT NULL,
    voltage REAL NOT NULL,
    current REAL NOT NULL,
    watts REAL NOT NULL,
    db_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);
