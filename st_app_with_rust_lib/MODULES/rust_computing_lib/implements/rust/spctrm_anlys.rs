

use std::os::raw::*;
use crate::wa_interface::spctrm_anlys_FUNCTION_BLOCK;
use std::mem;
use std::ptr;

const SAMPLE_RATE_HZ: f64 = 20.0; // 50 ms cycle
const ALPHA: f64 = 0.1;           // smoothing factor for amplitude/frequency

#[derive(Copy, Clone)]
#[repr(C)]
struct SpectralState {
    // Running statistics
    count: u64,
    mean: f64,
    m2: f64, // not used but kept for future variance if needed

    // Amplitude & frequency estimation
    amp: f64,

    // cumulative frequency estimation
    crossings: u64,      // number of zero crossings (half cycles)
    samples_sum: u64,    // total samples between counted crossings

    envelope: f64,
    phase: f64,

    last_sign: i8,
    last_cross_idx: u64,
    freq: f64,
}

impl SpectralState {
    const fn new() -> Self {
        Self {
            count: 0,
            mean: 0.0,
            m2: 0.0,
            amp: 0.0,
            crossings: 0,
            samples_sum: 0,
            envelope: 0.0,
            phase: 0.0,
            last_sign: 0,
            last_cross_idx: 0,
            freq: 0.0,
        }
    }

    fn update(&mut self, x: f64) -> (f64, f64, f64, f64) {
        // dt = 1/sample_rate
        const DT: f64 = 1.0 / SAMPLE_RATE_HZ;

        // --- mean & variance via Welford ---
        self.count += 1;
        let delta = x - self.mean;
        self.mean += delta / self.count as f64;
        let delta2 = x - self.mean;
        self.m2 += delta * delta2;

        // --- envelope & amplitude ---
        let abs_dev = (x - self.mean).abs();
        // exponential decay envelope
        self.envelope *= 0.99;
        if abs_dev > self.envelope { self.envelope = abs_dev; }
        // convert to peak amplitude (~sqrt(2) for sine RMS), use factor 1.0 for simplicity
        self.amp = (1.0 - ALPHA) * self.amp + ALPHA * self.envelope;

        // --- frequency via zero-crossing count ---
        let centered = x - self.mean;
        let sign = if centered >= 0.0 { 1 } else { -1 };
        if self.last_sign != 0 && sign != self.last_sign {
            let samples_since = self.count - self.last_cross_idx;
            if samples_since > 1 {
                self.crossings += 1;
                self.samples_sum += samples_since;
                let period_samples = (self.samples_sum as f64) / (self.crossings as f64) * 2.0;
                self.freq = SAMPLE_RATE_HZ / period_samples;
            }
            self.last_cross_idx = self.count;
        }
        self.last_sign = sign;

        // --- phase advance ---
        self.phase = (self.phase + 2.0 * std::f64::consts::PI * self.freq * DT) % (2.0 * std::f64::consts::PI);

        (self.freq, self.amp, self.mean, self.phase)
    }
}

#[repr(C)]
struct SPAState {
    t: SpectralState,
    p: SpectralState,
    h: SpectralState,
}

impl SPAState {
    fn new() -> Self {
        Self {
            t: SpectralState::new(),
            p: SpectralState::new(),
            h: SpectralState::new(),
        }
    }
}

/************* Function Block spctrm_anlys *************/

#[no_mangle]
pub extern "C" fn __init_spctrm_anlys(_this: *mut spctrm_anlys_FUNCTION_BLOCK) -> *const c_void {
    let boxed = Box::new(SPAState::new());
    Box::into_raw(boxed) as *const c_void
}

#[no_mangle]
pub extern "C" fn spctrm_anlys(this: *mut spctrm_anlys_FUNCTION_BLOCK, instance: *const c_void) {
    unsafe {
        if this.is_null() { return; }
        let state_ptr = if instance.is_null() {
            Box::into_raw(Box::new(SPAState::new())) as *mut SPAState
        } else { instance as *mut SPAState };

        let fb = &mut *this;
        let state = &mut *state_ptr;

        let (tf, ta, toff, tph) = state.t.update(fb.temperature as f64);
        let (pf, pa, poff, pph) = state.p.update(fb.pressure as f64);
        let (hf, ha, hoff, hph) = state.h.update(fb.humidity as f64);

        fb.t_freq = tf as c_float;
        fb.t_ampl = ta as c_float;
        fb.t_offset = toff as c_float;
        fb.t_phase = tph as c_float;

        fb.p_freq = pf as c_float;
        fb.p_ampl = pa as c_float;
        fb.p_offset = poff as c_float;
        fb.p_phase = pph as c_float;

        fb.h_freq = hf as c_float;
        fb.h_ampl = ha as c_float;
        fb.h_offset = hoff as c_float;
        fb.h_phase = hph as c_float;
    }
}

#[no_mangle]
pub extern "C" fn spctrm_anlys_save(instance: *const c_void, buffer: *mut c_void, size: c_int) -> c_int {
    unsafe {
        if buffer.is_null() { return -1; }
        let required = mem::size_of::<SPAState>() as c_int;
        if size < required { return -1; }
        ptr::copy_nonoverlapping(instance as *const u8, buffer as *mut u8, required as usize);
        required
    }
}

#[no_mangle]
pub extern "C" fn spctrm_anlys_store(instance: *const c_void, instance_data: *const c_void, size: c_int) -> bool {
    unsafe {
        if instance.is_null() || instance_data.is_null() { return false; }
        let expected = mem::size_of::<SPAState>() as c_int;
        if size != expected { return false; }
        ptr::copy_nonoverlapping(instance_data as *const u8, instance as *mut u8, expected as usize);
        true
    }
}
/*********** End Function Block spctrm_anlys ***********/
