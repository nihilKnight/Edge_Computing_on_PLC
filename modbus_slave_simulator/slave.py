import math
import random
import time
import threading
from typing import List

# Import path changes for pymodbus >= 3.0
from pymodbus.server import StartTcpServer
from pymodbus.datastore import (
    ModbusServerContext,
    ModbusDeviceContext,
    ModbusSequentialDataBlock,
)
# In v3, ModbusDeviceIdentification is re-exported at top level
from pymodbus import ModbusDeviceIdentification


# --------------------------- Configuration ----------------------------------
HOST = "0.0.0.0"  # Listen on all interfaces
PORT = 5020        # Non-privileged default port for testing

# Register addresses (holding registers)
REG_TEMPERATURE = 0  # Temperature register address
REG_HUMIDITY = 1     # Humidity register address
REG_PRESSURE = 2     # Pressure register address

REGISTER_SCALE = 100  # Multiply sensor float by this factor before storing
UPDATE_PERIOD = 3.0   # Seconds between sensor updates

# ------------------------- Sensor Simulation --------------------------------

def generate_sensor_values(t: float) -> List[float]:
    """Generate synthetic temperature, humidity, and pressure readings.

    Parameters
    ----------
    t : float
        Elapsed time in seconds.

    Returns
    -------
    List[float]
        [temperature, humidity, pressure] values.
    """
    temperature = 25 + 5 * math.sin(2 * math.pi * (t / 60)) + random.uniform(-0.5, 0.5)
    humidity = 50 + 10 * math.sin(2 * math.pi * (t / 120)) + random.uniform(-1.0, 1.0)
    pressure = 101 + 2 * math.sin(2 * math.pi * (t / 180)) + random.uniform(-0.2, 0.2)
    return [temperature, humidity, pressure]


def updating_thread(context: ModbusServerContext, slave_id: int = 0) -> None:
    """Thread function to periodically update holding registers with sensor data."""
    start_time = time.time()
    while True:
        now = time.time() - start_time
        temperature, humidity, pressure = generate_sensor_values(now)
        values = [int(v * REGISTER_SCALE) for v in (temperature, humidity, pressure)]

        # print(f'[{time.strftime("%Y-%m-%d %H:%M:%S")}] Writing values: {values}')

        # Write values into holding registers
        context[slave_id].setValues(3, REG_TEMPERATURE, values)

        time.sleep(UPDATE_PERIOD)


# ---------------------------- Server Setup ----------------------------------

def run_server():
    """Configure and start the Modbus TCP server."""
    # Initialize data store with 10 holding registers.
    device = ModbusDeviceContext(
        hr=ModbusSequentialDataBlock(0, [0] * 10)
    )
    context = ModbusServerContext(device, single=True)

    # Start the sensor update thread
    thread = threading.Thread(target=updating_thread, args=(context,), daemon=True)
    thread.start()

    # Server identity (optional)
    identity = ModbusDeviceIdentification()
    identity.VendorName = "VirtualSensorCorp"
    identity.ProductCode = "VS"
    identity.VendorUrl = "https://example.com"
    identity.ProductName = "Virtual Sensor Modbus Slave"
    identity.ModelName = "VS-1000"
    identity.MajorMinorRevision = "1.0"

    print(f"Starting Modbus TCP Server on {HOST}:{PORT} ...")
    StartTcpServer(context, identity=identity, address=(HOST, PORT))


if __name__ == "__main__":
    run_server()
