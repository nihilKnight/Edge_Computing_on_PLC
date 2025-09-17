use std::os::raw::*;


/************* Function Block z_anm_detc *************/
#[repr(C)]
pub struct z_anm_detc_FUNCTION_BLOCK {
  pub temperature: c_float, // VAR_INPUT
  pub pressure: c_float, // VAR_INPUT
  pub humidity: c_float, // VAR_INPUT
  pub mean: c_float, // VAR_OUTPUT
  pub variance: c_float, // VAR_OUTPUT
  pub standard_deviation: c_float, // VAR_OUTPUT
  pub z_score: c_float, // VAR_OUTPUT
}

/*********** End Function Block z_anm_detc ***********/
