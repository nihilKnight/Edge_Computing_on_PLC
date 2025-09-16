

use std::os::raw::*;
use crate::wa_interface::simple_computing_FUNCTION_BLOCK;

/************* Function Block simple_computing *************/

#[no_mangle]
pub extern "C" fn __init_simple_computing(this: *mut simple_computing_FUNCTION_BLOCK) -> *const c_void {
    unsafe {

    }

    std::ptr::null()
}

#[no_mangle]
pub extern "C" fn simple_computing(this: *mut simple_computing_FUNCTION_BLOCK, instance: *const c_void) {
    unsafe {

    }
}

#[no_mangle]
pub extern "C" fn simple_computing_save(instance: *const c_void, buffer: *mut c_void, size: c_int) -> c_int {
    unsafe {

    }

    0
}

#[no_mangle]
pub extern "C" fn simple_computing_store(instance: *const c_void, instance_data: *const c_void, size: c_int) -> bool {
    unsafe {

    }

    true
}
/*********** End Function Block simple_computing ***********/
