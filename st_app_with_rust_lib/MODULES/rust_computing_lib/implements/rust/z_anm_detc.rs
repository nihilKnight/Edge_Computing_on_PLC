

use std::os::raw::*;
use crate::wa_interface::z_anm_detc_FUNCTION_BLOCK;

/************* Function Block z_anm_detc *************/

#[no_mangle]
pub extern "C" fn __init_z_anm_detc(this: *mut z_anm_detc_FUNCTION_BLOCK) -> *const c_void {
    unsafe {

    }

    std::ptr::null()
}

#[no_mangle]
pub extern "C" fn z_anm_detc(this: *mut z_anm_detc_FUNCTION_BLOCK, instance: *const c_void) {
    unsafe {

    }
}

#[no_mangle]
pub extern "C" fn z_anm_detc_save(instance: *const c_void, buffer: *mut c_void, size: c_int) -> c_int {
    unsafe {

    }

    0
}

#[no_mangle]
pub extern "C" fn z_anm_detc_store(instance: *const c_void, instance_data: *const c_void, size: c_int) -> bool {
    unsafe {

    }

    true
}
/*********** End Function Block z_anm_detc ***********/
