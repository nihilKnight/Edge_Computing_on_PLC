

use std::os::raw::*;
use crate::wa_interface::z_anm_detc_FUNCTION_BLOCK;
use std::mem;
use std::ptr;

#[repr(C)]
// Z Anomaly Detection State
struct ZADState {
    count: u64,
    mean: f64,
    m2: f64,
}

impl ZADState {
    fn new() -> Self {
        Self {
            count: 0,
            mean: 0.0,
            m2: 0.0,
        }
    }

    fn update(&mut self, x: f64) -> (f64, f64, f64, f64) {
        // Welford incremental algorithm
        self.count += 1;
        let delta = x - self.mean;
        self.mean += delta / self.count as f64;
        let delta2 = x - self.mean;
        self.m2 += delta * delta2;

        let variance = if self.count > 1 {
            self.m2 / self.count as f64
        } else {
            0.0
        };
        let std_dev = variance.sqrt();
        let z_score = if std_dev > 0.0 {
            (x - self.mean) / std_dev
        } else {
            0.0
        };
        (self.mean, variance, std_dev, z_score)
    }
}


/************* Function Block z_anm_detc *************/

#[no_mangle]
pub extern "C" fn __init_z_anm_detc(this: *mut z_anm_detc_FUNCTION_BLOCK) -> *const c_void {
    unsafe {
        // Allocate internal state on first initialisation
        let boxed_state = Box::new(ZADState::new());
        return Box::into_raw(boxed_state) as *const c_void;
    }
}

#[no_mangle]
pub extern "C" fn z_anm_detc(this: *mut z_anm_detc_FUNCTION_BLOCK, instance: *const c_void) {
    unsafe {
        // SAFETY: pointers provided by the runtime/PLC environment
        if this.is_null() {
            return;
        }

        // Obtain or create state pointer
        let state_ptr = if instance.is_null() {
            // allocate new state if PLC passes null (should not normally happen)
            Box::into_raw(Box::new(ZADState::new())) as *mut ZADState
        } else {
            instance as *mut ZADState
        };

        let fb = &mut *this;
        let state = &mut *state_ptr;

        // Update stats with current reading
        let x = (fb.temperature as f64 + fb.pressure as f64 + fb.humidity as f64) / 3.0;
        let (mean, var, std_dev, z) = state.update(x);

        fb.mean = mean as c_float;
        fb.variance = var as c_float;
        fb.standard_deviation = std_dev as c_float;
        fb.z_score = z as c_float;

    }
}

#[no_mangle]
pub extern "C" fn z_anm_detc_save(instance: *const c_void, buffer: *mut c_void, size: c_int) -> c_int {
    unsafe {
        if buffer.is_null() {
            return -1;
        }

        let required = mem::size_of::<ZADState>() as c_int;
        if size < required {
            return -1;
        }
        ptr::copy_nonoverlapping(instance as *const u8, buffer as *mut u8, required as usize);
        return required;
    }
}

#[no_mangle]
pub extern "C" fn z_anm_detc_store(instance: *const c_void, instance_data: *const c_void, size: c_int) -> bool {
    unsafe {
        if instance.is_null() || instance_data.is_null() {
            return false;
        }
        let expected = mem::size_of::<ZADState>() as c_int;
        if size != expected {
            return false;
        }
        ptr::copy_nonoverlapping(instance_data as *const u8, instance as *mut u8, expected as usize);
        return true;
    }
}
/*********** End Function Block z_anm_detc ***********/
