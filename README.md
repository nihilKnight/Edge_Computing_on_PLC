# CPIPC Demo Project

This repository shows a small end-to-end pipeline:

1. **Python** program simulates sensors and exposes them through _Modbus TCP_.
2. **PLC** (Soft-PLC compiled to WASM) runs Structured-Text that calls high-performance **Rust Function-Blocks** for online statistics and spectrum analysis.
3. **Node / Browser** dashboard uses _OPC UA_ + _Socket.IO_ to visualise real-time data and predictions.

```
┌──────────────┐   Modbus TCP   ┌────────────────────┐   OPC UA   ┌─────────────────────┐
│ slave.py     │ ─────────────▶ │  PLC (Rust + ST)   │ ─────────▶ │  Web dashboard      │
│ 25 °C  etc.  │                │  running as WASM   │            │  (ECharts + Socket) │
└──────────────┘                └────────────────────┘            └─────────────────────┘
```

---

## 1. Directory layout

```
modbus_slave_simulator/
└─ slave.py               # synthetic sensors

st_app_with_rust_lib/
└─ MODULES/rust_computing_lib/
   ├─ implements/rust/    # you edit Rust FBs here
   └─ .MODULE/rust/wa_interface.rs  # auto-generated bridge – read-only

data_visualization_host/
└─ frontend-lite/
   ├─ public/             # static files (index.html, app.js, style.css)
   └─ server.js           # Express + Socket.IO gateway
```

---

## 2. Requirements

- **Python 3.10+** – simulator
- **Node 18+** – dashboard & OPC UA bridge
- **Rust 1.68+** – build WASM FBs (`wasm32-unknown-unknown` target)

### Install

```bash
pip install -r requirements.txt                 # pymodbus
cd data_visualization_host/frontend-lite
npm i                                           # express, socket.io, echarts …
```

---

## 3. Run the demo

### 3.1 Sensor & Modbus slave

```bash
python modbus_slave_simulator/slave.py          # listens on 0.0.0.0:5020
```

### 3.2 Compile Rust FBs (optional test)

```bash
cd st_app_with_rust_lib/MODULES/rust_computing_lib
cargo build --target wasm32-unknown-unknown --release
```

In a real PLC this WASM is loaded automatically; outside of PLC you may host it with Wasmtime for tests.

### 3.3 Web dashboard

```bash
cd data_visualization_host/frontend-lite
node server.js             # http://localhost:3000
```

Add a PLC endpoint (e.g. `opc.tcp://localhost:4840`), map variables, and start watching charts.

---

## 4. Rust Function-Blocks

| FB               | File                  | Purpose                                           |
| ---------------- | --------------------- | ------------------------------------------------- |
| simple_computing | `simple_computing.rs` | Incremental mean, variance, Z-score               |
| z_anm_detc       | `z_anm_detc.rs`       | 3-channel anomaly detection via Z-score           |
| spctrm_anlys     | `spctrm_anlys.rs`     | Online spectrum analysis (freq, amplitude, phase) |

Algorithms:

- **Welford** for variance (numerically stable).
- **Zero-crossing average** for ultra-low frequency estimation.
- **EWMA of variance** for amplitude (noise-robust).
- Phase derived from sample counter → no system-time dependency in WASM.

---

## 5. Frontend details (`public/app.js`)

- Uses **ECharts v5** – no build toolchain required.
- Real-time line chart (raw values) & prediction chart:
  - Red scatter – live data
  - Blue solid – fitted past
  - Blue dashed – 60 s forecast
- Dynamic Y-range with smoothing to avoid jitter.

---

## 6. Extending the demo

1. **Add sensors**: extend `slave.py`, regenerate interface, implement new FB.
2. **Better frequency**: replace zero-cross with Goertzel or Sliding DFT.
3. **Deploy**: containerise python+node; run WASM on real PLC or soft-PLC (open62541).

Enjoy experimenting! 🚀
